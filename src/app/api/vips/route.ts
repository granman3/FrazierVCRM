import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { vipList, contactsMerged, auditLog } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { z } from "zod";

/**
 * GET: List active VIPs
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const vips = await db.query.vipList.findMany({
    where: and(
      eq(vipList.tenantId, session.user.tenantId),
      isNull(vipList.removedAt)
    ),
    with: {
      contact: true,
    },
    orderBy: (vips, { desc }) => [desc(vips.addedAt)],
  });

  return NextResponse.json({
    vips: vips.map((v) => ({
      id: v.id,
      category: v.category,
      addedAt: v.addedAt,
      addedBy: v.addedBy,
      contact: v.contact
        ? {
            id: v.contact.id,
            fullName: v.contact.fullName,
            company: v.contact.company,
            title: v.contact.title,
            email: v.contact.email,
            linkedinUrl: v.contact.linkedinUrl,
          }
        : null,
    })),
  });
}

const addVipSchema = z.object({
  contactId: z.string().uuid(),
  category: z.string().optional(),
});

/**
 * POST: Manually add a contact to VIP list
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

  const parsed = addVipSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { contactId, category } = parsed.data;

  // Verify contact exists and belongs to tenant
  const contact = await db.query.contactsMerged.findFirst({
    where: and(
      eq(contactsMerged.id, contactId),
      eq(contactsMerged.tenantId, session.user.tenantId)
    ),
  });

  if (!contact) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }

  // Add to VIP list
  const [vip] = await db
    .insert(vipList)
    .values({
      tenantId: session.user.tenantId,
      contactId,
      category: category || "other",
      addedBy: "manual",
    })
    .onConflictDoUpdate({
      target: [vipList.tenantId, vipList.contactId],
      set: {
        removedAt: null,
        category: category || "other",
        addedBy: "manual",
        addedAt: new Date(),
      },
    })
    .returning();

  // Audit log
  await db.insert(auditLog).values({
    tenantId: session.user.tenantId,
    userId: session.user.id,
    action: "vip.added",
    targetType: "vip",
    targetId: vip.id,
    metadata: { contactId, category },
  });

  return NextResponse.json({
    success: true,
    vip: {
      id: vip.id,
      contactId: vip.contactId,
      category: vip.category,
    },
  });
}
