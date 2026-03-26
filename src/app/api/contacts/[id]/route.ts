import { NextRequest, NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { getDb } from "@/db";
import { contacts, vips, outreachLog, interactions } from "@/db/schema";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const db = getDb(process.env.DATABASE_URL!);
    const { id } = await context.params;

    const [contact] = await db
      .select()
      .from(contacts)
      .where(eq(contacts.id, id))
      .limit(1);

    if (!contact) {
      return NextResponse.json({ data: null, error: "Contact not found" }, { status: 404 });
    }

    const vipRows = await db
      .select()
      .from(vips)
      .where(eq(vips.contactId, id))
      .limit(1);

    const outreachRows = await db
      .select()
      .from(outreachLog)
      .where(eq(outreachLog.contactId, id))
      .orderBy(desc(outreachLog.sentAt));

    const interactionRows = await db
      .select()
      .from(interactions)
      .where(eq(interactions.contactId, id))
      .orderBy(desc(interactions.occurredAt));

    return NextResponse.json({
      data: {
        ...contact,
        vip: vipRows[0] ?? null,
        outreach: outreachRows,
        interactions: interactionRows,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ data: null, error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const db = getDb(process.env.DATABASE_URL!);
    const { id } = await context.params;
    const body = await request.json();

    const { id: _id, sourceType: _st, sourceId: _si, createdAt: _ca, ...updateFields } = body;

    const [updated] = await db
      .update(contacts)
      .set({ ...updateFields, updatedAt: new Date() })
      .where(eq(contacts.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ data: null, error: "Contact not found" }, { status: 404 });
    }

    return NextResponse.json({ data: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ data: null, error: message }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const db = getDb(process.env.DATABASE_URL!);
    const { id } = await context.params;

    const [deleted] = await db
      .delete(contacts)
      .where(eq(contacts.id, id))
      .returning({ id: contacts.id });

    if (!deleted) {
      return NextResponse.json({ data: null, error: "Contact not found" }, { status: 404 });
    }

    return NextResponse.json({ data: { id: deleted.id } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ data: null, error: message }, { status: 500 });
  }
}
