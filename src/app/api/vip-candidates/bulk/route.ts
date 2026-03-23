import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { vipCandidates, vipList, auditLog } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";

/**
 * POST: Bulk approve or reject VIP candidates
 */
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

  const { candidateIds, approved } = body;

  if (!Array.isArray(candidateIds) || candidateIds.length === 0 || typeof approved !== "boolean") {
    return NextResponse.json(
      { error: "Missing required fields: candidateIds (array), approved (boolean)" },
      { status: 400 }
    );
  }

  // Get the candidates
  const candidates = await db.query.vipCandidates.findMany({
    where: and(
      inArray(vipCandidates.id, candidateIds),
      eq(vipCandidates.tenantId, session.user.tenantId)
    ),
  });

  if (candidates.length === 0) {
    return NextResponse.json({ error: "No candidates found" }, { status: 404 });
  }

  // Update all candidates
  await db
    .update(vipCandidates)
    .set({
      approved,
      reviewedAt: new Date(),
    })
    .where(
      and(
        inArray(vipCandidates.id, candidateIds),
        eq(vipCandidates.tenantId, session.user.tenantId)
      )
    );

  // If approved, add all to VIP list
  if (approved) {
    for (const candidate of candidates) {
      await db
        .insert(vipList)
        .values({
          tenantId: session.user.tenantId,
          contactId: candidate.contactId,
          category: candidate.category,
          addedBy: "bulk_approval",
        })
        .onConflictDoNothing();
    }
  }

  // Audit log
  await db.insert(auditLog).values({
    tenantId: session.user.tenantId,
    userId: session.user.id,
    action: approved ? "vip.bulk_approved" : "vip.bulk_rejected",
    targetType: "vip_candidates",
    targetId: candidateIds.join(","),
    metadata: { count: candidates.length },
  });

  return NextResponse.json({
    success: true,
    approved,
    count: candidates.length,
  });
}
