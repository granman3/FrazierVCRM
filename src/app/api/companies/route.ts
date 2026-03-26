import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, desc, like, and, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { companies, companyEmployees } from "@/db/schema";

const createCompanySchema = z.object({
  name: z.string().min(1),
  domain: z.string().optional(),
  crunchbaseUrl: z.string().url().optional(),
  linkedinUrl: z.string().url().optional(),
  logoUrl: z.string().url().optional(),
  sector: z.string().optional(),
  stage: z.string().optional(),
  status: z.string().optional(),
  headcount: z.number().int().optional(),
  foundedYear: z.number().int().optional(),
  hqLocation: z.string().optional(),
  description: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const db = getDb(process.env.DATABASE_URL!);
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q");
    const status = searchParams.get("status");

    const conditions = [];
    if (q) conditions.push(like(companies.name, `%${q}%`));
    if (status) conditions.push(eq(companies.status, status));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select({
        id: companies.id,
        name: companies.name,
        domain: companies.domain,
        crunchbaseUrl: companies.crunchbaseUrl,
        linkedinUrl: companies.linkedinUrl,
        logoUrl: companies.logoUrl,
        sector: companies.sector,
        stage: companies.stage,
        status: companies.status,
        headcount: companies.headcount,
        foundedYear: companies.foundedYear,
        hqLocation: companies.hqLocation,
        description: companies.description,
        lastFundingDate: companies.lastFundingDate,
        lastFundingAmount: companies.lastFundingAmount,
        totalRaised: companies.totalRaised,
        createdAt: companies.createdAt,
        updatedAt: companies.updatedAt,
        employeeCount: sql<number>`count(${companyEmployees.id})`.as("employee_count"),
      })
      .from(companies)
      .leftJoin(companyEmployees, eq(companies.id, companyEmployees.companyId))
      .where(whereClause)
      .groupBy(companies.id)
      .orderBy(desc(companies.updatedAt));

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
    const parsed = createCompanySchema.parse(body);

    const [created] = await db
      .insert(companies)
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
