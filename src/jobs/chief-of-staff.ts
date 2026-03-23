import type { Job } from "pg-boss";
import { db } from "@/db";
import {
  tenants,
  vipList,
  contactsMerged,
  automationRuns,
  outreachLog,
  newsItems,
  integrationSecrets,
} from "@/db/schema";
import { eq, and, isNull, gt } from "drizzle-orm";
import type { ChiefOfStaffJob } from "./types";
import { daysAgo } from "@/lib/utils";
import { fetchCompanyNews, isExcitingNews, NewsItem as NewsItemType } from "@/lib/news";
import { detectJobChange, ProxycurlCredentials } from "@/lib/proxycurl";
import { generateDraft } from "@/lib/deepseek";
import { decryptSecretJSON } from "@/lib/encryption";

export async function handleChiefOfStaff(job: Job<ChiefOfStaffJob>) {
  const { tenantId } = job.data;

  console.log(`Starting chief-of-staff loop for tenant ${tenantId}`);

  // Create run record
  const [run] = await db
    .insert(automationRuns)
    .values({
      tenantId,
      workflowName: "chief-of-staff",
      status: "running",
    })
    .returning();

  try {
    // Get active VIPs with contact data
    const vips = await db.query.vipList.findMany({
      where: and(eq(vipList.tenantId, tenantId), isNull(vipList.removedAt)),
      with: {
        contact: true,
      },
    });

    if (vips.length === 0) {
      console.log("No VIPs to process");
      await db
        .update(automationRuns)
        .set({
          status: "success",
          finishedAt: new Date(),
          vipsConsidered: 0,
        })
        .where(eq(automationRuns.id, run.id));
      return;
    }

    console.log(`Processing ${vips.length} VIPs`);

    const draftsToSend: DraftItem[] = [];
    let skippedNoSignal = 0;

    for (const vip of vips) {
      if (!vip.contact) continue;

      try {
        // Check for job changes
        const jobChange = await detectJobChangeForContact(tenantId, vip.contact);

        // Check for news
        const news = await fetchNewsForCompany(vip.contact.company || "");

        // Apply hype filter
        const excitingNews = news.filter((n) => isExciting(n));

        // Skip if no signal
        if (!jobChange && excitingNews.length === 0) {
          skippedNoSignal++;
          continue;
        }

        // Check if already contacted recently
        const recentOutreach = await db.query.outreachLog.findFirst({
          where: and(
            eq(outreachLog.tenantId, tenantId),
            eq(outreachLog.contactId, vip.contact.id),
            gt(outreachLog.draftSentAt, daysAgo(14))
          ),
        });

        if (recentOutreach) {
          skippedNoSignal++;
          continue;
        }

        // Generate draft
        const draft = await generateDraftForContact({
          contact: vip.contact,
          jobChange,
          news: excitingNews[0],
        });

        draftsToSend.push({
          contact: vip.contact,
          draft,
          trigger: jobChange ? "job_change" : "news",
          newsUrl: excitingNews[0]?.url,
          newsHeadline: excitingNews[0]?.headline,
        });

        // Log outreach
        await db.insert(outreachLog).values({
          tenantId,
          contactId: vip.contact.id,
          newsItemId: excitingNews[0]?.id,
          triggerType: jobChange ? "job_change" : "news",
          draftText: draft,
          deliveryMethod: "email_digest",
        });
      } catch (error) {
        console.error(`Error processing VIP ${vip.contact.fullName}:`, error);
      }
    }

    // Send daily digest email
    if (draftsToSend.length > 0) {
      await sendDailyDigest(tenantId, draftsToSend);
    }

    // Update run as success
    await db
      .update(automationRuns)
      .set({
        status: "success",
        finishedAt: new Date(),
        vipsConsidered: vips.length,
        draftsCreated: draftsToSend.length,
        skippedNoSignal,
      })
      .where(eq(automationRuns.id, run.id));

    console.log(
      `Chief-of-staff completed: ${draftsToSend.length} drafts, ${skippedNoSignal} skipped`
    );
  } catch (error) {
    console.error("Chief-of-staff loop failed:", error);

    await db
      .update(automationRuns)
      .set({
        status: "failed",
        finishedAt: new Date(),
        errorSummary: error instanceof Error ? error.message : "Unknown error",
      })
      .where(eq(automationRuns.id, run.id));

    throw error;
  }
}

interface Contact {
  id: string;
  fullName: string;
  company?: string | null;
  title?: string | null;
  email?: string | null;
  linkedinUrl?: string | null;
}

interface NewsItem {
  id: string;
  headline: string;
  url: string;
  source?: string | null;
  category?: string | null;
}

interface DraftItem {
  contact: Contact;
  draft: string;
  trigger: "job_change" | "news";
  newsUrl?: string;
  newsHeadline?: string;
}

interface JobChange {
  previousCompany: string;
  previousTitle: string;
  currentCompany: string;
  currentTitle: string;
}

async function detectJobChangeForContact(
  tenantId: string,
  contact: Contact
): Promise<JobChange | null> {
  if (!contact.linkedinUrl) {
    return null;
  }

  // Get Proxycurl credentials
  const secret = await db.query.integrationSecrets.findFirst({
    where: and(
      eq(integrationSecrets.tenantId, tenantId),
      eq(integrationSecrets.integrationType, "proxycurl"),
      isNull(integrationSecrets.revokedAt)
    ),
  });

  if (!secret) {
    return null;
  }

  const credentials = decryptSecretJSON<ProxycurlCredentials>(secret.encryptedPayload);

  return detectJobChange(
    credentials.apiKey,
    contact.linkedinUrl,
    contact.company || undefined,
    contact.title || undefined
  );
}

async function fetchNewsForCompany(company: string): Promise<NewsItem[]> {
  if (!company) {
    return [];
  }

  const newsItems = await fetchCompanyNews(company);

  // Convert to our NewsItem interface
  return newsItems.map((n) => ({
    id: n.id,
    headline: n.headline,
    url: n.url,
    source: n.source,
    category: n.category,
  }));
}

function isExciting(news: NewsItem): boolean {
  // Use the news library's exciting news check
  return ["funding", "acquisition", "ipo", "product_launch", "partnership"].includes(
    news.category || ""
  );
}

async function generateDraftForContact(params: {
  contact: Contact;
  jobChange?: JobChange | null;
  news?: NewsItem;
}): Promise<string> {
  const { contact, jobChange, news } = params;

  return generateDraft({
    contactName: contact.fullName,
    contactCompany: contact.company || undefined,
    jobChange: jobChange || undefined,
    news: news ? { headline: news.headline, url: news.url } : undefined,
  });
}

async function sendDailyDigest(
  tenantId: string,
  drafts: DraftItem[]
): Promise<void> {
  // Import Resend dynamically to avoid issues if not configured
  if (!process.env.RESEND_API_KEY) {
    console.log(`Would send ${drafts.length} drafts in daily digest (Resend not configured)`);
    return;
  }

  const { Resend } = await import("resend");
  const resend = new Resend(process.env.RESEND_API_KEY);

  // Get tenant email
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, tenantId),
    with: {
      users: {
        limit: 1,
        where: (users, { eq }) => eq(users.role, "admin"),
      },
    },
  });

  const adminEmail = tenant?.users?.[0]?.email;
  if (!adminEmail) {
    console.error("No admin email found for tenant");
    return;
  }

  // Generate email HTML
  const emailHtml = generateDigestHtml(drafts);

  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "noreply@example.com",
      to: adminEmail,
      subject: `Daily VIP Digest: ${drafts.length} outreach suggestions`,
      html: emailHtml,
    });

    console.log(`Sent daily digest to ${adminEmail} with ${drafts.length} drafts`);
  } catch (error) {
    console.error("Failed to send daily digest:", error);
  }
}

function generateDigestHtml(drafts: DraftItem[]): string {
  const items = drafts
    .map(
      (d) => `
    <div style="margin-bottom: 24px; padding: 16px; background: #f9fafb; border-radius: 8px;">
      <h3 style="margin: 0 0 8px 0;">${d.contact.fullName}</h3>
      <p style="margin: 0 0 4px 0; color: #6b7280; font-size: 14px;">
        ${d.contact.title || ""} ${d.contact.company ? `at ${d.contact.company}` : ""}
      </p>
      <p style="margin: 8px 0; color: #374151; font-size: 14px;">
        <strong>Trigger:</strong> ${d.trigger === "job_change" ? "Job Change" : "News"}
        ${d.newsHeadline ? `: ${d.newsHeadline}` : ""}
      </p>
      <div style="margin-top: 12px; padding: 12px; background: white; border-radius: 4px; border-left: 3px solid #3b82f6;">
        <p style="margin: 0; font-style: italic;">${d.draft}</p>
      </div>
      ${
        d.contact.email
          ? `<a href="mailto:${d.contact.email}?body=${encodeURIComponent(d.draft)}" style="display: inline-block; margin-top: 12px; padding: 8px 16px; background: #3b82f6; color: white; text-decoration: none; border-radius: 4px;">Send Email</a>`
          : ""
      }
    </div>
  `
    )
    .join("");

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Daily VIP Digest</title>
      </head>
      <body style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h1 style="margin-bottom: 24px;">Daily VIP Digest</h1>
        <p style="color: #6b7280; margin-bottom: 24px;">
          Here are ${drafts.length} outreach suggestions for today:
        </p>
        ${items}
        <hr style="margin: 32px 0; border: none; border-top: 1px solid #e5e7eb;">
        <p style="color: #9ca3af; font-size: 12px;">
          This is an automated email from your Chief of Staff AI.
        </p>
      </body>
    </html>
  `;
}
