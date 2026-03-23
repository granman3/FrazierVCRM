import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  createTenantInvite,
  createPlatformInvite,
  listTenantInvites,
  listPlatformInvites,
  getInviteUrl,
} from "@/lib/invites";
import { z } from "zod";

const createInviteSchema = z.object({
  type: z.enum(["tenant", "platform"]),
  email: z.string().email().optional(),
  role: z.enum(["member", "admin"]).optional(),
});

// GET /api/invites - List invites
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");

  try {
    if (type === "platform") {
      // Only platform admins can list platform invites
      if (session.user.role !== "platform_admin") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const invites = await listPlatformInvites();
      return NextResponse.json({ invites });
    }

    // List tenant invites
    if (!session.user.tenantId) {
      return NextResponse.json({ error: "No tenant" }, { status: 400 });
    }

    // Only admins can list invites
    if (session.user.role !== "admin" && session.user.role !== "platform_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const invites = await listTenantInvites(session.user.tenantId);
    return NextResponse.json({ invites });
  } catch (error) {
    console.error("Failed to list invites:", error);
    return NextResponse.json(
      { error: "Failed to list invites" },
      { status: 500 }
    );
  }
}

// POST /api/invites - Create invite
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { type, email, role } = createInviteSchema.parse(body);

    if (type === "platform") {
      // Only platform admins can create platform invites
      if (session.user.role !== "platform_admin") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const { token, expiresAt } = await createPlatformInvite({
        createdBy: session.user.id,
        email,
      });

      return NextResponse.json({
        success: true,
        url: getInviteUrl(token),
        expiresAt,
      });
    }

    // Tenant invite
    if (!session.user.tenantId) {
      return NextResponse.json({ error: "No tenant" }, { status: 400 });
    }

    // Only admins can create invites
    if (session.user.role !== "admin" && session.user.role !== "platform_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { token, expiresAt } = await createTenantInvite({
      tenantId: session.user.tenantId,
      createdBy: session.user.id,
      email,
      role,
    });

    return NextResponse.json({
      success: true,
      url: getInviteUrl(token),
      expiresAt,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Failed to create invite:", error);
    return NextResponse.json(
      { error: "Failed to create invite" },
      { status: 500 }
    );
  }
}
