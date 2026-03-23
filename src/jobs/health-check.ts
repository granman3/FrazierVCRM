import type { Job } from "pg-boss";
import { db } from "@/db";
import { integrationSecrets } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { decryptSecretJSON, ICloudCredentials, GoogleContactsCredentials, ProxycurlCredentials } from "@/lib/encryption";
import type { HealthCheckJob } from "./types";

export async function handleHealthCheck(job: Job<HealthCheckJob>) {
  const { tenantId, integrationType } = job.data;

  console.log(`Starting health check for tenant ${tenantId}, integration: ${integrationType}`);

  try {
    // Get credentials
    const secret = await db.query.integrationSecrets.findFirst({
      where: and(
        eq(integrationSecrets.tenantId, tenantId),
        eq(integrationSecrets.integrationType, integrationType),
        isNull(integrationSecrets.revokedAt)
      ),
    });

    if (!secret) {
      throw new Error(`No credentials found for ${integrationType}`);
    }

    let testResult: { success: boolean; error?: string };

    switch (integrationType) {
      case "carddav":
        testResult = await testCardDAV(
          decryptSecretJSON<ICloudCredentials>(secret.encryptedPayload)
        );
        break;

      case "google_contacts":
        testResult = await testGoogleContacts(
          decryptSecretJSON<GoogleContactsCredentials>(secret.encryptedPayload)
        );
        break;

      case "proxycurl":
        testResult = await testProxycurl(
          decryptSecretJSON<ProxycurlCredentials>(secret.encryptedPayload)
        );
        break;

      default:
        throw new Error(`Unknown integration type: ${integrationType}`);
    }

    // Update test status
    await db
      .update(integrationSecrets)
      .set({
        lastTestedAt: new Date(),
        testStatus: testResult.success ? "success" : "failed",
        testError: testResult.error || null,
      })
      .where(eq(integrationSecrets.id, secret.id));

    console.log(
      `Health check ${testResult.success ? "passed" : "failed"} for ${integrationType}`
    );
  } catch (error) {
    console.error("Health check failed:", error);
    throw error;
  }
}

async function testCardDAV(
  credentials: ICloudCredentials
): Promise<{ success: boolean; error?: string }> {
  const { testICloudCredentials } = await import("@/lib/carddav");
  return testICloudCredentials(credentials);
}

async function testGoogleContacts(
  credentials: GoogleContactsCredentials
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if token is expired
    if (credentials.expiresAt < Date.now()) {
      return { success: false, error: "Token expired" };
    }

    // TODO: Make a test request to Google People API
    console.log("Google Contacts test not yet implemented");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function testProxycurl(
  credentials: ProxycurlCredentials
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!credentials.apiKey) {
      return { success: false, error: "Missing API key" };
    }

    // Test with a simple API call
    const response = await fetch("https://nubela.co/proxycurl/api/credit-balance", {
      headers: {
        Authorization: `Bearer ${credentials.apiKey}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        return { success: false, error: "Invalid API key" };
      }
      return { success: false, error: `API returned ${response.status}` };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
