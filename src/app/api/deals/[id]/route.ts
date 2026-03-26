import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { deals, companies } from "@/db/schema";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const db = getDb(process.env.DATABASE_URL!);
    const { id } = await context.params;

    const [row] = await db
      .select({
        id: deals.id,
        companyId: deals.companyId,
        dealName: deals.dealName,
        stage: deals.stage,
        assignedTo: deals.assignedTo,
        source: deals.source,
        sector: deals.sector,
        checkSize: deals.checkSize,
        valuation: deals.valuation,
        notes: deals.notes,
        stageUpdatedAt: deals.stageUpdatedAt,
        closedAt: deals.closedAt,
        passedAt: deals.passedAt,
        passReason: deals.passReason,
        createdAt: deals.createdAt,
        updatedAt: deals.updatedAt,
        companyName: companies.name,
        companyLogoUrl: companies.logoUrl,
        companySector: companies.sector,
        companyStage: companies.stage,
      })
      .from(deals)
      .innerJoin(companies, eq(deals.companyId, companies.id))
      .where(eq(deals.id, id))
      .limit(1);

    if (!row) {
      return NextResponse.json({ data: null, error: "Deal not found" }, { status: 404 });
    }

    return NextResponse.json({ data: row });
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

    const { id: _id, companyId: _cid, createdAt: _ca, ...updateFields } = body;

    if (updateFields.stage) {
      updateFields.stageUpdatedAt = new Date();
    }

    const [updated] = await db
      .update(deals)
      .set({ ...updateFields, updatedAt: new Date() })
      .where(eq(deals.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ data: null, error: "Deal not found" }, { status: 404 });
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
      .delete(deals)
      .where(eq(deals.id, id))
      .returning({ id: deals.id });

    if (!deleted) {
      return NextResponse.json({ data: null, error: "Deal not found" }, { status: 404 });
    }

    return NextResponse.json({ data: { id: deleted.id } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ data: null, error: message }, { status: 500 });
  }
}
