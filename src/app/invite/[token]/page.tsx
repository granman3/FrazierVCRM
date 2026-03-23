import { validateInvite } from "@/lib/invites";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { InviteAcceptClient } from "./client";

interface InvitePageProps {
  params: { token: string };
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = params;
  const session = await getServerSession(authOptions);

  // Validate the invite
  const { valid, invite, error } = await validateInvite(token);

  if (!valid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-destructive mb-4">Invalid Invite</h1>
          <p className="text-muted-foreground mb-6">
            {error === "INVITE_NOT_FOUND" && "This invite link is not valid."}
            {error === "INVITE_ALREADY_USED" && "This invite has already been used."}
            {error === "INVITE_REVOKED" && "This invite has been revoked."}
            {error === "INVITE_EXPIRED" && "This invite has expired."}
          </p>
          <a
            href="/"
            className="inline-block px-4 py-2 bg-primary text-primary-foreground rounded-md"
          >
            Go Home
          </a>
        </div>
      </div>
    );
  }

  // If user is already signed in and has a tenant, show conflict
  if (session?.user?.tenantId && invite?.type === "platform") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full text-center">
          <h1 className="text-2xl font-bold mb-4">Already in a Workspace</h1>
          <p className="text-muted-foreground mb-6">
            You&apos;re already a member of {session.user.tenantName || "a workspace"}.
            Platform invites create a new workspace.
          </p>
          <a
            href="/dashboard"
            className="inline-block px-4 py-2 bg-primary text-primary-foreground rounded-md"
          >
            Go to Dashboard
          </a>
        </div>
      </div>
    );
  }

  return (
    <InviteAcceptClient
      token={token}
      invite={{
        type: invite!.type,
        email: invite!.email || undefined,
        tenantName: invite!.tenant?.name,
        creatorName: invite!.creator?.name || undefined,
        creatorEmail: invite!.creator?.email || undefined,
      }}
      isSignedIn={!!session?.user}
      userEmail={session?.user?.email}
    />
  );
}
