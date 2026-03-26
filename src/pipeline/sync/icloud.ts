import { createDAVClient, type DAVObject } from "tsdav";
import ICAL from "ical.js";
import { contacts } from "../../db/schema";
import type { Db } from "../../db";
import { logger } from "../../lib/logger";

interface ParsedContact {
  sourceId: string;
  fullName: string;
  company?: string;
  title?: string;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
  rawData: string;
}

export async function syncICloudContacts(
  db: Db,
  username: string,
  appPassword: string
): Promise<number> {
  const TIMEOUT_MS = 60_000;
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("iCloud sync timed out after 60s")), TIMEOUT_MS)
  );

  const doSync = async (): Promise<number> => {
    const client = await createDAVClient({
      serverUrl: "https://contacts.icloud.com",
      credentials: { username, password: appPassword },
      authMethod: "Basic",
      defaultAccountType: "carddav",
    });

    const addressBooks = await client.fetchAddressBooks();
    if (!addressBooks || addressBooks.length === 0) {
      logger.info("No iCloud address books found");
      return 0;
    }

  let processed = 0;

  for (const addressBook of addressBooks) {
    const vCards = await client.fetchVCards({ addressBook });

    for (const vCard of vCards) {
      const parsed = parseVCard(vCard);
      if (!parsed) continue;

      await db
        .insert(contacts)
        .values({
          sourceType: "icloud",
          sourceId: parsed.sourceId,
          fullName: parsed.fullName,
          company: parsed.company,
          title: parsed.title,
          email: parsed.email,
          phone: parsed.phone,
          linkedinUrl: parsed.linkedinUrl,
          rawData: { vcard: parsed.rawData },
          lastSyncedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [contacts.sourceType, contacts.sourceId],
          set: {
            fullName: parsed.fullName,
            company: parsed.company,
            title: parsed.title,
            email: parsed.email,
            phone: parsed.phone,
            linkedinUrl: parsed.linkedinUrl,
            rawData: { vcard: parsed.rawData },
            lastSyncedAt: new Date(),
            updatedAt: new Date(),
          },
        });

      processed++;
    }
  }

    return processed;
  };

  return Promise.race([doSync(), timeout]);
}

function parseVCard(vCard: DAVObject): ParsedContact | null {
  if (!vCard.data) return null;

  try {
    const jcalData = ICAL.parse(vCard.data);
    const comp = new ICAL.Component(jcalData);
    const vcard = comp.getFirstSubcomponent("vcard");
    if (!vcard) return null;

    const uid = vcard.getFirstPropertyValue("uid") as string | null;
    const fn = vcard.getFirstPropertyValue("fn") as string | null;
    if (!uid || !fn) return null;

    const org = vcard.getFirstPropertyValue("org");
    const company = Array.isArray(org) ? org[0] : (org as string | undefined);
    const title = vcard.getFirstPropertyValue("title") as string | undefined;

    const emailProp = vcard.getFirstProperty("email");
    const email = emailProp ? (emailProp.getFirstValue() as string) : undefined;

    const telProp = vcard.getFirstProperty("tel");
    const phone = telProp ? (telProp.getFirstValue() as string) : undefined;

    const linkedinUrl = findLinkedInUrl(vcard);

    return { sourceId: uid, fullName: fn, company, title, email, phone, linkedinUrl, rawData: vCard.data };
  } catch (err) {
    logger.debug({ err }, "Failed to parse vCard");
    return null;
  }
}

function findLinkedInUrl(vcard: ICAL.Component): string | undefined {
  for (const urlProp of vcard.getAllProperties("url")) {
    const url = urlProp.getFirstValue() as string | undefined;
    if (url?.includes("linkedin.com")) return url;
  }

  for (const socialProp of vcard.getAllProperties("x-socialprofile")) {
    const type = socialProp.getParameter("type");
    const value = socialProp.getFirstValue() as string | undefined;
    if ((type === "linkedin" || type === "LinkedIn") && value) return value;
  }

  for (const imppProp of vcard.getAllProperties("impp")) {
    const value = imppProp.getFirstValue() as string | undefined;
    if (value?.includes("linkedin")) return value.replace(/^x-apple:/, "");
  }

  return undefined;
}
