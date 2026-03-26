import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { getDb } from "@/db";
import { deals, companies } from "@/db/schema";

const createDealSchema = z.object({
  companyId: z.string().uuid(),
  dealName: z.string().min(1),
  stage: z.string().optional(),
  assignedTo: z.string().uuid().optional(),
  source: z.string().optional(),
  sector: z.string().optional(),
  checkSize: z.number().optional(),
  valuation: z.number().optional(),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const db = getDb(process.env.DATABASE_URL!);
    const { searchParams } = new URL(request.url);
    const stage = searchParams.get("stage");

    const baseQuery = db
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
      })
      .from(deals)
      .innerJoin(companies, eq(deals.companyId, companies.id))
      .orderBy(desc(deals.updatedAt));

    const rows = stage
      ? await baseQuery.where(eq(deals.stage, stage))
      : await baseQuery;

    return NextResponse.json({ data: rows });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ data: null, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = getDb(process.env.DATABASE_URL!);
    const body = await request.json();
    const parsed = createDealSchema.parse(body);

    const [created] = await db
      .insert(deals)
      .values(parsed)
      .returning();

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ data: null, error: error.errors }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ data: null, error: message }, { status: 500 });
  }
}
