import { NextRequest, NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { getDb } from "@/db";
import { newsItems } from "@/db/schema";

export async function GET(request: NextRequest) {
  try {
    const db = getDb(process.env.DATABASE_URL!);
    const { searchParams } = new URL(request.url);
    const company = searchParams.get("company");

    const baseQuery = db
      .select()
      .from(newsItems)
      .orderBy(desc(newsItems.fetchedAt));

    const rows = company
      ? await baseQuery.where(eq(newsItems.company, company))
      : await baseQuery;

    return NextResponse.json({ data: rows });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ data: null, error: message }, { status: 500 });
  }
}
