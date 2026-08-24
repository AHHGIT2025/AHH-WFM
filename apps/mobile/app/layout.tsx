import type { Metadata } from "next";
import AuthProvider from "../components/auth-provider";
import { MobileShell } from "../components/mobile-shell";
import SecfacSessionInitializer from "../components/secfac-session-initializer";
import { BRANDING } from "../lib/branding";
import "./globals.css";

export const metadata: Metadata = {
  title: BRANDING.PRODUCT_NAME,
  description: BRANDING.DESCRIPTION,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AuthProvider>
          <SecfacSessionInitializer />
          <MobileShell>{children}</MobileShell>
        </AuthProvider>
      </body>
    </html>
  );
}
