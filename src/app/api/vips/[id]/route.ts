import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { vipList, auditLog } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";

/**
 * DELETE: Remove a VIP from the list
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const vip = await db.query.vipList.findFirst({
    where: and(
      eq(vipList.id, params.id),
      eq(vipList.tenantId, session.user.tenantId),
      isNull(vipList.removedAt)
    ),
  });

  if (!vip) {
    return NextResponse.json({ error: "VIP not found" }, { status: 404 });
  }

  // Soft delete
  await db
    .update(vipList)
    .set({ removedAt: new Date() })
    .where(eq(vipList.id, params.id));

  // Audit log
  await db.insert(auditLog).values({
    tenantId: session.user.tenantId,
    userId: session.user.id,
    action: "vip.removed",
    targetType: "vip",
    targetId: params.id,
    metadata: { contactId: vip.contactId },
  });

  return NextResponse.json({ success: true });
}

/**
 * PATCH: Update VIP category
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

  const { category } = body;

  const vip = await db.query.vipList.findFirst({
    where: and(
      eq(vipList.id, params.id),
      eq(vipList.tenantId, session.user.tenantId),
      isNull(vipList.removedAt)
    ),
  });

  if (!vip) {
    return NextResponse.json({ error: "VIP not found" }, { status: 404 });
  }

  await db
    .update(vipList)
    .set({ category })
    .where(eq(vipList.id, params.id));

  return NextResponse.json({ success: true, category });
}
