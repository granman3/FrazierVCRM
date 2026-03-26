import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PipelineTrigger } from "./pipeline-trigger";

interface EnvCheck {
  readonly name: string;
  readonly label: string;
  readonly group: string;
}

const ENV_CHECKS: ReadonlyArray<EnvCheck> = [
  { name: "DATABASE_URL", label: "PostgreSQL Database", group: "Core" },
  { name: "NEXTAUTH_SECRET", label: "NextAuth Secret", group: "Auth" },
  { name: "GOOGLE_CLIENT_ID", label: "Google OAuth Client ID", group: "Auth" },
  { name: "GOOGLE_CLIENT_SECRET", label: "Google OAuth Secret", group: "Auth" },
  { name: "ALLOWED_EMAILS", label: "Allowed Email Addresses", group: "Auth" },
  { name: "ICLOUD_USERNAME", label: "iCloud Username", group: "Contact Sync" },
  { name: "ICLOUD_APP_PASSWORD", label: "iCloud App Password", group: "Contact Sync" },
  { name: "GOOGLE_REFRESH_TOKEN", label: "Google Refresh Token", group: "Contact Sync" },
  { name: "DEEPSEEK_API_KEY", label: "DeepSeek API Key", group: "AI & Enrichment" },
  { name: "PROXYCURL_API_KEY", label: "Proxycurl API Key", group: "AI & Enrichment" },
  { name: "BING_NEWS_API_KEY", label: "Bing News API Key", group: "AI & Enrichment" },
  { name: "RESEND_API_KEY", label: "Resend API Key", group: "Email" },
  { name: "RESEND_FROM_EMAIL", label: "Sender Email", group: "Email" },
  { name: "DIGEST_TO_EMAIL", label: "Digest Recipient", group: "Email" },
];

function isConfigured(name: string): boolean {
  const value = process.env[name];
  return value != null && value.length > 0;
}

export default function SettingsPage() {
  const groups = Array.from(new Set(ENV_CHECKS.map((c) => c.group)));

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Settings</h2>

      <Card>
        <CardHeader>
          <CardTitle>Integration Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {groups.map((group) => (
            <div key={group}>
              <h4 className="mb-2 text-sm font-semibold text-gray-700">{group}</h4>
              <div className="space-y-2">
                {ENV_CHECKS.filter((c) => c.group === group).map((check) => {
                  const configured = isConfigured(check.name);
                  return (
                    <div
                      key={check.name}
                      className="flex items-center justify-between rounded-md border px-4 py-2.5"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {check.label}
                        </p>
                        <p className="text-xs text-gray-400">{check.name}</p>
                      </div>
                      <Badge variant={configured ? "success" : "destructive"}>
                        {configured ? "Configured" : "Missing"}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-gray-600">
            Manually trigger a full pipeline run: sync contacts, classify VIPs,
            detect signals, generate outreach drafts, and send the daily digest.
          </p>
          <PipelineTrigger />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tuning</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-md border px-4 py-2.5">
            <div>
              <p className="text-sm font-medium text-gray-900">VIP Auto-Approve Threshold</p>
              <p className="text-xs text-gray-400">VIP_AUTO_APPROVE_THRESHOLD</p>
            </div>
            <span className="text-sm font-mono text-gray-700">
              {process.env.VIP_AUTO_APPROVE_THRESHOLD ?? "0.85"}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-md border px-4 py-2.5">
            <div>
              <p className="text-sm font-medium text-gray-900">Cooldown Days</p>
              <p className="text-xs text-gray-400">COOLDOWN_DAYS</p>
            </div>
            <span className="text-sm font-mono text-gray-700">
              {process.env.COOLDOWN_DAYS ?? "14"}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
