import { describe, it, expect, vi } from "vitest";

vi.mock("./logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { withRetry, HttpError } from "./retry";

describe("withRetry", () => {
  it("returns result on first success", async () => {
    const fn = vi.fn(async () => 42);
    const result = await withRetry(fn, { retries: 3 });
    expect(result).toBe(42);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on failure then succeeds", async () => {
    let calls = 0;
    const fn = vi.fn(async () => {
      calls++;
      if (calls < 3) throw new Error("transient");
      return "ok";
    });
    const result = await withRetry(fn, { retries: 3, baseDelayMs: 10 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("throws after exhausting retries", async () => {
    const fn = vi.fn(async () => {
      throw new Error("always fails");
    });
    await expect(
      withRetry(fn, { retries: 2, baseDelayMs: 10 })
    ).rejects.toThrow("always fails");
    expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  it("does not retry non-retryable HTTP errors", async () => {
    const fn = vi.fn(async () => {
      throw new HttpError("Not found", 404);
    });
    await expect(
      withRetry(fn, { retries: 3, baseDelayMs: 10 })
    ).rejects.toThrow("Not found");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries 429 errors", async () => {
    let calls = 0;
    const fn = vi.fn(async () => {
      calls++;
      if (calls === 1) throw new HttpError("Rate limited", 429);
      return "ok";
    });
    const result = await withRetry(fn, { retries: 2, baseDelayMs: 10 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("calls onRetry callback", async () => {
    let calls = 0;
    const onRetry = vi.fn();
    const fn = vi.fn(async () => {
      calls++;
      if (calls < 2) throw new Error("fail");
      return "ok";
    });
    await withRetry(fn, { retries: 2, baseDelayMs: 10, onRetry });
    expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 1);
  });

  it("passes AbortSignal to function", async () => {
    const fn = vi.fn(async (signal: AbortSignal) => {
      expect(signal).toBeInstanceOf(AbortSignal);
      return "ok";
    });
    await withRetry(fn, { timeoutMs: 5000 });
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
