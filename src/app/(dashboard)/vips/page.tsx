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
      <h2 className="text-2xl font-semibold tracking-tight text-foreground">
        VIP Management
      </h2>

      <section className="space-y-4">
        <h3 className="text-lg font-medium text-foreground">
          Pending Review
          <span className="ml-2 text-sm text-muted-foreground">({pendingVips.length})</span>
        </h3>
        {pendingVips.length === 0 ? (
          <p className="text-sm text-muted-foreground">No VIPs pending review.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {pendingVips.map((vip) => (
              <Card key={vip.id} className="border-warm/30">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      {vip.contactName}
                    </CardTitle>
                    <Badge variant="warning">{vip.category}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {vip.contactTitle}
                    {vip.contactCompany ? ` at ${vip.contactCompany}` : ""}
                  </p>
                </CardHeader>
                <CardContent>
                  <p className="mb-3 text-sm text-muted-foreground">{vip.reason}</p>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Confidence:</span>
                    <div className="h-1.5 w-24 rounded-full bg-secondary">
                      <div
                        className="h-1.5 rounded-full bg-warm transition-all"
                        style={{ width: `${Math.round(vip.confidence * 100)}%` }}
                      />
                    </div>
                    <span className="font-mono text-xs text-warm">
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
        <h3 className="text-lg font-medium text-foreground">
          Active VIPs
          <span className="ml-2 text-sm text-muted-foreground">({activeVips.length})</span>
        </h3>
        {activeVips.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active VIPs.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {activeVips.map((vip) => (
              <Card key={vip.id} className="transition-colors duration-200 hover:border-sage-200/30">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      {vip.contactName}
                    </CardTitle>
                    <Badge variant="success">{vip.category}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {vip.contactTitle}
                    {vip.contactCompany ? ` at ${vip.contactCompany}` : ""}
                  </p>
                </CardHeader>
                <CardContent>
                  <p className="mb-3 text-sm text-muted-foreground">{vip.reason}</p>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Confidence:</span>
                    <div className="h-1.5 w-24 rounded-full bg-secondary">
                      <div
                        className="h-1.5 rounded-full bg-sage-200 transition-all"
                        style={{ width: `${Math.round(vip.confidence * 100)}%` }}
                      />
                    </div>
                    <span className="font-mono text-xs text-sage-200">
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
