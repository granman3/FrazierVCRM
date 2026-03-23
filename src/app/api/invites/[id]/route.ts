import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revokeInvite } from "@/lib/invites";

// DELETE /api/invites/[id] - Revoke invite
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!session.user.tenantId) {
    return NextResponse.json({ error: "No tenant" }, { status: 400 });
  }

  // Only admins can revoke invites
  if (session.user.role !== "admin" && session.user.role !== "platform_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await revokeInvite({
      inviteId: params.id,
      tenantId: session.user.tenantId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to revoke invite:", error);
    return NextResponse.json(
      { error: "Failed to revoke invite" },
      { status: 500 }
    );
  }
}
