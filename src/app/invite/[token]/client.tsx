"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface InviteAcceptClientProps {
  token: string;
  invite: {
    type: string;
    email?: string;
    tenantName?: string;
    creatorName?: string;
    creatorEmail?: string;
  };
  isSignedIn: boolean;
  userEmail?: string;
}

export function InviteAcceptClient({
  token,
  invite,
  isSignedIn,
  userEmail,
}: InviteAcceptClientProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAccept = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/invites/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to accept invite");
        return;
      }

      // Redirect to setup wizard
      router.push("/setup");
    } catch (err) {
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignInAndAccept = () => {
    // Store token in session storage for post-auth handling
    sessionStorage.setItem("pendingInviteToken", token);
    signIn("google", { callbackUrl: `/invite/${token}` });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">
            {invite.type === "platform"
              ? "You're Invited to Chief of Staff"
              : `Join ${invite.tenantName || "the team"}`}
          </CardTitle>
          <CardDescription>
            {invite.creatorName || invite.creatorEmail
              ? `${invite.creatorName || invite.creatorEmail} invited you`
              : "You've been invited"}
            {invite.type === "platform"
              ? " to create your own workspace"
              : " to collaborate"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}

          {isSignedIn ? (
            <>
              <p className="text-sm text-muted-foreground text-center">
                Signed in as <strong>{userEmail}</strong>
              </p>
              <Button
                className="w-full"
                size="lg"
                onClick={handleAccept}
                disabled={isLoading}
              >
                {isLoading ? "Accepting..." : "Accept Invite"}
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground text-center">
                Sign in with Google to accept this invite
                {invite.email && (
                  <>
                    <br />
                    <span className="text-xs">
                      (This invite is for {invite.email})
                    </span>
                  </>
                )}
              </p>
              <Button
                className="w-full"
                size="lg"
                onClick={handleSignInAndAccept}
              >
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Sign in with Google
              </Button>
            </>
          )}

          <div className="pt-4 border-t">
            <h4 className="font-medium text-sm mb-2">What you'll get:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Sync contacts from iCloud, Google, or CSV</li>
              <li>• AI-powered VIP identification</li>
              <li>• Daily digests with personalized outreach drafts</li>
              <li>• Job change and company news alerts</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
