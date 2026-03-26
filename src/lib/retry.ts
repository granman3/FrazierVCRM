import { logger } from "./logger";

export interface RetryOptions {
  retries?: number;
  baseDelayMs?: number;
  timeoutMs?: number;
  onRetry?: (error: unknown, attempt: number) => void;
}

const NON_RETRYABLE = new Set([400, 401, 403, 404, 422]);

export class HttpError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export async function withRetry<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  opts: RetryOptions = {}
): Promise<T> {
  const { retries = 3, baseDelayMs = 500, timeoutMs = 10_000, onRetry } = opts;

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const result = await fn(controller.signal);
      clearTimeout(timer);
      return result;
    } catch (error) {
      clearTimeout(timer);
      lastError = error;

      if (error instanceof HttpError && NON_RETRYABLE.has(error.status)) {
        throw error;
      }

      if (attempt < retries) {
        const jitter = Math.random() * 200;
        const delay = baseDelayMs * Math.pow(2, attempt) + jitter;
        logger.warn({ attempt: attempt + 1, retries, delay: Math.round(delay), err: error }, "Retrying after failure");
        onRetry?.(error, attempt + 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}
