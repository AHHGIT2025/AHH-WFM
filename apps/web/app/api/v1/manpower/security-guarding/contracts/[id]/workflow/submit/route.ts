import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission } from "@/lib/permissions";
import { checkContractCompanyAccess } from "@/lib/contract-company-auth";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth(undefined, { requiredOperation: "SECURITY_GUARDING" });
  if (auth.error) return auth.error;

  if (!hasPermission(auth.session?.user, "manpower.admin.full_access") &&
      !hasPermission(auth.session?.user, "manpower.security.manage") &&
      !hasPermission(auth.session?.user, "manpower.security.contracts.manage") &&
      !hasPermission(auth.session?.user, "precontract.workflow.submit") &&
      !hasPermission(auth.session?.user, "precontract.contractConversion.execute") &&
      !hasPermission(auth.session?.user, "commercial.opportunities.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const user = auth.session?.user as any;
    const existingContract = await mockDb.getManpowerContract(params.id);
    if (!existingContract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }
    if (existingContract.operationType && existingContract.operationType !== "SECURITY_GUARDING") {
      return NextResponse.json({ error: "Forbidden: Contract belongs to a different operation scope" }, { status: 403 });
    }
    const companyErr = checkContractCompanyAccess(user, existingContract, {
      requireVerifiedOwnership: true,
    });
    if (companyErr) return companyErr;

    const submittedBy = user?.name || user?.email || "System";
    const submittedById = user?.id || user?.employeeId || null;
    const contract = await mockDb.submitContractWorkflow(params.id, submittedBy, submittedById);
    return NextResponse.json(contract);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to submit workflow" }, { status: 500 });
  }
}
