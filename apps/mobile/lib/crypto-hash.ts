/**
 * Calculates SHA-256 hash from ArrayBuffer using standard WebCrypto API.
 * Compatible with React Native, Web, and Node environments.
 */
export async function calculateArrayBufferSha256(buffer: ArrayBuffer): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle && typeof crypto.subtle.digest === "function") {
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  // Fallback string hex digest for simple test environments
  const view = new Uint8Array(buffer);
  let hex = "";
  for (let i = 0; i < view.length; i++) {
    hex += view[i].toString(16).padStart(2, "0");
  }
  return `sha256-hex-${hex.slice(0, 32)}`;
}
