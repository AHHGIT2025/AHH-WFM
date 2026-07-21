import { NextRequest, NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { getControlRoomIncrementalFeed } from "@/lib/secfac-sos-dispatch-service";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const operationTypeParam = searchParams.get("operationType") || "SECURITY_GUARDING";

    if (!["SECURITY_GUARDING", "FACILITY_MANAGEMENT"].includes(operationTypeParam)) {
      return NextResponse.json(
        { error: "Explicit valid operationType parameter ('SECURITY_GUARDING' or 'FACILITY_MANAGEMENT') is required." },
        { status: 400 }
      );
    }

    const auth = await checkApiAuth(undefined, {
      requiredOperation: operationTypeParam as any,
      requiredPermission: "secfac.controlroom.view"
    });
    if (auth.error) return auth.error;

    const updatedAfter = searchParams.get("updatedAfter") || undefined;
    const siteId = searchParams.get("siteId") || undefined;
    const companyId = searchParams.get("companyId") || undefined;
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const feed = await getControlRoomIncrementalFeed({
      operationType: operationTypeParam as any,
      updatedAfter,
      limit,
      siteId,
      companyId
    });

    return NextResponse.json(feed);
  } catch (e: any) {
    console.error("GET /api/v1/secfac/control-room/events error:", e);
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 });
  }
}
