import crypto from "crypto";
import { logger } from "../lib/logger";
import { withRetry, HttpError } from "../lib/retry";

// ============================================================================
// JOB CHANGE DETECTION (Proxycurl)
// ============================================================================

export interface JobChange {
  previousCompany: string;
  previousTitle: string;
  currentCompany: string;
  currentTitle: string;
}

export async function detectJobChange(
  apiKey: string,
  linkedinUrl: string,
  previousCompany?: string | null,
  previousTitle?: string | null
): Promise<JobChange | null> {
  if (!linkedinUrl || !previousCompany || !previousTitle) return null;

  try {
    const profile = await withRetry(
      async (signal) => {
        const response = await fetch(
          `https://nubela.co/proxycurl/api/v2/linkedin?url=${encodeURIComponent(linkedinUrl)}&use_cache=if-present`,
          { headers: { Authorization: `Bearer ${apiKey}` }, signal }
        );
        if (!response.ok) throw new HttpError(`Proxycurl error`, response.status);
        return (await response.json()) as {
          experiences?: Array<{ ends_at: unknown; company: string; title: string }>;
        };
      },
      { retries: 2, timeoutMs: 10_000 }
    );

    const currentExp = profile.experiences?.find((exp) => !exp.ends_at);
    if (!currentExp) return null;

    const companyChanged =
      currentExp.company.toLowerCase() !== previousCompany.toLowerCase();
    const titleChanged =
      currentExp.title.toLowerCase() !== previousTitle.toLowerCase();

    if (companyChanged || titleChanged) {
      return {
        previousCompany,
        previousTitle,
        currentCompany: currentExp.company,
        currentTitle: currentExp.title,
      };
    }

    return null;
  } catch (err) {
    logger.warn({ linkedinUrl, err }, "Job change detection failed");
    return null;
  }
}

// ============================================================================
// NEWS FETCHING
// ============================================================================

export interface NewsItem {
  id: string;
  headline: string;
  url: string;
  source: string;
  snippet?: string;
  publishedAt?: Date;
  company: string;
  category: string;
}

const EXCITING_CATEGORIES = new Set([
  "funding",
  "acquisition",
  "ipo",
  "product_launch",
  "partnership",
]);

export function isExciting(item: NewsItem): boolean {
  return EXCITING_CATEGORIES.has(item.category);
}

export async function fetchCompanyNews(
  company: string,
  bingApiKey?: string
): Promise<NewsItem[]> {
  if (!company.trim()) return [];

  const results: NewsItem[] = [];

  try {
    results.push(...(await fetchGoogleNews(company)));
  } catch (err) {
    logger.warn({ company, err }, "Google News RSS fetch failed");
  }

  if (bingApiKey) {
    try {
      results.push(...(await fetchBingNews(company, bingApiKey)));
    } catch (err) {
      logger.warn({ company, err }, "Bing News fetch failed");
    }
  }

  // Dedupe by URL
  const seen = new Set<string>();
  return results.filter((item) => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
}

async function fetchGoogleNews(company: string): Promise<NewsItem[]> {
  const query = encodeURIComponent(`"${company}"`);
  return withRetry(
    async (signal) => {
      const response = await fetch(
        `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`,
        { signal }
      );
      if (!response.ok) throw new HttpError("Google RSS error", response.status);
      const xml = await response.text();
      return parseRSS(xml, company, "google");
    },
    { retries: 2, timeoutMs: 8_000 }
  );
}

async function fetchBingNews(
  company: string,
  apiKey: string
): Promise<NewsItem[]> {
  return withRetry(
    async (signal) => {
      const response = await fetch(
        `https://api.bing.microsoft.com/v7.0/news/search?q=${encodeURIComponent(company)}&count=10&mkt=en-US`,
        { headers: { "Ocp-Apim-Subscription-Key": apiKey }, signal }
      );
      if (!response.ok) throw new HttpError("Bing News error", response.status);

      const data = (await response.json()) as {
        value?: Array<{
          url: string;
          name: string;
          provider?: Array<{ name?: string }>;
          description?: string;
          datePublished?: string;
        }>;
      };
      return (data.value || []).map((article) => ({
        id: hashUrl(article.url),
        headline: article.name,
        url: article.url,
        source: article.provider?.[0]?.name || "bing",
        snippet: article.description,
        publishedAt: article.datePublished
          ? new Date(article.datePublished)
          : undefined,
        company,
        category: categorize(article.name),
      }));
    },
    { retries: 2, timeoutMs: 10_000 }
  );
}

export function parseRSS(
  xml: string,
  company: string,
  source: string
): NewsItem[] {
  const items: NewsItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = extractTag(block, "title");
    const link = extractTag(block, "link");
    const pubDate = extractTag(block, "pubDate");

    if (title && link) {
      items.push({
        id: hashUrl(link),
        headline: decodeEntities(title),
        url: link,
        source,
        publishedAt: pubDate ? new Date(pubDate) : undefined,
        company,
        category: categorize(title),
      });
    }
  }

  return items.slice(0, 10);
}

function extractTag(xml: string, tag: string): string | undefined {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return m ? m[1].trim() : undefined;
}

export function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function hashUrl(url: string): string {
  return crypto.createHash("sha256").update(url).digest("hex").slice(0, 16);
}

export function categorize(headline: string): string {
  const l = headline.toLowerCase();
  if (/raises|funding|series/.test(l)) return "funding";
  if (/acquired|acquisition|buys/.test(l)) return "acquisition";
  if (/ipo|public|listing/.test(l)) return "ipo";
  if (/launches|release|unveils/.test(l)) return "product_launch";
  if (/partnership|partners/.test(l)) return "partnership";
  if (/hires|joins|appoints/.test(l)) return "hiring";
  return "general";
}
