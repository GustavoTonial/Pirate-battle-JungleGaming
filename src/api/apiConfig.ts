/**
 * Network tunables. Defaults suit production; query params exist so E2E tests can run
 * timeout/retry scenarios quickly: `?apiTimeout=<ms>&retryBase=<ms>&retries=<n>`.
 */
const q = new URLSearchParams(window.location.search);
const num = (key: string, fallback: number) => {
  const v = Number(q.get(key));
  return q.has(key) && Number.isFinite(v) && v >= 0 ? v : fallback;
};

export const API_CONFIG = {
  baseURL: (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api',
  timeoutMs: num('apiTimeout', 6000),
  retryBaseMs: num('retryBase', 800),
  retries: num('retries', 2),
};
