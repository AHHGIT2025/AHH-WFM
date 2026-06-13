import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

export async function GET(request: Request) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR", "EMPLOYEE"]);
  if (auth.error) return auth.error;

  const url = new URL(request.url);
  const date = url.searchParams.get("date") || new Date().toISOString().split("T")[0];

  try {
    const coverage = await mockDb.getDeploymentsCoverage(date);
    return NextResponse.json(coverage);
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch deployments coverage" }, { status: 500 });
  }
}
