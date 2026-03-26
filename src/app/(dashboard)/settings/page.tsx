import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface EnvCheck {
  readonly name: string;
  readonly label: string;
}

const ENV_CHECKS: ReadonlyArray<EnvCheck> = [
  { name: "DATABASE_URL", label: "Database" },
  { name: "GOOGLE_CLIENT_ID", label: "Google OAuth" },
  { name: "GOOGLE_CLIENT_SECRET", label: "Google OAuth Secret" },
  { name: "OPENAI_API_KEY", label: "OpenAI" },
  { name: "RESEND_API_KEY", label: "Resend (Email)" },
  { name: "NEXTAUTH_SECRET", label: "NextAuth Secret" },
  { name: "NEXTAUTH_URL", label: "NextAuth URL" },
  { name: "ALLOWED_EMAILS", label: "Allowed Emails" },
  { name: "CALDAV_URL", label: "CalDAV" },
  { name: "CALDAV_USERNAME", label: "CalDAV Username" },
  { name: "CALDAV_PASSWORD", label: "CalDAV Password" },
];

function isConfigured(name: string): boolean {
  const value = process.env[name];
  return value != null && value.length > 0;
}

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Settings</h2>

      <Card>
        <CardHeader>
          <CardTitle>Integration Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {ENV_CHECKS.map((check) => {
              const configured = isConfigured(check.name);
              return (
                <div
                  key={check.name}
                  className="flex items-center justify-between rounded-md border px-4 py-3"
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-gray-600">
            Manually trigger a full pipeline run: sync contacts, score VIPs,
            generate outreach drafts.
          </p>
          <button className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Run Pipeline Now
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
