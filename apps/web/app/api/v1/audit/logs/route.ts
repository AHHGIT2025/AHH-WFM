import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { mockDb } from "@ahh-wfm/mock-data";

export async function GET() {
  const auth = await checkApiAuth(["ADMIN"]);
  if (auth.error) return auth.error;

  try {
    const logs = await mockDb.getUserActivityLogs();
    return NextResponse.json(logs);
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch user activity logs" }, { status: 500 });
  }
}
