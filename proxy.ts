import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const MUTATION_METHODS = new Set(["POST", "PATCH", "DELETE"]);
const API_PREFIX = "/api/";

// Routes that are exempt from CSRF checks (auth callbacks, health, cron)
const EXEMPT_PATHS = ["/api/auth/", "/api/health", "/api/cron"];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only apply to /api/ routes with mutation methods
  if (!pathname.startsWith(API_PREFIX)) return NextResponse.next();
  if (!MUTATION_METHODS.has(req.method)) return NextResponse.next();
  if (EXEMPT_PATHS.some((p) => pathname.startsWith(p))) return NextResponse.next();

  // Check Origin header against Host
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");

  if (origin) {
    try {
      const originHost = new URL(origin).host;
      if (originHost !== host) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
