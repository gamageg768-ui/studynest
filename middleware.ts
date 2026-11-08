import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

const AUTH_PATHS = ["/api/auth/login", "/api/auth/register", "/api/auth/guest"];
const AI_PATH_PREFIX = "/api/ai/";

const AUTH_LIMIT = 10;
const AUTH_WINDOW_SECONDS = 15 * 60;
const AI_LIMIT = 20;
const AI_WINDOW_SECONDS = 60 * 60;

function getIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function getBearer(req: NextRequest): string {
  return (req.headers.get("authorization") || "").replace("Bearer ", "").trim();
}

async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<{ allowed: boolean; retryAfter: number }> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowSeconds * 1000);

  try {
    await sql`
      INSERT INTO rate_limits (key, count, window_start)
      VALUES (${key}, 1, ${now.toISOString()})
      ON CONFLICT (key) DO UPDATE SET
        count = CASE
          WHEN rate_limits.window_start < ${windowStart.toISOString()} THEN 1
          ELSE rate_limits.count + 1
        END,
        window_start = CASE
          WHEN rate_limits.window_start < ${windowStart.toISOString()} THEN ${now.toISOString()}
          ELSE rate_limits.window_start
        END
    `;

    const [row] = await sql`SELECT count, window_start FROM rate_limits WHERE key = ${key}`;
    if (!row || row.count <= limit) return { allowed: true, retryAfter: 0 };

    const windowExpiry = new Date(new Date(row.window_start).getTime() + windowSeconds * 1000);
    const retryAfter = Math.ceil((windowExpiry.getTime() - now.getTime()) / 1000);
    return { allowed: false, retryAfter: Math.max(retryAfter, 1) };
  } catch {
    // If rate limit table doesn't exist yet, allow the request
    return { allowed: true, retryAfter: 0 };
  }
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  if (req.method === "POST" && AUTH_PATHS.includes(path)) {
    const ip = getIp(req);
    const { allowed, retryAfter } = await checkRateLimit(
      `auth:${ip}:${path}`,
      AUTH_LIMIT,
      AUTH_WINDOW_SECONDS
    );
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }
  }

  if (req.method === "POST" && path.startsWith(AI_PATH_PREFIX)) {
    const token = getBearer(req);
    const key = token ? `ai:token:${token}` : `ai:ip:${getIp(req)}`;
    const { allowed, retryAfter } = await checkRateLimit(key, AI_LIMIT, AI_WINDOW_SECONDS);
    if (!allowed) {
      return NextResponse.json(
        { error: "AI request limit reached. Please try again later." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/auth/login", "/api/auth/register", "/api/auth/guest", "/api/ai/:path*"],
};
