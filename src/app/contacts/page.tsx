import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { contactsMerged } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { ContactsClient } from "./client";

export default async function ContactsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.tenantId) {
    redirect("/api/auth/signin");
  }

  if (!session.user.setupComplete) {
    redirect("/setup");
  }

  const contacts = await db.query.contactsMerged.findMany({
    where: eq(contactsMerged.tenantId, session.user.tenantId),
    orderBy: [desc(contactsMerged.updatedAt)],
    limit: 100,
  });

  return <ContactsClient contacts={contacts} />;
}
