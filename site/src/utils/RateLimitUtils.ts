import axios from 'axios';

/**
 * Checks whether an error is an HTTP 429 (Too Many Requests / Rate Limited) response.
 */
export function isRateLimitError(error: unknown): boolean {
  if (axios.isAxiosError(error)) {
    return error.response?.status === 429;
  }
  if (typeof Response !== 'undefined' && error instanceof Response) {
    return error.status === 429;
  }
  if (error && typeof error === 'object') {
    const anyErr = error as { status?: number; statusCode?: number; code?: number | string; message?: string };
    if (anyErr.status === 429 || anyErr.statusCode === 429 || anyErr.code === 429 || anyErr.code === '429') {
      return true;
    }
    if (typeof anyErr.message === 'string' && (anyErr.message.includes('429') || /too many requests/i.test(anyErr.message))) {
      return true;
    }
  }
  return false;
}

/**
 * Extracts retry-after in seconds from an error response, or returns fallback.
 */
export function getRetryAfterSeconds(error: unknown, fallbackSeconds = 3): number {
  if (axios.isAxiosError(error) && error.response) {
    const header = error.response.headers?.['retry-after'] || error.response.headers?.['Retry-After'];
    if (header) {
      const parsed = Number(header);
      if (Number.isFinite(parsed) && parsed > 0) return Math.min(Math.max(1, Math.round(parsed)), 60);
      const parsedDate = Date.parse(String(header));
      if (!Number.isNaN(parsedDate)) {
        const diff = Math.ceil((parsedDate - Date.now()) / 1000);
        if (diff > 0) return Math.min(Math.max(1, diff), 60);
      }
    }
    const resetHeader = error.response.headers?.['x-ratelimit-reset'];
    if (resetHeader) {
      const parsed = Number(resetHeader);
      if (Number.isFinite(parsed) && parsed > 0) return Math.min(Math.max(1, Math.round(parsed)), 60);
    }
  }
  if (typeof Response !== 'undefined' && error instanceof Response) {
    const header = error.headers.get('Retry-After');
    if (header) {
      const parsed = Number(header);
      if (Number.isFinite(parsed) && parsed > 0) return Math.min(Math.max(1, Math.round(parsed)), 60);
    }
  }
  return Math.max(1, fallbackSeconds);
}

/**
 * Automatically retries an async operation if it fails with 429, waiting the appropriate duration.
 */
export async function withRateLimitRetry<T>(
  operation: () => Promise<T>,
  options?: {
    maxRetries?: number;
    fallbackDelaySeconds?: number;
    onRateLimited?: (retryAfterSeconds: number, attempt: number) => void;
  }
): Promise<T> {
  const maxRetries = options?.maxRetries ?? 2;
  const fallbackDelay = options?.fallbackDelaySeconds ?? 3;
  let attempt = 0;

  while (true) {
    try {
      return await operation();
    } catch (error) {
      if (isRateLimitError(error) && attempt < maxRetries) {
        attempt++;
        const waitSec = getRetryAfterSeconds(error, fallbackDelay * attempt);
        options?.onRateLimited?.(waitSec, attempt);
        await new Promise((resolve) => setTimeout(resolve, waitSec * 1000));
        continue;
      }
      throw error;
    }
  }
}
