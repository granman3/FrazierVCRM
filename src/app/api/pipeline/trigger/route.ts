import { NextRequest, NextResponse } from "next/server";

export async function POST(_request: NextRequest) {
  try {
    // TODO: wire up actual pipeline call
    // import { runPipeline } from "@/pipeline/main";
    // runPipeline().catch(console.error); // fire-and-forget

    return NextResponse.json({ data: { status: "started" } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ data: null, error: message }, { status: 500 });
  }
}
