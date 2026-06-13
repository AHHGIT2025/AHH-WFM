import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { ReportService } from "@/lib/report-service";

export async function GET() {
  const auth = await checkApiAuth(["ADMIN", "HR", "FINANCE"]);
  if (auth.error) return auth.error;

  try {
    const data = await ReportService.getSapReport();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: "Failed to generate SAP report" }, { status: 500 });
  }
}
