"use client";

import React, { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { BRANDING } from "../lib/branding";

interface StartupSplashProps {
  children?: React.ReactNode;
}

export const StartupSplash: React.FC<StartupSplashProps> = ({ children }) => {
  const { status } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  const [splashVisible, setSplashVisible] = useState<boolean>(true);
  const [animationCompleted, setAnimationCompleted] = useState<boolean>(false);
  const [mediaError, setMediaError] = useState<boolean>(false);
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // 1. Cold start detection & reduced motion check
  useEffect(() => {
    if (typeof window !== "undefined") {
      const alreadyShown = sessionStorage.getItem("wfm_mobile_startup_splash_shown");
      if (alreadyShown === "true") {
        setSplashVisible(false);
        return;
      }

      const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      if (mediaQuery.matches) {
        setReducedMotion(true);
        // Reduced motion: short static display (300ms)
        const timer = setTimeout(() => {
          setAnimationCompleted(true);
        }, 300);
        return () => clearTimeout(timer);
      }

      // Default splash animation duration (2.5 seconds)
      const timer = setTimeout(() => {
        setAnimationCompleted(true);
      }, 2500);

      return () => clearTimeout(timer);
    }
  }, []);

  // 2. Coordinate animation completion with session resolution
  useEffect(() => {
    if (!splashVisible) return;

    // Both animation duration completed AND session status determined
    if (animationCompleted && status !== "loading") {
      sessionStorage.setItem("wfm_mobile_startup_splash_shown", "true");

      // Seamless fade out
      const fadeTimer = setTimeout(() => {
        setSplashVisible(false);
        if (status === "unauthenticated" && pathname !== "/login") {
          router.replace("/login");
        }
      }, 200);

      return () => clearTimeout(fadeTimer);
    }
  }, [animationCompleted, status, splashVisible, pathname, router]);

  // If splash is dismissed, render normal application content
  if (!splashVisible) {
    return <>{children}</>;
  }

  return (
    <div
      data-testid="startup-splash-container"
      className="fixed inset-0 z-[9999] bg-[#031751] flex flex-col items-center justify-between p-8 font-sans text-white select-none overflow-hidden"
    >
      {/* Background Subtle Gradient Blobs */}
      <div className="absolute top-[-15%] left-[-15%] w-[70%] h-[70%] rounded-full bg-[#093FA6] opacity-30 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-15%] right-[-15%] w-[70%] h-[70%] rounded-full bg-[#116BEE] opacity-25 blur-[120px] pointer-events-none" />

      {/* Top Spacer */}
      <div className="h-10 w-full" />

      {/* Center Branding / Google Flow Animation Container */}
      <div className="flex flex-col items-center justify-center text-center relative z-10 my-auto">
        {/* Google Flow Video Integration Anchor */}
        {!reducedMotion && !mediaError && (
          <div className="relative w-28 h-28 mb-6 flex items-center justify-center">
            {/* Hidden video element that attempts playback if asset is present, falls back gracefully */}
            <video
              ref={videoRef}
              data-testid="google-flow-video"
              src="/assets/splash/google_flow_splash.mp4"
              className="w-full h-full object-contain hidden"
              autoPlay
              muted
              playsInline
              onError={() => setMediaError(true)}
              onEnded={() => setAnimationCompleted(true)}
            />
            {/* Static high-resolution symbol container */}
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#093FA6] to-[#116BEE] flex items-center justify-center shadow-2xl border border-white/20">
              <span className="material-symbols-outlined text-white text-[42px]">domain</span>
            </div>
          </div>
        )}

        {/* Static Fallback Symbol (for reduced motion or video error) */}
        {(reducedMotion || mediaError) && (
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#093FA6] to-[#116BEE] flex items-center justify-center shadow-2xl border border-white/20 mb-6">
            <span className="material-symbols-outlined text-white text-[42px]">domain</span>
          </div>
        )}

        {/* Product Title */}
        <h1 className="text-3xl font-extrabold tracking-tight text-white mb-1">
          {BRANDING.PRODUCT_NAME}
        </h1>
        <p className="text-xs font-semibold text-[#5FAFD8] uppercase tracking-widest mb-2">
          {BRANDING.PORTAL_NAME}
        </p>
      </div>

      {/* Bottom Brand Identity & Loading Status */}
      <div className="flex flex-col items-center text-center relative z-10 w-full space-y-3 pb-4">
        {/* Loading Indicator when session is still determining */}
        {status === "loading" && (
          <div className="flex items-center gap-2 text-xs text-slate-300 font-medium py-1">
            <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            <span>Connecting...</span>
          </div>
        )}

        <div className="border-t border-white/10 pt-4 w-full max-w-[280px]">
          <p className="text-xs font-bold text-white tracking-wide">
            {BRANDING.BRAND_NAME}
          </p>
          <p className="text-[10px] text-slate-300 italic mt-0.5">
            {BRANDING.TAGLINE}
          </p>
          <p className="text-[9px] text-slate-400 opacity-60 mt-1">
            {BRANDING.COPYRIGHT_TEXT}
          </p>
        </div>
      </div>
    </div>
  );
};

export default StartupSplash;
