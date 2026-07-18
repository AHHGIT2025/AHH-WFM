export interface SecfacDeviceSession {
  deviceSessionId: string;
  createdAt: string;
  deviceLabel: string;
  devicePlatform: string;
}

// Generate client-side session UUID
function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// Detect simple platform details transparently
function getPlatformLabel(): string {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("android")) return "android";
  if (ua.includes("iphone") || ua.includes("ipad")) return "ios";
  return "browser-mobile";
}

export function getOrCreateDeviceSession(): SecfacDeviceSession {
  if (typeof window === "undefined") {
    return {
      deviceSessionId: "server-side-session",
      createdAt: new Date().toISOString(),
      deviceLabel: "Server Execution",
      devicePlatform: "server"
    };
  }

  // Attempt using localStorage
  try {
    const key = "secfac_device_session";
    const stored = localStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && parsed.deviceSessionId) {
        return parsed;
      }
    }

    // Initialize new session identity
    const session: SecfacDeviceSession = {
      deviceSessionId: generateUUID(),
      createdAt: new Date().toISOString(),
      deviceLabel: "Mobile Browser",
      devicePlatform: getPlatformLabel()
    };
    localStorage.setItem(key, JSON.stringify(session));
    return session;
  } catch (err) {
    // Return volatile session if localStorage throws
    return {
      deviceSessionId: "volatile-session-" + generateUUID().slice(0, 8),
      createdAt: new Date().toISOString(),
      deviceLabel: "Mobile Browser (Volatile)",
      devicePlatform: getPlatformLabel()
    };
  }
}
