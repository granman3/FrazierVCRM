import OpenAI from "openai";
import { eq, notInArray } from "drizzle-orm";
import { contacts, vips } from "../db/schema";
import type { Db } from "../db";
import { logger } from "../lib/logger";

interface ContactRow {
  id: string;
  fullName: string;
  company: string | null;
  title: string | null;
  email: string | null;
}

interface Classification {
  id: string;
  isVIP: boolean;
  confidence: number;
  category: string;
  reason: string;
}

const CLASSIFICATION_PROMPT = `You are a VIP classifier for a VC firm's relationship management system.

Analyze contacts and determine if they are VIPs worth monitoring.

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

Return JSON: { "classifications": [{ "id": "contact id", "isVIP": true/false, "confidence": 0.0-1.0, "category": "category_name", "reason": "Brief explanation" }] }

Only include contacts with confidence >= 0.6 as VIPs.`;

export async function classifyNewContacts(
  db: Db,
  deepseekApiKey: string | undefined,
  autoApproveThreshold: number
): Promise<number> {
  // Get contacts not yet classified
  const existingVips = await db.query.vips.findMany({
    columns: { contactId: true },
  });
  const classifiedIds = existingVips.map((v) => v.contactId);

  const unclassified = await db.query.contacts.findMany({
    where: classifiedIds.length > 0
      ? notInArray(contacts.id, classifiedIds)
      : undefined,
  });

  if (unclassified.length === 0) return 0;

  const BATCH_SIZE = 150;
  let totalVips = 0;

  for (let i = 0; i < unclassified.length; i += BATCH_SIZE) {
    const batch = unclassified.slice(i, i + BATCH_SIZE);
    const results = deepseekApiKey
      ? await classifyWithDeepSeek(deepseekApiKey, batch)
      : classifyWithHeuristics(batch);

    for (const r of results) {
      await db
        .insert(vips)
        .values({
          contactId: r.id,
          confidence: r.confidence,
          reason: r.reason,
          category: r.category,
          autoApproved: r.confidence >= autoApproveThreshold,
          active: r.confidence >= autoApproveThreshold,
        })
        .onConflictDoUpdate({
          target: [vips.contactId],
          set: {
            confidence: r.confidence,
            reason: r.reason,
            category: r.category,
          },
        });
      totalVips++;
    }

    if (i + BATCH_SIZE < unclassified.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return totalVips;
}

async function classifyWithDeepSeek(
  apiKey: string,
  batch: ContactRow[]
): Promise<Classification[]> {
  const client = new OpenAI({
    baseURL: "https://api.deepseek.com/v1",
    apiKey,
  });

  try {
    const contactsText = batch
      .map(
        (c) =>
          `ID: ${c.id}\nName: ${c.fullName}\nTitle: ${c.title || "N/A"}\nCompany: ${c.company || "N/A"}\nEmail: ${c.email || "N/A"}`
      )
      .join("\n\n");

    const completion = await client.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: CLASSIFICATION_PROMPT },
        { role: "user", content: `Classify these contacts:\n\n${contactsText}` },
      ],
      temperature: 0.1,
      max_tokens: 4000,
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error("No response from DeepSeek");

    const parsed = JSON.parse(content);
    const results: Classification[] = parsed.classifications || parsed;
    return results.filter((r) => r.isVIP && r.confidence >= 0.6);
  } catch (error) {
    logger.warn({ err: error, batchSize: batch.length }, "DeepSeek classification failed, using heuristics");
    return classifyWithHeuristics(batch);
  }
}

export function classifyWithHeuristics(batch: ContactRow[]): Classification[] {
  const results: Classification[] = [];

  for (const contact of batch) {
    const title = contact.title?.toLowerCase() || "";
    const company = contact.company?.toLowerCase() || "";

    let confidence = 0;
    let category = "other";
    let reason = "";

    if (/\b(ceo|cto|cfo|coo|founder|co-founder)\b/.test(title)) {
      confidence = 0.9;
      category = "portfolio_founder";
      reason = `Executive/founder: ${contact.title} at ${contact.company}`;
    } else if (
      /\b(partner|managing|gp)\b/.test(title) &&
      /\b(venture|capital|vc|partners)\b/.test(company)
    ) {
      confidence = 0.85;
      category = "coinvestor";
      reason = `VC professional: ${contact.title} at ${contact.company}`;
    } else if (/\b(director|vp|vice president|head of)\b/.test(title)) {
      confidence = 0.7;
      category = "advisor";
      reason = `Senior leader: ${contact.title} at ${contact.company}`;
    }

    if (confidence >= 0.6) {
      results.push({
        id: contact.id,
        isVIP: true,
        confidence,
        category,
        reason,
      });
    }
  }

  return results;
}
