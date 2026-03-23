import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { tenants, users, invites } from "@/db/schema";
import { desc, count, isNull } from "drizzle-orm";
import { AdminClient } from "./client";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/api/auth/signin");
  }

  // Only platform admins can access
  if (session.user.role !== "platform_admin") {
    redirect("/dashboard");
  }

  const [tenantsList, userCounts, pendingInvites] = await Promise.all([
    db.query.tenants.findMany({
      orderBy: [desc(tenants.createdAt)],
      limit: 50,
    }),

    db.select({ count: count() }).from(users),

    db
      .select({ count: count() })
      .from(invites)
      .where(isNull(invites.acceptedAt)),
  ]);

  return (
    <AdminClient
      tenants={tenantsList.map((t) => ({
        id: t.id,
        name: t.name,
        status: t.status,
        createdAt: t.createdAt.toISOString(),
        setupComplete: !!t.setupCompletedAt,
      }))}
      stats={{
        totalTenants: tenantsList.length,
        totalUsers: userCounts[0]?.count || 0,
        pendingInvites: pendingInvites[0]?.count || 0,
      }}
    />
  );
}
