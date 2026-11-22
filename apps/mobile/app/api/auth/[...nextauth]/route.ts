import NextAuth from "next-auth";
import { getAuthOptions } from "../../../../lib/auth";

function handleAuth(req: Request, context: { params: { nextauth: string[] } }) {
  const handler = NextAuth(getAuthOptions());
  return handler(req, context);
}

export { handleAuth as GET, handleAuth as POST };
