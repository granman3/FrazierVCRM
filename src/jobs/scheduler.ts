import PgBoss from "pg-boss";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { eq, and, isNotNull } from "drizzle-orm";

/**
 * Schedules recurring jobs for all active tenants.
 */
export async function scheduleTenantsJobs(boss: PgBoss): Promise<void> {
  // Get all active tenants with completed setup
  const activeTenants = await db.query.tenants.findMany({
    where: and(
      eq(tenants.status, "active"),
      isNotNull(tenants.setupCompletedAt)
    ),
  });

  console.log(`Scheduling jobs for ${activeTenants.length} active tenants`);

  for (const tenant of activeTenants) {
    const timezone = tenant.timezone || "America/New_York";

    // Schedule daily contact sync (3 AM)
    await boss.schedule(
      `contacts-sync-${tenant.id}`,
      "0 3 * * *",
      {
        tenantId: tenant.id,
        sourceType: "carddav", // Will sync all connected sources
        fullSync: false,
      },
      { tz: timezone, singletonKey: `contacts-sync-${tenant.id}` }
    );

    // Schedule weekly VIP classification (Sunday 4 AM)
    await boss.schedule(
      `vip-classifier-${tenant.id}`,
      "0 4 * * 0",
      {
        tenantId: tenant.id,
        incrementalOnly: false,
      },
      { tz: timezone, singletonKey: `vip-classifier-${tenant.id}` }
    );

    // Schedule daily chief-of-staff digest (7 AM)
    await boss.schedule(
      `chief-of-staff-${tenant.id}`,
      "0 7 * * *",
      {
        tenantId: tenant.id,
      },
      { tz: timezone, singletonKey: `chief-of-staff-${tenant.id}` }
    );

    console.log(`Scheduled jobs for tenant ${tenant.id} (${timezone})`);
  }
}

/**
 * Schedules a one-time health check job for an integration.
 */
export async function scheduleHealthCheck(
  boss: PgBoss,
  tenantId: string,
  integrationType: string
): Promise<string> {
  const jobId = await boss.send("health-check", {
    tenantId,
    integrationType,
  });

  return jobId || "";
}

/**
 * Triggers an immediate contact sync for a tenant.
 */
export async function triggerContactsSync(
  boss: PgBoss,
  tenantId: string,
  sourceType: string,
  fullSync: boolean = false
): Promise<string> {
  const jobId = await boss.send("contacts-sync", {
    tenantId,
    sourceType,
    fullSync,
  });

  return jobId || "";
}

/**
 * Triggers an immediate VIP classification for a tenant.
 */
export async function triggerVipClassification(
  boss: PgBoss,
  tenantId: string
): Promise<string> {
  const jobId = await boss.send("vip-classifier", {
    tenantId,
    incrementalOnly: false,
  });

  return jobId || "";
}
