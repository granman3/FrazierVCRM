import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("./retry", () => ({
  withRetry: vi.fn(async (fn: (signal: AbortSignal) => Promise<unknown>) => {
    const controller = new AbortController();
    return fn(controller.signal);
  }),
  HttpError: class HttpError extends Error {
    constructor(message: string, public readonly status: number) {
      super(message);
      this.name = "HttpError";
    }
  },
}));

import { getValidAccessToken } from "./google-auth";

describe("getValidAccessToken", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns undefined when no tokens provided", async () => {
    const result = await getValidAccessToken({});
    expect(result).toBeUndefined();
  });

  it("returns accessToken when no refresh credentials", async () => {
    const result = await getValidAccessToken({ accessToken: "at-123" });
    expect(result).toBe("at-123");
  });

  it("returns accessToken when partial refresh credentials", async () => {
    const result = await getValidAccessToken({
      accessToken: "at-123",
      refreshToken: "rt-456",
      // missing clientId and clientSecret
    });
    expect(result).toBe("at-123");
  });

  it("refreshes token when all credentials provided", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "new-at-789",
        expires_in: 3600,
        token_type: "Bearer",
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await getValidAccessToken({
      accessToken: "old-at",
      refreshToken: "rt-456",
      clientId: "cid",
      clientSecret: "csecret",
    });

    expect(result).toBe("new-at-789");
    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("https://oauth2.googleapis.com/token");
    expect(opts.method).toBe("POST");
  });

  it("falls back to accessToken on refresh failure", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
    });
    vi.stubGlobal("fetch", mockFetch);

    // The withRetry mock will throw the HttpError from fetch
    // but getValidAccessToken catches it and falls back
    const { withRetry } = await import("./retry");
    vi.mocked(withRetry).mockRejectedValueOnce(new Error("refresh failed"));

    const result = await getValidAccessToken({
      accessToken: "fallback-at",
      refreshToken: "rt-456",
      clientId: "cid",
      clientSecret: "csecret",
    });

    expect(result).toBe("fallback-at");
  });
});
