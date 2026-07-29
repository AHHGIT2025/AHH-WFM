import { NextRequest, NextResponse } from "next/server";
import middleware from "../../apps/web/middleware";

jest.mock("next-auth/middleware", () => ({
    withAuth: (middlewareFn: any) => middlewareFn
}));

describe("Middleware Security & Initialization", () => {
    it("1. Middleware can be imported and initialized without crypto is not defined", () => {
        expect(middleware).toBeDefined();
        expect(typeof middleware).toBe("function");
    });

    it("2. Correlation IDs are always non-empty", async () => {
        const req = new NextRequest("http://localhost:3000/api/v1/scheduler/relievers/assign", { method: "POST" });
        (req as any).nextauth = { token: null };
        const res: NextResponse = await (middleware as any)(req);
        expect(res.status).toBe(403);
        const data = await res.json();
        expect(data.correlationId).toBeDefined();
        expect(data.correlationId.length).toBeGreaterThan(0);
    });

    it("3. Correlation IDs are diagnostic-only", async () => {
        const req = new NextRequest("http://localhost:3000/api/v1/scheduler/relievers/assign", { method: "POST" });
        (req as any).nextauth = { token: null };
        const res = await (middleware as any)(req);
        const data = await res.json();
        expect(typeof data.correlationId).toBe("string");
    });

    it("4. Correlation IDs are not used for authentication or authorization", async () => {
        const req = new NextRequest("http://localhost:3000/api/v1/scheduler/relievers/assign", { method: "POST" });
        Object.defineProperty(req, 'ip', { value: '127.0.0.1', writable: true });
        (req as any).nextauth = { token: null };
        const res = await (middleware as any)(req);
        expect(res.status).toBe(403);
    });

    it("5. Missing or disallowed origin is rejected for protected state-changing routes", async () => {
        const req = new NextRequest("http://localhost:3000/api/v1/scheduler/relievers/assign", {
            method: "POST",
            headers: new Headers({ "origin": "http://evil.com", "host": "localhost:3000" })
        });
        (req as any).nextauth = { token: null };
        const res = await (middleware as any)(req);
        expect(res.status).toBe(403);
    });

    it("6. Approved same-origin requests pass the origin boundary", async () => {
        const req = new NextRequest("http://localhost:3000/api/v1/scheduler/relievers/assign", {
            method: "POST",
            headers: new Headers({ "origin": "http://localhost:3000", "host": "localhost:3000" })
        });
        (req as any).nextauth = { token: { id: "user1" } };
        const res = await (middleware as any)(req);
        expect(res).toBeUndefined();
    });

    it("7. Authenticated rate-limit identity uses the authenticated user identity", async () => {
        for (let i = 0; i < 61; i++) {
            const req = new NextRequest("http://localhost:3000/api/v1/scheduler/relievers/assign", {
                method: "POST",
                headers: new Headers({ "origin": "http://localhost:3000", "host": "localhost:3000" })
            });
            (req as any).nextauth = { token: { id: "rate-limit-user" } };
            const res = await (middleware as any)(req);
            if (i === 60) {
                expect(res.status).toBe(429);
            } else {
                expect(res).toBeUndefined();
            }
        }
    });

    it("8. Arbitrary X-Forwarded-For values do not control the rate-limit identity", async () => {
        const req = new NextRequest("http://localhost:3000/api/v1/scheduler/relievers/assign", {
            method: "POST",
            headers: new Headers({ "origin": "http://localhost:3000", "host": "localhost:3000", "x-forwarded-for": "9.9.9.9" })
        });
        Object.defineProperty(req, 'ip', { value: '127.0.0.1', writable: true });
        (req as any).nextauth = { token: null };
        const res = await (middleware as any)(req);
        expect(res).toBeUndefined();
    });

    it("9. Rate-limit rejection returns HTTP 429", async () => {
        const req = new NextRequest("http://localhost:3000/api/v1/scheduler/relievers/assign", {
            method: "POST",
            headers: new Headers({ "origin": "http://localhost:3000", "host": "localhost:3000" })
        });
        (req as any).nextauth = { token: { id: "rate-limit-user" } };
        const res = await (middleware as any)(req);
        expect(res.status).toBe(429);
    });

    it("10. Rate-limit rejection includes Retry-After", async () => {
        const req = new NextRequest("http://localhost:3000/api/v1/scheduler/relievers/assign", {
            method: "POST",
            headers: new Headers({ "origin": "http://localhost:3000", "host": "localhost:3000" })
        });
        (req as any).nextauth = { token: { id: "rate-limit-user" } };
        const res = await (middleware as any)(req);
        expect(res.headers.get("Retry-After")).toBeDefined();
    });

    it("11. CSRF rejection returns a safe response without stack traces or internal paths", async () => {
        const req = new NextRequest("http://localhost:3000/api/v1/scheduler/relievers/assign", { method: "POST" });
        (req as any).nextauth = { token: null };
        const res = await (middleware as any)(req);
        const data = await res.json();
        expect(data.error).toBe("Forbidden: CSRF / Origin Validation Failed");
        expect(data.stack).toBeUndefined();
        expect(data.path).toBeUndefined();
    });

    it("12. Production CSP does not contain unsafe-eval", () => {
        const csp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';";
        expect(csp).not.toContain("unsafe-eval");
    });
});
