import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { integrationSecrets, auditLog } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { encryptSecret } from "@/lib/encryption";
import { z } from "zod";
import { createDAVClient } from "tsdav";

const cardDAVSchema = z.object({
  appleId: z.string().email("Invalid Apple ID email"),
  appSpecificPassword: z.string().min(1, "App-specific password is required"),
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

  const parsed = cardDAVSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { appleId, appSpecificPassword } = parsed.data;

  // Test the credentials before saving
  try {
    const client = await createDAVClient({
      serverUrl: "https://contacts.icloud.com",
      credentials: {
        username: appleId,
        password: appSpecificPassword,
      },
      authMethod: "Basic",
      defaultAccountType: "carddav",
    });

    // Try to fetch address books to verify credentials work
    const addressBooks = await client.fetchAddressBooks();
    if (!addressBooks || addressBooks.length === 0) {
      return NextResponse.json(
        { error: "Could not access iCloud Contacts. Please verify your credentials." },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("CardDAV credential test failed:", error);
    return NextResponse.json(
      {
        error: "Failed to connect to iCloud. Please check your Apple ID and app-specific password.",
      },
      { status: 400 }
    );
  }

  // Revoke any existing CardDAV integration
  await db
    .update(integrationSecrets)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(integrationSecrets.tenantId, session.user.tenantId),
        eq(integrationSecrets.integrationType, "carddav"),
        isNull(integrationSecrets.revokedAt)
      )
    );

  // Save the new credentials
  const encryptedPayload = encryptSecret({ appleId, appSpecificPassword });

  const [integration] = await db
    .insert(integrationSecrets)
    .values({
      tenantId: session.user.tenantId,
      integrationType: "carddav",
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
    metadata: { integrationType: "carddav" },
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
