import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    announcements: [
      { id: 1, title: "Public Holiday Notice", date: "2026-06-20", category: "Holiday", urgent: false },
      { id: 2, title: "New Geofence Policy Enabled", date: "2026-06-13", category: "Policy", urgent: true },
      { id: 3, title: "Project Alpha Site Update", date: "2026-06-10", category: "Project", urgent: false }
    ]
  });
}
