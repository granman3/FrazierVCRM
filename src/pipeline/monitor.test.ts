import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../lib/retry", () => ({
  withRetry: vi.fn(async (fn: (signal: AbortSignal) => Promise<unknown>) => {
    const controller = new AbortController();
    return fn(controller.signal);
  }),
  HttpError: class HttpError extends Error {
    status: number;
    constructor(msg: string, status: number) {
      super(msg);
      this.status = status;
    }
  },
}));

import { categorize, isExciting, parseRSS, decodeEntities, fetchCompanyNews, detectJobChange, type NewsItem } from "./monitor";

describe("categorize", () => {
  it("identifies funding", () => {
    expect(categorize("Acme raises $50M Series B")).toBe("funding");
  });

  it("identifies acquisition", () => {
    expect(categorize("BigCo acquired Acme")).toBe("acquisition");
  });

  it("identifies IPO", () => {
    expect(categorize("Acme files for IPO")).toBe("ipo");
  });

  it("identifies product launch", () => {
    expect(categorize("Acme launches new AI product")).toBe("product_launch");
  });

  it("identifies partnership", () => {
    expect(categorize("Acme partners with Google")).toBe("partnership");
  });

  it("identifies hiring", () => {
    expect(categorize("Acme hires new CTO")).toBe("hiring");
  });

  it("defaults to general", () => {
    expect(categorize("Acme quarterly earnings report")).toBe("general");
  });
});

describe("isExciting", () => {
  it("returns true for exciting categories", () => {
    const exciting = ["funding", "acquisition", "ipo", "product_launch", "partnership"];
    for (const category of exciting) {
      expect(isExciting({ category } as NewsItem)).toBe(true);
    }
  });

  it("returns false for non-exciting categories", () => {
    expect(isExciting({ category: "general" } as NewsItem)).toBe(false);
    expect(isExciting({ category: "hiring" } as NewsItem)).toBe(false);
  });
});

describe("decodeEntities", () => {
  it("decodes HTML entities", () => {
    expect(decodeEntities("A &amp; B &lt; C &gt; D")).toBe("A & B < C > D");
    expect(decodeEntities("He said &quot;hello&quot;")).toBe('He said "hello"');
    expect(decodeEntities("It&#39;s fine")).toBe("It's fine");
  });
});

describe("parseRSS", () => {
  it("parses well-formed RSS", () => {
    const xml = `
      <rss><channel>
        <item>
          <title>Acme raises $10M</title>
          <link>https://example.com/1</link>
          <pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate>
        </item>
        <item>
          <title>Acme launches product</title>
          <link>https://example.com/2</link>
        </item>
      </channel></rss>
    `;
    const items = parseRSS(xml, "Acme", "test");
    expect(items).toHaveLength(2);
    expect(items[0].headline).toBe("Acme raises $10M");
    expect(items[0].url).toBe("https://example.com/1");
    expect(items[0].source).toBe("test");
    expect(items[0].company).toBe("Acme");
    expect(items[0].category).toBe("funding");
    expect(items[1].category).toBe("product_launch");
  });

  it("decodes HTML entities in titles", () => {
    const xml = `<rss><channel><item><title>A &amp; B</title><link>https://example.com</link></item></channel></rss>`;
    const items = parseRSS(xml, "A", "test");
    expect(items[0].headline).toBe("A & B");
  });

  it("returns empty for no items", () => {
    const xml = `<rss><channel></channel></rss>`;
    expect(parseRSS(xml, "Acme", "test")).toHaveLength(0);
  });

  it("limits to 10 items", () => {
    const itemXml = Array.from({ length: 15 }, (_, i) =>
      `<item><title>News ${i}</title><link>https://example.com/${i}</link></item>`
    ).join("");
    const xml = `<rss><channel>${itemXml}</channel></rss>`;
    expect(parseRSS(xml, "Co", "test")).toHaveLength(10);
  });

  it("skips items without link", () => {
    const xml = `<rss><channel><item><title>No link</title></item></channel></rss>`;
    expect(parseRSS(xml, "Co", "test")).toHaveLength(0);
  });
});

describe("fetchCompanyNews", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("returns empty for blank company", async () => {
    const result = await fetchCompanyNews("", undefined);
    expect(result).toHaveLength(0);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("fetches from Google RSS", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        `<rss><channel><item><title>News</title><link>https://a.com</link></item></channel></rss>`,
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await fetchCompanyNews("Acme", undefined);
    expect(result).toHaveLength(1);
    expect(result[0].headline).toBe("News");
  });

  it("dedupes by URL", async () => {
    const rss = `<rss><channel><item><title>Same</title><link>https://same.com</link></item></channel></rss>`;
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, text: async () => rss })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          value: [{ url: "https://same.com", name: "Same", provider: [] }],
        }),
      });
    vi.stubGlobal("fetch", mockFetch);

    const result = await fetchCompanyNews("Acme", "bing-key");
    expect(result).toHaveLength(1);
  });
});

describe("detectJobChange", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("returns null if no linkedinUrl", async () => {
    const result = await detectJobChange("key", "", "OldCo", "CEO");
    expect(result).toBeNull();
  });

  it("returns null if no previousCompany", async () => {
    const result = await detectJobChange("key", "https://linkedin.com/in/test", null, "CEO");
    expect(result).toBeNull();
  });

  it("detects company change", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        experiences: [{ ends_at: null, company: "NewCo", title: "CEO" }],
      }),
    }));

    const result = await detectJobChange("key", "https://linkedin.com/in/test", "OldCo", "CEO");
    expect(result).not.toBeNull();
    expect(result!.currentCompany).toBe("NewCo");
    expect(result!.previousCompany).toBe("OldCo");
  });

  it("returns null when no change", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        experiences: [{ ends_at: null, company: "SameCo", title: "CEO" }],
      }),
    }));

    const result = await detectJobChange("key", "https://linkedin.com/in/test", "SameCo", "CEO");
    expect(result).toBeNull();
  });

  it("returns null on API error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const result = await detectJobChange("key", "https://linkedin.com/in/test", "Co", "CEO");
    expect(result).toBeNull();
  });
});
