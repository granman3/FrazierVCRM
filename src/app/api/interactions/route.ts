import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, desc, and } from "drizzle-orm";
import { getDb } from "@/db";
import { interactions, users } from "@/db/schema";

const createInteractionSchema = z.object({
  contactId: z.string().uuid().optional(),
  companyId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  type: z.string().min(1),
  subject: z.string().optional(),
  body: z.string().optional(),
  occurredAt: z.string().datetime().transform((s) => new Date(s)),
});

export async function GET(request: NextRequest) {
  try {
    const db = getDb(process.env.DATABASE_URL!);
    const { searchParams } = new URL(request.url);
    const contactId = searchParams.get("contactId");
    const companyId = searchParams.get("companyId");

    const conditions = [];
    if (contactId) conditions.push(eq(interactions.contactId, contactId));
    if (companyId) conditions.push(eq(interactions.companyId, companyId));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select({
        id: interactions.id,
        contactId: interactions.contactId,
        companyId: interactions.companyId,
        userId: interactions.userId,
        type: interactions.type,
        subject: interactions.subject,
        body: interactions.body,
        occurredAt: interactions.occurredAt,
        createdAt: interactions.createdAt,
        updatedAt: interactions.updatedAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(interactions)
      .leftJoin(users, eq(interactions.userId, users.id))
      .where(whereClause)
      .orderBy(desc(interactions.occurredAt));

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
    const parsed = createInteractionSchema.parse(body);

    const [created] = await db
      .insert(interactions)
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
