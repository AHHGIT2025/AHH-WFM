import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { getAllowedOperationTypes } from "@/lib/server/master-data-service";

export async function GET(req: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const companyId = searchParams.get("companyId");
  const departmentId = searchParams.get("departmentId");

  if (!companyId) {
    return NextResponse.json({ success: false, error: "companyId is required" }, { status: 400 });
  }

  try {
    const allowed = await getAllowedOperationTypes({
      companyId,
      departmentId,
      userContext: {
        userId: auth.session?.user?.id,
        role: auth.session?.user?.role,
        operationAccess: auth.session?.user?.operationAccess
      }
    });

    return NextResponse.json({ success: true, data: allowed });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
