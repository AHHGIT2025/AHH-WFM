import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

export async function GET(request: Request) {
  const auth = await checkApiAuth(undefined, {
    requiredOperation: ["SECURITY_GUARDING", "FACILITY_MANAGEMENT"]
  });
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const contractId = searchParams.get("contractId") || undefined;

  try {
    const list = await mockDb.getManpowerContractMaterials(contractId);
    return NextResponse.json(list);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to fetch contract materials" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await checkApiAuth(undefined, {
    requiredOperation: ["SECURITY_GUARDING", "FACILITY_MANAGEMENT"]
  });
  if (auth.error) return auth.error;

  try {
    const data = await request.json();
    if (!data.contractId || !data.materialName || data.quantityRequired === undefined) {
      return NextResponse.json({ error: "Missing required fields (contractId, materialName, quantityRequired)" }, { status: 400 });
    }
    const created = await mockDb.createManpowerContractMaterial(data);
    return NextResponse.json(created);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to create contract material" }, { status: 500 });
  }
}
