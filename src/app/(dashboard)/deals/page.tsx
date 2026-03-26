import { getDb } from "@/db";
import { deals, companies, users } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const STAGE_ORDER = [
  "sourced",
  "screening",
  "diligence",
  "ic_review",
  "term_sheet",
  "closed",
  "passed",
] as const;

function stageVariant(stage: string) {
  const map: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
    sourced: "secondary",
    screening: "default",
    diligence: "default",
    ic_review: "warning",
    term_sheet: "warning",
    closed: "success",
    passed: "destructive",
  };
  return map[stage] ?? "secondary";
}

function formatCurrency(amount: number | null): string {
  if (amount == null) return "-";
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount}`;
}

interface DealRow {
  readonly id: string;
  readonly dealName: string;
  readonly stage: string;
  readonly checkSize: number | null;
  readonly companyName: string;
  readonly assigneeName: string | null;
}

export default async function DealsPage() {
  const db = getDb(process.env.DATABASE_URL!);

  const rows = await db
    .select({
      id: deals.id,
      dealName: deals.dealName,
      stage: deals.stage,
      checkSize: deals.checkSize,
      companyName: companies.name,
      assigneeName: users.name,
    })
    .from(deals)
    .innerJoin(companies, eq(deals.companyId, companies.id))
    .leftJoin(users, eq(deals.assignedTo, users.id))
    .orderBy(desc(deals.stageUpdatedAt));

  const grouped = STAGE_ORDER.reduce<Record<string, ReadonlyArray<DealRow>>>(
    (acc, stage) => ({
      ...acc,
      [stage]: rows.filter((r) => r.stage === stage),
    }),
    {}
  );

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Deals</h2>

      {STAGE_ORDER.map((stage) => {
        const stageDeals = grouped[stage] ?? [];
        if (stageDeals.length === 0) return null;

        return (
          <section key={stage} className="space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold capitalize text-gray-800">
                {stage.replace("_", " ")}
              </h3>
              <Badge variant={stageVariant(stage)}>{stageDeals.length}</Badge>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {stageDeals.map((deal) => (
                <Card key={deal.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{deal.dealName}</CardTitle>
                    <p className="text-sm text-gray-600">{deal.companyName}</p>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between text-sm text-gray-500">
                      <span>{deal.assigneeName ?? "Unassigned"}</span>
                      <span className="font-medium">
                        {formatCurrency(deal.checkSize)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        );
      })}

      {rows.length === 0 && (
        <p className="text-sm text-gray-500">No deals in the pipeline.</p>
      )}
    </div>
  );
}
