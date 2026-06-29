import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

export async function GET(request: Request) {
  const auth = await checkApiAuth(undefined, {
    requiredOperation: ["SECURITY_GUARDING", "FACILITY_MANAGEMENT"]
  });
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId") || undefined;
  const contractMaterialId = searchParams.get("contractMaterialId") || undefined;

  try {
    const list = await mockDb.getManpowerProjectMaterialAllocations(projectId, contractMaterialId);
    return NextResponse.json(list);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to fetch project material allocations" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await checkApiAuth(undefined, {
    requiredOperation: ["SECURITY_GUARDING", "FACILITY_MANAGEMENT"]
  });
  if (auth.error) return auth.error;

  try {
    const data = await request.json();
    if (!data.projectId || !data.contractMaterialId || data.quantityAllocated === undefined) {
      return NextResponse.json({ error: "Missing required fields (projectId, contractMaterialId, quantityAllocated)" }, { status: 400 });
    }
    const created = await mockDb.createManpowerProjectMaterialAllocation(data);
    return NextResponse.json(created);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to create project material allocation" }, { status: 500 });
  }
}
