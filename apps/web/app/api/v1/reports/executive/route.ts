import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { ReportService } from "@/lib/report-service";

export async function GET(request: Request) {
  const auth = await checkApiAuth(["ADMIN", "HR", "FINANCE"]);
  if (auth.error) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || undefined;
    const data = await ReportService.getExecutiveSummary(period);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: "Failed to generate executive report" }, { status: 500 });
  }
}
