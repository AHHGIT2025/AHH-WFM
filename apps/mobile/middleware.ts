import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    if (token && token.mustChangePassword === true && req.nextUrl.pathname !== "/change-password") {
      return NextResponse.redirect(new URL("/change-password", req.url));
    }
  },
  {
    cookies: {
      sessionToken: {
        name: "ahh-wfm.mobile.session-token",
      },
    },
    callbacks: {
      authorized: ({ token }) =>
        !!token &&
        !(token as any).isRevoked &&
        !(token as any).authVerifyError &&
        (token as any).isLocked !== true &&
        (token as any).isActive !== false &&
        (token as any).isLoginEnabled !== false &&
        (token as any).mobileAccessEnabled !== false &&
        (token as any).authPlatform !== "WEB" &&
        (!(token as any).aud || (token as any).aud === "ahh-wfm-mobile"),
    },
  }
);

export const config = {
  matcher: [
    "/((?!api|login|media|_next/static|_next/image|favicon.ico).*)",
  ],
};
