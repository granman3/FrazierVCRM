import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { runPipeline } from "@/pipeline/run";
import { loadConfig } from "@/lib/config";

export async function POST(_request: NextRequest) {
  try {
    const config = loadConfig();
    const db = getDb(config.DATABASE_URL);

    // Fire-and-forget: start pipeline in background, return immediately
    const runPromise = runPipeline(db, config);
    runPromise.catch(() => {
      // Errors are logged inside runPipeline and stored in the runs table
    });

    return NextResponse.json({ data: { status: "started" } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ data: null, error: message }, { status: 500 });
  }
}
