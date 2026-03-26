import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { tags } from "@/db/schema";

const createTagSchema = z.object({
  name: z.string().min(1),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export async function GET(_request: NextRequest) {
  try {
    const db = getDb(process.env.DATABASE_URL!);
    const rows = await db.select().from(tags);
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
    const parsed = createTagSchema.parse(body);

    const [created] = await db
      .insert(tags)
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

export async function DELETE(request: NextRequest) {
  try {
    const db = getDb(process.env.DATABASE_URL!);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ data: null, error: "Missing id parameter" }, { status: 400 });
    }

    const [deleted] = await db
      .delete(tags)
      .where(eq(tags.id, id))
      .returning({ id: tags.id });

    if (!deleted) {
      return NextResponse.json({ data: null, error: "Tag not found" }, { status: 404 });
    }

    return NextResponse.json({ data: { id: deleted.id } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ data: null, error: message }, { status: 500 });
  }
}
