import fs from "fs";
import path from "path";

describe("WFM Mobile Startup Experience & Animated Splash Verification", () => {
  const rootDir = path.resolve(__dirname, "../..");

  test("1. Production MP4 asset exists in apps/mobile/public/media/praxivo-wfm-splash.mp4", () => {
    const mp4File = path.join(rootDir, "apps/mobile/public/media/praxivo-wfm-splash.mp4");
    expect(fs.existsSync(mp4File)).toBe(true);
    const stat = fs.statSync(mp4File);
    expect(stat.size).toBeGreaterThan(1000000); // ~1.74 MB
  });

  test("2. StartupSplash component references /media/praxivo-wfm-splash.mp4 with required attributes", () => {
    const splashFile = path.join(rootDir, "apps/mobile/components/startup-splash.tsx");
    expect(fs.existsSync(splashFile)).toBe(true);
    const content = fs.readFileSync(splashFile, "utf8");

    expect(content).toContain('src="/media/praxivo-wfm-splash.mp4"');
    expect(content).toContain("autoPlay");
    expect(content).toContain("muted");
    expect(content).toContain("playsInline");
    expect(content).toContain('preload="auto"');
    expect(content).not.toContain("controls");
    expect(content).not.toContain("loop");
  });

  test("3. Startup coordinator implements parallel session resolution and cold-launch tracking", () => {
    const splashFile = path.join(rootDir, "apps/mobile/components/startup-splash.tsx");
    const content = fs.readFileSync(splashFile, "utf8");

    expect(content).toContain("useSession");
    expect(content).toContain("wfm_mobile_startup_splash_shown");
    expect(content).toContain("sessionStorage.getItem");
    expect(content).toContain("sessionStorage.setItem");
  });

  test("4. Startup coordinator handles reduced motion preference gracefully", () => {
    const splashFile = path.join(rootDir, "apps/mobile/components/startup-splash.tsx");
    const content = fs.readFileSync(splashFile, "utf8");

    expect(content).toContain("prefers-reduced-motion: reduce");
    expect(content).toContain("setReducedMotion(true)");
  });

  test("5. Startup coordinator provides resilient failure fallback for media playback", () => {
    const splashFile = path.join(rootDir, "apps/mobile/components/startup-splash.tsx");
    const content = fs.readFileSync(splashFile, "utf8");

    expect(content).toContain("onError");
    expect(content).toContain("setMediaError(true)");
    expect(content).toContain("BRANDING.PRODUCT_NAME");
    expect(content).toContain("BRANDING.BRAND_NAME");
    expect(content).toContain("BRANDING.TAGLINE");
  });

  test("6. Mobile RootLayout integrates StartupSplash component within AuthProvider", () => {
    const layoutFile = path.join(rootDir, "apps/mobile/app/layout.tsx");
    const content = fs.readFileSync(layoutFile, "utf8");

    expect(content).toContain("StartupSplash");
    expect(content).toContain("<StartupSplash>");
  });

  test("7. Startup coordinator uses replace navigation to protect browser history", () => {
    const splashFile = path.join(rootDir, "apps/mobile/components/startup-splash.tsx");
    const content = fs.readFileSync(splashFile, "utf8");

    expect(content).toContain('router.replace("/login")');
  });

  test("8. Video presentation maintains 9:16 aspect ratio on Praxivo Navy background", () => {
    const splashFile = path.join(rootDir, "apps/mobile/components/startup-splash.tsx");
    const content = fs.readFileSync(splashFile, "utf8");

    expect(content).toContain("aspect-[9/16]");
    expect(content).toContain("bg-[#031751]");
  });

  test("9. MP4 asset is packaged locally in Android assets for offline APK startup", () => {
    const androidAssetFile = path.join(rootDir, "apps/mobile/android/app/src/main/assets/public/media/praxivo-wfm-splash.mp4");
    const publicAssetFile = path.join(rootDir, "apps/mobile/public/media/praxivo-wfm-splash.mp4");
    const wwwAssetFile = path.join(rootDir, "apps/mobile/www/media/praxivo-wfm-splash.mp4");

    expect(fs.existsSync(androidAssetFile)).toBe(true);
    expect(fs.existsSync(publicAssetFile)).toBe(true);
    expect(fs.existsSync(wwwAssetFile)).toBe(true);

    const androidStat = fs.statSync(androidAssetFile);
    const publicStat = fs.statSync(publicAssetFile);
    expect(androidStat.size).toBe(publicStat.size);
  });

  test("10. Offline fallback HTML contains Praxivo Core Palette and zero unapproved non-core shades (#CBA135, #072274, #1B365D)", () => {
    const wwwIndex = path.join(rootDir, "apps/mobile/www/index.html");
    const androidIndex = path.join(rootDir, "apps/mobile/android/app/src/main/assets/public/index.html");

    expect(fs.existsSync(wwwIndex)).toBe(true);
    expect(fs.existsSync(androidIndex)).toBe(true);

    const wwwContent = fs.readFileSync(wwwIndex, "utf8");
    const androidContent = fs.readFileSync(androidIndex, "utf8");

    expect(wwwContent).not.toContain("CBA135");
    expect(wwwContent).not.toContain("#CBA135");
    expect(wwwContent).not.toContain("072274");
    expect(wwwContent).not.toContain("#072274");
    expect(wwwContent).not.toContain("1B365D");
    expect(wwwContent).not.toContain("#1B365D");
    expect(wwwContent).toContain("#031751");
    expect(wwwContent).toContain("#093FA6");
    expect(wwwContent).toContain("#5FAFD8");
    expect(wwwContent).toContain("Praxivo Labs");
    expect(wwwContent).toContain("WFM");

    expect(androidContent).not.toContain("CBA135");
    expect(androidContent).not.toContain("#CBA135");
    expect(androidContent).not.toContain("072274");
    expect(androidContent).not.toContain("#072274");
    expect(androidContent).not.toContain("1B365D");
    expect(androidContent).not.toContain("#1B365D");
    expect(androidContent).toContain("#031751");
    expect(androidContent).toContain("#093FA6");
    expect(androidContent).toContain("#5FAFD8");
  });
});
