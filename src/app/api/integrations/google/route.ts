import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { integrationSecrets, auditLog } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { encryptSecret } from "@/lib/encryption";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;

/**
 * GET: Start OAuth flow - redirect to Google
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const redirectUri = `${process.env.NEXTAUTH_URL}/api/integrations/google/callback`;

  // Generate state token to prevent CSRF
  const state = Buffer.from(
    JSON.stringify({
      tenantId: session.user.tenantId,
      userId: session.user.id,
      timestamp: Date.now(),
    })
  ).toString("base64url");

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/contacts.readonly",
    access_type: "offline",
    prompt: "consent",
    state,
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  return NextResponse.json({ authUrl });
}

/**
 * POST: Exchange authorization code for tokens
 */
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

  const { code, state } = body;

  if (!code) {
    return NextResponse.json({ error: "Missing authorization code" }, { status: 400 });
  }

  // Verify state
  if (state) {
    try {
      const stateData = JSON.parse(Buffer.from(state, "base64url").toString());
      if (stateData.tenantId !== session.user.tenantId) {
        return NextResponse.json({ error: "Invalid state" }, { status: 400 });
      }
      // Check timestamp (5 minute expiry)
      if (Date.now() - stateData.timestamp > 5 * 60 * 1000) {
        return NextResponse.json({ error: "State expired" }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: "Invalid state format" }, { status: 400 });
    }
  }

  const redirectUri = `${process.env.NEXTAUTH_URL}/api/integrations/google/callback`;

  // Exchange code for tokens
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    console.error("Google token exchange failed:", error);
    return NextResponse.json(
      { error: "Failed to exchange authorization code" },
      { status: 400 }
    );
  }

  const tokens = await tokenResponse.json();

  // Test the token by fetching profile
  const profileResponse = await fetch(
    "https://people.googleapis.com/v1/people/me?personFields=names,emailAddresses",
    {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    }
  );

  if (!profileResponse.ok) {
    return NextResponse.json(
      { error: "Failed to verify Google credentials" },
      { status: 400 }
    );
  }

  // Revoke any existing Google integration
  await db
    .update(integrationSecrets)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(integrationSecrets.tenantId, session.user.tenantId),
        eq(integrationSecrets.integrationType, "google_contacts"),
        isNull(integrationSecrets.revokedAt)
      )
    );

  // Calculate expiry time
  const expiresAt = Date.now() + tokens.expires_in * 1000;

  // Save the credentials
  const encryptedPayload = encryptSecret({
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt,
  });

  const [integration] = await db
    .insert(integrationSecrets)
    .values({
      tenantId: session.user.tenantId,
      integrationType: "google_contacts",
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
    metadata: { integrationType: "google_contacts" },
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
