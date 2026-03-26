import { getDb } from "@/db";
import { contacts, vips, companies, deals, runs } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function DashboardPage() {
  const db = getDb(process.env.DATABASE_URL!);

  const [contactCount, vipCount, companyCount, dealCount, recentRuns] =
    await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(contacts)
        .then((rows) => Number(rows[0]?.count ?? 0)),
      db
        .select({ count: sql<number>`count(*)` })
        .from(vips)
        .where(eq(vips.active, true))
        .then((rows) => Number(rows[0]?.count ?? 0)),
      db
        .select({ count: sql<number>`count(*)` })
        .from(companies)
        .where(eq(companies.status, "portfolio"))
        .then((rows) => Number(rows[0]?.count ?? 0)),
      db
        .select({ count: sql<number>`count(*)` })
        .from(deals)
        .then((rows) => Number(rows[0]?.count ?? 0)),
      db
        .select()
        .from(runs)
        .orderBy(desc(runs.startedAt))
        .limit(5),
    ]);

  const stats = [
    { label: "Total Contacts", value: contactCount },
    { label: "Active VIPs", value: vipCount },
    { label: "Portfolio Companies", value: companyCount },
    { label: "Open Deals", value: dealCount },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                {stat.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Pipeline Runs</CardTitle>
        </CardHeader>
        <CardContent>
          {recentRuns.length === 0 ? (
            <p className="text-sm text-gray-500">No pipeline runs yet.</p>
          ) : (
            <div className="space-y-3">
              {recentRuns.map((run) => (
                <div
                  key={run.id}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={
                        run.status === "completed"
                          ? "success"
                          : run.status === "failed"
                            ? "destructive"
                            : "warning"
                      }
                    >
                      {run.status}
                    </Badge>
                    <span className="text-sm text-gray-600">
                      {run.startedAt.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex gap-4 text-sm text-gray-500">
                    <span>{run.contactsSynced ?? 0} contacts</span>
                    <span>{run.vipsProcessed ?? 0} VIPs</span>
                    <span>{run.draftsCreated ?? 0} drafts</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
