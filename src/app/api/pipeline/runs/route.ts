import { NextRequest, NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { getDb } from "@/db";
import { runs } from "@/db/schema";

export async function GET(_request: NextRequest) {
  try {
    const db = getDb(process.env.DATABASE_URL!);

    const rows = await db
      .select()
      .from(runs)
      .orderBy(desc(runs.startedAt))
      .limit(20);

    return NextResponse.json({ data: rows });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ data: null, error: message }, { status: 500 });
  }
}
