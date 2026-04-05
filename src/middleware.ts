import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { rateLimit } from "@/lib/rate-limit";

const SESSION_COOKIE = "playchess_session";

function getSessionKey() {
  return new TextEncoder().encode(
    process.env.AUTH_SECRET ?? "playchess-development-secret-change-me",
  );
}

/** Route-specific rate limit config: [max requests, window in ms] */
const ROUTE_LIMITS: Record<string, [number, number]> = {
  "/api/duels/pong-sync":            [15, 1_000],   // 15 req/s (polling game)
  "/api/duels/submit":               [3,  1_000],   // 3 req/s
  "/api/duels/enter-arcade":         [3,  5_000],   // 3 req/5s
  "/api/duels/arcade-participation": [2,  5_000],   // 2 req/5s
  "/api/matches/move":               [5,  1_000],   // 5 req/s
  "/api/matches/state":              [10, 1_000],   // 10 req/s (polling)
  "/api/matches/chat":               [5,  1_000],   // 5 req/s
  "/api/matches/bot-move":           [2,  2_000],   // 2 req/2s
  "/api/lobby/updates":              [3,  10_000],  // 3 SSE connects/10s
};

/** Default rate limit for all /api/* routes not listed above */
const DEFAULT_API_LIMIT: [number, number] = [30, 1_000]; // 30 req/s

function matchRouteLimit(pathname: string): [number, number] {
  for (const [pattern, limit] of Object.entries(ROUTE_LIMITS)) {
    if (pathname.includes(pattern)) return limit;
  }
  return DEFAULT_API_LIMIT;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only rate-limit API routes
  if (!pathname.startsWith("/api/")) return NextResponse.next();

  // Extract identity: prefer userId from JWT, fallback to IP
  let identity = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")
    ?? "anonymous";

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, getSessionKey());
      if (payload.sub) identity = `user:${payload.sub}`;
    } catch {
      // Invalid token — use IP-based identity
    }
  }

  const [max, windowMs] = matchRouteLimit(pathname);
  const key = `${identity}:${pathname}`;
  const result = rateLimit(key, max, windowMs);

  if (!result.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(result.retryAfterMs / 1000)),
        },
      },
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
