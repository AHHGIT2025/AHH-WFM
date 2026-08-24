import fs from "fs";
import path from "path";

describe("WFM Praxivo Labs Visual Identity & Theme Verification", () => {
  const rootDir = path.resolve(__dirname, "../..");

  test("1. Centralized Tailwind preset defines exact 5 Praxivo Labs hex values", () => {
    const presetFile = path.join(rootDir, "packages/config/tailwind-preset.js");
    expect(fs.existsSync(presetFile)).toBe(true);
    const content = fs.readFileSync(presetFile, "utf8");

    expect(content).toContain('"#031751"'); // Praxivo Navy
    expect(content).toContain('"#093FA6"'); // Core Blue
    expect(content).toContain('"#116BEE"'); // Innovation Blue
    expect(content).toContain('"#4643F3"'); // Intelligence Violet
    expect(content).toContain('"#5FAFD8"'); // Digital Cyan
  });

  test("2. Web & Mobile globals.css define authoritative Praxivo CSS variables", () => {
    const webCss = fs.readFileSync(path.join(rootDir, "apps/web/app/globals.css"), "utf8");
    const mobileCss = fs.readFileSync(path.join(rootDir, "apps/mobile/app/globals.css"), "utf8");

    for (const css of [webCss, mobileCss]) {
      expect(css).toContain("--praxivo-navy: #031751;");
      expect(css).toContain("--praxivo-core-blue: #093FA6;");
      expect(css).toContain("--praxivo-innovation-blue: #116BEE;");
      expect(css).toContain("--praxivo-intelligence-violet: #4643F3;");
      expect(css).toContain("--praxivo-digital-cyan: #5FAFD8;");
    }
  });

  test("3. Web & Mobile Tailwind configs map primary and secondary to Praxivo Core tokens", () => {
    const webConfig = fs.readFileSync(path.join(rootDir, "apps/web/tailwind.config.ts"), "utf8");
    const mobileConfig = fs.readFileSync(path.join(rootDir, "apps/mobile/tailwind.config.ts"), "utf8");

    expect(webConfig).toContain('primary: "#031751"');
    expect(webConfig).toContain('secondary: "#093FA6"');
    expect(webConfig).toContain('"secondary-container": "#116BEE"');

    expect(mobileConfig).toContain('primary: "#031751"');
    expect(mobileConfig).toContain('secondary: "#093FA6"');
    expect(mobileConfig).toContain('"secondary-container": "#116BEE"');
    expect(mobileConfig).not.toContain("#58002a"); // Old maroon removed
  });

  test("4. Shared Button component defines Core Blue primary, Innovation Blue hover, and Violet workflow", () => {
    const buttonFile = path.join(rootDir, "packages/ui/src/index.tsx");
    const content = fs.readFileSync(buttonFile, "utf8");

    expect(content).toContain("bg-[#093FA6]");
    expect(content).toContain("hover:bg-[#116BEE]");
    expect(content).toContain("bg-[#4643F3]");
    expect(content).toContain("disabled:opacity-50");
    expect(content).toContain("disabled:text-slate-500");
  });

  test("5. Shared Badge component enforces Praxivo Navy text on Digital Cyan informational variant", () => {
    const uiFile = path.join(rootDir, "packages/ui/src/index.tsx");
    const content = fs.readFileSync(uiFile, "utf8");

    expect(content).toContain('variant === "info" && "bg-[#5FAFD8]/20 text-[#031751] border-[#5FAFD8]/40"');
    expect(content).toContain('variant === "workflow" && "bg-[#4643F3]/15 text-[#4643F3] border-[#4643F3]/30"');
  });

  test("6. Web LayoutShell applies Praxivo Navy sidebar and Innovation Blue active indicator", () => {
    const shellFile = path.join(rootDir, "apps/web/components/layout-shell.tsx");
    const content = fs.readFileSync(shellFile, "utf8");

    expect(content).toContain("bg-[#031751]");
    expect(content).toContain("bg-[#116BEE]");
    expect(content).toContain("border-[#5FAFD8]");
  });

  test("7. Mobile Bottom Navigation uses Core Blue selected state and clean neutral unselected state", () => {
    const mobileShell = path.join(rootDir, "apps/mobile/components/mobile-shell.tsx");
    const content = fs.readFileSync(mobileShell, "utf8");

    expect(content).toContain("text-[#093FA6]");
    expect(content).toContain("bg-[#093FA6]");
    expect(content).toContain("border-slate-200");
  });

  test("8. Semantic Emergency / SOS status colors remain preserved in semantic red", () => {
    const mobilePage = fs.readFileSync(path.join(rootDir, "apps/mobile/app/page.tsx"), "utf8");
    expect(mobilePage).toContain("bg-[#BA1A1A]");
    expect(mobilePage).toContain("emergency");
  });

  test("9. Android Native Launch Screen configures Praxivo Navy background to prevent white flash", () => {
    const colorsXml = fs.readFileSync(path.join(rootDir, "apps/mobile/android/app/src/main/res/values/colors.xml"), "utf8");
    const icLauncherBg = fs.readFileSync(path.join(rootDir, "apps/mobile/android/app/src/main/res/values/ic_launcher_background.xml"), "utf8");
    const stylesXml = fs.readFileSync(path.join(rootDir, "apps/mobile/android/app/src/main/res/values/styles.xml"), "utf8");

    expect(colorsXml).toContain('<color name="splash_background">#031751</color>');
    expect(icLauncherBg).toContain('<color name="ic_launcher_background">#031751</color>');
    expect(stylesXml).toContain("@color/splash_background");
  });
});
