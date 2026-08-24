"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
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
  const [videoLoaded, setVideoLoaded] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const completeAnimation = useCallback(() => {
    setAnimationCompleted(true);
  }, []);

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
          completeAnimation();
        }, 300);
        return () => clearTimeout(timer);
      }

      // Safety timeout: 4 seconds video duration + 200ms grace
      const timer = setTimeout(() => {
        completeAnimation();
      }, 4200);

      return () => clearTimeout(timer);
    }
  }, [completeAnimation]);

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
      className="fixed inset-0 z-[9999] bg-[#031751] flex flex-col items-center justify-center font-sans text-white select-none overflow-hidden"
    >
      {/* Background Ambient Layers */}
      <div className="absolute inset-0 bg-[#031751]" />

      {/* 1. Approved Google Flow MP4 Video Player (9:16 aspect ratio, centered, full-screen fit) */}
      {!reducedMotion && !mediaError && (
        <div className="relative w-full h-full max-w-[480px] max-h-screen flex items-center justify-center overflow-hidden z-10">
          <video
            ref={videoRef}
            data-testid="google-flow-video"
            src="/media/praxivo-wfm-splash.mp4"
            className={`w-full h-full object-contain aspect-[9/16] transition-opacity duration-300 ${
              videoLoaded ? "opacity-100" : "opacity-0"
            }`}
            autoPlay
            muted
            playsInline
            preload="auto"
            onLoadedData={() => setVideoLoaded(true)}
            onEnded={completeAnimation}
            onError={() => {
              setMediaError(true);
              completeAnimation();
            }}
          />

          {/* Minimal non-blocking branded loader before video frames decode */}
          {!videoLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#031751]">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#093FA6] to-[#116BEE] flex items-center justify-center shadow-xl border border-white/20">
                <span className="material-symbols-outlined text-white text-[32px]">domain</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. Resilient Static Branded Fallback (for reduced motion, error, or loading) */}
      {(reducedMotion || mediaError) && (
        <div className="relative z-10 flex flex-col items-center justify-between h-full w-full p-8 text-center max-w-[430px]">
          {/* Subtle Ambient Blobs */}
          <div className="absolute top-[-15%] left-[-15%] w-[70%] h-[70%] rounded-full bg-[#093FA6] opacity-30 blur-[120px] pointer-events-none" />
          <div className="absolute bottom-[-15%] right-[-15%] w-[70%] h-[70%] rounded-full bg-[#116BEE] opacity-25 blur-[120px] pointer-events-none" />

          {/* Top Spacer */}
          <div className="h-10 w-full" />

          {/* Center Brand Identity */}
          <div className="flex flex-col items-center justify-center my-auto">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#093FA6] to-[#116BEE] flex items-center justify-center shadow-2xl border border-white/20 mb-6">
              <span className="material-symbols-outlined text-white text-[42px]">domain</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white mb-1">
              {BRANDING.PRODUCT_NAME}
            </h1>
            <p className="text-xs font-semibold text-[#5FAFD8] uppercase tracking-widest mb-2">
              {BRANDING.PORTAL_NAME}
            </p>
          </div>

          {/* Bottom Brand Signature */}
          <div className="flex flex-col items-center w-full space-y-3 pb-4">
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
      )}

      {/* 3. Restrained Session Loading Status if Video Finishes before Session Resolves */}
      {animationCompleted && status === "loading" && !reducedMotion && !mediaError && (
        <div className="absolute bottom-10 z-20 flex items-center gap-2 bg-[#031751]/80 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 text-xs text-slate-300 font-medium shadow-lg">
          <div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          <span>Connecting...</span>
        </div>
      )}
    </div>
  );
};

export default StartupSplash;
