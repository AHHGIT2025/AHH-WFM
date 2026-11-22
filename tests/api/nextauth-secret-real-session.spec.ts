// Do NOT mock next-auth/next or next-auth/jwt here: exercises real encode + getServerSession + checkApiAuth.
let mockCookieStore: Array<{ name: string; value: string }> = [];

jest.mock("next/headers", () => ({
  cookies: () => ({
    getAll: () => mockCookieStore,
    get: (name: string) => mockCookieStore.find((c) => c.name === name),
  }),
  headers: () => new Headers(),
}));

import { encode } from "next-auth/jwt";
import { getServerSession } from "next-auth/next";
import {
  authOptions as webAuthOptions,
  WEB_SESSION_AUDIENCE,
  WEB_SESSION_COOKIE_NAME,
} from "../../apps/web/lib/auth";
import {
  authOptions as mobileAuthOptions,
  MOBILE_SESSION_AUDIENCE,
  MOBILE_SESSION_COOKIE_NAME,
} from "../../apps/mobile/lib/auth";
import { checkApiAuth as checkWebApiAuth } from "../../apps/web/lib/api-guards";
import { checkApiAuth as checkMobileApiAuth } from "../../apps/mobile/lib/api-guards";
import { mockDb } from "@ahh-wfm/mock-data";

describe("Real getServerSession + next-auth/jwt Cookie Round-Trip & Secret Enforcement", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.restoreAllMocks();
    mockCookieStore = [];
    jest.spyOn(mockDb, "getUserRoleAssignments").mockResolvedValue([] as any);
    jest.spyOn(mockDb, "getSystemRoles").mockResolvedValue([] as any);
    jest.spyOn(mockDb, "getRolePermissions").mockResolvedValue([] as any);
    jest.spyOn(mockDb, "getSystemPermissions").mockResolvedValue([] as any);
    jest.spyOn(mockDb, "getUserOperationAccess").mockResolvedValue(null as any);
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
      {
        id: "emp-web",
        name: "Web User",
        email: "web@ahh.com",
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
      {
        id: "emp-mobile",
        name: "Mobile User",
        email: "mobile@ahh.com",
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

  describe("1. Missing, blank, and configured-no-cookie secret enforcement", () => {
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

  describe("2. Real next-auth/jwt cookie round-trip & cross-app isolation (F4)", () => {
    const testSecret = "roundtrip-test-only-nextauth-secret-987654321";

    beforeEach(() => {
      process.env = {
        ...originalEnv,
        NODE_ENV: "production",
        NEXTAUTH_SECRET: testSecret,
      };
    });

    it("accepts a valid Web token under the Web cookie on Web (positive control)", async () => {
      const jwt = await encode({
        secret: testSecret,
        token: {
          id: "emp-1",
          sub: "emp-1",
          role: "EMPLOYEE",
          authPlatform: "WEB",
          aud: WEB_SESSION_AUDIENCE,
          isActive: true,
          isLoginEnabled: true,
          isLocked: false,
          isRevoked: false,
          webAccessEnabled: true,
          mobileAccessEnabled: true,
        },
      });
      mockCookieStore = [{ name: WEB_SESSION_COOKIE_NAME, value: jwt }];

      const res = await checkWebApiAuth();
      expect(res.error).toBeNull();
      expect((res.session?.user as any)?.id).toBe("emp-1");
    });

    it("accepts a valid Mobile token under the Mobile cookie on Mobile (positive control)", async () => {
      const jwt = await encode({
        secret: testSecret,
        token: {
          id: "emp-1",
          sub: "emp-1",
          role: "EMPLOYEE",
          authPlatform: "MOBILE",
          aud: MOBILE_SESSION_AUDIENCE,
          isActive: true,
          isLoginEnabled: true,
          isLocked: false,
          isRevoked: false,
          webAccessEnabled: true,
          mobileAccessEnabled: true,
        },
      });
      mockCookieStore = [{ name: MOBILE_SESSION_COOKIE_NAME, value: jwt }];

      const res = await checkMobileApiAuth();
      expect(res.error).toBeNull();
      expect((res.session?.user as any)?.id).toBe("emp-1");
    });

    it("rejects Web token under only the Mobile cookie name sent to Web (401)", async () => {
      const jwt = await encode({
        secret: testSecret,
        token: {
          id: "emp-web",
          sub: "emp-web",
          role: "EMPLOYEE",
          authPlatform: "WEB",
          aud: WEB_SESSION_AUDIENCE,
          isActive: true,
          isLoginEnabled: true,
          isLocked: false,
          isRevoked: false,
          webAccessEnabled: true,
          mobileAccessEnabled: true,
        },
      });
      mockCookieStore = [{ name: MOBILE_SESSION_COOKIE_NAME, value: jwt }];

      const res = await checkWebApiAuth();
      expect(res.session).toBeNull();
      expect(res.error?.status).toBe(401);
    });

    it("rejects Mobile token under only the Web cookie name sent to Mobile (401)", async () => {
      const jwt = await encode({
        secret: testSecret,
        token: {
          id: "emp-mobile",
          sub: "emp-mobile",
          role: "EMPLOYEE",
          authPlatform: "MOBILE",
          aud: MOBILE_SESSION_AUDIENCE,
          isActive: true,
          isLoginEnabled: true,
          isLocked: false,
          isRevoked: false,
          webAccessEnabled: true,
          mobileAccessEnabled: true,
        },
      });
      mockCookieStore = [{ name: WEB_SESSION_COOKIE_NAME, value: jwt }];

      const res = await checkMobileApiAuth();
      expect(res.session).toBeNull();
      expect(res.error?.status).toBe(401);
    });

    it("rejects Web token presented under the Mobile cookie on Mobile (401)", async () => {
      const jwt = await encode({
        secret: testSecret,
        token: {
          id: "emp-1",
          sub: "emp-1",
          role: "EMPLOYEE",
          authPlatform: "WEB",
          aud: WEB_SESSION_AUDIENCE,
          isActive: true,
          isLoginEnabled: true,
          isLocked: false,
          isRevoked: false,
          webAccessEnabled: true,
          mobileAccessEnabled: true,
        },
      });
      mockCookieStore = [{ name: MOBILE_SESSION_COOKIE_NAME, value: jwt }];

      const res = await checkMobileApiAuth();
      expect(res.session).toBeNull();
      expect(res.error?.status).toBe(401);
    });

    it("rejects Mobile token presented under the Web cookie on Web (401)", async () => {
      const jwt = await encode({
        secret: testSecret,
        token: {
          id: "emp-1",
          sub: "emp-1",
          role: "EMPLOYEE",
          authPlatform: "MOBILE",
          aud: MOBILE_SESSION_AUDIENCE,
          isActive: true,
          isLoginEnabled: true,
          isLocked: false,
          isRevoked: false,
          webAccessEnabled: true,
          mobileAccessEnabled: true,
        },
      });
      mockCookieStore = [{ name: WEB_SESSION_COOKIE_NAME, value: jwt }];

      const res = await checkWebApiAuth();
      expect(res.session).toBeNull();
      expect(res.error?.status).toBe(401);
    });

    it("when both cookies are present, each guard accepts only its own app's token", async () => {
      const webJwt = await encode({
        secret: testSecret,
        token: {
          id: "emp-web",
          sub: "emp-web",
          role: "EMPLOYEE",
          authPlatform: "WEB",
          aud: WEB_SESSION_AUDIENCE,
          isActive: true,
          isLoginEnabled: true,
          isLocked: false,
          isRevoked: false,
          webAccessEnabled: true,
          mobileAccessEnabled: true,
        },
      });
      const mobileJwt = await encode({
        secret: testSecret,
        token: {
          id: "emp-mobile",
          sub: "emp-mobile",
          role: "EMPLOYEE",
          authPlatform: "MOBILE",
          aud: MOBILE_SESSION_AUDIENCE,
          isActive: true,
          isLoginEnabled: true,
          isLocked: false,
          isRevoked: false,
          webAccessEnabled: true,
          mobileAccessEnabled: true,
        },
      });

      mockCookieStore = [
        { name: WEB_SESSION_COOKIE_NAME, value: webJwt },
        { name: MOBILE_SESSION_COOKIE_NAME, value: mobileJwt },
      ];

      const webRes = await checkWebApiAuth();
      expect(webRes.error).toBeNull();
      expect((webRes.session?.user as any)?.id).toBe("emp-web");
      expect((webRes.session?.user as any)?.authPlatform).toBe("WEB");

      const mobileRes = await checkMobileApiAuth();
      expect(mobileRes.error).toBeNull();
      expect((mobileRes.session?.user as any)?.id).toBe("emp-mobile");
      expect((mobileRes.session?.user as any)?.authPlatform).toBe("MOBILE");
    });

    it("rejects a token encoded with a different secret on both Web and Mobile", async () => {
      const wrongSecretJwt = await encode({
        secret: "completely-different-secret-000000000",
        token: {
          id: "emp-1",
          sub: "emp-1",
          role: "EMPLOYEE",
          authPlatform: "WEB",
          aud: WEB_SESSION_AUDIENCE,
          isActive: true,
          isLoginEnabled: true,
          isLocked: false,
          isRevoked: false,
          webAccessEnabled: true,
          mobileAccessEnabled: true,
        },
      });

      mockCookieStore = [{ name: WEB_SESSION_COOKIE_NAME, value: wrongSecretJwt }];
      const webRes = await checkWebApiAuth();
      expect(webRes.session).toBeNull();
      expect(webRes.error?.status).toBe(401);

      mockCookieStore = [{ name: MOBILE_SESSION_COOKIE_NAME, value: wrongSecretJwt }];
      const mobileRes = await checkMobileApiAuth();
      expect(mobileRes.session).toBeNull();
      expect(mobileRes.error?.status).toBe(401);
    });
  });

  describe("3. Secret leakage check on real session & failure paths (F3)", () => {
    it("never logs or prints the configured dummy secret during real auth/failure logging paths", async () => {
      const dummySecret = "dummy-real-session-secret-must-not-leak-999";
      const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
      const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
      const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      process.env = {
        ...originalEnv,
        NODE_ENV: "development",
        NEXTAUTH_SECRET: dummySecret,
      };

      // Path A: valid cookie in development triggers real console.log("[API Auth Debug] ...")
      const validJwt = await encode({
        secret: dummySecret,
        token: {
          id: "emp-1",
          sub: "emp-1",
          role: "EMPLOYEE",
          authPlatform: "WEB",
          aud: WEB_SESSION_AUDIENCE,
          isActive: true,
          isLoginEnabled: true,
          isLocked: false,
          isRevoked: false,
          webAccessEnabled: true,
          mobileAccessEnabled: true,
        },
      });
      mockCookieStore = [{ name: WEB_SESSION_COOKIE_NAME, value: validJwt }];
      const okRes = await checkWebApiAuth();
      expect(okRes.error).toBeNull();

      // Path B: wrong-secret cookie
      const wrongSecretJwt = await encode({
        secret: "wrong-secret-0000000000000000000000000",
        token: { id: "emp-1", sub: "emp-1", authPlatform: "WEB", aud: WEB_SESSION_AUDIENCE },
      });
      mockCookieStore = [{ name: WEB_SESSION_COOKIE_NAME, value: wrongSecretJwt }];
      const wrongRes = await checkWebApiAuth();
      expect(wrongRes.error?.status).toBe(401);

      // Path C: malformed cookie
      mockCookieStore = [{ name: WEB_SESSION_COOKIE_NAME, value: "not-a-valid-jwe-token" }];
      const malformedRes = await checkWebApiAuth();
      expect(malformedRes.error?.status).toBe(401);

      // Non-vacuous guarantee: verify logging actually occurred before checking absence of secret
      expect(logSpy.mock.calls.length + warnSpy.mock.calls.length + errorSpy.mock.calls.length).toBeGreaterThan(0);

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
});
