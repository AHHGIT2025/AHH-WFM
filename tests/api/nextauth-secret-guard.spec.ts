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
    jest.spyOn(mockDb, "getSystemRoles").mockResolvedValue([] as any);
    jest.spyOn(mockDb, "getRolePermissions").mockResolvedValue([] as any);
    jest.spyOn(mockDb, "getSystemPermissions").mockResolvedValue([] as any);
    jest.spyOn(mockDb, "getUserOperationAccess").mockResolvedValue(null as any);
    jest.spyOn(mockDb, "updateEmployee").mockResolvedValue(null as any);
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
        passwordHash: "$2a$10$invalidhashforfailurepath00000000000000000000000000000",
        failedLoginAttempts: 0,
      },
    ] as any);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("1. Missing, blank, or whitespace-padded NEXTAUTH_SECRET fails closed", () => {
    const missingMessage =
      "CRITICAL SECURITY ERROR: NEXTAUTH_SECRET environment variable must be explicitly configured.";
    const paddedMessage =
      "CRITICAL SECURITY ERROR: NEXTAUTH_SECRET must not contain leading or trailing whitespace.";

    it.each(["production", "development", "test"] as const)(
      "throws when NEXTAUTH_SECRET is missing in NODE_ENV=%s",
      (nodeEnv) => {
        process.env = { ...originalEnv, NODE_ENV: nodeEnv };
        delete process.env.NEXTAUTH_SECRET;

        expect(() => resolveWebSecret()).toThrow(missingMessage);
        expect(() => resolveMobileSecret()).toThrow(missingMessage);
        expect(() => getWebAuthOptions()).toThrow(missingMessage);
        expect(() => getMobileAuthOptions()).toThrow(missingMessage);
        expect(() => webAuthOptions.secret).toThrow(missingMessage);
        expect(() => mobileAuthOptions.secret).toThrow(missingMessage);
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

        expect(() => resolveWebSecret()).toThrow(missingMessage);
        expect(() => resolveMobileSecret()).toThrow(missingMessage);
      }
    );

    it.each([" leading-space-secret", "trailing-space-secret ", "  both-padded-secret  "])(
      "rejects whitespace-padded NEXTAUTH_SECRET (%j) so handlers and middleware never diverge",
      (paddedValue) => {
        process.env = {
          ...originalEnv,
          NODE_ENV: "production",
          NEXTAUTH_SECRET: paddedValue,
        };

        expect(() => resolveWebSecret()).toThrow(paddedMessage);
        expect(() => resolveMobileSecret()).toThrow(paddedMessage);
        expect(() => getWebAuthOptions()).toThrow(paddedMessage);
        expect(() => getMobileAuthOptions()).toThrow(paddedMessage);
        expect(() => webAuthOptions.secret).toThrow(paddedMessage);
        expect(() => mobileAuthOptions.secret).toThrow(paddedMessage);
      }
    );
  });

  describe("2. Secret leakage prevention across real failure paths", () => {
    it("never leaks a configured dummy secret during rejected getEmployees in JWT callback or failed authorize", async () => {
      const dummySecret = "dummy-secret-should-never-appear-in-logs";
      const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
      const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
      const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      process.env = {
        ...originalEnv,
        NODE_ENV: "production",
        NEXTAUTH_SECRET: dummySecret,
      };

      // Failure path 1: rejected getEmployees() inside Web & Mobile JWT callbacks
      jest.spyOn(mockDb, "getEmployees").mockRejectedValueOnce(new Error("Simulated DB outage (Web JWT)"));
      const webErrToken = await webAuthOptions.callbacks!.jwt!({
        token: { id: "emp-1", authPlatform: "WEB", aud: WEB_SESSION_AUDIENCE } as any,
        account: null,
        trigger: "update",
      } as any);
      expect(webErrToken.authVerifyError).toBe(true);

      jest.spyOn(mockDb, "getEmployees").mockRejectedValueOnce(new Error("Simulated DB outage (Mobile JWT)"));
      const mobileErrToken = await mobileAuthOptions.callbacks!.jwt!({
        token: { id: "emp-1", authPlatform: "MOBILE", aud: MOBILE_SESSION_AUDIENCE } as any,
        account: null,
        trigger: "update",
      } as any);
      expect(mobileErrToken.authVerifyError).toBe(true);

      // Failure path 2: failed CredentialsProvider authorize()
      const webCredsProvider = webAuthOptions.providers.find((p: any) => p.id === "credentials") as any;
      const mobileCredsProvider = mobileAuthOptions.providers.find((p: any) => p.id === "credentials") as any;

      await expect(
        webCredsProvider.authorize({ email: "emp-1@ahh.com", password: "wrong-password" }, {} as any)
      ).rejects.toThrow(/Invalid credentials/);

      await expect(
        mobileCredsProvider.authorize({ email: "emp-1@ahh.com", password: "wrong-password" }, {} as any)
      ).rejects.toThrow(/Invalid credentials/);

      expect(errorSpy).toHaveBeenCalled();

      const allLoggedText = [
        ...logSpy.mock.calls,
        ...warnSpy.mock.calls,
        ...errorSpy.mock.calls,
      ]
        .flat()
        .map((v) => String(v))
        .join(" ");

      expect(allLoggedText).not.toContain(dummySecret);
      expect(allLoggedText).not.toContain("foundation-secret-key");
    });
  });

  describe("3. Exact configured NEXTAUTH_SECRET is accepted", () => {
    it("returns exact secret for both Web and Mobile when unpadded", () => {
      process.env = {
        ...originalEnv,
        NODE_ENV: "production",
        NEXTAUTH_SECRET: "configured-runtime-secret-abc-123456",
      };

      expect(resolveWebSecret()).toBe("configured-runtime-secret-abc-123456");
      expect(resolveMobileSecret()).toBe("configured-runtime-secret-abc-123456");
      expect(webAuthOptions.secret).toBe("configured-runtime-secret-abc-123456");
      expect(mobileAuthOptions.secret).toBe("configured-runtime-secret-abc-123456");
      expect(getWebAuthOptions().secret).toBe("configured-runtime-secret-abc-123456");
      expect(getMobileAuthOptions().secret).toBe("configured-runtime-secret-abc-123456");
    });
  });

  describe("4. Module import safety without runtime secrets (not a substitute for next build)", () => {
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
          mobileRoute.POST(
            new Request("http://localhost/api/auth/callback/credentials", { method: "POST" }),
            { params: { nextauth: ["callback", "credentials"] } }
          )
        )
      ).rejects.toThrow(/NEXTAUTH_SECRET environment variable must be explicitly configured/);
    });
  });

  describe("5. Positive & Negative Web/Mobile JWT callbacks and checkApiAuth isolation", () => {
    it("Web JWT callback keeps valid WEB token authorized and revokes MOBILE platform or aud", async () => {
      const jwtCallback = webAuthOptions.callbacks!.jwt!;

      const validWeb = await jwtCallback({
        token: {
          id: "emp-1",
          authPlatform: "WEB",
          aud: WEB_SESSION_AUDIENCE,
        } as any,
        account: null,
        trigger: "update",
      } as any);
      expect(validWeb.isRevoked).toBe(false);
      expect(validWeb.authVerifyError).toBe(false);
      expect(validWeb.aud).toBe(WEB_SESSION_AUDIENCE);
      expect(validWeb.authPlatform).toBe("WEB");
      expect(Array.isArray(validWeb.permissions)).toBe(true);
      expect((validWeb.permissions as string[]).length).toBeGreaterThan(0);

      const wrongPlatform = await jwtCallback({
        token: {
          id: "emp-1",
          authPlatform: "MOBILE",
          aud: WEB_SESSION_AUDIENCE,
          permissions: ["employees.view"],
        } as any,
        account: null,
        trigger: "update",
      } as any);
      expect(wrongPlatform.isRevoked).toBe(true);
      expect(wrongPlatform.permissions).toEqual([]);

      const wrongAudience = await jwtCallback({
        token: {
          id: "emp-1",
          authPlatform: "WEB",
          aud: MOBILE_SESSION_AUDIENCE,
          permissions: ["employees.view"],
        } as any,
        account: null,
        trigger: "update",
      } as any);
      expect(wrongAudience.isRevoked).toBe(true);
      expect(wrongAudience.permissions).toEqual([]);
    });

    it("Mobile JWT callback keeps valid MOBILE token authorized and revokes WEB platform or aud", async () => {
      const jwtCallback = mobileAuthOptions.callbacks!.jwt!;

      const validMobile = await jwtCallback({
        token: {
          id: "emp-1",
          authPlatform: "MOBILE",
          aud: MOBILE_SESSION_AUDIENCE,
        } as any,
        account: null,
        trigger: "update",
      } as any);
      expect(validMobile.isRevoked).toBe(false);
      expect(validMobile.authVerifyError).toBe(false);
      expect(validMobile.aud).toBe(MOBILE_SESSION_AUDIENCE);
      expect(validMobile.authPlatform).toBe("MOBILE");
      expect(Array.isArray(validMobile.permissions)).toBe(true);
      expect((validMobile.permissions as string[]).length).toBeGreaterThan(0);

      const wrongPlatform = await jwtCallback({
        token: {
          id: "emp-1",
          authPlatform: "WEB",
          aud: MOBILE_SESSION_AUDIENCE,
          permissions: ["self.profile.view"],
        } as any,
        account: null,
        trigger: "update",
      } as any);
      expect(wrongPlatform.isRevoked).toBe(true);
      expect(wrongPlatform.permissions).toEqual([]);

      const wrongAudience = await jwtCallback({
        token: {
          id: "emp-1",
          authPlatform: "MOBILE",
          aud: WEB_SESSION_AUDIENCE,
          permissions: ["self.profile.view"],
        } as any,
        account: null,
        trigger: "update",
      } as any);
      expect(wrongAudience.isRevoked).toBe(true);
      expect(wrongAudience.permissions).toEqual([]);
    });

    it("Web checkApiAuth allows valid WEB session and rejects MOBILE platform or aud with 403", async () => {
      mockGetServerSession.mockResolvedValueOnce({
        user: {
          id: "emp-1",
          role: "EMPLOYEE",
          authPlatform: "WEB",
          aud: WEB_SESSION_AUDIENCE,
          webAccessEnabled: true,
        },
      });
      const okRes = await checkWebApiAuth();
      expect(okRes.error).toBeNull();
      expect((okRes.session?.user as any)?.id).toBe("emp-1");

      mockGetServerSession.mockResolvedValueOnce({
        user: {
          id: "emp-1",
          role: "EMPLOYEE",
          authPlatform: "MOBILE",
          aud: WEB_SESSION_AUDIENCE,
          webAccessEnabled: true,
        },
      });
      const badPlatformRes = await checkWebApiAuth();
      expect(badPlatformRes.session).toBeNull();
      expect(badPlatformRes.error?.status).toBe(403);

      mockGetServerSession.mockResolvedValueOnce({
        user: {
          id: "emp-1",
          role: "EMPLOYEE",
          authPlatform: "WEB",
          aud: MOBILE_SESSION_AUDIENCE,
          webAccessEnabled: true,
        },
      });
      const badAudRes = await checkWebApiAuth();
      expect(badAudRes.session).toBeNull();
      expect(badAudRes.error?.status).toBe(403);
    });

    it("Mobile checkApiAuth allows valid MOBILE session and rejects WEB platform or aud with 403", async () => {
      mockGetServerSession.mockResolvedValueOnce({
        user: {
          id: "emp-1",
          role: "EMPLOYEE",
          authPlatform: "MOBILE",
          aud: MOBILE_SESSION_AUDIENCE,
          mobileAccessEnabled: true,
        },
      });
      const okRes = await checkMobileApiAuth();
      expect(okRes.error).toBeNull();
      expect((okRes.session?.user as any)?.id).toBe("emp-1");

      mockGetServerSession.mockResolvedValueOnce({
        user: {
          id: "emp-1",
          role: "EMPLOYEE",
          authPlatform: "WEB",
          aud: MOBILE_SESSION_AUDIENCE,
          mobileAccessEnabled: true,
        },
      });
      const badPlatformRes = await checkMobileApiAuth();
      expect(badPlatformRes.session).toBeNull();
      expect(badPlatformRes.error?.status).toBe(403);

      mockGetServerSession.mockResolvedValueOnce({
        user: {
          id: "emp-1",
          role: "EMPLOYEE",
          authPlatform: "MOBILE",
          aud: WEB_SESSION_AUDIENCE,
          mobileAccessEnabled: true,
        },
      });
      const badAudRes = await checkMobileApiAuth();
      expect(badAudRes.session).toBeNull();
      expect(badAudRes.error?.status).toBe(403);
    });
  });
});
