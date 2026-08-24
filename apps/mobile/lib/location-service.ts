import { Capacitor } from "@capacitor/core";
import { Geolocation, PermissionStatus } from "@capacitor/geolocation";

export type LocationErrorCode =
  | "PERMISSION_DENIED"
  | "PERMANENTLY_DENIED"
  | "APPROXIMATE_ONLY"
  | "LOCATION_DISABLED"
  | "POSITION_TIMEOUT"
  | "NOT_SUPPORTED"
  | "UNKNOWN_LOCATION_ERROR";

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export interface LocationResult {
  success: boolean;
  coords?: LocationCoordinates;
  errorCode?: LocationErrorCode;
  errorMessage?: string;
  nativeError?: string;
}

export class LocationService {
  /**
   * Explanatory message required before triggering the system permission prompt
   */
  public static readonly PERMISSION_EXPLANATION =
    "WFM uses your location to verify that attendance is recorded at the assigned work location.";

  /**
   * User-facing error message mapping
   */
  public static readonly ERROR_MESSAGES: Record<LocationErrorCode, string> = {
    PERMISSION_DENIED:
      "Location permission is denied. Enable it in Android Settings.",
    PERMANENTLY_DENIED:
      "Location permission is denied. Enable it in Android Settings -> Apps -> WFM -> Permissions.",
    APPROXIMATE_ONLY:
      "Precise location is required for attendance verification. Enable Precise location in Android Settings.",
    LOCATION_DISABLED:
      "Location services are switched off. Turn on Location and try again.",
    POSITION_TIMEOUT:
      "Unable to obtain a GPS position. Move to an open area and try again.",
    NOT_SUPPORTED:
      "Geolocation is not supported on this device.",
    UNKNOWN_LOCATION_ERROR:
      "Unable to obtain a GPS position. Move to an open area and try again.",
  };

  /**
   * Checks current permission status without prompting user
   */
  public static async checkPermissionStatus(): Promise<LocationResult> {
    if (!Capacitor.isNativePlatform()) {
      if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
        return {
          success: false,
          errorCode: "NOT_SUPPORTED",
          errorMessage: this.ERROR_MESSAGES.NOT_SUPPORTED,
        };
      }
      return { success: true };
    }

    try {
      const status: PermissionStatus = await Geolocation.checkPermissions();
      return this.evaluatePermissionStatus(status);
    } catch (err: any) {
      console.error("[LocationService] Error checking permissions:", err?.code, err?.message);
      return {
        success: false,
        errorCode: "UNKNOWN_LOCATION_ERROR",
        errorMessage: this.ERROR_MESSAGES.UNKNOWN_LOCATION_ERROR,
        nativeError: err?.message || String(err),
      };
    }
  }

  /**
   * Requests location permission if prompt/prompt-with-rationale, then acquires position
   */
  public static async getCurrentLocation(): Promise<LocationResult> {
    if (Capacitor.isNativePlatform()) {
      return this.getCurrentLocationNative();
    } else {
      return this.getCurrentLocationBrowser();
    }
  }

  /**
   * Native Capacitor implementation
   */
  private static async getCurrentLocationNative(): Promise<LocationResult> {
    try {
      // 1. Check existing permissions
      let status: PermissionStatus = await Geolocation.checkPermissions();

      // 2. Request permission if prompt or prompt-with-rationale
      if (
        status.location === "prompt" ||
        status.location === "prompt-with-rationale" ||
        status.coarseLocation === "prompt" ||
        status.coarseLocation === "prompt-with-rationale"
      ) {
        status = await Geolocation.requestPermissions({ permissions: ["location"] });
      }

      // 3. Evaluate granted permissions
      const permEval = this.evaluatePermissionStatus(status);
      if (!permEval.success) {
        return permEval;
      }

      // 4. Acquire high-accuracy position
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
      });

      if (!pos || !pos.coords) {
        return {
          success: false,
          errorCode: "POSITION_TIMEOUT",
          errorMessage: this.ERROR_MESSAGES.POSITION_TIMEOUT,
        };
      }

      return {
        success: true,
        coords: {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        },
      };
    } catch (err: any) {
      // Log native error internally without exposing raw stack trace to user
      console.error("[LocationService] Native Geolocation acquisition error:", err?.code, err?.message);
      return this.classifyNativeError(err);
    }
  }

  /**
   * Browser / Web fallback implementation
   */
  private static getCurrentLocationBrowser(): Promise<LocationResult> {
    return new Promise((resolve) => {
      if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
        return resolve({
          success: false,
          errorCode: "NOT_SUPPORTED",
          errorMessage: this.ERROR_MESSAGES.NOT_SUPPORTED,
        });
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            success: true,
            coords: {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
            },
          });
        },
        (err) => {
          console.error("[LocationService] Browser Geolocation error:", err?.code, err?.message);
          let errorCode: LocationErrorCode = "UNKNOWN_LOCATION_ERROR";
          if (err.code === 1) {
            errorCode = "PERMISSION_DENIED";
          } else if (err.code === 2) {
            errorCode = "LOCATION_DISABLED";
          } else if (err.code === 3) {
            errorCode = "POSITION_TIMEOUT";
          }

          resolve({
            success: false,
            errorCode,
            errorMessage: this.ERROR_MESSAGES[errorCode],
            nativeError: err.message,
          });
        },
        {
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 0,
        }
      );
    });
  }

  /**
   * Helper to evaluate Capacitor PermissionStatus
   */
  private static evaluatePermissionStatus(status: PermissionStatus): LocationResult {
    const loc = status.location as string;
    const coarse = status.coarseLocation as string;

    // Precise location granted
    if (loc === "granted") {
      return { success: true };
    }

    // Coarse location granted but precise denied/not granted
    if (coarse === "granted" && loc !== "granted") {
      return {
        success: false,
        errorCode: "APPROXIMATE_ONLY",
        errorMessage: this.ERROR_MESSAGES.APPROXIMATE_ONLY,
      };
    }

    // Explicitly denied
    if (loc === "denied" || coarse === "denied") {
      return {
        success: false,
        errorCode: "PERMANENTLY_DENIED",
        errorMessage: this.ERROR_MESSAGES.PERMANENTLY_DENIED,
      };
    }

    // Fallthrough for prompt states if evaluated directly
    return {
      success: false,
      errorCode: "PERMISSION_DENIED",
      errorMessage: this.ERROR_MESSAGES.PERMISSION_DENIED,
    };
  }

  /**
   * Maps native error objects to classified user errors
   */
  public static classifyNativeError(err: any): LocationResult {
    const msg = String(err?.message || "").toLowerCase();
    const code = err?.code;

    if (code === 1 || msg.includes("denied") || msg.includes("permission")) {
      return {
        success: false,
        errorCode: "PERMISSION_DENIED",
        errorMessage: this.ERROR_MESSAGES.PERMISSION_DENIED,
        nativeError: err?.message || String(err),
      };
    }

    if (
      code === 2 ||
      msg.includes("location services") ||
      msg.includes("location settings") ||
      msg.includes("turned off") ||
      msg.includes("gps disabled") ||
      msg.includes("provider disabled")
    ) {
      return {
        success: false,
        errorCode: "LOCATION_DISABLED",
        errorMessage: this.ERROR_MESSAGES.LOCATION_DISABLED,
        nativeError: err?.message || String(err),
      };
    }

    if (code === 3 || msg.includes("timeout") || msg.includes("timed out") || msg.includes("expired")) {
      return {
        success: false,
        errorCode: "POSITION_TIMEOUT",
        errorMessage: this.ERROR_MESSAGES.POSITION_TIMEOUT,
        nativeError: err?.message || String(err),
      };
    }

    return {
      success: false,
      errorCode: "UNKNOWN_LOCATION_ERROR",
      errorMessage: this.ERROR_MESSAGES.UNKNOWN_LOCATION_ERROR,
      nativeError: err?.message || String(err),
    };
  }
}
