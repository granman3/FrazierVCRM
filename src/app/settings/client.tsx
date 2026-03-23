"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  Cloud,
  CheckCircle,
  XCircle,
  AlertCircle,
  Trash2,
  Plus,
  Loader2,
  ExternalLink,
} from "lucide-react";

interface Integration {
  id: string;
  type: string;
  status: string;
  lastTested?: string;
  error?: string;
}

interface SettingsClientProps {
  integrations: Integration[];
}

const INTEGRATION_INFO: Record<string, { name: string; description: string }> = {
  carddav: {
    name: "iCloud Contacts",
    description: "Sync contacts from your iCloud account via CardDAV",
  },
  google_contacts: {
    name: "Google Contacts",
    description: "Sync contacts from your Google account",
  },
  proxycurl: {
    name: "LinkedIn Enrichment",
    description: "Enrich contacts with LinkedIn data and detect job changes",
  },
};

export function SettingsClient({ integrations: initialIntegrations }: SettingsClientProps) {
  const [integrations, setIntegrations] = useState(initialIntegrations);
  const [connectModal, setConnectModal] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "failed":
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return <Badge className="bg-green-100 text-green-800">Connected</Badge>;
      case "failed":
        return <Badge className="bg-red-100 text-red-800">Error</Badge>;
      default:
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
    }
  };

  const isConnected = (type: string) => {
    return integrations.some((i) => i.type === type);
  };

  async function handleConnect(type: string) {
    setIsConnecting(true);
    setError(null);

    try {
      let endpoint = "";
      let body: Record<string, string> = {};

      switch (type) {
        case "carddav":
          endpoint = "/api/integrations/carddav";
          body = {
            appleId: formData.appleId || "",
            appSpecificPassword: formData.appSpecificPassword || "",
          };
          break;
        case "google_contacts":
          // Start OAuth flow
          const googleRes = await fetch("/api/integrations/google");
          const { authUrl } = await googleRes.json();
          window.location.href = authUrl;
          return;
        case "proxycurl":
          endpoint = "/api/integrations/proxycurl";
          body = {
            apiKey: formData.apiKey || "",
          };
          break;
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Connection failed");
      }

      const data = await res.json();
      setIntegrations((prev) => [
        ...prev.filter((i) => i.type !== type),
        {
          id: data.integration.id,
          type: data.integration.integrationType,
          status: data.integration.testStatus,
        },
      ]);

      setConnectModal(null);
      setFormData({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
    }

    setIsConnecting(false);
  }

  async function handleDisconnect(id: string, type: string) {
    try {
      await fetch(`/api/integrations/${id}`, {
        method: "DELETE",
      });
      setIntegrations((prev) => prev.filter((i) => i.id !== id));
    } catch (error) {
      console.error("Failed to disconnect:", error);
    }
  }

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your integrations and preferences
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="w-5 h-5" />
            Integrations
          </CardTitle>
          <CardDescription>
            Connect your contact sources and enrichment services
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {Object.entries(INTEGRATION_INFO).map(([type, info]) => {
            const integration = integrations.find((i) => i.type === type);

            return (
              <div key={type} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  {integration ? getStatusIcon(integration.status) : (
                    <div className="w-5 h-5 rounded-full border-2 border-dashed border-muted-foreground" />
                  )}
                  <div>
                    <h4 className="font-medium">{info.name}</h4>
                    <p className="text-sm text-muted-foreground">{info.description}</p>
                    {integration?.error && (
                      <p className="text-sm text-red-500 mt-1">{integration.error}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {integration && getStatusBadge(integration.status)}
                  {integration ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDisconnect(integration.id, type)}
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Disconnect
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => setConnectModal(type)}>
                      <Plus className="w-4 h-4 mr-1" />
                      Connect
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* iCloud Connect Modal */}
      <Dialog open={connectModal === "carddav"} onOpenChange={() => setConnectModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect iCloud Contacts</DialogTitle>
            <DialogDescription>
              Enter your Apple ID and an app-specific password to sync your iCloud contacts.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="appleId">Apple ID</Label>
              <Input
                id="appleId"
                type="email"
                placeholder="your@email.com"
                value={formData.appleId || ""}
                onChange={(e) => setFormData({ ...formData, appleId: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="appSpecificPassword">App-Specific Password</Label>
              <Input
                id="appSpecificPassword"
                type="password"
                placeholder="xxxx-xxxx-xxxx-xxxx"
                value={formData.appSpecificPassword || ""}
                onChange={(e) =>
                  setFormData({ ...formData, appSpecificPassword: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                <a
                  href="https://appleid.apple.com/account/manage"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Generate an app-specific password
                  <ExternalLink className="inline w-3 h-3 ml-1" />
                </a>
              </p>
            </div>

            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConnectModal(null)}>
              Cancel
            </Button>
            <Button onClick={() => handleConnect("carddav")} disabled={isConnecting}>
              {isConnecting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Connect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Google Connect Modal */}
      <Dialog open={connectModal === "google_contacts"} onOpenChange={() => setConnectModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect Google Contacts</DialogTitle>
            <DialogDescription>
              You'll be redirected to Google to authorize access to your contacts.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              We only request read-only access to your contacts. Your data is encrypted
              and never shared.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConnectModal(null)}>
              Cancel
            </Button>
            <Button onClick={() => handleConnect("google_contacts")} disabled={isConnecting}>
              {isConnecting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Continue with Google
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Proxycurl Connect Modal */}
      <Dialog open={connectModal === "proxycurl"} onOpenChange={() => setConnectModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect LinkedIn Enrichment</DialogTitle>
            <DialogDescription>
              Enter your Proxycurl API key to enable LinkedIn enrichment and job change detection.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="apiKey">Proxycurl API Key</Label>
              <Input
                id="apiKey"
                type="password"
                placeholder="Your API key"
                value={formData.apiKey || ""}
                onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                <a
                  href="https://nubela.co/proxycurl"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Get a Proxycurl API key
                  <ExternalLink className="inline w-3 h-3 ml-1" />
                </a>
              </p>
            </div>

            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConnectModal(null)}>
              Cancel
            </Button>
            <Button onClick={() => handleConnect("proxycurl")} disabled={isConnecting}>
              {isConnecting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Connect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
