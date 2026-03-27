import { NextRequest, NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { getDb } from "@/db";
import { outreachLog, contacts } from "@/db/schema";

export async function GET(_request: NextRequest) {
  try {
    const db = getDb(process.env.DATABASE_URL!);

    const rows = await db
      .select({
        id: outreachLog.id,
        contactId: outreachLog.contactId,
        newsItemId: outreachLog.newsItemId,
        triggerType: outreachLog.triggerType,
        draftText: outreachLog.draftText,
        sentAt: outreachLog.sentAt,
        createdAt: outreachLog.createdAt,
        contactName: contacts.fullName,
        contactEmail: contacts.email,
        contactCompany: contacts.company,
      })
      .from(outreachLog)
      .innerJoin(contacts, eq(outreachLog.contactId, contacts.id))
      .orderBy(desc(outreachLog.sentAt))
      .limit(100);

    return NextResponse.json({ data: rows });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ data: null, error: message }, { status: 500 });
  }
}
