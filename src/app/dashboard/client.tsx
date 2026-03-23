"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Cloud,
  Users,
  Star,
  Activity,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Settings,
  LogOut,
  ChevronRight,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { formatRelativeTime } from "@/lib/utils";

interface Integration {
  type: string;
  status: string;
  lastTested?: string;
  error?: string;
}

interface AutomationRun {
  id: string;
  workflowName: string;
  status: string;
  startedAt: string;
  finishedAt?: string;
  vipsConsidered: number;
  draftsCreated: number;
  skippedNoSignal: number;
  errorSummary?: string;
}

interface DashboardClientProps {
  userName: string;
  integrations: Integration[];
  recentRuns: AutomationRun[];
  stats: {
    pendingVips: number;
    activeVips: number;
    totalContacts: number;
  };
}

const INTEGRATION_LABELS: Record<string, string> = {
  carddav: "iCloud Contacts",
  google_contacts: "Google Contacts",
  proxycurl: "LinkedIn Enrichment",
};

const WORKFLOW_LABELS: Record<string, string> = {
  "contacts-sync": "Contact Sync",
  "vip-classifier": "VIP Classification",
  "chief-of-staff": "Daily Digest",
};

export function DashboardClient({
  userName,
  integrations,
  recentRuns,
  stats,
}: DashboardClientProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "failed":
        return <XCircle className="w-4 h-4 text-red-500" />;
      case "running":
        return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
      default:
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return <Badge variant="success">Healthy</Badge>;
      case "failed":
        return <Badge variant="destructive">Error</Badge>;
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Contacts</p>
                  <p className="text-3xl font-bold">{stats.totalContacts}</p>
                </div>
                <Users className="w-8 h-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active VIPs</p>
                  <p className="text-3xl font-bold">{stats.activeVips}</p>
                </div>
                <Star className="w-8 h-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card className={stats.pendingVips > 0 ? "border-blue-200 bg-blue-50/50" : ""}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending Approval</p>
                  <p className="text-3xl font-bold">{stats.pendingVips}</p>
                </div>
                {stats.pendingVips > 0 && (
                  <Link href="/vips">
                    <Button size="sm">Review</Button>
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Integration Health */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cloud className="w-5 h-5" />
                Integration Health
              </CardTitle>
              <CardDescription>Status of your connected services</CardDescription>
            </CardHeader>
            <CardContent>
              {integrations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Cloud className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No integrations connected</p>
                  <Link href="/settings">
                    <Button variant="outline" className="mt-4">
                      Connect Integration
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {integrations.map((integration) => (
                    <div
                      key={integration.type}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div className="flex items-center gap-3">
                        {getStatusIcon(integration.status)}
                        <div>
                          <p className="font-medium">
                            {INTEGRATION_LABELS[integration.type] || integration.type}
                          </p>
                          {integration.lastTested && (
                            <p className="text-xs text-muted-foreground">
                              Last checked {formatRelativeTime(integration.lastTested)}
                            </p>
                          )}
                        </div>
                      </div>
                      {getStatusBadge(integration.status)}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Runs */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Recent Activity
              </CardTitle>
              <CardDescription>Latest automation runs</CardDescription>
            </CardHeader>
            <CardContent>
              {recentRuns.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No recent activity</p>
                  <p className="text-sm mt-2">
                    Automations will run once you've connected contact sources and approved VIPs.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentRuns.slice(0, 5).map((run) => (
                    <div
                      key={run.id}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div className="flex items-center gap-3">
                        {getStatusIcon(run.status)}
                        <div>
                          <p className="font-medium">
                            {WORKFLOW_LABELS[run.workflowName] || run.workflowName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatRelativeTime(run.startedAt)}
                            {run.status === "success" && run.draftsCreated > 0 && (
                              <span className="ml-2">
                                • {run.draftsCreated} draft{run.draftsCreated !== 1 ? "s" : ""}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  ))}

                  {recentRuns.length > 5 && (
                    <Link
                      href="/settings"
                      className="block text-center text-sm text-primary hover:underline"
                    >
                      View all activity
                    </Link>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Link href="/vips">
                <Button variant="outline">
                  <Star className="w-4 h-4 mr-2" />
                  Manage VIPs
                </Button>
              </Link>
              <Link href="/contacts">
                <Button variant="outline">
                  <Users className="w-4 h-4 mr-2" />
                  View Contacts
                </Button>
              </Link>
              <Link href="/settings">
                <Button variant="outline">
                  <Cloud className="w-4 h-4 mr-2" />
                  Integrations
                </Button>
              </Link>
              <Button variant="outline" disabled>
                <RefreshCw className="w-4 h-4 mr-2" />
                Sync Now
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
  );
}
