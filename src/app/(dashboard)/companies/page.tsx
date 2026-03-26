import Link from "next/link";
import { getDb } from "@/db";
import { companies } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface CompaniesPageProps {
  readonly searchParams: { status?: string };
}

const STATUS_TABS = ["all", "portfolio", "watchlist", "prospect", "exited"] as const;

type StatusTab = (typeof STATUS_TABS)[number];

function statusVariant(status: string) {
  const map: Record<string, "success" | "default" | "warning" | "secondary" | "destructive"> = {
    portfolio: "success",
    watchlist: "default",
    prospect: "warning",
    exited: "secondary",
  };
  return map[status] ?? "secondary";
}

export default async function CompaniesPage({ searchParams }: CompaniesPageProps) {
  const db = getDb(process.env.DATABASE_URL!);
  const activeStatus = (searchParams.status ?? "all") as StatusTab;

  const query = db.select().from(companies).orderBy(desc(companies.updatedAt));

  const rows =
    activeStatus === "all"
      ? await query
      : await query.where(eq(companies.status, activeStatus));

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Companies</h2>

      <div className="flex gap-1 rounded-md border bg-gray-50 p-1">
        {STATUS_TABS.map((tab) => (
          <Link
            key={tab}
            href={`/companies${tab === "all" ? "" : `?status=${tab}`}`}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeStatus === tab
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {rows.length === 0 ? (
          <p className="col-span-full text-sm text-gray-500">
            No companies found.
          </p>
        ) : (
          rows.map((company) => (
            <Link key={company.id} href={`/companies/${company.id}`}>
              <Card className="transition-shadow hover:shadow-md">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{company.name}</CardTitle>
                    <Badge variant={statusVariant(company.status)}>
                      {company.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1 text-sm text-gray-600">
                    {company.sector && <p>Sector: {company.sector}</p>}
                    {company.stage && <p>Stage: {company.stage}</p>}
                    {company.headcount != null && (
                      <p>Headcount: {company.headcount.toLocaleString()}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
