/**
/**
 * Server-Side Configuration Helper for Mobile BFF Routes
 *
 * Deterministically resolves the authoritative Web API target base URL.
 * - SERVER Deployment: Expects server-only environment variable `WEB_API_URL` (e.g. `http://10.10.50.24:3200`).
 * - LOCAL Development: Defaults safely to `http://localhost:3100`.
 */
export function getWebApiBaseUrl(): string {
  if (process.env.WEB_API_URL && process.env.WEB_API_URL.trim().length > 0) {
    return process.env.WEB_API_URL.trim().replace(/\/+$/, "");
  }
  if (process.env.NEXT_PUBLIC_WEB_URL && process.env.NEXT_PUBLIC_WEB_URL.trim().length > 0) {
    return process.env.NEXT_PUBLIC_WEB_URL.trim().replace(/\/+$/, "");
  }
  if (process.env.PORT === "3201") {
    return "http://127.0.0.1:3200";
  }
  if (process.env.NEXTAUTH_URL && process.env.NEXTAUTH_URL.includes(":3201")) {
    return process.env.NEXTAUTH_URL.replace(":3201", ":3200").replace(/\/+$/, "");
  }
  return "http://localhost:3100";
}

