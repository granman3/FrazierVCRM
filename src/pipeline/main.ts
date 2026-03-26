import { eq, and, gt, isNull } from "drizzle-orm";
import { loadConfig } from "../lib/config";
import { getDb, closeDb } from "../db";
import { logger } from "../lib/logger";
import { vips, outreachLog, runs } from "../db/schema";
import { syncICloudContacts } from "./sync/icloud";
import { syncGoogleContacts } from "./sync/google";
import { classifyNewContacts } from "./classify";
import { detectJobChange, fetchCompanyNews, isExciting } from "./monitor";
import { generateDraft, sendDigest, type DigestEntry } from "./digest";

async function main() {
  const config = loadConfig();
  const db = getDb(config.DATABASE_URL);

  // Create run record
  const [run] = await db.insert(runs).values({ status: "running" }).returning();

  try {
    // ── Step 1: Sync contacts ──────────────────────────────────────────
    let contactsSynced = 0;

    if (config.ICLOUD_USERNAME && config.ICLOUD_APP_PASSWORD) {
      const count = await syncICloudContacts(
        db,
        config.ICLOUD_USERNAME,
        config.ICLOUD_APP_PASSWORD
      );
      logger.info(`Synced ${count} iCloud contacts`);
      contactsSynced += count;
    }

    if (config.GOOGLE_ACCESS_TOKEN) {
      const count = await syncGoogleContacts(db, config.GOOGLE_ACCESS_TOKEN);
      logger.info(`Synced ${count} Google contacts`);
      contactsSynced += count;
    }

    // ── Step 2: Classify new contacts ──────────────────────────────────
    const newVips = await classifyNewContacts(
      db,
      config.DEEPSEEK_API_KEY,
      config.VIP_AUTO_APPROVE_THRESHOLD
    );
    logger.info(`Classified ${newVips} new VIPs`);

    // ── Step 3: Process active VIPs ────────────────────────────────────
    const activeVips = await db.query.vips.findMany({
      where: and(eq(vips.active, true), isNull(vips.removedAt)),
      with: { contact: true },
    });

    logger.info(`Processing ${activeVips.length} active VIPs`);

    const cooldownDate = new Date();
    cooldownDate.setDate(cooldownDate.getDate() - config.COOLDOWN_DAYS);

    const digestEntries: DigestEntry[] = [];

    for (const vip of activeVips) {
      if (!vip.contact) continue;

      try {
        // Check for job changes
        let jobChange = null;
        if (config.PROXYCURL_API_KEY && vip.contact.linkedinUrl) {
          jobChange = await detectJobChange(
            config.PROXYCURL_API_KEY,
            vip.contact.linkedinUrl,
            vip.contact.company,
            vip.contact.title
          );
        }

        // Fetch news
        const news = vip.contact.company
          ? await fetchCompanyNews(vip.contact.company, config.BING_NEWS_API_KEY)
          : [];
        const excitingNews = news.filter(isExciting);

        // Skip if no signal
        if (!jobChange && excitingNews.length === 0) continue;

        // Skip if contacted recently
        const recentOutreach = await db.query.outreachLog.findFirst({
          where: and(
            eq(outreachLog.contactId, vip.contact.id),
            gt(outreachLog.sentAt, cooldownDate)
          ),
        });
        if (recentOutreach) continue;

        // Generate draft
        const draft = await generateDraft(
          {
            contactName: vip.contact.fullName,
            contactCompany: vip.contact.company || undefined,
            jobChange: jobChange || undefined,
            news: excitingNews[0]
              ? { headline: excitingNews[0].headline, url: excitingNews[0].url }
              : undefined,
          },
          config.DEEPSEEK_API_KEY
        );

        // Log outreach
        await db.insert(outreachLog).values({
          contactId: vip.contact.id,
          triggerType: jobChange ? "job_change" : "news",
          draftText: draft,
        });

        digestEntries.push({
          contactName: vip.contact.fullName,
          contactTitle: vip.contact.title,
          contactCompany: vip.contact.company,
          contactEmail: vip.contact.email,
          trigger: jobChange ? "job_change" : "news",
          newsHeadline: excitingNews[0]?.headline,
          draft,
        });
      } catch (error) {
        logger.error({ err: error, vip: vip.contact.fullName }, "Error processing VIP");
      }
    }

    // ── Step 4: Send digest ────────────────────────────────────────────
    if (digestEntries.length > 0 && config.RESEND_API_KEY && config.RESEND_FROM_EMAIL) {
      await sendDigest(
        digestEntries,
        config.DIGEST_TO_EMAIL,
        config.RESEND_API_KEY,
        config.RESEND_FROM_EMAIL
      );
      logger.info(`Sent digest with ${digestEntries.length} entries to ${config.DIGEST_TO_EMAIL}`);
    } else if (digestEntries.length > 0) {
      logger.info(`${digestEntries.length} drafts generated (Resend not configured)`);
    } else {
      logger.info("No signals detected today");
    }

    // ── Update run ─────────────────────────────────────────────────────
    await db
      .update(runs)
      .set({
        status: "success",
        finishedAt: new Date(),
        contactsSynced,
        vipsProcessed: activeVips.length,
        draftsCreated: digestEntries.length,
      })
      .where(eq(runs.id, run.id));

    logger.info("Pipeline complete");
  } catch (error) {
    logger.error({ err: error }, "Pipeline failed");

    await db
      .update(runs)
      .set({
        status: "failed",
        finishedAt: new Date(),
        errorSummary: error instanceof Error ? error.message : "Unknown error",
      })
      .where(eq(runs.id, run.id));

    process.exitCode = 1;
  } finally {
    await closeDb();
  }
}

main();
