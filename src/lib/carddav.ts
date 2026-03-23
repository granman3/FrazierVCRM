import { createDAVClient, DAVObject, type DAVClient } from "tsdav";
import ICAL from "ical.js";

export interface ICloudCredentials {
  appleId: string;
  appSpecificPassword: string;
}

export interface ParsedContact {
  sourceId: string;
  fullName: string;
  company?: string;
  title?: string;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
  rawData: string;
}

/**
 * Creates a CardDAV client connected to iCloud Contacts
 */
export async function createICloudClient(
  credentials: ICloudCredentials
): Promise<DAVClient> {
  const client = await createDAVClient({
    serverUrl: "https://contacts.icloud.com",
    credentials: {
      username: credentials.appleId,
      password: credentials.appSpecificPassword,
    },
    authMethod: "Basic",
    defaultAccountType: "carddav",
  });

  return client;
}

/**
 * Fetches all contacts from iCloud via CardDAV
 */
export async function fetchICloudContacts(
  credentials: ICloudCredentials
): Promise<ParsedContact[]> {
  const client = await createICloudClient(credentials);

  // Get all address books
  const addressBooks = await client.fetchAddressBooks();

  if (!addressBooks || addressBooks.length === 0) {
    console.log("No address books found");
    return [];
  }

  console.log(`Found ${addressBooks.length} address books`);

  const allContacts: ParsedContact[] = [];

  for (const addressBook of addressBooks) {
    console.log(`Fetching contacts from address book: ${addressBook.displayName || addressBook.url}`);

    // Fetch vCards from this address book
    const vCards = await client.fetchVCards({
      addressBook,
    });

    console.log(`Found ${vCards.length} vCards`);

    for (const vCard of vCards) {
      try {
        const parsed = parseVCard(vCard);
        if (parsed) {
          allContacts.push(parsed);
        }
      } catch (error) {
        console.error(`Error parsing vCard:`, error);
      }
    }
  }

  return allContacts;
}

/**
 * Parses a vCard into a structured contact object
 */
function parseVCard(vCard: DAVObject): ParsedContact | null {
  if (!vCard.data) {
    return null;
  }

  try {
    const jcalData = ICAL.parse(vCard.data);
    const comp = new ICAL.Component(jcalData);
    const vcard = comp.getFirstSubcomponent("vcard");

    if (!vcard) {
      return null;
    }

    // Get UID (required)
    const uid = vcard.getFirstPropertyValue("uid");
    if (!uid) {
      return null;
    }

    // Get full name
    const fn = vcard.getFirstPropertyValue("fn");
    if (!fn) {
      return null;
    }

    // Get organization (company)
    const org = vcard.getFirstPropertyValue("org");
    const company = Array.isArray(org) ? org[0] : org;

    // Get title
    const title = vcard.getFirstPropertyValue("title");

    // Get email (first one)
    const emailProp = vcard.getFirstProperty("email");
    const email = emailProp ? emailProp.getFirstValue() : undefined;

    // Get phone (first one)
    const telProp = vcard.getFirstProperty("tel");
    const phone = telProp ? telProp.getFirstValue() : undefined;

    // Look for LinkedIn URL in various fields
    let linkedinUrl: string | undefined;

    // Check URL properties
    const urlProps = vcard.getAllProperties("url");
    for (const urlProp of urlProps) {
      const url = urlProp.getFirstValue();
      if (url && typeof url === "string" && url.includes("linkedin.com")) {
        linkedinUrl = url;
        break;
      }
    }

    // Check social profiles (X-SOCIALPROFILE)
    if (!linkedinUrl) {
      const socialProps = vcard.getAllProperties("x-socialprofile");
      for (const socialProp of socialProps) {
        const type = socialProp.getParameter("type");
        const value = socialProp.getFirstValue();
        if (
          (type === "linkedin" || type === "LinkedIn") &&
          typeof value === "string"
        ) {
          linkedinUrl = value;
          break;
        }
      }
    }

    // Check IMPP for LinkedIn
    if (!linkedinUrl) {
      const imppProps = vcard.getAllProperties("impp");
      for (const imppProp of imppProps) {
        const value = imppProp.getFirstValue();
        if (value && typeof value === "string" && value.includes("linkedin")) {
          linkedinUrl = value.replace(/^x-apple:/, "");
          break;
        }
      }
    }

    return {
      sourceId: uid as string,
      fullName: fn as string,
      company: company as string | undefined,
      title: title as string | undefined,
      email: email as string | undefined,
      phone: phone as string | undefined,
      linkedinUrl,
      rawData: vCard.data,
    };
  } catch (error) {
    console.error("Error parsing vCard:", error);
    return null;
  }
}

/**
 * Tests iCloud CardDAV credentials by attempting to fetch address books
 */
export async function testICloudCredentials(
  credentials: ICloudCredentials
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = await createICloudClient(credentials);
    const addressBooks = await client.fetchAddressBooks();

    if (!addressBooks || addressBooks.length === 0) {
      return { success: false, error: "No address books found" };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
