import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const completeSetupSchema = z.object({
  timezone: z.string(),
  digestTime: z.string(),
  digestEmail: z.string().email(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { timezone, digestTime, digestEmail } = completeSetupSchema.parse(body);

    // Update tenant with settings and mark setup complete
    await db
      .update(tenants)
      .set({
        timezone,
        setupCompletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, session.user.tenantId));

    // TODO: Store digest preferences (email, time) in a user preferences table

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Failed to complete setup:", error);
    return NextResponse.json(
      { error: "Failed to complete setup" },
      { status: 500 }
    );
  }
}
