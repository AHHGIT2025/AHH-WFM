import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { getHoldingCompany, setHoldingCompanyTransactional } from "@/lib/server/master-data-service";

export async function GET(req: Request) {
  const auth = await checkApiAuth(undefined, { requiredPermission: "settings.view" });
  if (auth.error) return auth.error;

  try {
    const holding = await getHoldingCompany();
    return NextResponse.json({ success: true, data: holding });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}

export async function POST(req: Request) {
  const auth = await checkApiAuth(undefined, { requiredPermission: "settings.manage" });
  if (auth.error) return auth.error;

  try {
    const body = await req.json();
    if (!body.companyId) {
      return NextResponse.json({ success: false, error: "companyId is required" }, { status: 400 });
    }

    const updated = await setHoldingCompanyTransactional(body.companyId, auth.session?.user?.id || "SYSTEM");
    return NextResponse.json({ success: true, data: updated });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
