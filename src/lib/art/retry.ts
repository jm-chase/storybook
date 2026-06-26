/**
 * Retry transient Gemini failures: 429/RESOURCE_EXHAUSTED (quota/rate) and
 * 503/UNAVAILABLE ("high demand"). Honors the server's retry delay when given,
 * otherwise exponential backoff. Shared by image generation and vision checks.
 */
export async function withRetry<T>(fn: () => Promise<T>, tries = 4): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const msg = String((e as { message?: string })?.message ?? e);
      const retriable = /\b429\b|RESOURCE_EXHAUSTED|\b503\b|UNAVAILABLE|high demand/i.test(msg);
      if (!retriable || attempt >= tries - 1) throw e;
      const m = msg.match(/retry in ([0-9.]+)s/i) ?? msg.match(/"retryDelay":\s*"([0-9.]+)s"/);
      const waitMs = m
        ? (Math.ceil(parseFloat(m[1])) + 1) * 1000
        : Math.min(3000 * 2 ** attempt, 30000);
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
}
