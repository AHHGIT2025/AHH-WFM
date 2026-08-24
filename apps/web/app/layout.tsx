import type { Metadata } from "next";
import AuthProvider from "../components/auth-provider";
import { LayoutShell } from "../components/layout-shell";
import "./globals.css";

import { BRANDING } from "@/lib/branding";

export const metadata: Metadata = {
  title: `${BRANDING.PRODUCT_NAME} | Command Center`,
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
          <LayoutShell>{children}</LayoutShell>
        </AuthProvider>
      </body>
    </html>
  );
}
