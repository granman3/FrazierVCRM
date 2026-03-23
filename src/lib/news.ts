import crypto from "crypto";

export interface NewsItem {
  id: string;
  headline: string;
  url: string;
  source: string;
  snippet?: string;
  publishedAt?: Date;
  company: string;
  category?: string;
}

/**
 * Fetch news about a company using Google RSS and Bing News
 */
export async function fetchCompanyNews(company: string): Promise<NewsItem[]> {
  if (!company || company.trim() === "") {
    return [];
  }

  const results: NewsItem[] = [];

  // Try Google News RSS
  try {
    const googleNews = await fetchGoogleNews(company);
    results.push(...googleNews);
  } catch (error) {
    console.error("Google News fetch failed:", error);
  }

  // Try Bing News if we have API key
  if (process.env.BING_NEWS_API_KEY) {
    try {
      const bingNews = await fetchBingNews(company);
      results.push(...bingNews);
    } catch (error) {
      console.error("Bing News fetch failed:", error);
    }
  }

  // Dedupe by URL
  const seen = new Set<string>();
  return results.filter((item) => {
    if (seen.has(item.url)) {
      return false;
    }
    seen.add(item.url);
    return true;
  });
}

async function fetchGoogleNews(company: string): Promise<NewsItem[]> {
  const query = encodeURIComponent(`"${company}"`);
  const rssUrl = `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`;

  const response = await fetch(rssUrl);
  if (!response.ok) {
    throw new Error(`Google RSS returned ${response.status}`);
  }

  const xml = await response.text();
  return parseRSS(xml, company, "google");
}

async function fetchBingNews(company: string): Promise<NewsItem[]> {
  const response = await fetch(
    `https://api.bing.microsoft.com/v7.0/news/search?q=${encodeURIComponent(company)}&count=10&mkt=en-US`,
    {
      headers: {
        "Ocp-Apim-Subscription-Key": process.env.BING_NEWS_API_KEY!,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Bing News API returned ${response.status}`);
  }

  const data = await response.json();
  const items: NewsItem[] = [];

  for (const article of data.value || []) {
    const urlHash = crypto.createHash("sha256").update(article.url).digest("hex").slice(0, 16);

    items.push({
      id: urlHash,
      headline: article.name,
      url: article.url,
      source: article.provider?.[0]?.name || "bing",
      snippet: article.description,
      publishedAt: article.datePublished ? new Date(article.datePublished) : undefined,
      company,
      category: categorizeNews(article.name),
    });
  }

  return items;
}

function parseRSS(xml: string, company: string, source: string): NewsItem[] {
  const items: NewsItem[] = [];

  // Simple XML parsing for RSS items
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];

    const title = extractTag(itemXml, "title");
    const link = extractTag(itemXml, "link");
    const pubDate = extractTag(itemXml, "pubDate");
    const description = extractTag(itemXml, "description");

    if (title && link) {
      const urlHash = crypto.createHash("sha256").update(link).digest("hex").slice(0, 16);

      items.push({
        id: urlHash,
        headline: decodeHTMLEntities(title),
        url: link,
        source,
        snippet: description ? decodeHTMLEntities(stripHtml(description)) : undefined,
        publishedAt: pubDate ? new Date(pubDate) : undefined,
        company,
        category: categorizeNews(title),
      });
    }
  }

  return items.slice(0, 10); // Limit to 10 items
}

function extractTag(xml: string, tag: string): string | undefined {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const match = xml.match(regex);
  return match ? match[1].trim() : undefined;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "");
}

function decodeHTMLEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

/**
 * Categorize news based on headline keywords
 */
function categorizeNews(headline: string): string {
  const lower = headline.toLowerCase();

  if (lower.includes("raises") || lower.includes("funding") || lower.includes("series")) {
    return "funding";
  }
  if (lower.includes("acquired") || lower.includes("acquisition") || lower.includes("buys")) {
    return "acquisition";
  }
  if (lower.includes("ipo") || lower.includes("public") || lower.includes("listing")) {
    return "ipo";
  }
  if (lower.includes("launches") || lower.includes("release") || lower.includes("unveils")) {
    return "product_launch";
  }
  if (lower.includes("partnership") || lower.includes("partners")) {
    return "partnership";
  }
  if (lower.includes("hires") || lower.includes("joins") || lower.includes("appoints")) {
    return "hiring";
  }

  return "general";
}

/**
 * Check if news is "exciting" (worth reaching out about)
 */
export function isExcitingNews(item: NewsItem): boolean {
  const excitingCategories = ["funding", "acquisition", "ipo", "product_launch", "partnership"];
  return excitingCategories.includes(item.category || "");
}
