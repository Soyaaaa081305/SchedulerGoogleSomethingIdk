type Entry = { count: number; reset: number };

const store = new Map<string, Entry>();

function keyFor(req: Request, scope: string): string {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? "unknown";
  return `${scope}:${ip}`;
}

// Overload: (key: string, opts?: {maxRequests, windowMs}) => boolean  (legacy, used by upload)
// Overload: (req: Request, scope: string, max: number, windowMs: number) => {ok, remaining, reset}
export function rateLimit(
  keyOrReq: string | Request,
  optsOrScope?: { maxRequests?: number; windowMs?: number } | string,
  max?: number,
  windowMs?: number
): boolean | { ok: boolean; remaining: number; reset: number } {
  const now = Date.now();

  // Legacy: rateLimit("upload:123", {maxRequests:5, windowMs:60000}) -> boolean
  if (typeof keyOrReq === "string" && (typeof optsOrScope === "object" || optsOrScope === undefined)) {
    const key = keyOrReq;
    const opts = (optsOrScope as { maxRequests?: number; windowMs?: number }) ?? {};
    const maxRequests = opts.maxRequests ?? 5;
    const window = opts.windowMs ?? 60_000;
    const e = store.get(key);
    if (!e || now > e.reset) {
      store.set(key, { count: 1, reset: now + window });
      return true;
    }
    if (e.count >= maxRequests) return false;
    e.count++;
    return true;
  }

  // New: rateLimit(req, "scope", 10, 60000) -> {ok, ...}
  const req = keyOrReq as Request;
  const scope = optsOrScope as string;
  const m = max as number;
  const w = windowMs as number;
  const k = keyFor(req, scope);
  const e = store.get(k);
  if (!e || now > e.reset) {
    const reset = now + w;
    store.set(k, { count: 1, reset });
    return { ok: true, remaining: m - 1, reset };
  }
  if (e.count >= m) return { ok: false, remaining: 0, reset: e.reset };
  e.count++;
  return { ok: true, remaining: m - e.count, reset: e.reset };
}

export function rateLimitOrThrow(req: Request, scope: string, max: number, windowMs: number) {
  const r = rateLimit(req, scope, max, windowMs) as { ok: boolean; remaining: number; reset: number };
  if (!r.ok) {
    const err = new Error(`Too many requests. Try again in ${Math.ceil((r.reset - Date.now()) / 1000)}s.`) as Error & { status?: number };
    err.status = 429;
    throw err;
  }
  return r;
}

// periodic cleanup to avoid memory leak
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of store) if (now > v.reset) store.delete(k);
  }, 60_000).unref?.();
}
