import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  withRateLimitRetry,
  FetchRetryExhaustedError,
} from '@/storage/soukai/rate-limit-fetch'

const response = (status: number, headers: Record<string, string> = {}) =>
  ({
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
  }) as unknown as Response

describe('withRateLimitRetry', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns a successful response without retrying', async () => {
    const fetchFn = vi.fn().mockResolvedValue(response(200))
    const fetch = withRateLimitRetry(fetchFn)

    const result = await fetch('https://pod/tasks/')

    expect(result.status).toBe(200)
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  it('passes non-retryable statuses (e.g. 404) through unchanged', async () => {
    const fetchFn = vi.fn().mockResolvedValue(response(404))
    const fetch = withRateLimitRetry(fetchFn)

    const result = await fetch('https://pod/tasks/')

    expect(result.status).toBe(404)
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  it('retries a 429 until it succeeds, honoring Retry-After in seconds', async () => {
    vi.useFakeTimers()
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(response(429, { 'retry-after': '2' }))
      .mockResolvedValueOnce(response(200))
    const fetch = withRateLimitRetry(fetchFn, { baseDelayMs: 1000 })

    const promise = fetch('https://pod/tasks/')
    await vi.advanceTimersByTimeAsync(2000)
    const result = await promise

    expect(result.status).toBe(200)
    expect(fetchFn).toHaveBeenCalledTimes(2)
  })

  it('uses exponential backoff when no Retry-After header is present', async () => {
    vi.useFakeTimers()
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(response(429))
      .mockResolvedValueOnce(response(429))
      .mockResolvedValueOnce(response(200))
    const fetch = withRateLimitRetry(fetchFn, { baseDelayMs: 1000 })

    // Delays: 1000ms, 2000ms
    const promise = fetch('https://pod/tasks/')
    await vi.advanceTimersByTimeAsync(1000)
    expect(fetchFn).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(2000)
    const result = await promise

    expect(result.status).toBe(200)
    expect(fetchFn).toHaveBeenCalledTimes(3)
  })

  it('throws FetchRetryExhaustedError when the 429 persists', async () => {
    vi.useFakeTimers()
    const fetchFn = vi.fn().mockResolvedValue(response(429))
    const fetch = withRateLimitRetry(fetchFn, {
      maxRetries: 2,
      baseDelayMs: 1000,
    })

    const promise = fetch('https://pod/tasks/deadbeef')
    const expectation = expect(promise).rejects.toBeInstanceOf(
      FetchRetryExhaustedError,
    )
    await vi.runAllTimersAsync()
    await expectation
    expect(fetchFn).toHaveBeenCalledTimes(3) // initial + 2 retries
  })
})