import { NextRequest, NextResponse } from "next/server";
import { like, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { contacts, companies, newsItems } from "@/db/schema";

export async function GET(request: NextRequest) {
  try {
    const db = getDb(process.env.DATABASE_URL!);
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q");

    if (!q || q.trim().length === 0) {
      return NextResponse.json({ data: null, error: "Missing search term ?q=" }, { status: 400 });
    }

    const pattern = `%${q}%`;

    const [contactResults, companyResults, newsResults] = await Promise.all([
      db
        .select({
          id: contacts.id,
          fullName: contacts.fullName,
          email: contacts.email,
          company: contacts.company,
        })
        .from(contacts)
        .where(
          sql`${contacts.fullName} ILIKE ${pattern} OR ${contacts.email} ILIKE ${pattern} OR ${contacts.company} ILIKE ${pattern}`
        )
        .limit(20),

      db
        .select({
          id: companies.id,
          name: companies.name,
          sector: companies.sector,
          stage: companies.stage,
        })
        .from(companies)
        .where(like(companies.name, pattern))
        .limit(20),

      db
        .select({
          id: newsItems.id,
          headline: newsItems.headline,
          url: newsItems.url,
          company: newsItems.company,
          publishedAt: newsItems.publishedAt,
        })
        .from(newsItems)
        .where(like(newsItems.headline, pattern))
        .limit(20),
    ]);

    return NextResponse.json({
      data: {
        contacts: contactResults,
        companies: companyResults,
        news: newsResults,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ data: null, error: message }, { status: 500 });
  }
}
