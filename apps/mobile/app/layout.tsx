import type { Metadata } from "next";
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
        <MobileShell>{children}</MobileShell>
      </body>
    </html>
  );
}
