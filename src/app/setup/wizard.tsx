"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Check, Cloud, FileSpreadsheet, Mail, Clock, Lock } from "lucide-react";

const STEPS = [
  { id: "contacts", title: "Contact Sources", icon: Cloud },
  { id: "email", title: "Email Delivery", icon: Mail },
  { id: "schedule", title: "Schedule", icon: Clock },
  { id: "consent", title: "Consent", icon: Lock },
];

const TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Phoenix", label: "Arizona (no DST)" },
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "Europe/Paris", label: "Paris (CET/CEST)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
  { value: "Asia/Singapore", label: "Singapore (SGT)" },
  { value: "Australia/Sydney", label: "Sydney (AEST/AEDT)" },
];

interface SetupWizardProps {
  tenantId: string;
  userEmail: string;
  userName?: string;
  timezone?: string;
  connectedIntegrations: Record<string, { connected: boolean; status: string }>;
}

export function SetupWizard({
  tenantId,
  userEmail,
  userName,
  timezone: initialTimezone,
  connectedIntegrations,
}: SetupWizardProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [digestEmail, setDigestEmail] = useState(userEmail);
  const [timezone, setTimezone] = useState(initialTimezone || "America/New_York");
  const [digestTime, setDigestTime] = useState("07:00");
  const [consentChecked, setConsentChecked] = useState(false);

  const progress = ((currentStep + 1) / STEPS.length) * 100;

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    if (!consentChecked) {
      setError("Please accept the terms to continue");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/setup/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timezone,
          digestTime,
          digestEmail,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Failed to complete setup");
        return;
      }

      router.push("/dashboard");
    } catch (err) {
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const connectGoogle = () => {
    // Redirect to Google OAuth for contacts
    window.location.href = "/api/integrations/google/connect?scope=contacts";
  };

  const renderStep = () => {
    switch (STEPS[currentStep].id) {
      case "contacts":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="font-medium mb-4">Choose your contact sources</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Connect at least one source to import your contacts. You can add more later.
              </p>
            </div>

            <div className="space-y-4">
              {/* Google Contacts */}
              <div
                className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                  connectedIntegrations.google_contacts?.connected
                    ? "border-green-500 bg-green-50"
                    : "hover:border-primary"
                }`}
                onClick={() => !connectedIntegrations.google_contacts?.connected && connectGoogle()}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                      </svg>
                    </div>
                    <div>
                      <div className="font-medium">Google Contacts</div>
                      <div className="text-sm text-muted-foreground">
                        Sync contacts from your Google account
                      </div>
                    </div>
                  </div>
                  {connectedIntegrations.google_contacts?.connected ? (
                    <Badge variant="success">
                      <Check className="w-3 h-3 mr-1" />
                      Connected
                    </Badge>
                  ) : (
                    <Button variant="outline" size="sm">
                      Connect
                    </Button>
                  )}
                </div>
              </div>

              {/* iCloud Contacts */}
              <div
                className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                  connectedIntegrations.carddav?.connected
                    ? "border-green-500 bg-green-50"
                    : "hover:border-primary"
                }`}
                onClick={() => router.push("/setup/icloud")}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                      <Cloud className="w-6 h-6 text-gray-600" />
                    </div>
                    <div>
                      <div className="font-medium">iCloud Contacts</div>
                      <div className="text-sm text-muted-foreground">
                        Sync contacts via CardDAV
                      </div>
                    </div>
                  </div>
                  {connectedIntegrations.carddav?.connected ? (
                    <Badge variant="success">
                      <Check className="w-3 h-3 mr-1" />
                      Connected
                    </Badge>
                  ) : (
                    <Button variant="outline" size="sm">
                      Connect
                    </Button>
                  )}
                </div>
              </div>

              {/* CSV Upload */}
              <div
                className="p-4 border rounded-lg cursor-pointer transition-colors hover:border-primary"
                onClick={() => router.push("/setup/csv")}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <FileSpreadsheet className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <div className="font-medium">CSV Upload</div>
                      <div className="text-sm text-muted-foreground">
                        Import from a spreadsheet
                      </div>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    Upload
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );

      case "email":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="font-medium mb-4">Email Delivery</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Where should we send your daily VIP digest?
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Digest Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={digestEmail}
                  onChange={(e) => setDigestEmail(e.target.value)}
                  placeholder="your@email.com"
                />
                <p className="text-xs text-muted-foreground">
                  We'll send your daily digest with VIP updates and message drafts to this address.
                </p>
              </div>
            </div>
          </div>
        );

      case "schedule":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="font-medium mb-4">Digest Schedule</h3>
              <p className="text-sm text-muted-foreground mb-6">
                When would you like to receive your daily digest?
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value}>
                        {tz.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="time">Delivery Time</Label>
                <Select value={digestTime} onValueChange={setDigestTime}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select time" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="06:00">6:00 AM</SelectItem>
                    <SelectItem value="07:00">7:00 AM</SelectItem>
                    <SelectItem value="08:00">8:00 AM</SelectItem>
                    <SelectItem value="09:00">9:00 AM</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Your digest will arrive around this time each day.
                </p>
              </div>
            </div>
          </div>
        );

      case "consent":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="font-medium mb-4">Almost There!</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Review and accept to complete your setup.
              </p>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-muted/30 rounded-lg">
                <h4 className="font-medium mb-2">What we'll do:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Store your integration credentials encrypted</li>
                  <li>• Sync and store your contacts for automation</li>
                  <li>• Process your VIPs through AI to identify news</li>
                  <li>• Send you a daily email digest with drafts</li>
                </ul>
              </div>

              <div className="flex items-start space-x-3">
                <Checkbox
                  id="consent"
                  checked={consentChecked}
                  onCheckedChange={(checked) => setConsentChecked(checked as boolean)}
                />
                <Label htmlFor="consent" className="text-sm leading-relaxed">
                  I authorize Chief of Staff to store my credentials, sync my contacts,
                  and process data as described. I've read the{" "}
                  <a href="/privacy" className="underline" target="_blank">
                    Privacy Policy
                  </a>{" "}
                  and{" "}
                  <a href="/terms" className="underline" target="_blank">
                    Terms of Service
                  </a>
                  .
                </Label>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 py-8">
      <div className="container max-w-2xl mx-auto px-4">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex justify-between text-sm text-muted-foreground mb-2">
            <span>
              Step {currentStep + 1} of {STEPS.length}
            </span>
            <span>{STEPS[currentStep].title}</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Step indicators */}
        <div className="flex justify-center gap-2 mb-8">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <div
                key={step.id}
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  index < currentStep
                    ? "bg-primary text-primary-foreground"
                    : index === currentStep
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {index < currentStep ? (
                  <Check className="w-5 h-5" />
                ) : (
                  <Icon className="w-5 h-5" />
                )}
              </div>
            );
          })}
        </div>

        {/* Content */}
        <Card>
          <CardContent className="pt-6">
            {error && (
              <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm mb-6">
                {error}
              </div>
            )}

            {renderStep()}

            {/* Navigation */}
            <div className="flex justify-between mt-8 pt-6 border-t">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={currentStep === 0}
              >
                Back
              </Button>

              {currentStep < STEPS.length - 1 ? (
                <Button onClick={handleNext}>Continue</Button>
              ) : (
                <Button onClick={handleComplete} disabled={isLoading || !consentChecked}>
                  {isLoading ? "Completing..." : "Complete Setup"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
