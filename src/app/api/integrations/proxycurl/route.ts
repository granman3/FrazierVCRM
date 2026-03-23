import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { integrationSecrets, auditLog } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { encryptSecret } from "@/lib/encryption";
import { z } from "zod";

const proxycurlSchema = z.object({
  apiKey: z.string().min(1, "API key is required"),
});

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = proxycurlSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { apiKey } = parsed.data;

  // Test the API key
  try {
    const response = await fetch("https://nubela.co/proxycurl/api/credit-balance", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        return NextResponse.json(
          { error: "Invalid API key. Please check your Proxycurl API key." },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: `Proxycurl API returned error: ${response.status}` },
        { status: 400 }
      );
    }

    const data = await response.json();
    console.log(`Proxycurl credit balance: ${data.credit_balance}`);
  } catch (error) {
    console.error("Proxycurl API test failed:", error);
    return NextResponse.json(
      { error: "Failed to verify Proxycurl API key." },
      { status: 400 }
    );
  }

  // Revoke any existing Proxycurl integration
  await db
    .update(integrationSecrets)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(integrationSecrets.tenantId, session.user.tenantId),
        eq(integrationSecrets.integrationType, "proxycurl"),
        isNull(integrationSecrets.revokedAt)
      )
    );

  // Save the new credentials
  const encryptedPayload = encryptSecret({ apiKey });

  const [integration] = await db
    .insert(integrationSecrets)
    .values({
      tenantId: session.user.tenantId,
      integrationType: "proxycurl",
      encryptedPayload,
      lastTestedAt: new Date(),
      testStatus: "success",
    })
    .returning();

  // Audit log
  await db.insert(auditLog).values({
    tenantId: session.user.tenantId,
    userId: session.user.id,
    action: "integration.connected",
    targetType: "integration",
    targetId: integration.id,
    metadata: { integrationType: "proxycurl" },
  });

  return NextResponse.json({
    success: true,
    integration: {
      id: integration.id,
      integrationType: integration.integrationType,
      testStatus: integration.testStatus,
    },
  });
}
