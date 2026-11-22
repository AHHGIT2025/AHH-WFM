// Do NOT mock next-auth/next here: exercises real getServerSession + real checkApiAuth.
jest.mock("next/headers", () => ({
  cookies: () => ({
    getAll: () => [],
    get: () => undefined,
  }),
  headers: () => new Headers(),
}));

import { getServerSession } from "next-auth/next";
import { authOptions as webAuthOptions } from "../../apps/web/lib/auth";
import { authOptions as mobileAuthOptions } from "../../apps/mobile/lib/auth";
import { checkApiAuth as checkWebApiAuth } from "../../apps/web/lib/api-guards";
import { checkApiAuth as checkMobileApiAuth } from "../../apps/mobile/lib/api-guards";

describe("Real getServerSession + checkApiAuth Secret Enforcement (Unmocked next-auth/next)", () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
  });

  it("rejects Web and Mobile checkApiAuth when NEXTAUTH_SECRET is missing", async () => {
    process.env = { ...originalEnv, NODE_ENV: "production" };
    delete process.env.NEXTAUTH_SECRET;

    await expect(checkWebApiAuth()).rejects.toThrow(
      /NEXTAUTH_SECRET environment variable must be explicitly configured/
    );
    await expect(checkMobileApiAuth()).rejects.toThrow(
      /NEXTAUTH_SECRET environment variable must be explicitly configured/
    );
  });

  it("rejects Web and Mobile checkApiAuth when NEXTAUTH_SECRET is blank", async () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: "production",
      NEXTAUTH_SECRET: "   ",
    };

    await expect(checkWebApiAuth()).rejects.toThrow(
      /NEXTAUTH_SECRET environment variable must be explicitly configured/
    );
    await expect(checkMobileApiAuth()).rejects.toThrow(
      /NEXTAUTH_SECRET environment variable must be explicitly configured/
    );
  });

  it("returns unauthenticated (401) when NEXTAUTH_SECRET is configured and no session cookie is present", async () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: "production",
      NEXTAUTH_SECRET: "configured-real-session-test-secret-123456",
    };

    const webSession = await getServerSession(webAuthOptions);
    const mobileSession = await getServerSession(mobileAuthOptions);
    expect(webSession).toBeNull();
    expect(mobileSession).toBeNull();

    const webRes = await checkWebApiAuth();
    expect(webRes.session).toBeNull();
    expect(webRes.error?.status).toBe(401);

    const mobileRes = await checkMobileApiAuth();
    expect(mobileRes.session).toBeNull();
    expect(mobileRes.error?.status).toBe(401);
  });
});
