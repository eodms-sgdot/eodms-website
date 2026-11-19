import axios from 'axios';

export interface HttpExchange {
  method: string;
  url: string;
  status?: number;
  statusText?: string;
  body?: unknown;
  /** Used when no response was received (network error, timeout, CORS). */
  failure?: string;
}

const formatBody = (body: unknown): string => {
  if (body === undefined || body === null || body === '') return '(empty response body)';
  if (typeof body !== 'string') return JSON.stringify(body, null, 2);
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
};

/** Returns the most informative message from a structured HTTP error response. */
export function getHttpErrorMessage(
  data: unknown,
  fields: readonly string[] = ['message', 'detail', 'details', 'error'],
): string | undefined {
  if (typeof data === 'string') {
    const message = data.trim();
    return message && !/^\d{3}\b/.test(message) ? message : undefined;
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return undefined;

  const body = data as Record<string, unknown>;
  return fields
    .map(key => body[key])
    .find((value): value is string =>
      typeof value === 'string' && value.trim().length > 0 && !/^\d{3}\b/.test(value.trim()),
    )
    ?.trim();
}

/** Copy-pasteable summary of a failed HTTP exchange. Request headers and bodies are never included. */
export function formatHttpErrorDetails({ method, url, status, statusText, body, failure }: HttpExchange): string {
  return [
    `${method.toUpperCase()} ${url}`,
    failure ? `No response received: ${failure}` : `HTTP ${status ?? ''} ${statusText ?? ''}`.trim(),
    `Date: ${new Date().toISOString()}`,
    ...(failure ? [] : ['', formatBody(body)]),
  ].join('\n');
}

/** Returns copyable details for an Axios error, or undefined for anything else. */
export function getAxiosErrorDetails(error: unknown): string | undefined {
  if (!axios.isAxiosError(error)) return undefined;
  const { config, response } = error;
  const responseUrl = (response?.request as XMLHttpRequest | undefined)?.responseURL;
  const url = responseUrl || [config?.baseURL, config?.url].filter(Boolean).join('') || '(unknown URL)';
  return formatHttpErrorDetails({
    method: config?.method ?? 'GET',
    url,
    status: response?.status,
    statusText: response?.statusText,
    body: response?.data,
    failure: response ? undefined : [error.code, error.message].filter(Boolean).join(': '),
  });
}
