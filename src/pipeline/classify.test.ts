import { describe, it, expect, vi } from "vitest";

vi.mock("../lib/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { classifyWithHeuristics } from "./classify";

function contact(overrides: Partial<{ id: string; fullName: string; company: string | null; title: string | null; email: string | null }> = {}) {
  return {
    id: overrides.id ?? "test-id",
    fullName: overrides.fullName ?? "Test Person",
    company: overrides.company ?? null,
    title: overrides.title ?? null,
    email: overrides.email ?? null,
  };
}

describe("classifyWithHeuristics", () => {
  it("classifies CEO as portfolio_founder with 0.9 confidence", () => {
    const results = classifyWithHeuristics([
      contact({ title: "CEO", company: "Acme Startup" }),
    ]);
    expect(results).toHaveLength(1);
    expect(results[0].category).toBe("portfolio_founder");
    expect(results[0].confidence).toBe(0.9);
  });

  it("classifies Founder as portfolio_founder", () => {
    const results = classifyWithHeuristics([
      contact({ title: "Co-founder & CTO", company: "TechCo" }),
    ]);
    expect(results).toHaveLength(1);
    expect(results[0].category).toBe("portfolio_founder");
  });

  it("classifies Partner at VC firm as coinvestor", () => {
    const results = classifyWithHeuristics([
      contact({ title: "Managing Partner", company: "Sequoia Capital" }),
    ]);
    expect(results).toHaveLength(1);
    expect(results[0].category).toBe("coinvestor");
    expect(results[0].confidence).toBe(0.85);
  });

  it("classifies VP as advisor", () => {
    const results = classifyWithHeuristics([
      contact({ title: "VP of Engineering", company: "BigCo" }),
    ]);
    expect(results).toHaveLength(1);
    expect(results[0].category).toBe("advisor");
    expect(results[0].confidence).toBe(0.7);
  });

  it("classifies Director as advisor", () => {
    const results = classifyWithHeuristics([
      contact({ title: "Director of Product", company: "SomeCo" }),
    ]);
    expect(results).toHaveLength(1);
    expect(results[0].category).toBe("advisor");
  });

  it("does not classify Software Engineer", () => {
    const results = classifyWithHeuristics([
      contact({ title: "Software Engineer", company: "Google" }),
    ]);
    expect(results).toHaveLength(0);
  });

  it("does not classify null title", () => {
    const results = classifyWithHeuristics([
      contact({ title: null, company: null }),
    ]);
    expect(results).toHaveLength(0);
  });

  it("is case insensitive", () => {
    const results = classifyWithHeuristics([
      contact({ title: "ceo", company: "startup" }),
    ]);
    expect(results).toHaveLength(1);
    expect(results[0].category).toBe("portfolio_founder");
  });

  it("does not classify Managing Director at non-VC as coinvestor", () => {
    const results = classifyWithHeuristics([
      contact({ title: "Managing Director", company: "Goldman Sachs" }),
    ]);
    // Should NOT match coinvestor (no VC keywords in company)
    // May match advisor via "director" pattern
    for (const r of results) {
      expect(r.category).not.toBe("coinvestor");
    }
  });

  it("handles batch of multiple contacts", () => {
    const results = classifyWithHeuristics([
      contact({ id: "1", title: "CEO", company: "A" }),
      contact({ id: "2", title: "Intern", company: "B" }),
      contact({ id: "3", title: "GP", company: "Venture Partners" }),
    ]);
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.id)).toContain("1");
    expect(results.map((r) => r.id)).toContain("3");
  });
});
