import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { integrationSecrets, auditLog } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const integration = await db.query.integrationSecrets.findFirst({
    where: and(
      eq(integrationSecrets.id, params.id),
      eq(integrationSecrets.tenantId, session.user.tenantId),
      isNull(integrationSecrets.revokedAt)
    ),
  });

  if (!integration) {
    return NextResponse.json({ error: "Integration not found" }, { status: 404 });
  }

  // Revoke the integration
  await db
    .update(integrationSecrets)
    .set({ revokedAt: new Date() })
    .where(eq(integrationSecrets.id, params.id));

  // Audit log
  await db.insert(auditLog).values({
    tenantId: session.user.tenantId,
    userId: session.user.id,
    action: "integration.revoked",
    targetType: "integration",
    targetId: params.id,
    metadata: { integrationType: integration.integrationType },
  });

  return NextResponse.json({ success: true });
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const integration = await db.query.integrationSecrets.findFirst({
    where: and(
      eq(integrationSecrets.id, params.id),
      eq(integrationSecrets.tenantId, session.user.tenantId),
      isNull(integrationSecrets.revokedAt)
    ),
    columns: {
      id: true,
      integrationType: true,
      lastTestedAt: true,
      testStatus: true,
      testError: true,
      createdAt: true,
    },
  });

  if (!integration) {
    return NextResponse.json({ error: "Integration not found" }, { status: 404 });
  }

  return NextResponse.json({ integration });
}
