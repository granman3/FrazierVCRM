import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SetupWizard } from "./wizard";
import { db } from "@/db";
import { integrationSecrets, tenants } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";

export default async function SetupPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/auth/signin?callbackUrl=/setup");
  }

  if (!session.user.tenantId) {
    redirect("/auth/no-tenant");
  }

  // Check if setup is already complete
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, session.user.tenantId),
  });

  if (tenant?.setupCompletedAt) {
    redirect("/dashboard");
  }

  // Get current integration status
  const secrets = await db.query.integrationSecrets.findMany({
    where: and(
      eq(integrationSecrets.tenantId, session.user.tenantId),
      isNull(integrationSecrets.revokedAt)
    ),
  });

  const connectedIntegrations = secrets.reduce(
    (acc, s) => {
      acc[s.integrationType] = {
        connected: true,
        status: s.testStatus || "pending",
      };
      return acc;
    },
    {} as Record<string, { connected: boolean; status: string }>
  );

  return (
    <SetupWizard
      tenantId={session.user.tenantId}
      userEmail={session.user.email}
      userName={session.user.name || undefined}
      timezone={tenant?.timezone || undefined}
      connectedIntegrations={connectedIntegrations}
    />
  );
}
