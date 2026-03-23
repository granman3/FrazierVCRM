import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { vipCandidates, contactsMerged, vipList, auditLog } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";

/**
 * GET: List pending VIP candidates for review
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const candidates = await db.query.vipCandidates.findMany({
    where: and(
      eq(vipCandidates.tenantId, session.user.tenantId),
      isNull(vipCandidates.approved) // Pending only
    ),
    with: {
      contact: true,
    },
    orderBy: (candidates, { desc }) => [desc(candidates.confidence)],
    limit: 50,
  });

  return NextResponse.json({
    candidates: candidates.map((c) => ({
      id: c.id,
      contactId: c.contactId,
      confidence: c.confidence,
      reason: c.reason,
      category: c.category,
      suggestedAt: c.suggestedAt,
      contact: c.contact
        ? {
            id: c.contact.id,
            fullName: c.contact.fullName,
            company: c.contact.company,
            title: c.contact.title,
            email: c.contact.email,
            linkedinUrl: c.contact.linkedinUrl,
          }
        : null,
    })),
  });
}

/**
 * POST: Approve or reject a VIP candidate
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

  const { candidateId, approved, category } = body;

  if (!candidateId || typeof approved !== "boolean") {
    return NextResponse.json(
      { error: "Missing required fields: candidateId, approved" },
      { status: 400 }
    );
  }

  // Get the candidate
  const candidate = await db.query.vipCandidates.findFirst({
    where: and(
      eq(vipCandidates.id, candidateId),
      eq(vipCandidates.tenantId, session.user.tenantId)
    ),
  });

  if (!candidate) {
    return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  }

  // Update the candidate
  await db
    .update(vipCandidates)
    .set({
      approved,
      reviewedAt: new Date(),
    })
    .where(eq(vipCandidates.id, candidateId));

  // If approved, add to VIP list
  if (approved) {
    await db
      .insert(vipList)
      .values({
        tenantId: session.user.tenantId,
        contactId: candidate.contactId,
        category: category || candidate.category,
        addedBy: "user_approval",
      })
      .onConflictDoNothing();
  }

  // Audit log
  await db.insert(auditLog).values({
    tenantId: session.user.tenantId,
    userId: session.user.id,
    action: approved ? "vip.approved" : "vip.rejected",
    targetType: "vip_candidate",
    targetId: candidateId,
    metadata: { contactId: candidate.contactId, category },
  });

  return NextResponse.json({ success: true, approved });
}
