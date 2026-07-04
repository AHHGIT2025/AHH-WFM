import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  try {
    const payload = await request.json();
    const { levelId, employeeId, remarks } = payload;
    if (!levelId || !employeeId) {
      return NextResponse.json({ error: "Missing levelId or employeeId" }, { status: 400 });
    }
    
    const contract = await mockDb.approveContractWorkflowLevel(params.id, levelId, employeeId, remarks);
    return NextResponse.json(contract);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to approve level" }, { status: 500 });
  }
}
