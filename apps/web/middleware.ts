import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    
    // Block standard employees from accessing Web Admin dashboards
    if (token && token.role !== "ADMIN" && token.role !== "SUPERVISOR") {
      return NextResponse.redirect(new URL("/login?error=UnauthorizedAccess", req.url));
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
  ],
};
