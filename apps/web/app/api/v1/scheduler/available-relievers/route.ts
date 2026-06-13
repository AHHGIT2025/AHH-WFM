import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

export async function GET(request: Request) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR", "EMPLOYEE"]);
  if (auth.error) return auth.error;

  const url = new URL(request.url);
  const date = url.searchParams.get("date") || undefined;
  const designationId = url.searchParams.get("designationId") || undefined;
  const tradeClassificationId = url.searchParams.get("tradeClassificationId") || undefined;
  const projectId = url.searchParams.get("projectId") || undefined;
  const siteId = url.searchParams.get("siteId") || undefined;

  try {
    const relievers = await mockDb.getAvailableRelievers({
      date,
      designationId,
      tradeClassificationId,
      projectId,
      siteId
    });
    return NextResponse.json(relievers);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to fetch available relievers" }, { status: 500 });
  }
}
