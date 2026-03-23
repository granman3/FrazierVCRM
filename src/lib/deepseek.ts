import OpenAI from "openai";

// DeepSeek uses OpenAI-compatible API
const client = new OpenAI({
  baseURL: "https://api.deepseek.com/v1",
  apiKey: process.env.DEEPSEEK_API_KEY || "",
});

export interface Contact {
  id: string;
  fullName: string;
  company?: string | null;
  title?: string | null;
  email?: string | null;
  linkedinUrl?: string | null;
}

export interface VIPClassification {
  id: string;
  isVIP: boolean;
  confidence: number;
  category: string;
  reason: string;
}

const CLASSIFICATION_PROMPT = `You are a VIP classifier for a VC firm's relationship management system.

Your task is to analyze contacts and determine if they are VIPs worth monitoring for relationship building.

VIP Categories:
- portfolio_founder: Founders/executives at portfolio companies
- lp: Limited Partners (investors in the fund)
- coinvestor: Partners/GPs at other VC firms who might co-invest
- advisor: Senior advisors, board members, or industry experts
- other: Other notable contacts worth monitoring

Classification Criteria:
- C-suite executives (CEO, CTO, CFO, COO) at startups = portfolio_founder (high confidence)
- Partners, Managing Directors, GPs at VC/PE firms = coinvestor (high confidence)
- Founders, Co-founders at any company = portfolio_founder (medium-high confidence)
- Directors, VPs, Heads of departments = advisor (medium confidence)
- Angel investors, Scout roles = coinvestor (medium confidence)
- Individual contributors, entry-level roles = NOT VIP

Return JSON array with classifications. For each contact:
{
  "id": "contact id",
  "isVIP": true/false,
  "confidence": 0.0-1.0,
  "category": "category_name",
  "reason": "Brief explanation"
}

Only include contacts with confidence >= 0.6 as VIPs.`;

/**
 * Classify a batch of contacts using DeepSeek
 */
export async function classifyContacts(
  contacts: Contact[]
): Promise<VIPClassification[]> {
  if (!process.env.DEEPSEEK_API_KEY) {
    console.warn("DEEPSEEK_API_KEY not set, using heuristic classification");
    return classifyContactsHeuristic(contacts);
  }

  try {
    const contactsText = contacts
      .map(
        (c) =>
          `ID: ${c.id}\nName: ${c.fullName}\nTitle: ${c.title || "N/A"}\nCompany: ${c.company || "N/A"}\nEmail: ${c.email || "N/A"}`
      )
      .join("\n\n");

    const completion = await client.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content: CLASSIFICATION_PROMPT,
        },
        {
          role: "user",
          content: `Classify these contacts:\n\n${contactsText}`,
        },
      ],
      temperature: 0.1,
      max_tokens: 4000,
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from DeepSeek");
    }

    const parsed = JSON.parse(content);
    const results: VIPClassification[] = parsed.classifications || parsed;

    // Filter to only VIPs with sufficient confidence
    return results.filter((r) => r.isVIP && r.confidence >= 0.6);
  } catch (error) {
    console.error("DeepSeek classification failed, falling back to heuristics:", error);
    return classifyContactsHeuristic(contacts);
  }
}

/**
 * Fallback heuristic classification when DeepSeek is unavailable
 */
function classifyContactsHeuristic(contacts: Contact[]): VIPClassification[] {
  const results: VIPClassification[] = [];

  for (const contact of contacts) {
    const title = contact.title?.toLowerCase() || "";
    const company = contact.company?.toLowerCase() || "";

    let confidence = 0;
    let category = "other";
    let reason = "";
    let isVIP = false;

    // C-suite and founders
    if (
      title.includes("ceo") ||
      title.includes("cto") ||
      title.includes("cfo") ||
      title.includes("coo") ||
      title.includes("founder") ||
      title.includes("co-founder")
    ) {
      confidence = 0.9;
      category = "portfolio_founder";
      reason = `Executive/founder role: ${contact.title} at ${contact.company}`;
      isVIP = true;
    }
    // Partners and VPs at VC firms
    else if (
      (title.includes("partner") || title.includes("managing") || title.includes("gp")) &&
      (company.includes("venture") ||
        company.includes("capital") ||
        company.includes("vc") ||
        company.includes("partners"))
    ) {
      confidence = 0.85;
      category = "coinvestor";
      reason = `VC professional: ${contact.title} at ${contact.company}`;
      isVIP = true;
    }
    // Directors and VPs
    else if (
      title.includes("director") ||
      title.includes("vp") ||
      title.includes("vice president") ||
      title.includes("head of")
    ) {
      confidence = 0.7;
      category = "advisor";
      reason = `Senior leader: ${contact.title} at ${contact.company}`;
      isVIP = true;
    }

    if (isVIP && confidence >= 0.6) {
      results.push({
        id: contact.id,
        isVIP,
        confidence,
        category,
        reason,
      });
    }
  }

  return results;
}

const DRAFT_PROMPT = `You are a relationship manager for a VC firm. Write brief, personalized outreach messages.

Guidelines:
- Keep it short (2-3 sentences max)
- Be warm but professional
- Reference the specific trigger naturally
- End with a soft call to action
- Don't be salesy or pushy
- Use first name only
- Sound human, not templated`;

export interface DraftParams {
  contactName: string;
  contactCompany?: string;
  jobChange?: {
    previousCompany: string;
    previousTitle: string;
    currentCompany: string;
    currentTitle: string;
  };
  news?: {
    headline: string;
    url: string;
  };
}

/**
 * Generate a personalized outreach draft using DeepSeek
 */
export async function generateDraft(params: DraftParams): Promise<string> {
  if (!process.env.DEEPSEEK_API_KEY) {
    return generateDraftFallback(params);
  }

  try {
    let context = `Contact: ${params.contactName}`;
    if (params.contactCompany) {
      context += ` at ${params.contactCompany}`;
    }

    if (params.jobChange) {
      context += `\n\nJob Change: ${params.jobChange.previousTitle} at ${params.jobChange.previousCompany} → ${params.jobChange.currentTitle} at ${params.jobChange.currentCompany}`;
    }

    if (params.news) {
      context += `\n\nRecent News: ${params.news.headline}\nURL: ${params.news.url}`;
    }

    const completion = await client.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content: DRAFT_PROMPT,
        },
        {
          role: "user",
          content: `Write an outreach message for:\n\n${context}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 200,
    });

    return completion.choices[0]?.message?.content || generateDraftFallback(params);
  } catch (error) {
    console.error("DeepSeek draft generation failed:", error);
    return generateDraftFallback(params);
  }
}

function generateDraftFallback(params: DraftParams): string {
  const firstName = params.contactName.split(" ")[0];

  if (params.jobChange) {
    return `Hey ${firstName}! Just saw you joined ${params.jobChange.currentCompany} - congrats! Would love to catch up when you have a moment.`;
  }

  if (params.news) {
    return `Hey ${firstName}! Saw the news about ${params.contactCompany || "your company"} - exciting stuff! Let me know if there's anything I can help with.`;
  }

  return `Hey ${firstName}! Hope all is well. Would love to catch up when you have time.`;
}
