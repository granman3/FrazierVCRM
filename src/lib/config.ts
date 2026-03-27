import { z } from "zod";
import { logger } from "./logger";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),

  // Contact sources
  ICLOUD_USERNAME: z.string().optional(),
  ICLOUD_APP_PASSWORD: z.string().optional(),
  GOOGLE_ACCESS_TOKEN: z.string().optional(),
  GOOGLE_REFRESH_TOKEN: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // AI + enrichment
  DEEPSEEK_API_KEY: z.string().optional(),
  PROXYCURL_API_KEY: z.string().optional(),

  // News
  BING_NEWS_API_KEY: z.string().optional(),

  // Email delivery
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().email().optional(),
  DIGEST_TO_EMAIL: z.string().email().optional(),

  // Tuning
  VIP_AUTO_APPROVE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.85),
  COOLDOWN_DAYS: z.coerce.number().int().positive().default(14),
});

export type Config = z.infer<typeof envSchema>;

export function loadConfig(): Config {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const missing = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    logger.error({ issues: result.error.issues }, `Invalid configuration:\n${missing}`);
    process.exit(1);
  }

  return result.data;
}
