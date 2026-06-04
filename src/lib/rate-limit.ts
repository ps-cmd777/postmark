// In-memory sliding-window rate limiter for the AI-calling routes.
// One Map<key+ip, number[]> of recent request timestamps, pruned in
// place on every check and via a periodic sweep.
//
// Why in-memory and not Redis / Upstash: Postmark deploys to Render's
// free tier as a single instance. Per-process memory is the right
// granularity; an external service would add a hop, a secret, and
// money for no functional gain at this scale. If we ever scale to
// multiple instances, swap this module for an upstash-redis impl
// behind the same checkRateLimit signature.
//
// Localhost is always exempt so the MCP server and local development
// don't rate-limit themselves. DISABLE_RATE_LIMIT=true short-circuits
// the whole thing — useful for tests and load-checks.

const DISABLE = process.env.DISABLE_RATE_LIMIT;
const DISABLED = DISABLE === "true" || DISABLE === "1";

// "unknown" is intentionally NOT exempted: a request without an
// identifiable IP shares one bucket with all other anonymous callers
// (fail-closed). Worst case: 5/hr preflight calls split across every
// header-less client — preferable to the fail-open alternative where
// any client that strips XFF gets unlimited Opus.
const LOCAL_IPS = new Set(["127.0.0.1", "::1", "localhost"]);

const buckets = new Map<string, number[]>();

// Module-load marker. If we see this line printed more than once
// while diagnosing, the module is being re-evaluated per-request and
// the in-memory bucket Map can't persist state — that's a different
// problem class than IP extraction.
console.error(
  `[ratelimit] module loaded pid=${process.pid} disabled=${DISABLED} at=${new Date().toISOString()}`,
);

// Periodic sweep: drop empty arrays so silent keys don't linger. Lazy
// pruning inside checkRateLimit handles the common path; this just
// reclaims unused keys. unref() so it never keeps the process alive.
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
if (typeof setInterval === "function") {
  const handle = setInterval(() => {
    const now = Date.now();
    for (const [key, stamps] of buckets) {
      // Keep only entries with at least one timestamp inside any
      // reasonable window (1 hour is the largest we use).
      const cutoff = now - 60 * 60 * 1000;
      const fresh = stamps.filter((t) => t > cutoff);
      if (fresh.length === 0) buckets.delete(key);
      else if (fresh.length !== stamps.length) buckets.set(key, fresh);
    }
  }, CLEANUP_INTERVAL_MS);
  (handle as { unref?: () => void }).unref?.();
}

export interface RateLimit {
  key: string; // route identifier, e.g. "preflight"
  limit: number; // max requests per window
  windowMs: number; // window length
}

export type RateLimitCheck =
  | { ok: true }
  | { ok: false; retryAfterSec: number };

// Trust only what the proxy appended. x-forwarded-for is a comma list:
// "<client>, <hop1>, <hop2>, <our-proxy>". The first entries are client-
// supplied (anyone can send arbitrary XFF headers); the last entry is
// what Render's edge proxy wrote, which is the actual TCP source IP.
// Taking the first value is the classic rate-limit-bypass mistake —
// always take the last value, the one written by your trusted hop.
function extractIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const parts = fwd.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length > 0) {
      const last = parts[parts.length - 1];
      return last.replace(/^::ffff:/, "");
    }
  }
  const real = req.headers.get("x-real-ip");
  if (real) return real.replace(/^::ffff:/, "");
  return "unknown";
}

export function checkRateLimit(req: Request, limit: RateLimit): RateLimitCheck {
  if (DISABLED) {
    console.error(
      `[ratelimit] ${limit.key} DISABLED via env (DISABLE_RATE_LIMIT=${process.env.DISABLE_RATE_LIMIT})`,
    );
    return { ok: true };
  }

  const ip = extractIp(req);
  const xff = req.headers.get("x-forwarded-for");
  const xri = req.headers.get("x-real-ip");

  if (LOCAL_IPS.has(ip)) {
    console.error(
      `[ratelimit] ${limit.key} EXEMPT ip=${ip} xff=${JSON.stringify(xff)} xri=${JSON.stringify(xri)}`,
    );
    return { ok: true };
  }

  const bucketKey = `${limit.key}:${ip}`;
  const now = Date.now();
  const cutoff = now - limit.windowMs;

  const existing = buckets.get(bucketKey) ?? [];
  const before = existing.length;
  // diagnostic — logs one line per request so we can see how IPs map
  // to buckets in production. Remove after we confirm the limiter
  // is behaving on Render.
  console.error(
    `[ratelimit] ${limit.key} ip=${ip} xff=${JSON.stringify(xff)} xri=${JSON.stringify(xri)} bucketBefore=${before} buckets=${buckets.size}`,
  );
  // Find the first index >= cutoff. Timestamps are pushed in order
  // so a linear scan from the head is fine for our small windows.
  let firstFresh = 0;
  while (firstFresh < existing.length && existing[firstFresh] <= cutoff) {
    firstFresh++;
  }
  const fresh = firstFresh === 0 ? existing : existing.slice(firstFresh);

  if (fresh.length >= limit.limit) {
    const oldest = fresh[0];
    const retryAfterSec = Math.max(
      1,
      Math.ceil((oldest + limit.windowMs - now) / 1000),
    );
    if (fresh.length !== existing.length) buckets.set(bucketKey, fresh);
    console.error(
      `[ratelimit] ${limit.key} DENY ip=${ip} fresh=${fresh.length}/${limit.limit} retryAfterSec=${retryAfterSec}`,
    );
    return { ok: false, retryAfterSec };
  }

  fresh.push(now);
  buckets.set(bucketKey, fresh);
  console.error(
    `[ratelimit] ${limit.key} ALLOW ip=${ip} fresh=${fresh.length}/${limit.limit}`,
  );
  return { ok: true };
}

export function rateLimitResponse(retryAfterSec: number): Response {
  return new Response(
    JSON.stringify({
      error: `Rate limit exceeded. Try again in ${retryAfterSec}s.`,
    }),
    {
      status: 429,
      headers: {
        "content-type": "application/json",
        "retry-after": String(retryAfterSec),
      },
    },
  );
}

export const HOUR_MS = 60 * 60 * 1000;

export const PREFLIGHT_LIMIT: RateLimit = {
  key: "preflight",
  limit: 5,
  windowMs: HOUR_MS,
};

export const SEARCH_LIMIT: RateLimit = {
  key: "search",
  limit: 20,
  windowMs: HOUR_MS,
};

export const HEALTH_LIMIT: RateLimit = {
  key: "health",
  limit: 60,
  windowMs: HOUR_MS,
};
