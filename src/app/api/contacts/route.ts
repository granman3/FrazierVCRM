import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, desc, like, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { contacts, vips } from "@/db/schema";
import { randomUUID } from "crypto";

const createContactSchema = z.object({
  fullName: z.string().min(1),
  company: z.string().optional(),
  title: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  linkedinUrl: z.string().url().optional(),
  crunchbaseUrl: z.string().url().optional(),
  photoUrl: z.string().url().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const db = getDb(process.env.DATABASE_URL!);
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q");
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)));
    const offset = (page - 1) * limit;

    const conditions = q
      ? like(contacts.fullName, `%${q}%`)
      : undefined;

    const rows = await db
      .select({
        id: contacts.id,
        sourceType: contacts.sourceType,
        sourceId: contacts.sourceId,
        fullName: contacts.fullName,
        company: contacts.company,
        title: contacts.title,
        email: contacts.email,
        phone: contacts.phone,
        linkedinUrl: contacts.linkedinUrl,
        crunchbaseUrl: contacts.crunchbaseUrl,
        photoUrl: contacts.photoUrl,
        lastSyncedAt: contacts.lastSyncedAt,
        createdAt: contacts.createdAt,
        updatedAt: contacts.updatedAt,
        vipId: vips.id,
        vipActive: vips.active,
        vipCategory: vips.category,
        vipConfidence: vips.confidence,
      })
      .from(contacts)
      .leftJoin(vips, eq(contacts.id, vips.contactId))
      .where(conditions)
      .orderBy(desc(contacts.updatedAt))
      .limit(limit)
      .offset(offset);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(contacts)
      .where(conditions);

    return NextResponse.json({
      data: rows,
      meta: {
        total: Number(countResult.count),
        page,
        limit,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ data: null, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = getDb(process.env.DATABASE_URL!);
    const body = await request.json();
    const parsed = createContactSchema.parse(body);

    const [created] = await db
      .insert(contacts)
      .values({
        ...parsed,
        sourceType: "manual",
        sourceId: `manual-${randomUUID()}`,
      })
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
