"use client";

import { useEffect } from "react";
import { getOrCreateDeviceSession } from "../lib/secfac-device-session";

export default function SecfacSessionInitializer() {
  useEffect(() => {
    if (typeof window !== "undefined") {
      // Warm up device session
      const session = getOrCreateDeviceSession();
      
      // Wrap window.fetch to automatically inject device session headers for all SECFAC API calls
      const originalFetch = window.fetch;
      window.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
        const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        
        if (url.includes("/api/v1/secfac/")) {
          // Clone or initialize headers
          const headers = new Headers(init?.headers || {});
          
          if (!headers.has("X-Secfac-Device-Session-Id")) {
            headers.set("X-Secfac-Device-Session-Id", session.deviceSessionId);
          }
          if (!headers.has("X-Secfac-Device-Label")) {
            headers.set("X-Secfac-Device-Label", session.deviceLabel);
          }
          if (!headers.has("X-Secfac-Device-Platform")) {
            headers.set("X-Secfac-Device-Platform", session.devicePlatform);
          }
          if (!headers.has("X-Secfac-Client-Action-At")) {
            headers.set("X-Secfac-Client-Action-At", new Date().toISOString());
          }
          if (!headers.has("X-Secfac-Network-Status")) {
            headers.set("X-Secfac-Network-Status", navigator.onLine ? "ONLINE" : "OFFLINE");
          }

          // Return with modified headers
          return originalFetch(input, {
            ...init,
            headers
          });
        }
        
        return originalFetch(input, init);
      };
    }
  }, []);

  return null;
}
