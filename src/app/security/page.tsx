import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Lock, Server, Eye, Key, Database, FileCheck } from "lucide-react";

export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-muted/30">
      <div className="container mx-auto py-16 px-4 max-w-4xl">
        <div className="text-center mb-12">
          <Shield className="w-16 h-16 mx-auto mb-4 text-primary" />
          <h1 className="text-4xl font-bold mb-4">Security & Privacy</h1>
          <p className="text-xl text-muted-foreground">
            How we protect your data and respect your privacy
          </p>
        </div>

        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5" />
                Encryption
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <Badge variant="success" className="mt-1">AES-256</Badge>
                <div>
                  <h4 className="font-medium">Envelope Encryption</h4>
                  <p className="text-sm text-muted-foreground">
                    All sensitive credentials (API keys, OAuth tokens, app-specific passwords)
                    are encrypted using libsodium with AES-256-GCM encryption. Each tenant's
                    secrets are encrypted with unique data encryption keys.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Badge variant="success" className="mt-1">TLS 1.3</Badge>
                <div>
                  <h4 className="font-medium">Transport Security</h4>
                  <p className="text-sm text-muted-foreground">
                    All data in transit is encrypted using TLS 1.3. We enforce HTTPS for
                    all connections and use HSTS headers.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5" />
                Data Access
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <Badge variant="outline" className="mt-1">Read-only</Badge>
                <div>
                  <h4 className="font-medium">Contact Sync</h4>
                  <p className="text-sm text-muted-foreground">
                    We only request read-only access to your contacts. We never modify,
                    delete, or add contacts to your iCloud or Google account.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Badge variant="outline" className="mt-1">Minimal</Badge>
                <div>
                  <h4 className="font-medium">Scoped Permissions</h4>
                  <p className="text-sm text-muted-foreground">
                    We request the minimum permissions needed. For Google, we only request
                    the `contacts.readonly` scope. For iCloud, we only access the CardDAV
                    contacts endpoint.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="w-5 h-5" />
                Credentials Management
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Your credentials are stored securely with multiple layers of protection:
              </p>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-2 ml-4">
                <li>Encrypted at rest using envelope encryption</li>
                <li>Decrypted only when needed for sync operations</li>
                <li>Never logged or stored in plaintext</li>
                <li>Never shared with third parties</li>
                <li>Revocable at any time through the settings page</li>
              </ul>
              <div className="bg-muted p-4 rounded-lg mt-4">
                <h4 className="font-medium mb-2">App-Specific Passwords</h4>
                <p className="text-sm text-muted-foreground">
                  For iCloud, we recommend using an app-specific password rather than
                  your main Apple ID password. This limits the scope of access and
                  allows you to revoke access without changing your main password.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                Data Storage
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <Badge variant="outline" className="mt-1">Isolated</Badge>
                <div>
                  <h4 className="font-medium">Tenant Isolation</h4>
                  <p className="text-sm text-muted-foreground">
                    Each organization's data is logically isolated. We use row-level
                    security and tenant IDs on all data to ensure strict separation.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Badge variant="outline" className="mt-1">Retained</Badge>
                <div>
                  <h4 className="font-medium">Data Retention</h4>
                  <p className="text-sm text-muted-foreground">
                    Contact data is retained for as long as you maintain an active account.
                    Automation run logs are retained for 90 days. You can request full
                    data deletion at any time.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="w-5 h-5" />
                Infrastructure
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Our infrastructure is designed for security:
              </p>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-2 ml-4">
                <li>PostgreSQL database with encrypted connections</li>
                <li>Containerized deployment with minimal attack surface</li>
                <li>Regular security updates and dependency audits</li>
                <li>Comprehensive audit logging for all sensitive operations</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileCheck className="w-5 h-5" />
                Third-Party Services
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground mb-4">
                We integrate with the following services. Data shared is limited to
                what's necessary for functionality:
              </p>
              <div className="space-y-3">
                <div className="border rounded-lg p-3">
                  <h4 className="font-medium">Proxycurl (LinkedIn Enrichment)</h4>
                  <p className="text-xs text-muted-foreground">
                    LinkedIn profile URLs are sent to detect job changes. No other
                    contact data is shared.
                  </p>
                </div>
                <div className="border rounded-lg p-3">
                  <h4 className="font-medium">DeepSeek (AI Classification)</h4>
                  <p className="text-xs text-muted-foreground">
                    Contact names, titles, and companies are sent for VIP classification
                    and draft generation. DeepSeek does not store this data.
                  </p>
                </div>
                <div className="border rounded-lg p-3">
                  <h4 className="font-medium">Resend (Email Delivery)</h4>
                  <p className="text-xs text-muted-foreground">
                    Your email address is used to send daily digest emails.
                    Resend does not store email content.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="text-center py-8">
            <p className="text-muted-foreground">
              Have security questions?{" "}
              <a href="mailto:security@example.com" className="text-primary hover:underline">
                Contact us
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
