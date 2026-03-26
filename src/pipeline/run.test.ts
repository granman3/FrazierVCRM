import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../lib/google-auth", () => ({
  getValidAccessToken: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./sync/icloud", () => ({
  syncICloudContacts: vi.fn().mockResolvedValue(5),
}));

vi.mock("./sync/google", () => ({
  syncGoogleContacts: vi.fn().mockResolvedValue(10),
}));

vi.mock("./classify", () => ({
  classifyNewContacts: vi.fn().mockResolvedValue(3),
}));

vi.mock("./monitor", () => ({
  detectJobChange: vi.fn().mockResolvedValue(null),
  fetchCompanyNews: vi.fn().mockResolvedValue([]),
  isExciting: vi.fn().mockReturnValue(false),
}));

vi.mock("./digest", () => ({
  generateDraft: vi.fn().mockResolvedValue("Draft text"),
  sendDigest: vi.fn().mockResolvedValue(undefined),
}));

import { runPipeline } from "./run";
import { syncICloudContacts } from "./sync/icloud";
import { syncGoogleContacts } from "./sync/google";
import { classifyNewContacts } from "./classify";
import { getValidAccessToken } from "../lib/google-auth";
import type { Config } from "../lib/config";

function makeMockDb() {
  const runRecord = { id: "run-1", status: "running" };
  return {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([runRecord]),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
    query: {
      vips: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      outreachLog: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    },
  };
}

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    DIGEST_TO_EMAIL: "test@test.com",
    VIP_AUTO_APPROVE_THRESHOLD: 0.85,
    COOLDOWN_DAYS: 14,
    ...overrides,
  };
}

describe("runPipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runs with no contact sources configured", async () => {
    const db = makeMockDb();
    const config = makeConfig();

    const runId = await runPipeline(db as any, config);

    expect(runId).toBe("run-1");
    expect(syncICloudContacts).not.toHaveBeenCalled();
    expect(syncGoogleContacts).not.toHaveBeenCalled();
    expect(classifyNewContacts).toHaveBeenCalledOnce();
  });

  it("syncs iCloud contacts when credentials configured", async () => {
    const db = makeMockDb();
    const config = makeConfig({
      ICLOUD_USERNAME: "user@icloud.com",
      ICLOUD_APP_PASSWORD: "app-pass",
    });

    await runPipeline(db as any, config);

    expect(syncICloudContacts).toHaveBeenCalledWith(db, "user@icloud.com", "app-pass");
  });

  it("syncs Google contacts when token available", async () => {
    const db = makeMockDb();
    vi.mocked(getValidAccessToken).mockResolvedValueOnce("fresh-token");
    const config = makeConfig({
      GOOGLE_ACCESS_TOKEN: "old-token",
      GOOGLE_REFRESH_TOKEN: "rt",
      GOOGLE_CLIENT_ID: "cid",
      GOOGLE_CLIENT_SECRET: "csecret",
    });

    await runPipeline(db as any, config);

    expect(syncGoogleContacts).toHaveBeenCalledWith(db, "fresh-token");
  });

  it("updates run to failed on error", async () => {
    const db = makeMockDb();
    vi.mocked(classifyNewContacts).mockRejectedValueOnce(new Error("boom"));
    const config = makeConfig();

    await expect(runPipeline(db as any, config)).rejects.toThrow("boom");

    const updateCall = db.update.mock.calls[0];
    expect(updateCall).toBeDefined();
  });

  it("classifies with configured threshold", async () => {
    const db = makeMockDb();
    const config = makeConfig({ VIP_AUTO_APPROVE_THRESHOLD: 0.9 });

    await runPipeline(db as any, config);

    expect(classifyNewContacts).toHaveBeenCalledWith(db, undefined, 0.9);
  });
});
