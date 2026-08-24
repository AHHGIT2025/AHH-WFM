import fs from "fs";
import path from "path";

describe("WFM Mobile Startup Experience & Animated Splash Verification", () => {
  const rootDir = path.resolve(__dirname, "../..");

  test("1. StartupSplash component exists and defines Praxivo Navy backdrop and branding", () => {
    const splashFile = path.join(rootDir, "apps/mobile/components/startup-splash.tsx");
    expect(fs.existsSync(splashFile)).toBe(true);
    const content = fs.readFileSync(splashFile, "utf8");

    expect(content).toContain("bg-[#031751]");
    expect(content).toContain("BRANDING.PRODUCT_NAME");
    expect(content).toContain("BRANDING.BRAND_NAME");
    expect(content).toContain("BRANDING.TAGLINE");
    expect(content).toContain("BRANDING.COPYRIGHT_TEXT");
  });

  test("2. Startup coordinator implements parallel session resolution and cold-launch tracking", () => {
    const splashFile = path.join(rootDir, "apps/mobile/components/startup-splash.tsx");
    const content = fs.readFileSync(splashFile, "utf8");

    expect(content).toContain("useSession");
    expect(content).toContain("wfm_mobile_startup_splash_shown");
    expect(content).toContain("sessionStorage.getItem");
    expect(content).toContain("sessionStorage.setItem");
  });

  test("3. Startup coordinator handles reduced motion preference gracefully", () => {
    const splashFile = path.join(rootDir, "apps/mobile/components/startup-splash.tsx");
    const content = fs.readFileSync(splashFile, "utf8");

    expect(content).toContain("prefers-reduced-motion: reduce");
    expect(content).toContain("setReducedMotion(true)");
  });

  test("4. Startup coordinator provides resilient failure fallback for media playback", () => {
    const splashFile = path.join(rootDir, "apps/mobile/components/startup-splash.tsx");
    const content = fs.readFileSync(splashFile, "utf8");

    expect(content).toContain("onError={() => setMediaError(true)}");
    expect(content).toContain("mediaError");
    expect(content).toContain("google_flow_splash");
  });

  test("5. Mobile RootLayout integrates StartupSplash component within AuthProvider", () => {
    const layoutFile = path.join(rootDir, "apps/mobile/app/layout.tsx");
    const content = fs.readFileSync(layoutFile, "utf8");

    expect(content).toContain("StartupSplash");
    expect(content).toContain("<StartupSplash>");
  });

  test("6. Startup coordinator uses replace navigation to protect browser history", () => {
    const splashFile = path.join(rootDir, "apps/mobile/components/startup-splash.tsx");
    const content = fs.readFileSync(splashFile, "utf8");

    expect(content).toContain('router.replace("/login")');
  });
});
