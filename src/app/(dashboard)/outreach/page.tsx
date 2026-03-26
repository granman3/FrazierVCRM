import { getDb } from "@/db";
import { outreachLog, contacts } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
      <h2 className="text-2xl font-bold text-gray-900">Outreach Log</h2>

      {items.length === 0 ? (
        <p className="text-sm text-gray-500">No outreach messages yet.</p>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-sm font-medium text-gray-500">
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Trigger</th>
                  <th className="px-4 py-3">Draft Preview</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900">
                        {item.contactName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {item.contactEmail ?? ""}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge>{item.triggerType}</Badge>
                    </td>
                    <td className="max-w-md px-4 py-3">
                      <p className="line-clamp-2 text-sm text-gray-600">
                        {item.draftText}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
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
