import type { Metadata } from "next";
import { LayoutShell } from "../components/layout-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "AHH WFM | Command Center",
  description: "Enterprise Workforce Management Command Center & SAP SuccessFactors Sync Hub",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <LayoutShell>{children}</LayoutShell>
      </body>
    </html>
  );
}
