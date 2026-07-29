import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

// Bounded local fallback limiter (Token Bucket)
const rateLimitMap = new Map<string, { count: number, resetTime: number }>();
const MAX_REQUESTS = 60; // per window
const WINDOW_MS = 60000; // 1 minute

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    
    if (token && token.mustChangePassword === true && req.nextUrl.pathname !== "/change-password") {
      return NextResponse.redirect(new URL("/change-password", req.url));
    }

    // CSRF Protection: Strict Same-Origin Validation for State-Changing Requests
    const isStateChanging = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);
    if (isStateChanging && req.nextUrl.pathname.startsWith("/api/")) {
      const origin = req.headers.get("origin");
      const host = req.headers.get("host");
      // Require origin to match host exactly (strict same-origin)
      // Note: Mobile APIs using bearer tokens might not send origin, but web sessions do.
      if (!origin || new URL(origin).host !== host) {
          const correlationId = Date.now().toString(36) + Math.random().toString(36).substring(2);
          const res = new NextResponse(JSON.stringify({ error: "Forbidden: CSRF / Origin Validation Failed", correlationId }), { status: 403 });
          res.headers.set("Content-Type", "application/json");
          return res;
      }
    }

    // Rate Limiting Logic for Sensitive MP-4 / Reliever routes
    if (req.nextUrl.pathname.startsWith("/api/v1/scheduler/relievers") || 
        req.nextUrl.pathname.startsWith("/api/v1/manpower/payroll-advisory") ||
        req.nextUrl.pathname.startsWith("/api/v1/manpower/billing-support")) {
        
        // Ignore X-Forwarded-For for security decisions since proxy trust cannot be proven from repo
        const ip = req.ip || "127.0.0.1";
        const userId = token?.id as string || ip;
        const identityKey = `${userId}:${req.nextUrl.pathname}`;
        
        const now = Date.now();
        const record = rateLimitMap.get(identityKey) || { count: 0, resetTime: now + WINDOW_MS };
        
        if (now > record.resetTime) {
            record.count = 0;
            record.resetTime = now + WINDOW_MS;
        }
        
        record.count++;
        rateLimitMap.set(identityKey, record);
        
        if (record.count > MAX_REQUESTS) {
            const retryAfter = Math.ceil((record.resetTime - now) / 1000);
            const correlationId = Date.now().toString(36) + Math.random().toString(36).substring(2);
            const res = new NextResponse(JSON.stringify({ error: "Too Many Requests", correlationId }), { status: 429 });
            res.headers.set("Retry-After", retryAfter.toString());
            res.headers.set("Content-Type", "application/json");
            return res;
        }
    }
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: [
    "/((?!api|login|_next/static|_next/image|favicon.ico).*)",
    "/api/v1/scheduler/relievers/:path*",
    "/api/v1/manpower/payroll-advisory/:path*",
    "/api/v1/manpower/billing-support/:path*"
  ],
};
