import { Resend } from "resend";

let resend: Resend | null = null;

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    return null;
  }
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

export interface DraftItem {
  contactName: string;
  contactTitle?: string;
  contactCompany?: string;
  contactEmail?: string;
  trigger: "job_change" | "news";
  newsHeadline?: string;
  newsUrl?: string;
  draft: string;
}

/**
 * Send daily digest email using Resend
 */
export async function sendDailyDigestEmail(
  to: string,
  drafts: DraftItem[]
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const client = getResend();

  if (!client) {
    console.log("Resend not configured, skipping email");
    return { success: false, error: "Resend not configured" };
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || "notifications@example.com";

  try {
    const result = await client.emails.send({
      from: fromEmail,
      to,
      subject: `Daily VIP Digest: ${drafts.length} outreach ${drafts.length === 1 ? "suggestion" : "suggestions"}`,
      html: generateDigestEmailHtml(drafts),
    });

    return {
      success: true,
      messageId: result.data?.id,
    };
  } catch (error) {
    console.error("Failed to send email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

function generateDigestEmailHtml(drafts: DraftItem[]): string {
  const itemsHtml = drafts
    .map(
      (d, index) => `
      <tr>
        <td style="padding: 24px; background: ${index % 2 === 0 ? "#ffffff" : "#f9fafb"};">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <h3 style="margin: 0 0 8px 0; font-size: 18px; color: #111827;">${d.contactName}</h3>
                <p style="margin: 0 0 4px 0; color: #6b7280; font-size: 14px;">
                  ${d.contactTitle || ""}${d.contactTitle && d.contactCompany ? " at " : ""}${d.contactCompany || ""}
                </p>
              </td>
              <td style="text-align: right; vertical-align: top;">
                <span style="display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 500; ${
                  d.trigger === "job_change"
                    ? "background: #dbeafe; color: #1d4ed8;"
                    : "background: #fef3c7; color: #92400e;"
                }">
                  ${d.trigger === "job_change" ? "Job Change" : "News"}
                </span>
              </td>
            </tr>
          </table>

          ${
            d.newsHeadline
              ? `
            <p style="margin: 12px 0 8px 0; color: #374151; font-size: 14px;">
              <strong>Trigger:</strong> ${d.newsHeadline}
            </p>
            ${
              d.newsUrl
                ? `<a href="${d.newsUrl}" style="color: #3b82f6; font-size: 14px; text-decoration: none;">Read article &rarr;</a>`
                : ""
            }
          `
              : ""
          }

          <div style="margin-top: 16px; padding: 16px; background: #f3f4f6; border-radius: 8px; border-left: 4px solid #3b82f6;">
            <p style="margin: 0; font-style: italic; color: #374151; line-height: 1.6;">${d.draft}</p>
          </div>

          ${
            d.contactEmail
              ? `
            <div style="margin-top: 16px;">
              <a href="mailto:${d.contactEmail}?subject=${encodeURIComponent("Catching up")}&body=${encodeURIComponent(d.draft)}"
                 style="display: inline-block; padding: 10px 20px; background: #3b82f6; color: white; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 14px;">
                Compose Email
              </a>
            </div>
          `
              : ""
          }
        </td>
      </tr>
    `
    )
    .join("");

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Daily VIP Digest</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: #f3f4f6;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background: #f3f4f6; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <!-- Header -->
                <tr>
                  <td style="padding: 32px 24px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);">
                    <h1 style="margin: 0; color: white; font-size: 24px; font-weight: 600;">Daily VIP Digest</h1>
                    <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">
                      ${drafts.length} outreach ${drafts.length === 1 ? "suggestion" : "suggestions"} for ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                    </p>
                  </td>
                </tr>

                <!-- Introduction -->
                <tr>
                  <td style="padding: 24px; border-bottom: 1px solid #e5e7eb;">
                    <p style="margin: 0; color: #4b5563; line-height: 1.6;">
                      Your AI Chief of Staff has identified ${drafts.length} opportunity${drafts.length === 1 ? "" : "s"} to reach out to your VIPs.
                      Review the suggested drafts below and click to compose an email.
                    </p>
                  </td>
                </tr>

                <!-- Drafts -->
                ${itemsHtml}

                <!-- Footer -->
                <tr>
                  <td style="padding: 24px; background: #f9fafb; border-top: 1px solid #e5e7eb;">
                    <p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center;">
                      This is an automated email from your Solo Chief of Staff.
                      <br>
                      <a href="${process.env.NEXTAUTH_URL || "#"}/dashboard" style="color: #3b82f6; text-decoration: none;">View Dashboard</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

/**
 * Send a test email to verify Resend configuration
 */
export async function sendTestEmail(to: string): Promise<boolean> {
  const client = getResend();

  if (!client) {
    console.log("Resend not configured");
    return false;
  }

  try {
    await client.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "notifications@example.com",
      to,
      subject: "Solo Chief of Staff - Test Email",
      html: `
        <div style="font-family: system-ui, sans-serif; padding: 20px;">
          <h1>Email Configuration Working!</h1>
          <p>If you received this email, your Resend integration is configured correctly.</p>
        </div>
      `,
    });
    return true;
  } catch (error) {
    console.error("Test email failed:", error);
    return false;
  }
}
