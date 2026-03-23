import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { acceptInvite } from "@/lib/invites";
import { z } from "zod";

const acceptInviteSchema = z.object({
  token: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { token } = acceptInviteSchema.parse(body);

    const result = await acceptInvite({
      token,
      userId: session.user.id,
      email: session.user.email!,
      name: session.user.name || undefined,
    });

    if (!result.success) {
      const statusMap: Record<string, number> = {
        INVITE_NOT_FOUND: 404,
        INVITE_ALREADY_USED: 400,
        INVITE_REVOKED: 400,
        INVITE_EXPIRED: 400,
        INVITE_EMAIL_MISMATCH: 403,
        INVITE_NO_TENANT: 400,
      };

      return NextResponse.json(
        { error: result.error },
        { status: statusMap[result.error!] || 400 }
      );
    }

    return NextResponse.json({
      success: true,
      tenantId: result.tenantId,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Failed to accept invite:", error);
    return NextResponse.json(
      { error: "Failed to accept invite" },
      { status: 500 }
    );
  }
}
