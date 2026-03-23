"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  CheckCircle,
  XCircle,
  ExternalLink,
  Users,
  UserCheck,
  Clock,
  Loader2,
} from "lucide-react";

interface Contact {
  id: string;
  fullName: string;
  company?: string;
  title?: string;
  email?: string;
  linkedinUrl?: string;
}

interface VipCandidate {
  id: string;
  contactId: string;
  confidence: number;
  reason: string;
  category: string;
  suggestedAt: string;
  contact: Contact | null;
}

interface Vip {
  id: string;
  category: string;
  addedAt: string;
  addedBy: string;
  contact: Contact | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  portfolio_founder: "Portfolio Founder",
  lp: "LP",
  coinvestor: "Co-investor",
  advisor: "Advisor",
  other: "Other",
};

const CATEGORY_COLORS: Record<string, string> = {
  portfolio_founder: "bg-blue-100 text-blue-800",
  lp: "bg-green-100 text-green-800",
  coinvestor: "bg-purple-100 text-purple-800",
  advisor: "bg-yellow-100 text-yellow-800",
  other: "bg-gray-100 text-gray-800",
};

export function VipsClient() {
  const [activeTab, setActiveTab] = useState("pending");
  const [candidates, setCandidates] = useState<VipCandidate[]>([]);
  const [vips, setVips] = useState<Vip[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<"approve" | "reject" | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [candidatesRes, vipsRes] = await Promise.all([
        fetch("/api/vip-candidates"),
        fetch("/api/vips"),
      ]);

      if (candidatesRes.ok) {
        const data = await candidatesRes.json();
        setCandidates(data.candidates);
      }

      if (vipsRes.ok) {
        const data = await vipsRes.json();
        setVips(data.vips);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    }
    setLoading(false);
  }

  async function handleApprove(candidateId: string) {
    setProcessing(true);
    try {
      const res = await fetch("/api/vip-candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId, approved: true }),
      });

      if (res.ok) {
        setCandidates((prev) => prev.filter((c) => c.id !== candidateId));
        fetchData(); // Refresh VIPs list
      }
    } catch (error) {
      console.error("Failed to approve:", error);
    }
    setProcessing(false);
  }

  async function handleReject(candidateId: string) {
    setProcessing(true);
    try {
      const res = await fetch("/api/vip-candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId, approved: false }),
      });

      if (res.ok) {
        setCandidates((prev) => prev.filter((c) => c.id !== candidateId));
      }
    } catch (error) {
      console.error("Failed to reject:", error);
    }
    setProcessing(false);
  }

  async function handleBulkAction(approved: boolean) {
    if (selectedIds.size === 0) return;

    setProcessing(true);
    try {
      const res = await fetch("/api/vip-candidates/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateIds: Array.from(selectedIds),
          approved,
        }),
      });

      if (res.ok) {
        setCandidates((prev) => prev.filter((c) => !selectedIds.has(c.id)));
        setSelectedIds(new Set());
        if (approved) {
          fetchData(); // Refresh VIPs list
        }
      }
    } catch (error) {
      console.error("Failed to process bulk action:", error);
    }
    setProcessing(false);
    setBulkAction(null);
  }

  async function handleRemoveVip(vipId: string) {
    try {
      const res = await fetch(`/api/vips/${vipId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setVips((prev) => prev.filter((v) => v.id !== vipId));
      }
    } catch (error) {
      console.error("Failed to remove VIP:", error);
    }
  }

  function toggleSelection(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === candidates.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(candidates.map((c) => c.id)));
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">VIP Management</h1>
        <p className="text-muted-foreground mt-2">
          Review AI-suggested VIPs and manage your relationship list
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{candidates.length}</div>
            <p className="text-xs text-muted-foreground">AI-suggested contacts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active VIPs</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{vips.length}</div>
            <p className="text-xs text-muted-foreground">Approved relationships</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Categories</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(vips.map((v) => v.category)).size}
            </div>
            <p className="text-xs text-muted-foreground">Active categories</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="pending">
            Pending Review ({candidates.length})
          </TabsTrigger>
          <TabsTrigger value="approved">
            Approved VIPs ({vips.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          {candidates.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
                <h3 className="text-lg font-semibold">All caught up!</h3>
                <p className="text-muted-foreground">
                  No pending VIP suggestions to review
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Bulk actions bar */}
              <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={selectedIds.size === candidates.length && candidates.length > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                  <span className="text-sm text-muted-foreground">
                    {selectedIds.size > 0
                      ? `${selectedIds.size} selected`
                      : "Select all"}
                  </span>
                </div>
                {selectedIds.size > 0 && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setBulkAction("approve")}
                      disabled={processing}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Approve All
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setBulkAction("reject")}
                      disabled={processing}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Reject All
                    </Button>
                  </div>
                )}
              </div>

              {/* Candidate cards */}
              {candidates.map((candidate) => (
                <CandidateCard
                  key={candidate.id}
                  candidate={candidate}
                  selected={selectedIds.has(candidate.id)}
                  onToggleSelect={() => toggleSelection(candidate.id)}
                  onApprove={() => handleApprove(candidate.id)}
                  onReject={() => handleReject(candidate.id)}
                  processing={processing}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="approved">
          {vips.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">No VIPs yet</h3>
                <p className="text-muted-foreground">
                  Approve some candidates to start building your VIP list
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {vips.map((vip) => (
                <VipCard
                  key={vip.id}
                  vip={vip}
                  onRemove={() => handleRemoveVip(vip.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Bulk action confirmation */}
      <AlertDialog open={bulkAction !== null} onOpenChange={() => setBulkAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {bulkAction === "approve" ? "Approve" : "Reject"} {selectedIds.size} candidates?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {bulkAction === "approve"
                ? "These contacts will be added to your VIP list and monitored for updates."
                : "These contacts will be marked as rejected and won't appear again."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleBulkAction(bulkAction === "approve")}>
              {bulkAction === "approve" ? "Approve All" : "Reject All"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CandidateCard({
  candidate,
  selected,
  onToggleSelect,
  onApprove,
  onReject,
  processing,
}: {
  candidate: VipCandidate;
  selected: boolean;
  onToggleSelect: () => void;
  onApprove: () => void;
  onReject: () => void;
  processing: boolean;
}) {
  const contact = candidate.contact;

  return (
    <Card className={selected ? "ring-2 ring-primary" : ""}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <Checkbox checked={selected} onCheckedChange={onToggleSelect} className="mt-1" />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold truncate">{contact?.fullName || "Unknown"}</h3>
              <Badge className={CATEGORY_COLORS[candidate.category] || CATEGORY_COLORS.other}>
                {CATEGORY_LABELS[candidate.category] || candidate.category}
              </Badge>
            </div>

            {contact?.title && (
              <p className="text-sm text-muted-foreground truncate">{contact.title}</p>
            )}
            {contact?.company && (
              <p className="text-sm text-muted-foreground truncate">{contact.company}</p>
            )}

            <div className="mt-2 p-2 bg-muted/50 rounded text-sm">
              <p className="text-muted-foreground">{candidate.reason}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Confidence: {Math.round(candidate.confidence * 100)}%
              </p>
            </div>

            <div className="flex items-center gap-2 mt-3">
              {contact?.linkedinUrl && (
                <a
                  href={contact.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                >
                  <ExternalLink className="h-3 w-3" />
                  LinkedIn
                </a>
              )}
              {contact?.email && (
                <span className="text-sm text-muted-foreground">{contact.email}</span>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Button size="sm" onClick={onApprove} disabled={processing}>
              <CheckCircle className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={onReject} disabled={processing}>
              <XCircle className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function VipCard({ vip, onRemove }: { vip: Vip; onRemove: () => void }) {
  const contact = vip.contact;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h3 className="font-semibold">{contact?.fullName || "Unknown"}</h3>
            <Badge className={CATEGORY_COLORS[vip.category] || CATEGORY_COLORS.other}>
              {CATEGORY_LABELS[vip.category] || vip.category}
            </Badge>
          </div>
          <Button size="sm" variant="ghost" onClick={onRemove}>
            <XCircle className="h-4 w-4" />
          </Button>
        </div>

        {contact?.title && (
          <p className="text-sm text-muted-foreground">{contact.title}</p>
        )}
        {contact?.company && (
          <p className="text-sm text-muted-foreground">{contact.company}</p>
        )}

        <div className="flex items-center gap-2 mt-3">
          {contact?.linkedinUrl && (
            <a
              href={contact.linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:underline flex items-center gap-1"
            >
              <ExternalLink className="h-3 w-3" />
              LinkedIn
            </a>
          )}
        </div>

        <p className="text-xs text-muted-foreground mt-2">
          Added {new Date(vip.addedAt).toLocaleDateString()} via {vip.addedBy}
        </p>
      </CardContent>
    </Card>
  );
}
