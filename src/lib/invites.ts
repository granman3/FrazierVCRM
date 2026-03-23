import { db } from "@/db";
import { invites, tenants, users } from "@/db/schema";
import { eq, and, isNull, gt } from "drizzle-orm";
import { createHash, randomBytes } from "crypto";

const INVITE_EXPIRY_DAYS = 7;

/**
 * Generates a secure random token for invites.
 */
export function generateInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Hashes a token for storage (we never store raw tokens).
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Creates an invite link for a tenant.
 */
export async function createTenantInvite(params: {
  tenantId: string;
  createdBy: string;
  email?: string;
  role?: "member" | "admin";
}): Promise<{ token: string; expiresAt: Date }> {
  const token = generateInviteToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRY_DAYS);

  await db.insert(invites).values({
    tenantId: params.tenantId,
    type: "tenant",
    tokenHash,
    email: params.email,
    role: params.role || "member",
    createdBy: params.createdBy,
    expiresAt,
  });

  return { token, expiresAt };
}

/**
 * Creates a platform invite (creates new tenant on acceptance).
 */
export async function createPlatformInvite(params: {
  createdBy: string;
  email?: string;
}): Promise<{ token: string; expiresAt: Date }> {
  const token = generateInviteToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRY_DAYS);

  await db.insert(invites).values({
    type: "platform",
    tokenHash,
    email: params.email,
    role: "admin", // Platform invites create admins of their new tenant
    createdBy: params.createdBy,
    expiresAt,
  });

  return { token, expiresAt };
}

/**
 * Validates an invite token and returns the invite details.
 */
export async function validateInvite(token: string): Promise<{
  valid: boolean;
  invite?: typeof invites.$inferSelect & {
    tenant?: typeof tenants.$inferSelect;
    creator?: typeof users.$inferSelect;
  };
  error?: string;
}> {
  const tokenHash = hashToken(token);

  const invite = await db.query.invites.findFirst({
    where: eq(invites.tokenHash, tokenHash),
  });

  if (!invite) {
    return { valid: false, error: "INVITE_NOT_FOUND" };
  }

  if (invite.acceptedAt) {
    return { valid: false, error: "INVITE_ALREADY_USED" };
  }

  if (invite.revokedAt) {
    return { valid: false, error: "INVITE_REVOKED" };
  }

  if (invite.expiresAt < new Date()) {
    return { valid: false, error: "INVITE_EXPIRED" };
  }

  // Fetch related data
  let tenant, creator;

  if (invite.tenantId) {
    tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, invite.tenantId),
    });
  }

  if (invite.createdBy) {
    creator = await db.query.users.findFirst({
      where: eq(users.id, invite.createdBy),
    });
  }

  return {
    valid: true,
    invite: {
      ...invite,
      tenant,
      creator,
    },
  };
}

/**
 * Accepts an invite and creates/updates user accordingly.
 */
export async function acceptInvite(params: {
  token: string;
  userId: string;
  email: string;
  name?: string;
}): Promise<{
  success: boolean;
  tenantId?: string;
  error?: string;
}> {
  const { valid, invite, error } = await validateInvite(params.token);

  if (!valid || !invite) {
    return { success: false, error };
  }

  // Check if invite is restricted to specific email
  if (invite.email && invite.email.toLowerCase() !== params.email.toLowerCase()) {
    return { success: false, error: "INVITE_EMAIL_MISMATCH" };
  }

  // Start transaction
  let tenantId: string;

  if (invite.type === "platform") {
    // Create new tenant for platform invites
    const [newTenant] = await db
      .insert(tenants)
      .values({
        name: `${params.name || params.email}'s Workspace`,
      })
      .returning();
    tenantId = newTenant.id;
  } else if (invite.tenantId) {
    tenantId = invite.tenantId;
  } else {
    return { success: false, error: "INVITE_NO_TENANT" };
  }

  // Update user with tenant and role
  await db
    .update(users)
    .set({
      tenantId,
      role: invite.role || "member",
      updatedAt: new Date(),
    })
    .where(eq(users.id, params.userId));

  // Mark invite as accepted
  await db
    .update(invites)
    .set({
      acceptedAt: new Date(),
      acceptedBy: params.userId,
    })
    .where(eq(invites.id, invite.id));

  return { success: true, tenantId };
}

/**
 * Revokes an invite.
 */
export async function revokeInvite(params: {
  inviteId: string;
  tenantId: string;
}): Promise<boolean> {
  const result = await db
    .update(invites)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(invites.id, params.inviteId),
        eq(invites.tenantId, params.tenantId),
        isNull(invites.acceptedAt),
        isNull(invites.revokedAt)
      )
    );

  return true;
}

/**
 * Lists pending invites for a tenant.
 */
export async function listTenantInvites(tenantId: string) {
  return db.query.invites.findMany({
    where: and(
      eq(invites.tenantId, tenantId),
      isNull(invites.acceptedAt),
      isNull(invites.revokedAt),
      gt(invites.expiresAt, new Date())
    ),
    orderBy: (invites, { desc }) => [desc(invites.createdAt)],
  });
}

/**
 * Lists platform invites (for platform admins).
 */
export async function listPlatformInvites() {
  return db.query.invites.findMany({
    where: and(
      eq(invites.type, "platform"),
      isNull(invites.acceptedAt),
      isNull(invites.revokedAt),
      gt(invites.expiresAt, new Date())
    ),
    orderBy: (invites, { desc }) => [desc(invites.createdAt)],
  });
}

/**
 * Generates the full invite URL.
 */
export function getInviteUrl(token: string): string {
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  return `${baseUrl}/invite/${token}`;
}
