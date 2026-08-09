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
  return "http://localhost:3100";
}
