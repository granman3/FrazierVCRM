import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { VipsClient } from "./client";

export default async function VipsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/api/auth/signin");
  }

  if (!session.user.setupComplete) {
    redirect("/setup");
  }

  return <VipsClient />;
}
