const mockGetServerSession = jest.fn();
jest.mock("next-auth/next", () => ({
  getServerSession: (...args: any[]) => mockGetServerSession(...args),
}));

import {
  resolveNextAuthSecret as resolveWebSecret,
  authOptions as webAuthOptions,
  getAuthOptions as getWebAuthOptions,
  WEB_SESSION_AUDIENCE,
} from "../../apps/web/lib/auth";
import {
  resolveNextAuthSecret as resolveMobileSecret,
  authOptions as mobileAuthOptions,
  getAuthOptions as getMobileAuthOptions,
  MOBILE_SESSION_AUDIENCE,
} from "../../apps/mobile/lib/auth";
import { checkApiAuth as checkWebApiAuth } from "../../apps/web/lib/api-guards";
import { checkApiAuth as checkMobileApiAuth } from "../../apps/mobile/lib/api-guards";
import { mockDb } from "@ahh-wfm/mock-data";

describe("NEXTAUTH_SECRET Hardcoded Fallback Removal & Build-Safe Runtime Guard", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.restoreAllMocks();
    mockGetServerSession.mockReset();
    jest.spyOn(mockDb, "getUserRoleAssignments").mockResolvedValue([] as any);
    jest.spyOn(mockDb, "getEmployees").mockResolvedValue([
      {
        id: "emp-1",
        name: "Test User",
        email: "emp-1@ahh.com",
        role: "EMPLOYEE",
        companyId: "comp-1",
        departmentId: "dept-1",
        isActive: true,
        employmentStatus: "ACTIVE",
        isLoginEnabled: true,
        isLocked: false,
        webAccessEnabled: true,
        mobileAccessEnabled: true,
      },
    ] as any);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("1. Missing or blank NEXTAUTH_SECRET fails closed across all NODE_ENV values", () => {
    const expectedMessage =
      "CRITICAL SECURITY ERROR: NEXTAUTH_SECRET environment variable must be explicitly configured.";

    it.each(["production", "development", "test"] as const)(
      "throws when NEXTAUTH_SECRET is missing in NODE_ENV=%s",
      (nodeEnv) => {
        process.env = { ...originalEnv, NODE_ENV: nodeEnv };
        delete process.env.NEXTAUTH_SECRET;

        expect(() => resolveWebSecret()).toThrow(expectedMessage);
        expect(() => resolveMobileSecret()).toThrow(expectedMessage);
        expect(() => getWebAuthOptions()).toThrow(expectedMessage);
        expect(() => getMobileAuthOptions()).toThrow(expectedMessage);
        expect(() => webAuthOptions.secret).toThrow(expectedMessage);
        expect(() => mobileAuthOptions.secret).toThrow(expectedMessage);
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

        expect(() => resolveWebSecret()).toThrow(expectedMessage);
        expect(() => resolveMobileSecret()).toThrow(expectedMessage);
      }
    );

    it("never includes a configured dummy secret or legacy fallback in thrown errors or console logs", () => {
      const dummySecret = "dummy-secret-should-never-appear-in-logs";
      const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
      const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
      const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      process.env = {
        ...originalEnv,
        NODE_ENV: "production",
        NEXTAUTH_SECRET: dummySecret,
      };

      expect(resolveWebSecret()).toBe(dummySecret);
      expect(resolveMobileSecret()).toBe(dummySecret);
      expect(getWebAuthOptions().secret).toBe(dummySecret);
      expect(getMobileAuthOptions().secret).toBe(dummySecret);

      const allLoggedText = [
        ...logSpy.mock.calls,
        ...warnSpy.mock.calls,
        ...errorSpy.mock.calls,
      ]
        .flat()
        .map((v) => String(v))
        .join(" ");

      expect(allLoggedText).not.toContain(dummySecret);

      delete process.env.NEXTAUTH_SECRET;
      expect(() => resolveWebSecret()).toThrow(expectedMessage);
      expect(() => resolveMobileSecret()).toThrow(expectedMessage);

      const postThrowLoggedText = [
        ...logSpy.mock.calls,
        ...warnSpy.mock.calls,
        ...errorSpy.mock.calls,
      ]
        .flat()
        .map((v) => String(v))
        .join(" ");

      expect(postThrowLoggedText).not.toContain(dummySecret);
      expect(postThrowLoggedText).not.toContain("foundation-secret-key");
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

  describe("3. Module import safety without runtime secrets (distinct from full next build)", () => {
    it("allows importing auth modules and NextAuth route handlers when NEXTAUTH_SECRET is unset, and fails closed on request invocation", async () => {
      process.env = { ...originalEnv, NODE_ENV: "production" };
      delete process.env.NEXTAUTH_SECRET;

      jest.resetModules();

      const webAuth = await import("../../apps/web/lib/auth");
      const mobileAuth = await import("../../apps/mobile/lib/auth");
      const webRoute = await import("../../apps/web/app/api/auth/[...nextauth]/route");
      const mobileRoute = await import("../../apps/mobile/app/api/auth/[...nextauth]/route");

      expect(typeof webAuth.getAuthOptions).toBe("function");
      expect(typeof mobileAuth.getAuthOptions).toBe("function");
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
          mobileRoute.POST(new Request("http://localhost/api/auth/callback/credentials", { method: "POST" }), {
            params: { nextauth: ["callback", "credentials"] },
          })
        )
      ).rejects.toThrow(/NEXTAUTH_SECRET environment variable must be explicitly configured/);
    });
  });

  describe("4. Real Web and Mobile JWT callbacks & checkApiAuth session/audience isolation", () => {
    it("Web JWT callback revokes tokens carrying MOBILE authPlatform or audience", async () => {
      const jwtCallback = webAuthOptions.callbacks?.jwt;
      expect(typeof jwtCallback).toBe("function");

      const rejectedByPlatform = await jwtCallback!({
        token: {
          id: "emp-1",
          authPlatform: "MOBILE",
          aud: WEB_SESSION_AUDIENCE,
          permissions: ["employees.view"],
        } as any,
        account: null,
        trigger: "update",
      } as any);

      expect(rejectedByPlatform.isRevoked).toBe(true);
      expect(rejectedByPlatform.permissions).toEqual([]);

      const rejectedByAudience = await jwtCallback!({
        token: {
          id: "emp-1",
          authPlatform: "WEB",
          aud: MOBILE_SESSION_AUDIENCE,
          permissions: ["employees.view"],
        } as any,
        account: null,
        trigger: "update",
      } as any);

      expect(rejectedByAudience.isRevoked).toBe(true);
      expect(rejectedByAudience.permissions).toEqual([]);
    });

    it("Mobile JWT callback revokes tokens carrying WEB authPlatform or audience", async () => {
      const jwtCallback = mobileAuthOptions.callbacks?.jwt;
      expect(typeof jwtCallback).toBe("function");

      const rejectedByPlatform = await jwtCallback!({
        token: {
          id: "emp-1",
          authPlatform: "WEB",
          aud: MOBILE_SESSION_AUDIENCE,
          permissions: ["self.profile.view"],
        } as any,
        account: null,
        trigger: "update",
      } as any);

      expect(rejectedByPlatform.isRevoked).toBe(true);
      expect(rejectedByPlatform.permissions).toEqual([]);

      const rejectedByAudience = await jwtCallback!({
        token: {
          id: "emp-1",
          authPlatform: "MOBILE",
          aud: WEB_SESSION_AUDIENCE,
          permissions: ["self.profile.view"],
        } as any,
        account: null,
        trigger: "update",
      } as any);

      expect(rejectedByAudience.isRevoked).toBe(true);
      expect(rejectedByAudience.permissions).toEqual([]);
    });

    it("Web checkApiAuth rejects Mobile-audience or Mobile-platform sessions with 403", async () => {
      mockGetServerSession.mockResolvedValueOnce({
        user: {
          id: "emp-1",
          role: "EMPLOYEE",
          authPlatform: "MOBILE",
          aud: MOBILE_SESSION_AUDIENCE,
          webAccessEnabled: true,
        },
      });

      const res = await checkWebApiAuth();
      expect(res.session).toBeNull();
      expect(res.error?.status).toBe(403);
    });

    it("Mobile checkApiAuth rejects Web-audience or Web-platform sessions with 403", async () => {
      mockGetServerSession.mockResolvedValueOnce({
        user: {
          id: "emp-1",
          role: "EMPLOYEE",
          authPlatform: "WEB",
          aud: WEB_SESSION_AUDIENCE,
          mobileAccessEnabled: true,
        },
      });

      const res = await checkMobileApiAuth();
      expect(res.session).toBeNull();
      expect(res.error?.status).toBe(403);
    });
  });
});
