import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, desc, and } from "drizzle-orm";
import { getDb } from "@/db";
import { departureAlerts, contacts, companies } from "@/db/schema";

const acknowledgeSchema = z.object({
  id: z.string().uuid(),
});

export async function GET(request: NextRequest) {
  try {
    const db = getDb(process.env.DATABASE_URL!);
    const { searchParams } = new URL(request.url);
    const acknowledgedParam = searchParams.get("acknowledged");

    const conditions = [];
    if (acknowledgedParam !== null) {
      conditions.push(eq(departureAlerts.acknowledged, acknowledgedParam === "true"));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select({
        id: departureAlerts.id,
        companyEmployeeId: departureAlerts.companyEmployeeId,
        contactId: departureAlerts.contactId,
        companyId: departureAlerts.companyId,
        previousTitle: departureAlerts.previousTitle,
        detectedAt: departureAlerts.detectedAt,
        acknowledged: departureAlerts.acknowledged,
        acknowledgedBy: departureAlerts.acknowledgedBy,
        acknowledgedAt: departureAlerts.acknowledgedAt,
        contactName: contacts.fullName,
        contactEmail: contacts.email,
        companyName: companies.name,
      })
      .from(departureAlerts)
      .innerJoin(contacts, eq(departureAlerts.contactId, contacts.id))
      .innerJoin(companies, eq(departureAlerts.companyId, companies.id))
      .where(whereClause)
      .orderBy(desc(departureAlerts.detectedAt));

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
    const { id } = acknowledgeSchema.parse(body);

    const [updated] = await db
      .update(departureAlerts)
      .set({
        acknowledged: true,
        acknowledgedAt: new Date(),
      })
      .where(eq(departureAlerts.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ data: null, error: "Alert not found" }, { status: 404 });
    }

    return NextResponse.json({ data: updated });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ data: null, error: error.errors }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ data: null, error: message }, { status: 500 });
  }
}
