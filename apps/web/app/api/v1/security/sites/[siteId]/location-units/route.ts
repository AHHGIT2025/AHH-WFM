import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { mockDb } from "@ahh-wfm/mock-data";

export async function GET(
  request: Request,
  { params }: { params: { siteId: string } }
) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const siteId = params.siteId;

  try {
    const units = await mockDb.getManpowerLocationUnits("SECURITY_GUARDING");
    const siteUnits = units.filter((u: any) => u.siteId === siteId);
    
    return NextResponse.json({
      success: true,
      locationUnits: siteUnits
    });
  } catch (error: any) {
    console.error("GET Location Units Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: { siteId: string } }
) {
  const auth = await checkApiAuth(undefined, { requiredOperation: "SECURITY_GUARDING" });
  if (auth.error) return auth.error;

  const siteId = params.siteId;

  try {
    const body = await request.json();
    const { name, type, remarks, guardTourRequired, checkpointRequired, checkpointCount } = body;

    if (!name || !type) {
      return NextResponse.json({ error: "Name and type are required" }, { status: 400 });
    }

    const payload = {
      siteId,
      name,
      type,
      remarks: remarks || "",
      operationType: "SECURITY_GUARDING",
      isActive: true,
      guardTourRequired: !!guardTourRequired,
      checkpointRequired: !!checkpointRequired,
      checkpointCount: type === "POST" ? Number(checkpointCount || 0) : 0
    };

    const newUnit = await mockDb.createManpowerLocationUnit(payload);

    return NextResponse.json({
      success: true,
      locationUnit: newUnit
    });
  } catch (error: any) {
    console.error("POST Location Unit Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
