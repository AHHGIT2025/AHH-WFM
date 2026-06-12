import type { Metadata } from "next";
import AuthProvider from "../components/auth-provider";
import { MobileShell } from "../components/mobile-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Al Hattab Geo-Attendance System",
  description: "Al Hattab Holding Employee Portal & Real-time Location Attendance Tracker",
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
          <MobileShell>{children}</MobileShell>
        </AuthProvider>
      </body>
    </html>
  );
}
