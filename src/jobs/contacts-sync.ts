import type { Job } from "pg-boss";
import { db } from "@/db";
import { contactsSnapshot, contactsMerged, automationRuns, integrationSecrets } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { decryptSecretJSON, ICloudCredentials, GoogleContactsCredentials } from "@/lib/encryption";
import { fetchICloudContacts, ParsedContact } from "@/lib/carddav";
import type { ContactsSyncJob } from "./types";

export async function handleContactsSync(job: Job<ContactsSyncJob>) {
  const { tenantId, sourceType, fullSync } = job.data;

  console.log(`Starting contacts sync for tenant ${tenantId}, source: ${sourceType}`);

  // Create run record
  const [run] = await db
    .insert(automationRuns)
    .values({
      tenantId,
      workflowName: "contacts-sync",
      status: "running",
    })
    .returning();

  try {
    // Get credentials
    const secret = await db.query.integrationSecrets.findFirst({
      where: and(
        eq(integrationSecrets.tenantId, tenantId),
        eq(integrationSecrets.integrationType, sourceType),
        isNull(integrationSecrets.revokedAt)
      ),
    });

    if (!secret) {
      throw new Error(`No credentials found for ${sourceType}`);
    }

    let contactsProcessed = 0;

    switch (sourceType) {
      case "carddav":
        contactsProcessed = await syncCardDAV(
          tenantId,
          decryptSecretJSON<ICloudCredentials>(secret.encryptedPayload),
          fullSync
        );
        break;

      case "google_contacts":
        contactsProcessed = await syncGoogleContacts(
          tenantId,
          decryptSecretJSON<GoogleContactsCredentials>(secret.encryptedPayload),
          fullSync
        );
        break;

      default:
        throw new Error(`Unknown source type: ${sourceType}`);
    }

    // Update run as success
    await db
      .update(automationRuns)
      .set({
        status: "success",
        finishedAt: new Date(),
        vipsConsidered: contactsProcessed,
      })
      .where(eq(automationRuns.id, run.id));

    console.log(`Contacts sync completed: ${contactsProcessed} contacts`);
  } catch (error) {
    console.error("Contacts sync failed:", error);

    // Update run as failed
    await db
      .update(automationRuns)
      .set({
        status: "failed",
        finishedAt: new Date(),
        errorSummary: error instanceof Error ? error.message : "Unknown error",
      })
      .where(eq(automationRuns.id, run.id));

    throw error;
  }
}

async function syncCardDAV(
  tenantId: string,
  credentials: ICloudCredentials,
  fullSync: boolean
): Promise<number> {
  console.log(`Fetching contacts from iCloud for tenant ${tenantId}`);

  // Fetch all contacts from iCloud
  const contacts = await fetchICloudContacts(credentials);
  console.log(`Fetched ${contacts.length} contacts from iCloud`);

  if (contacts.length === 0) {
    return 0;
  }

  let processed = 0;

  for (const contact of contacts) {
    try {
      // Upsert to contacts_snapshot
      const [snapshot] = await db
        .insert(contactsSnapshot)
        .values({
          tenantId,
          sourceType: "icloud",
          sourceId: contact.sourceId,
          fullName: contact.fullName,
          company: contact.company,
          title: contact.title,
          email: contact.email,
          phone: contact.phone,
          linkedinUrl: contact.linkedinUrl,
          rawData: { vcard: contact.rawData },
          lastSyncedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [contactsSnapshot.tenantId, contactsSnapshot.sourceType, contactsSnapshot.sourceId],
          set: {
            fullName: contact.fullName,
            company: contact.company,
            title: contact.title,
            email: contact.email,
            phone: contact.phone,
            linkedinUrl: contact.linkedinUrl,
            rawData: { vcard: contact.rawData },
            lastSyncedAt: new Date(),
            updatedAt: new Date(),
          },
        })
        .returning();

      // Create or update merged contact
      // For now, use simple 1:1 mapping (later: implement merge/dedupe)
      await db
        .insert(contactsMerged)
        .values({
          tenantId,
          primarySnapshotId: snapshot.id,
          linkedSnapshotIds: [],
          fullName: contact.fullName,
          company: contact.company,
          title: contact.title,
          email: contact.email,
          phone: contact.phone,
          linkedinUrl: contact.linkedinUrl,
        })
        .onConflictDoNothing();

      processed++;
    } catch (error) {
      console.error(`Error syncing contact ${contact.fullName}:`, error);
    }
  }

  return processed;
}

async function syncGoogleContacts(
  tenantId: string,
  credentials: GoogleContactsCredentials,
  fullSync: boolean
): Promise<number> {
  // Check if token is expired
  if (credentials.expiresAt < Date.now()) {
    // TODO: Implement token refresh using refresh_token
    console.log("Google token expired, refresh not yet implemented");
    throw new Error("Google OAuth token expired");
  }

  console.log(`Fetching contacts from Google for tenant ${tenantId}`);

  // Fetch contacts from Google People API
  const response = await fetch(
    "https://people.googleapis.com/v1/people/me/connections?" +
      new URLSearchParams({
        personFields: "names,emailAddresses,phoneNumbers,organizations,urls",
        pageSize: "1000",
      }),
    {
      headers: {
        Authorization: `Bearer ${credentials.accessToken}`,
      },
    }
  );

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Google OAuth token invalid or expired");
    }
    throw new Error(`Google People API error: ${response.status}`);
  }

  const data = await response.json();
  const connections = data.connections || [];

  console.log(`Fetched ${connections.length} contacts from Google`);

  let processed = 0;

  for (const person of connections) {
    try {
      const resourceName = person.resourceName;
      const name = person.names?.[0]?.displayName || "Unknown";
      const email = person.emailAddresses?.[0]?.value;
      const phone = person.phoneNumbers?.[0]?.value;
      const org = person.organizations?.[0];
      const company = org?.name;
      const title = org?.title;

      // Look for LinkedIn URL
      let linkedinUrl: string | undefined;
      for (const url of person.urls || []) {
        if (url.value?.includes("linkedin.com")) {
          linkedinUrl = url.value;
          break;
        }
      }

      // Upsert to contacts_snapshot
      const [snapshot] = await db
        .insert(contactsSnapshot)
        .values({
          tenantId,
          sourceType: "google",
          sourceId: resourceName,
          fullName: name,
          company,
          title,
          email,
          phone,
          linkedinUrl,
          rawData: person,
          lastSyncedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [contactsSnapshot.tenantId, contactsSnapshot.sourceType, contactsSnapshot.sourceId],
          set: {
            fullName: name,
            company,
            title,
            email,
            phone,
            linkedinUrl,
            rawData: person,
            lastSyncedAt: new Date(),
            updatedAt: new Date(),
          },
        })
        .returning();

      // Create merged contact (simple 1:1 for now)
      await db
        .insert(contactsMerged)
        .values({
          tenantId,
          primarySnapshotId: snapshot.id,
          linkedSnapshotIds: [],
          fullName: name,
          company,
          title,
          email,
          phone,
          linkedinUrl,
        })
        .onConflictDoNothing();

      processed++;
    } catch (error) {
      console.error(`Error syncing Google contact:`, error);
    }
  }

  return processed;
}
