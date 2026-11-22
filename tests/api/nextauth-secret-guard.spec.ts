import {
  resolveNextAuthSecret as resolveWebSecret,
  authOptions as webAuthOptions,
  getAuthOptions as getWebAuthOptions,
  WEB_SESSION_AUDIENCE,
  WEB_SESSION_COOKIE_NAME,
} from "../../apps/web/lib/auth";
import {
  resolveNextAuthSecret as resolveMobileSecret,
  authOptions as mobileAuthOptions,
  getAuthOptions as getMobileAuthOptions,
  MOBILE_SESSION_AUDIENCE,
  MOBILE_SESSION_COOKIE_NAME,
} from "../../apps/mobile/lib/auth";

describe("NEXTAUTH_SECRET Hardcoded Fallback Removal & Build-Safe Runtime Guard", () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("1. Missing or blank NEXTAUTH_SECRET fails closed across all NODE_ENV values", () => {
    it.each(["production", "development", "test"] as const)(
      "throws when NEXTAUTH_SECRET is missing in NODE_ENV=%s",
      (nodeEnv) => {
        process.env = { ...originalEnv, NODE_ENV: nodeEnv };
        delete process.env.NEXTAUTH_SECRET;

        expect(() => resolveWebSecret()).toThrow(
          /NEXTAUTH_SECRET environment variable must be explicitly configured/
        );
        expect(() => resolveMobileSecret()).toThrow(
          /NEXTAUTH_SECRET environment variable must be explicitly configured/
        );
        expect(() => getWebAuthOptions()).toThrow(
          /NEXTAUTH_SECRET environment variable must be explicitly configured/
        );
        expect(() => getMobileAuthOptions()).toThrow(
          /NEXTAUTH_SECRET environment variable must be explicitly configured/
        );
        expect(() => webAuthOptions.secret).toThrow(
          /NEXTAUTH_SECRET environment variable must be explicitly configured/
        );
        expect(() => mobileAuthOptions.secret).toThrow(
          /NEXTAUTH_SECRET environment variable must be explicitly configured/
        );
      }
    );

    it.each(["", "   ", "\t\n"])(
      "throws when NEXTAUTH_SECRET is blank (%j)",
      (blankValue) => {
        process.env = {
          ...originalEnv,
          NODE_ENV: "production",
          NEXTAUTH_SECRET: blankValue,
        };

        expect(() => resolveWebSecret()).toThrow(
          /NEXTAUTH_SECRET environment variable must be explicitly configured/
        );
        expect(() => resolveMobileSecret()).toThrow(
          /NEXTAUTH_SECRET environment variable must be explicitly configured/
        );
      }
    );

    it("never includes a secret value in thrown error messages", () => {
      process.env = { ...originalEnv, NODE_ENV: "production" };
      delete process.env.NEXTAUTH_SECRET;

      try {
        resolveWebSecret();
        fail("Expected resolveWebSecret to throw");
      } catch (err: any) {
        expect(err.message).not.toContain("foundation-secret-key");
      }

      try {
        resolveMobileSecret();
        fail("Expected resolveMobileSecret to throw");
      } catch (err: any) {
        expect(err.message).not.toContain("foundation-secret-key");
      }
    });
  });

  describe("2. Configured NEXTAUTH_SECRET is trimmed and accepted", () => {
    it("returns trimmed secret for both Web and Mobile", () => {
      process.env = {
        ...originalEnv,
        NODE_ENV: "production",
        NEXTAUTH_SECRET: "  configured-runtime-secret-abc-123456  ",
      };

      expect(resolveWebSecret()).toBe("configured-runtime-secret-abc-123456");
      expect(resolveMobileSecret()).toBe("configured-runtime-secret-abc-123456");
      expect(webAuthOptions.secret).toBe("configured-runtime-secret-abc-123456");
      expect(mobileAuthOptions.secret).toBe("configured-runtime-secret-abc-123456");
      expect(getWebAuthOptions().secret).toBe("configured-runtime-secret-abc-123456");
      expect(getMobileAuthOptions().secret).toBe("configured-runtime-secret-abc-123456");
    });
  });

  describe("3. Build-time module import succeeds without runtime secrets", () => {
    it("allows importing auth modules and NextAuth route handlers when NEXTAUTH_SECRET is unset", async () => {
      process.env = { ...originalEnv, NODE_ENV: "production" };
      delete process.env.NEXTAUTH_SECRET;

      jest.resetModules();

      const webRoute = await import("../../apps/web/app/api/auth/[...nextauth]/route");
      const mobileRoute = await import("../../apps/mobile/app/api/auth/[...nextauth]/route");

      expect(typeof webRoute.GET).toBe("function");
      expect(typeof webRoute.POST).toBe("function");
      expect(typeof mobileRoute.GET).toBe("function");
      expect(typeof mobileRoute.POST).toBe("function");

      await expect(
        Promise.resolve().then(() =>
          webRoute.GET(new Request("http://localhost/api/auth/session"), {
            params: { nextauth: ["session"] },
          })
        )
      ).rejects.toThrow(/NEXTAUTH_SECRET environment variable must be explicitly configured/);

      await expect(
        Promise.resolve().then(() =>
          mobileRoute.GET(new Request("http://localhost/api/auth/session"), {
            params: { nextauth: ["session"] },
          })
        )
      ).rejects.toThrow(/NEXTAUTH_SECRET environment variable must be explicitly configured/);
    });
  });

  describe("4. Web and Mobile audience & cookie isolation preserved", () => {
    it("preserves distinct cookie names and session audiences", () => {
      process.env = {
        ...originalEnv,
        NODE_ENV: "production",
        NEXTAUTH_SECRET: "configured-runtime-secret-abc-123456",
      };

      const webOpts = getWebAuthOptions();
      const mobileOpts = getMobileAuthOptions();

      expect(WEB_SESSION_AUDIENCE).toBe("ahh-wfm-web");
      expect(MOBILE_SESSION_AUDIENCE).toBe("ahh-wfm-mobile");
      expect(WEB_SESSION_COOKIE_NAME).toBe("ahh-wfm.web.session-token");
      expect(MOBILE_SESSION_COOKIE_NAME).toBe("ahh-wfm.mobile.session-token");
      expect(webOpts.cookies?.sessionToken?.name).toBe(WEB_SESSION_COOKIE_NAME);
      expect(mobileOpts.cookies?.sessionToken?.name).toBe(MOBILE_SESSION_COOKIE_NAME);
    });
  });
});
