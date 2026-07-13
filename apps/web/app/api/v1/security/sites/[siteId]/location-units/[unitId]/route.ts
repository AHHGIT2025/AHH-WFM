import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { mockDb } from "@ahh-wfm/mock-data";

export async function PATCH(
  request: Request,
  { params }: { params: { siteId: string; unitId: string } }
) {
  const auth = await checkApiAuth(undefined, { requiredOperation: "SECURITY_GUARDING" });
  if (auth.error) return auth.error;

  const unitId = params.unitId;

  try {
    const body = await request.json();
    const { name, type, remarks, isActive, guardTourRequired, checkpointRequired, checkpointCount } = body;

    const payload: any = {};
    if (name !== undefined) payload.name = name;
    if (type !== undefined) payload.type = type;
    if (remarks !== undefined) payload.remarks = remarks;
    if (isActive !== undefined) payload.isActive = !!isActive;
    if (guardTourRequired !== undefined) payload.guardTourRequired = !!guardTourRequired;
    if (checkpointRequired !== undefined) payload.checkpointRequired = !!checkpointRequired;
    if (checkpointCount !== undefined) payload.checkpointCount = Number(checkpointCount || 0);

    const updatedUnit = await mockDb.updateManpowerLocationUnit(unitId, payload);
    if (!updatedUnit) {
      return NextResponse.json({ error: "Location unit not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      locationUnit: updatedUnit
    });
  } catch (error: any) {
    console.error("PATCH Location Unit Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { siteId: string; unitId: string } }
) {
  const auth = await checkApiAuth(undefined, { requiredOperation: "SECURITY_GUARDING" });
  if (auth.error) return auth.error;

  const unitId = params.unitId;

  try {
    const success = await mockDb.deleteManpowerLocationUnit(unitId);
    if (!success) {
      return NextResponse.json({ error: "Location unit not found or failed to delete" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Location unit deleted successfully"
    });
  } catch (error: any) {
    console.error("DELETE Location Unit Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
