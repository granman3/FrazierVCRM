import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { integrationSecrets, auditLog } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const integrations = await db.query.integrationSecrets.findMany({
    where: and(
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

  return NextResponse.json({ integrations });
}
