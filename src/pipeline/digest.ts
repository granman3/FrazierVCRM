import OpenAI from "openai";
import type { JobChange } from "./monitor";
import { logger } from "../lib/logger";
import { withRetry } from "../lib/retry";

// ============================================================================
// DRAFT GENERATION
// ============================================================================

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
  jobChange?: JobChange;
  news?: { headline: string; url: string };
}

export async function generateDraft(
  params: DraftParams,
  deepseekApiKey?: string
): Promise<string> {
  if (!deepseekApiKey) return fallbackDraft(params);

  const client = new OpenAI({
    baseURL: "https://api.deepseek.com/v1",
    apiKey: deepseekApiKey,
  });

  try {
    let context = `Contact: ${params.contactName}`;
    if (params.contactCompany) context += ` at ${params.contactCompany}`;
    if (params.jobChange) {
      context += `\n\nJob Change: ${params.jobChange.previousTitle} at ${params.jobChange.previousCompany} → ${params.jobChange.currentTitle} at ${params.jobChange.currentCompany}`;
    }
    if (params.news) {
      context += `\n\nRecent News: ${params.news.headline}\nURL: ${params.news.url}`;
    }

    const completion = await client.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: DRAFT_PROMPT },
        { role: "user", content: `Write an outreach message for:\n\n${context}` },
      ],
      temperature: 0.7,
      max_tokens: 200,
    });

    return completion.choices[0]?.message?.content || fallbackDraft(params);
  } catch (err) {
    logger.warn({ err, contactName: params.contactName }, "Draft generation failed, using fallback");
    return fallbackDraft(params);
  }
}

export function fallbackDraft(params: DraftParams): string {
  const firstName = params.contactName.split(" ")[0];

  if (params.jobChange) {
    return `Hey ${firstName}! Just saw you joined ${params.jobChange.currentCompany} - congrats! Would love to catch up when you have a moment.`;
  }
  if (params.news) {
    return `Hey ${firstName}! Saw the news about ${params.contactCompany || "your company"} - exciting stuff! Let me know if there's anything I can help with.`;
  }
  return `Hey ${firstName}! Hope all is well. Would love to catch up when you have time.`;
}

// ============================================================================
// EMAIL DIGEST
// ============================================================================

export interface DigestEntry {
  contactName: string;
  contactTitle?: string | null;
  contactCompany?: string | null;
  contactEmail?: string | null;
  trigger: "job_change" | "news";
  newsHeadline?: string;
  draft: string;
}

export async function sendDigest(
  entries: DigestEntry[],
  toEmail: string,
  resendApiKey: string,
  fromEmail: string
): Promise<void> {
  if (entries.length === 0) return;

  const { Resend } = await import("resend");
  const resend = new Resend(resendApiKey);

  await withRetry(
    async () => {
      await resend.emails.send({
        from: fromEmail,
        to: toEmail,
        subject: `Daily VIP Digest: ${entries.length} outreach suggestions`,
        html: buildDigestHtml(entries),
      });
    },
    { retries: 2, timeoutMs: 15_000 }
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildDigestHtml(entries: DigestEntry[]): string {
  const items = entries
    .map(
      (d) => `
    <div style="margin-bottom: 24px; padding: 16px; background: #f9fafb; border-radius: 8px;">
      <h3 style="margin: 0 0 8px 0;">${escapeHtml(d.contactName)}</h3>
      <p style="margin: 0 0 4px 0; color: #6b7280; font-size: 14px;">
        ${escapeHtml(d.contactTitle || "")} ${d.contactCompany ? `at ${escapeHtml(d.contactCompany)}` : ""}
      </p>
      <p style="margin: 8px 0; color: #374151; font-size: 14px;">
        <strong>Trigger:</strong> ${d.trigger === "job_change" ? "Job Change" : "News"}
        ${d.newsHeadline ? `: ${escapeHtml(d.newsHeadline)}` : ""}
      </p>
      <div style="margin-top: 12px; padding: 12px; background: white; border-radius: 4px; border-left: 3px solid #3b82f6;">
        <p style="margin: 0; font-style: italic;">${escapeHtml(d.draft)}</p>
      </div>
      ${
        d.contactEmail
          ? `<a href="mailto:${encodeURIComponent(d.contactEmail)}?body=${encodeURIComponent(d.draft)}" style="display: inline-block; margin-top: 12px; padding: 8px 16px; background: #3b82f6; color: white; text-decoration: none; border-radius: 4px;">Send Email</a>`
          : ""
      }
    </div>`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Daily VIP Digest</title></head>
<body style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
  <h1 style="margin-bottom: 24px;">Daily VIP Digest</h1>
  <p style="color: #6b7280; margin-bottom: 24px;">
    Here are ${entries.length} outreach suggestions for today:
  </p>
  ${items}
  <hr style="margin: 32px 0; border: none; border-top: 1px solid #e5e7eb;">
  <p style="color: #9ca3af; font-size: 12px;">
    Automated email from Frazier VC Chief of Staff.
  </p>
</body>
</html>`;
}
