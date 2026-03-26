import { logger } from "./logger";
import { withRetry, HttpError } from "./retry";

interface TokenResponse {
  readonly access_token: string;
  readonly expires_in: number;
  readonly token_type: string;
}

/**
 * Refreshes a Google OAuth access token using a refresh token.
 * Returns the new access token, or falls back to the existing access token
 * if refresh credentials are not configured.
 */
export async function getValidAccessToken(opts: {
  readonly accessToken?: string;
  readonly refreshToken?: string;
  readonly clientId?: string;
  readonly clientSecret?: string;
}): Promise<string | undefined> {
  const { accessToken, refreshToken, clientId, clientSecret } = opts;

  // If we have refresh credentials, always refresh to get a fresh token
  if (refreshToken && clientId && clientSecret) {
    try {
      const token = await refreshAccessToken(refreshToken, clientId, clientSecret);
      return token;
    } catch (error) {
      logger.warn({ err: error }, "Failed to refresh Google access token, falling back to existing token");
      return accessToken;
    }
  }

  return accessToken;
}

async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const data = await withRetry(
    async (signal) => {
      const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: refreshToken,
          client_id: clientId,
          client_secret: clientSecret,
        }),
        signal,
      });

      if (!response.ok) {
        throw new HttpError("Google token refresh failed", response.status);
      }

      return (await response.json()) as TokenResponse;
    },
    { retries: 2, timeoutMs: 10_000 }
  );

  logger.info("Successfully refreshed Google access token");
  return data.access_token;
}
