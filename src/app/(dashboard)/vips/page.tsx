import { getDb } from "@/db";
import { vips, contacts } from "@/db/schema";
import { desc, eq, and } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { VipApproveReject, VipDeactivate } from "./vip-actions";

export default async function VipsPage() {
  const db = getDb(process.env.DATABASE_URL!);

  const [pendingVips, activeVips] = await Promise.all([
    db
      .select({
        id: vips.id,
        confidence: vips.confidence,
        reason: vips.reason,
        category: vips.category,
        addedAt: vips.addedAt,
        contactName: contacts.fullName,
        contactCompany: contacts.company,
        contactTitle: contacts.title,
      })
      .from(vips)
      .innerJoin(contacts, eq(vips.contactId, contacts.id))
      .where(and(eq(vips.autoApproved, false), eq(vips.active, false)))
      .orderBy(desc(vips.addedAt)),
    db
      .select({
        id: vips.id,
        confidence: vips.confidence,
        reason: vips.reason,
        category: vips.category,
        addedAt: vips.addedAt,
        contactName: contacts.fullName,
        contactCompany: contacts.company,
        contactTitle: contacts.title,
      })
      .from(vips)
      .innerJoin(contacts, eq(vips.contactId, contacts.id))
      .where(eq(vips.active, true))
      .orderBy(desc(vips.addedAt)),
  ]);

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold text-gray-900">VIP Management</h2>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-800">
          Pending Review ({pendingVips.length})
        </h3>
        {pendingVips.length === 0 ? (
          <p className="text-sm text-gray-500">No VIPs pending review.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {pendingVips.map((vip) => (
              <Card key={vip.id} className="border-yellow-200 bg-yellow-50">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      {vip.contactName}
                    </CardTitle>
                    <Badge variant="warning">{vip.category}</Badge>
                  </div>
                  <p className="text-sm text-gray-600">
                    {vip.contactTitle}
                    {vip.contactCompany ? ` at ${vip.contactCompany}` : ""}
                  </p>
                </CardHeader>
                <CardContent>
                  <p className="mb-2 text-sm text-gray-700">{vip.reason}</p>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="text-xs text-gray-500">Confidence:</span>
                    <div className="h-2 w-24 rounded-full bg-gray-200">
                      <div
                        className="h-2 rounded-full bg-yellow-500"
                        style={{ width: `${Math.round(vip.confidence * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500">
                      {Math.round(vip.confidence * 100)}%
                    </span>
                  </div>
                  <VipApproveReject vipId={vip.id} />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-800">
          Active VIPs ({activeVips.length})
        </h3>
        {activeVips.length === 0 ? (
          <p className="text-sm text-gray-500">No active VIPs.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {activeVips.map((vip) => (
              <Card key={vip.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      {vip.contactName}
                    </CardTitle>
                    <Badge variant="success">{vip.category}</Badge>
                  </div>
                  <p className="text-sm text-gray-600">
                    {vip.contactTitle}
                    {vip.contactCompany ? ` at ${vip.contactCompany}` : ""}
                  </p>
                </CardHeader>
                <CardContent>
                  <p className="mb-2 text-sm text-gray-700">{vip.reason}</p>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="text-xs text-gray-500">Confidence:</span>
                    <div className="h-2 w-24 rounded-full bg-gray-200">
                      <div
                        className="h-2 rounded-full bg-green-500"
                        style={{ width: `${Math.round(vip.confidence * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500">
                      {Math.round(vip.confidence * 100)}%
                    </span>
                  </div>
                  <VipDeactivate vipId={vip.id} />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
