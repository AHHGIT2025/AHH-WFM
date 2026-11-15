import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = await request.json().catch(() => ({}));
    const { levelId, remarks } = payload;
    if (!levelId) {
      return NextResponse.json({ error: "Missing levelId" }, { status: 400 });
    }

    const resolvedEmployeeId = payload.employeeId || user.employeeId || user.id;

    const contract = await mockDb.rejectContractWorkflowLevel(
      params.id,
      levelId,
      resolvedEmployeeId,
      remarks,
      user
    );
    return NextResponse.json(contract);
  } catch (e: any) {
    const isSoDError = e.message?.includes("Segregation of Duties");
    const isAuthError = e.message?.includes("not authorized");
    return NextResponse.json(
      { error: e.message || "Failed to reject level" },
      { status: isSoDError || isAuthError ? 403 : 500 }
    );
  }
}
