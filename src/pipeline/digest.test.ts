import { describe, it, expect, vi } from "vitest";

vi.mock("../lib/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../lib/retry", () => ({
  withRetry: vi.fn(async (fn: (signal: AbortSignal) => Promise<unknown>) => {
    const controller = new AbortController();
    return fn(controller.signal);
  }),
}));

vi.mock("openai", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: "AI generated draft" } }],
          }),
        },
      },
    })),
  };
});

import { fallbackDraft, generateDraft, buildDigestHtml, type DigestEntry, type DraftParams } from "./digest";

describe("fallbackDraft", () => {
  it("generates job change message", () => {
    const draft = fallbackDraft({
      contactName: "Jane Doe",
      contactCompany: "OldCo",
      jobChange: {
        previousCompany: "OldCo",
        previousTitle: "CTO",
        currentCompany: "NewCo",
        currentTitle: "CEO",
      },
    });
    expect(draft).toContain("Jane");
    expect(draft).toContain("NewCo");
  });

  it("generates news message", () => {
    const draft = fallbackDraft({
      contactName: "John Smith",
      contactCompany: "Acme",
      news: { headline: "Acme raises $10M", url: "https://example.com" },
    });
    expect(draft).toContain("John");
    expect(draft).toContain("Acme");
  });

  it("generates generic message", () => {
    const draft = fallbackDraft({
      contactName: "Alice Johnson",
    });
    expect(draft).toContain("Alice");
    expect(draft).toContain("catch up");
  });

  it("uses first name only", () => {
    const draft = fallbackDraft({
      contactName: "Robert James Smith III",
    });
    expect(draft).toContain("Robert");
    expect(draft).not.toContain("James");
  });
});

describe("generateDraft", () => {
  it("returns fallback when no API key", async () => {
    const draft = await generateDraft({ contactName: "Jane Doe" });
    expect(draft).toContain("Jane");
  });

  it("returns AI draft when API key provided", async () => {
    const draft = await generateDraft({ contactName: "Jane Doe" }, "fake-key");
    expect(draft).toBe("AI generated draft");
  });

  it("includes job change context in AI prompt", async () => {
    const draft = await generateDraft(
      {
        contactName: "Jane Doe",
        contactCompany: "OldCo",
        jobChange: {
          previousCompany: "OldCo",
          previousTitle: "CTO",
          currentCompany: "NewCo",
          currentTitle: "CEO",
        },
      },
      "fake-key"
    );
    expect(draft).toBe("AI generated draft");
  });

  it("includes news context in AI prompt", async () => {
    const draft = await generateDraft(
      {
        contactName: "Jane Doe",
        news: { headline: "Company raises $10M", url: "https://example.com" },
      },
      "fake-key"
    );
    expect(draft).toBe("AI generated draft");
  });

  it("falls back on AI failure", async () => {
    const OpenAI = (await import("openai")).default;
    vi.mocked(OpenAI).mockImplementationOnce(() => ({
      chat: {
        completions: {
          create: vi.fn().mockRejectedValue(new Error("API down")),
        },
      },
    }) as any);

    const draft = await generateDraft({ contactName: "Jane Doe" }, "fake-key");
    expect(draft).toContain("Jane");
  });
});

describe("buildDigestHtml", () => {
  const entry: DigestEntry = {
    contactName: "Jane Doe",
    contactTitle: "CEO",
    contactCompany: "Acme",
    contactEmail: "jane@acme.com",
    trigger: "news",
    newsHeadline: "Acme raises $10M",
    draft: "Hey Jane! Exciting news about Acme.",
  };

  it("includes contact info", () => {
    const html = buildDigestHtml([entry]);
    expect(html).toContain("Jane Doe");
    expect(html).toContain("CEO");
    expect(html).toContain("Acme");
  });

  it("includes trigger type", () => {
    const html = buildDigestHtml([entry]);
    expect(html).toContain("News");
    expect(html).toContain("Acme raises $10M");
  });

  it("includes draft text", () => {
    const html = buildDigestHtml([entry]);
    expect(html).toContain("Hey Jane! Exciting news about Acme.");
  });

  it("includes mailto link when email present", () => {
    const html = buildDigestHtml([entry]);
    expect(html).toContain("mailto:jane@acme.com");
    expect(html).toContain("Send Email");
  });

  it("omits mailto link when no email", () => {
    const html = buildDigestHtml([{ ...entry, contactEmail: null }]);
    expect(html).not.toContain("mailto:");
  });

  it("handles multiple entries", () => {
    const html = buildDigestHtml([
      entry,
      { ...entry, contactName: "Bob Smith", trigger: "job_change" },
    ]);
    expect(html).toContain("Jane Doe");
    expect(html).toContain("Bob Smith");
    expect(html).toContain("2 outreach suggestions");
  });

  it("shows Job Change trigger type", () => {
    const html = buildDigestHtml([{ ...entry, trigger: "job_change" }]);
    expect(html).toContain("Job Change");
  });
});
