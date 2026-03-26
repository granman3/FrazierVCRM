import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { vips, contacts } from "@/db/schema";

const patchVipSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(["approve", "reject", "toggle"]),
});

export async function GET(request: NextRequest) {
  try {
    const db = getDb(process.env.DATABASE_URL!);
    const { searchParams } = new URL(request.url);
    const activeParam = searchParams.get("active");

    const baseQuery = db
      .select({
        id: vips.id,
        contactId: vips.contactId,
        confidence: vips.confidence,
        reason: vips.reason,
        category: vips.category,
        autoApproved: vips.autoApproved,
        active: vips.active,
        addedAt: vips.addedAt,
        removedAt: vips.removedAt,
        contactName: contacts.fullName,
        contactEmail: contacts.email,
        contactCompany: contacts.company,
        contactTitle: contacts.title,
        contactPhotoUrl: contacts.photoUrl,
      })
      .from(vips)
      .innerJoin(contacts, eq(vips.contactId, contacts.id));

    const rows = activeParam !== null
      ? await baseQuery.where(eq(vips.active, activeParam === "true"))
      : await baseQuery;

    return NextResponse.json({ data: rows });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ data: null, error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const db = getDb(process.env.DATABASE_URL!);
    const body = await request.json();
    const { id, action } = patchVipSchema.parse(body);

    const [existing] = await db
      .select()
      .from(vips)
      .where(eq(vips.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ data: null, error: "VIP not found" }, { status: 404 });
    }

    let newActive: boolean;
    if (action === "approve") {
      newActive = true;
    } else if (action === "reject") {
      newActive = false;
    } else {
      newActive = !existing.active;
    }

    const [updated] = await db
      .update(vips)
      .set({
        active: newActive,
        removedAt: newActive ? null : new Date(),
      })
      .where(eq(vips.id, id))
      .returning();

    return NextResponse.json({ data: updated });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ data: null, error: error.errors }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ data: null, error: message }, { status: 500 });
  }
}
