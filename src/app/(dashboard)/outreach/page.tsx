import { getDb } from "@/db";
import { outreachLog, contacts } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export default async function OutreachPage() {
  const db = getDb(process.env.DATABASE_URL!);

  const items = await db
    .select({
      id: outreachLog.id,
      triggerType: outreachLog.triggerType,
      draftText: outreachLog.draftText,
      sentAt: outreachLog.sentAt,
      contactName: contacts.fullName,
      contactEmail: contacts.email,
    })
    .from(outreachLog)
    .innerJoin(contacts, eq(outreachLog.contactId, contacts.id))
    .orderBy(desc(outreachLog.sentAt))
    .limit(50);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold tracking-tight text-foreground">
        Outreach Log
      </h2>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No outreach messages yet.</p>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left text-sm font-medium text-muted-foreground">
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Trigger</th>
                  <th className="px-4 py-3">Draft Preview</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-border transition-colors hover:bg-secondary/50">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-foreground">
                        {item.contactName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.contactEmail ?? ""}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={item.triggerType === "job_change" ? "warning" : "default"}>
                        {item.triggerType}
                      </Badge>
                    </td>
                    <td className="max-w-md px-4 py-3">
                      <p className="line-clamp-2 text-sm text-muted-foreground">
                        {item.draftText}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {item.sentAt.toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
