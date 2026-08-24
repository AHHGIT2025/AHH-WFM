import fs from 'fs';
import path from 'path';

describe('WFM & Praxivo Labs Global Branding Verification', () => {
  const rootDir = path.resolve(__dirname, '../..');

  test('1. Web centralized branding module defines authoritative Praxivo Labs constants', () => {
    const webBrandingFile = path.join(rootDir, 'apps/web/lib/branding.ts');
    expect(fs.existsSync(webBrandingFile)).toBe(true);
    const content = fs.readFileSync(webBrandingFile, 'utf8');

    expect(content).toContain('PRODUCT_NAME: "WFM"');
    expect(content).toContain('BRAND_NAME: "Praxivo Labs"');
    expect(content).toContain('TAGLINE: "Turning Ideas into Intelligence"');
    expect(content).toContain('COPYRIGHT_TEXT: "© 2026 Praxivo Labs. All rights reserved."');
  });

  test('2. Mobile centralized branding module defines identical authoritative constants', () => {
    const mobileBrandingFile = path.join(rootDir, 'apps/mobile/lib/branding.ts');
    expect(fs.existsSync(mobileBrandingFile)).toBe(true);
    const content = fs.readFileSync(mobileBrandingFile, 'utf8');

    expect(content).toContain('PRODUCT_NAME: "WFM"');
    expect(content).toContain('BRAND_NAME: "Praxivo Labs"');
    expect(content).toContain('TAGLINE: "Turning Ideas into Intelligence"');
    expect(content).toContain('COPYRIGHT_TEXT: "© 2026 Praxivo Labs. All rights reserved."');
  });

  test('3. Web layout metadata uses WFM and Praxivo Labs branding', () => {
    const webLayoutFile = path.join(rootDir, 'apps/web/app/layout.tsx');
    const content = fs.readFileSync(webLayoutFile, 'utf8');

    expect(content).not.toContain('AHH WFM | Command Center');
    expect(content).toContain('BRANDING.PRODUCT_NAME');
    expect(content).toContain('BRANDING.DESCRIPTION');
  });

  test('4. Mobile layout metadata uses WFM and Praxivo Labs branding', () => {
    const mobileLayoutFile = path.join(rootDir, 'apps/mobile/app/layout.tsx');
    const content = fs.readFileSync(mobileLayoutFile, 'utf8');

    expect(content).not.toContain('Al Hattab Geo-Attendance System');
    expect(content).toContain('BRANDING.PRODUCT_NAME');
    expect(content).toContain('BRANDING.DESCRIPTION');
  });

  test('5. Web LayoutShell renders WFM header and Praxivo Labs footer', () => {
    const shellFile = path.join(rootDir, 'apps/web/components/layout-shell.tsx');
    const content = fs.readFileSync(shellFile, 'utf8');

    expect(content).not.toContain('© 2026 AHH WFM Enterprise. All rights reserved.');
    expect(content).toContain('BRANDING.PRODUCT_NAME');
    expect(content).toContain('BRANDING.COPYRIGHT_TEXT');
    expect(content).toContain('BRANDING.TAGLINE');
  });

  test('6. Web Login page displays WFM, Praxivo Labs, and exact tagline', () => {
    const loginFile = path.join(rootDir, 'apps/web/app/login/page.tsx');
    const content = fs.readFileSync(loginFile, 'utf8');

    expect(content).not.toContain('AHH WFM Secure Portal');
    expect(content).toContain('BRANDING.PRODUCT_NAME');
    expect(content).toContain('BRANDING.BRAND_NAME');
    expect(content).toContain('BRANDING.TAGLINE');
    expect(content).toContain('BRANDING.COPYRIGHT_TEXT');
  });

  test('7. Mobile Login page displays WFM, Praxivo Labs, and exact tagline', () => {
    const mobileLoginFile = path.join(rootDir, 'apps/mobile/app/login/page.tsx');
    const content = fs.readFileSync(mobileLoginFile, 'utf8');

    expect(content).not.toContain('Al Hattab Employee Portal');
    expect(content).toContain('BRANDING.PRODUCT_NAME');
    expect(content).toContain('BRANDING.BRAND_NAME');
    expect(content).toContain('BRANDING.TAGLINE');
    expect(content).toContain('BRANDING.COPYRIGHT_TEXT');
  });

  test('8. Mobile Profile page displays Praxivo Labs copyright and exact tagline', () => {
    const profileFile = path.join(rootDir, 'apps/mobile/app/profile/page.tsx');
    const content = fs.readFileSync(profileFile, 'utf8');

    expect(content).toContain('BRANDING.COPYRIGHT_TEXT');
    expect(content).toContain('BRANDING.TAGLINE');
    expect(content).toContain('BRANDING.PRODUCT_NAME');
  });

  test('9. Android display name is WFM and applicationId is unchanged', () => {
    const stringsFile = path.join(rootDir, 'apps/mobile/android/app/src/main/res/values/strings.xml');
    const content = fs.readFileSync(stringsFile, 'utf8');

    expect(content).toContain('<string name="app_name">WFM</string>');
    expect(content).toContain('<string name="title_activity_main">WFM</string>');
    expect(content).toContain('<string name="package_name">qa.alhattab.wfm.mobile</string>');
  });

  test('10. Capacitor appName is WFM and appId is unchanged', () => {
    const capFile = path.join(rootDir, 'apps/mobile/capacitor.config.ts');
    const content = fs.readFileSync(capFile, 'utf8');

    expect(content).toContain("appName: 'WFM'");
    expect(content).toContain("appId: 'qa.com.alhattab.ahhwfm'");
  });

  test('11. Mobile LocationService uses WFM without AHH WFM in user-facing strings', () => {
    const locFile = path.join(rootDir, 'apps/mobile/lib/location-service.ts');
    const content = fs.readFileSync(locFile, 'utf8');

    expect(content).not.toContain('AHH WFM');
    expect(content).toContain('WFM uses your location');
    expect(content).toContain('Apps -> WFM -> Permissions');
  });
});
