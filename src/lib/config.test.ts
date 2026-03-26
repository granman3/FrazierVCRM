import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("./logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe("loadConfig", () => {
  const originalEnv = process.env;
  const mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
    throw new Error("process.exit called");
  });

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    mockExit.mockClear();
  });

  it("parses valid config", async () => {
    process.env.DATABASE_URL = "postgresql://localhost:5432/test";
    process.env.DIGEST_TO_EMAIL = "test@example.com";

    const { loadConfig } = await import("./config");
    const config = loadConfig();

    expect(config.DATABASE_URL).toBe("postgresql://localhost:5432/test");
    expect(config.DIGEST_TO_EMAIL).toBe("test@example.com");
  });

  it("applies defaults for optional numeric fields", async () => {
    process.env.DATABASE_URL = "postgresql://localhost:5432/test";
    process.env.DIGEST_TO_EMAIL = "test@example.com";

    const { loadConfig } = await import("./config");
    const config = loadConfig();

    expect(config.VIP_AUTO_APPROVE_THRESHOLD).toBe(0.85);
    expect(config.COOLDOWN_DAYS).toBe(14);
  });

  it("coerces string numbers", async () => {
    process.env.DATABASE_URL = "postgresql://localhost:5432/test";
    process.env.DIGEST_TO_EMAIL = "test@example.com";
    process.env.VIP_AUTO_APPROVE_THRESHOLD = "0.9";
    process.env.COOLDOWN_DAYS = "7";

    const { loadConfig } = await import("./config");
    const config = loadConfig();

    expect(config.VIP_AUTO_APPROVE_THRESHOLD).toBe(0.9);
    expect(config.COOLDOWN_DAYS).toBe(7);
  });

  it("exits on missing required fields", async () => {
    delete process.env.DATABASE_URL;
    delete process.env.DIGEST_TO_EMAIL;

    const { loadConfig } = await import("./config");
    expect(() => loadConfig()).toThrow("process.exit called");
  });

  it("treats contact source fields as optional", async () => {
    process.env.DATABASE_URL = "postgresql://localhost:5432/test";
    process.env.DIGEST_TO_EMAIL = "test@example.com";

    const { loadConfig } = await import("./config");
    const config = loadConfig();

    expect(config.ICLOUD_USERNAME).toBeUndefined();
    expect(config.GOOGLE_ACCESS_TOKEN).toBeUndefined();
    expect(config.DEEPSEEK_API_KEY).toBeUndefined();
  });
});
