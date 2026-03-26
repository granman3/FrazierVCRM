import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { companies, companyEmployees, contacts, fundingRounds, deals } from "@/db/schema";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const db = getDb(process.env.DATABASE_URL!);
    const { id } = await context.params;

    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, id))
      .limit(1);

    if (!company) {
      return NextResponse.json({ data: null, error: "Company not found" }, { status: 404 });
    }

    const employees = await db
      .select({
        employeeId: companyEmployees.id,
        title: companyEmployees.title,
        department: companyEmployees.department,
        startedAt: companyEmployees.startedAt,
        endedAt: companyEmployees.endedAt,
        isKeyPerson: companyEmployees.isKeyPerson,
        contactId: contacts.id,
        contactName: contacts.fullName,
        contactEmail: contacts.email,
        contactPhone: contacts.phone,
        contactPhotoUrl: contacts.photoUrl,
      })
      .from(companyEmployees)
      .innerJoin(contacts, eq(companyEmployees.contactId, contacts.id))
      .where(eq(companyEmployees.companyId, id));

    const fundingRows = await db
      .select()
      .from(fundingRounds)
      .where(eq(fundingRounds.companyId, id));

    const dealRows = await db
      .select()
      .from(deals)
      .where(eq(deals.companyId, id));

    return NextResponse.json({
      data: {
        ...company,
        employees,
        fundingRounds: fundingRows,
        deals: dealRows,
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

    const { id: _id, createdAt: _ca, ...updateFields } = body;

    const [updated] = await db
      .update(companies)
      .set({ ...updateFields, updatedAt: new Date() })
      .where(eq(companies.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ data: null, error: "Company not found" }, { status: 404 });
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
      .delete(companies)
      .where(eq(companies.id, id))
      .returning({ id: companies.id });

    if (!deleted) {
      return NextResponse.json({ data: null, error: "Company not found" }, { status: 404 });
    }

    return NextResponse.json({ data: { id: deleted.id } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ data: null, error: message }, { status: 500 });
  }
}
