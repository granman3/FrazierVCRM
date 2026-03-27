import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { contacts } from "@/db/schema";
import { randomUUID } from "crypto";

function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = splitCsvLine(lines[0]);

  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, i) => {
      row[header] = values[i] ?? "";
    });
    return row;
  });
}

function mapCsvRow(row: Record<string, string>) {
  return {
    fullName: row["fullName"] || row["full_name"] || row["name"] || "",
    company: row["company"] || undefined,
    title: row["title"] || undefined,
    email: row["email"] || undefined,
    phone: row["phone"] || undefined,
    linkedinUrl: row["linkedinUrl"] || row["linkedin_url"] || undefined,
    sourceType: "csv" as const,
    sourceId: `csv-${randomUUID()}`,
  };
}

export async function POST(request: NextRequest) {
  try {
    const db = getDb(process.env.DATABASE_URL!);
    const csvText = await request.text();

    if (!csvText.trim()) {
      return NextResponse.json({ data: null, error: "Empty CSV body" }, { status: 400 });
    }

    const rows = parseCsv(csvText);
    if (rows.length === 0) {
      return NextResponse.json({ data: null, error: "No data rows found in CSV" }, { status: 400 });
    }

    const values = rows
      .map(mapCsvRow)
      .filter((v) => v.fullName.length > 0);

    if (values.length === 0) {
      return NextResponse.json({ data: null, error: "No valid contacts found in CSV" }, { status: 400 });
    }

    await db.insert(contacts).values(values);

    return NextResponse.json({ data: { imported: values.length } }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ data: null, error: message }, { status: 500 });
  }
}
