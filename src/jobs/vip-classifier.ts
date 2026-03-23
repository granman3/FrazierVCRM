import type { Job } from "pg-boss";
import { db } from "@/db";
import { contactsMerged, vipCandidates, automationRuns } from "@/db/schema";
import { eq, and, notInArray } from "drizzle-orm";
import type { VipClassifierJob } from "./types";
import { classifyContacts } from "@/lib/deepseek";

export async function handleVipClassifier(job: Job<VipClassifierJob>) {
  const { tenantId, incrementalOnly } = job.data;

  console.log(`Starting VIP classification for tenant ${tenantId}`);

  // Create run record
  const [run] = await db
    .insert(automationRuns)
    .values({
      tenantId,
      workflowName: "vip-classifier",
      status: "running",
    })
    .returning();

  try {
    // Get contacts to classify
    let contacts;

    if (incrementalOnly) {
      // Only get contacts not yet classified
      const existingCandidates = await db.query.vipCandidates.findMany({
        where: eq(vipCandidates.tenantId, tenantId),
        columns: { contactId: true },
      });

      const classifiedIds = existingCandidates.map((c) => c.contactId);

      contacts = await db.query.contactsMerged.findMany({
        where: and(
          eq(contactsMerged.tenantId, tenantId),
          classifiedIds.length > 0
            ? notInArray(contactsMerged.id, classifiedIds)
            : undefined
        ),
      });
    } else {
      contacts = await db.query.contactsMerged.findMany({
        where: eq(contactsMerged.tenantId, tenantId),
      });
    }

    if (contacts.length === 0) {
      console.log("No contacts to classify");
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

    console.log(`Classifying ${contacts.length} contacts`);

    // Batch and classify
    const BATCH_SIZE = 150;
    let totalVips = 0;

    for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
      const batch = contacts.slice(i, i + BATCH_SIZE);
      const vips = await classifyBatch(batch);
      totalVips += vips.length;

      // Save results
      for (const vip of vips) {
        await db
          .insert(vipCandidates)
          .values({
            tenantId,
            contactId: vip.id,
            confidence: vip.confidence,
            reason: vip.reason,
            category: vip.category,
          })
          .onConflictDoUpdate({
            target: [vipCandidates.tenantId, vipCandidates.contactId],
            set: {
              confidence: vip.confidence,
              reason: vip.reason,
              category: vip.category,
              suggestedAt: new Date(),
            },
          });
      }

      // Rate limit between batches
      if (i + BATCH_SIZE < contacts.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // Update run as success
    await db
      .update(automationRuns)
      .set({
        status: "success",
        finishedAt: new Date(),
        vipsConsidered: contacts.length,
        draftsCreated: totalVips,
      })
      .where(eq(automationRuns.id, run.id));

    console.log(`VIP classification completed: ${totalVips} VIPs identified`);
  } catch (error) {
    console.error("VIP classification failed:", error);

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
}

interface VIPResult {
  id: string;
  confidence: number;
  reason: string;
  category: string;
}

async function classifyBatch(contacts: Contact[]): Promise<VIPResult[]> {
  // Use DeepSeek for classification (with fallback to heuristics)
  const classifications = await classifyContacts(contacts);

  return classifications.map((c) => ({
    id: c.id,
    confidence: c.confidence,
    reason: c.reason,
    category: c.category,
  }));
}
