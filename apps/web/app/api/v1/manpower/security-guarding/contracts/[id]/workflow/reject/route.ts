import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission, isAdminUser } from "@/lib/permissions";
import { checkContractCompanyAccess } from "@/lib/contract-company-auth";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth(undefined, { requiredOperation: "SECURITY_GUARDING" });
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (
    !hasPermission(user, "manpower.admin.full_access") &&
    !hasPermission(user, "manpower.security.manage") &&
    !hasPermission(user, "manpower.security.contracts.manage") &&
    !hasPermission(user, "precontract.workflow.reject") &&
    !hasPermission(user, "precontract.workflow.approve")
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const payload = await request.json().catch(() => ({}));
    const { levelId, employeeId, remarks } = payload;
    const sessionEmployeeId = user.employeeId || user.id;
    const isSuperAdmin = (user?.role || "").trim().toUpperCase().replace(/\s+/g, "_") === "SUPER_ADMIN";

    if (!levelId) {
      return NextResponse.json({ error: "Missing levelId" }, { status: 400 });
    }
    if (employeeId && employeeId !== sessionEmployeeId && !isSuperAdmin) {
      return NextResponse.json(
        { error: "Forbidden: Cannot spoof another employeeId for workflow rejection" },
        { status: 403 }
      );
    }

    const effectiveEmployeeId = sessionEmployeeId;
    if (!effectiveEmployeeId) {
      return NextResponse.json({ error: "Missing levelId or employeeId" }, { status: 400 });
    }

    const existingContract = await mockDb.getManpowerContract(params.id);
    if (!existingContract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }
    if (existingContract.operationType && existingContract.operationType !== "SECURITY_GUARDING") {
      return NextResponse.json(
        { error: "Forbidden: Contract belongs to a different operation scope" },
        { status: 403 }
      );
    }
    const companyErr = checkContractCompanyAccess(user, existingContract, {
      requireVerifiedOwnership: true,
    });
    if (companyErr) return companyErr;
    if (Array.isArray(existingContract.workflows) && existingContract.workflows.length > 0) {
      const matchingWorkflow = existingContract.workflows.find((wf: any) =>
        Array.isArray(wf.levels) && wf.levels.some((l: any) => l.id === levelId)
      );
      if (!matchingWorkflow) {
        return NextResponse.json(
          { error: "Forbidden: Workflow level does not belong to this contract" },
          { status: 403 }
        );
      }
    }

    const contract = await mockDb.rejectContractWorkflowLevel(
      params.id,
      levelId,
      effectiveEmployeeId,
      remarks,
      user
    );
    return NextResponse.json(contract);
  } catch (e: any) {
    const msg = e?.message || "Failed to reject level";
    const lower = msg.toLowerCase();
    const isSoDOrAuth = lower.includes("segregation of duties") || lower.includes("not authorized");
    const status = isSoDOrAuth
      ? 403
      : lower.includes("not found")
        ? 400
        : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
