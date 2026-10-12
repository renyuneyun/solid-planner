/**
 * An HTTP request kept failing with a retryable status (e.g. 429) after the
 * configured number of retries was exhausted. Distinguishable from a plain
 * `Error` so callers can react to rate limiting specifically if needed.
 */
export class FetchRetryExhaustedError extends Error {
  readonly status: number
  readonly url: string

  constructor(url: string, status: number) {
    super(
      `Request to ${url} failed with HTTP ${status} after retries were exhausted`,
    )
    this.name = 'FetchRetryExhaustedError'
    this.status = status
    this.url = url
  }
}

const DEFAULT_RETRYABLE_STATUSES = [429, 502, 503, 504]

export interface RateLimitRetryOptions {
  /** Maximum number of retries after the initial attempt. Default 4. */
  maxRetries?: number
  /** Base delay (ms) for exponential backoff. Default 375. */
  baseDelayMs?: number
  /** Upper bound (ms) for exponential backoff. Default 8000. */
  maxDelayMs?: number
  /** Statuses to retry. Default [429, 502, 503, 504]. */
  retryableStatuses?: number[]
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Parse a `Retry-After` header value into a delay in milliseconds. Accepts
 * either delta-seconds (e.g. "10") or an HTTP-date. Returns null when the
 * header is absent or unparseable.
 */
export function parseRetryAfterDelayMs(header: string | null): number | null {
  if (header === null) return null

  const trimmed = header.trim()
  if (trimmed === '') return null

  const seconds = Number(trimmed)
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000
  }

  const date = Date.parse(trimmed)
  if (!Number.isNaN(date)) {
    return Math.max(0, date - Date.now())
  }

  return null
}

/**
 * Wrap a `fetch` function so that transient HTTP failures (rate limiting and a
 * small set of server errors) are retried with a delay before being surfaced.
 * A `Retry-After` header is honored when present; otherwise an exponential
 * backoff is used. When retries are exhausted the wrapper throws a
 * `FetchRetryExhaustedError` rather than returning the failed response, so
 * callers cannot silently mistake a failed read for an empty/missing resource.
 */
export function withRateLimitRetry(
  fetchFn: typeof fetch,
  options: RateLimitRetryOptions = {},
): typeof fetch {
  const {
    maxRetries = 4,
    baseDelayMs = 375,
    maxDelayMs = 8000,
    retryableStatuses = DEFAULT_RETRYABLE_STATUSES,
  } = options

  return async (input, init) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof Request
          ? input.url
          : input.toString()

    let response = await fetchFn(input, init)
    let attempt = 0

    while (retryableStatuses.includes(response.status) && attempt < maxRetries) {
      const delay =
        parseRetryAfterDelayMs(response.headers.get('retry-after')) ??
        Math.min(baseDelayMs * 2 ** attempt, maxDelayMs)
      await sleep(delay)

      response = await fetchFn(input, init)
      attempt++
    }

    if (retryableStatuses.includes(response.status)) {
      throw new FetchRetryExhaustedError(url, response.status)
    }

    return response
  }
}