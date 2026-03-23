import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { integrationSecrets } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { SettingsClient } from "./client";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.tenantId) {
    redirect("/api/auth/signin");
  }

  if (!session.user.setupComplete) {
    redirect("/setup");
  }

  const integrations = await db.query.integrationSecrets.findMany({
    where: and(
      eq(integrationSecrets.tenantId, session.user.tenantId),
      isNull(integrationSecrets.revokedAt)
    ),
  });

  return (
    <SettingsClient
      integrations={integrations.map((i) => ({
        id: i.id,
        type: i.integrationType,
        status: i.testStatus || "pending",
        lastTested: i.lastTestedAt?.toISOString(),
        error: i.testError || undefined,
      }))}
    />
  );
}
