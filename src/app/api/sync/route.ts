import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { integrationSecrets, auditLog } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import PgBoss from "pg-boss";

let boss: PgBoss | null = null;

async function getBoss(): Promise<PgBoss> {
  if (!boss) {
    boss = new PgBoss(process.env.DATABASE_URL!);
    await boss.start();
  }
  return boss;
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { type } = body;

  if (!type || !["contacts", "vip-classifier", "chief-of-staff"].includes(type)) {
    return NextResponse.json(
      { error: "Invalid sync type. Must be 'contacts', 'vip-classifier', or 'chief-of-staff'" },
      { status: 400 }
    );
  }

  try {
    const boss = await getBoss();

    let jobId: string | null = null;

    switch (type) {
      case "contacts":
        // Check if any contact source is connected
        const contactIntegration = await db.query.integrationSecrets.findFirst({
          where: and(
            eq(integrationSecrets.tenantId, session.user.tenantId),
            isNull(integrationSecrets.revokedAt)
          ),
        });

        if (!contactIntegration) {
          return NextResponse.json(
            { error: "No contact source connected" },
            { status: 400 }
          );
        }

        jobId = await boss.send("contacts-sync", {
          tenantId: session.user.tenantId,
          sourceType: contactIntegration.integrationType,
          fullSync: true,
        });
        break;

      case "vip-classifier":
        jobId = await boss.send("vip-classifier", {
          tenantId: session.user.tenantId,
          incrementalOnly: false,
        });
        break;

      case "chief-of-staff":
        jobId = await boss.send("chief-of-staff", {
          tenantId: session.user.tenantId,
        });
        break;
    }

    // Audit log
    await db.insert(auditLog).values({
      tenantId: session.user.tenantId,
      userId: session.user.id,
      action: "sync.triggered",
      targetType: "job",
      targetId: jobId || undefined,
      metadata: { type },
    });

    return NextResponse.json({
      success: true,
      jobId,
      message: `${type} sync triggered`,
    });
  } catch (error) {
    console.error("Failed to trigger sync:", error);
    return NextResponse.json(
      { error: "Failed to trigger sync" },
      { status: 500 }
    );
  }
}
