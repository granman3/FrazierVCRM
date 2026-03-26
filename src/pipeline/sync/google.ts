import { contacts } from "../../db/schema";
import type { Db } from "../../db";
import { logger } from "../../lib/logger";
import { withRetry, HttpError } from "../../lib/retry";

interface GooglePerson {
  resourceName: string;
  names?: Array<{ displayName?: string }>;
  emailAddresses?: Array<{ value?: string }>;
  phoneNumbers?: Array<{ value?: string }>;
  organizations?: Array<{ name?: string; title?: string }>;
  urls?: Array<{ value?: string }>;
}

export async function syncGoogleContacts(
  db: Db,
  accessToken: string
): Promise<number> {
  const data = await withRetry(
    async (signal) => {
      const response = await fetch(
        "https://people.googleapis.com/v1/people/me/connections?" +
          new URLSearchParams({
            personFields: "names,emailAddresses,phoneNumbers,organizations,urls",
            pageSize: "1000",
          }),
        { headers: { Authorization: `Bearer ${accessToken}` }, signal }
      );

      if (!response.ok) {
        throw new HttpError(`Google People API error`, response.status);
      }

      return (await response.json()) as { connections?: GooglePerson[] };
    },
    { retries: 2, timeoutMs: 15_000 }
  );

  const connections = data.connections || [];

  let processed = 0;

  for (const person of connections) {
    const resourceName = person.resourceName;
    const name = person.names?.[0]?.displayName || "Unknown";
    const email = person.emailAddresses?.[0]?.value;
    const phone = person.phoneNumbers?.[0]?.value;
    const org = person.organizations?.[0];
    const company = org?.name;
    const title = org?.title;

    const linkedinUrl = person.urls
      ?.find((u) => u.value?.includes("linkedin.com"))
      ?.value;

    await db
      .insert(contacts)
      .values({
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
        target: [contacts.sourceType, contacts.sourceId],
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
      });

    processed++;
  }

  return processed;
}
