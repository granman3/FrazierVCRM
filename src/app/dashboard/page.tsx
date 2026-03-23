import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import {
  integrationSecrets,
  automationRuns,
  vipCandidates,
  vipList,
  contactsMerged,
} from "@/db/schema";
import { eq, and, isNull, desc, count } from "drizzle-orm";
import { DashboardClient } from "./client";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.tenantId) {
    redirect("/auth/signin");
  }

  const tenantId = session.user.tenantId;

  // Fetch dashboard data in parallel
  const [
    integrations,
    recentRuns,
    pendingVipCount,
    activeVipCount,
    totalContacts,
  ] = await Promise.all([
    // Integration health
    db.query.integrationSecrets.findMany({
      where: and(
        eq(integrationSecrets.tenantId, tenantId),
        isNull(integrationSecrets.revokedAt)
      ),
    }),

    // Recent automation runs
    db.query.automationRuns.findMany({
      where: eq(automationRuns.tenantId, tenantId),
      orderBy: [desc(automationRuns.startedAt)],
      limit: 10,
    }),

    // Pending VIP candidates
    db
      .select({ count: count() })
      .from(vipCandidates)
      .where(
        and(
          eq(vipCandidates.tenantId, tenantId),
          isNull(vipCandidates.approved)
        )
      ),

    // Active VIPs
    db
      .select({ count: count() })
      .from(vipList)
      .where(
        and(
          eq(vipList.tenantId, tenantId),
          isNull(vipList.removedAt)
        )
      ),

    // Total contacts
    db
      .select({ count: count() })
      .from(contactsMerged)
      .where(eq(contactsMerged.tenantId, tenantId)),
  ]);

  return (
    <DashboardClient
      userName={session.user.name || session.user.email}
      integrations={integrations.map((i) => ({
        type: i.integrationType,
        status: i.testStatus || "pending",
        lastTested: i.lastTestedAt?.toISOString(),
        error: i.testError || undefined,
      }))}
      recentRuns={recentRuns.map((r) => ({
        id: r.id,
        workflowName: r.workflowName,
        status: r.status,
        startedAt: r.startedAt.toISOString(),
        finishedAt: r.finishedAt?.toISOString(),
        vipsConsidered: r.vipsConsidered || 0,
        draftsCreated: r.draftsCreated || 0,
        skippedNoSignal: r.skippedNoSignal || 0,
        errorSummary: r.errorSummary || undefined,
      }))}
      stats={{
        pendingVips: pendingVipCount[0]?.count || 0,
        activeVips: activeVipCount[0]?.count || 0,
        totalContacts: totalContacts[0]?.count || 0,
      }}
    />
  );
}
