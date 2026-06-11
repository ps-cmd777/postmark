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

// x-forwarded-for on Render is "<client>, <Cloudflare>, <Render LB>".
// Cloudflare and Render's edge both overwrite any client-supplied XFF
// before appending hops, so the FIRST value is the real client IP and
// trustworthy in this deployment. We previously took the last value
// (the standard "trust only your proxy" rule), but on Render the last
// hop is an internal load-balancer IP that rotates between requests,
// so every request landed in a different bucket and the limiter was
// effectively disabled. If the deployment target ever changes such
// that the edge no longer overwrites XFF, revisit this.
function extractIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const parts = fwd.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length > 0) {
      return parts[0].replace(/^::ffff:/, "");
    }
  }
  const real = req.headers.get("x-real-ip");
  if (real) return real.replace(/^::ffff:/, "");
  return "unknown";
}

export function checkRateLimit(req: Request, limit: RateLimit): RateLimitCheck {
  if (DISABLED) return { ok: true };

  const ip = extractIp(req);
  if (LOCAL_IPS.has(ip)) return { ok: true };

  const bucketKey = `${limit.key}:${ip}`;
  const now = Date.now();
  const cutoff = now - limit.windowMs;

  const existing = buckets.get(bucketKey) ?? [];
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
    return { ok: false, retryAfterSec };
  }

  fresh.push(now);
  buckets.set(bucketKey, fresh);
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
