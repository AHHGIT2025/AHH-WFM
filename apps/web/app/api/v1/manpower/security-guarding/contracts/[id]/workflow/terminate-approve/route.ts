import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission, isAdminUser } from "@/lib/permissions";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth(undefined, { requiredOperation: "SECURITY_GUARDING" });
  if (auth.error) return auth.error;

  const user = auth.session?.user;
  if (
    !hasPermission(user, "manpower.admin.full_access") &&
    !hasPermission(user, "manpower.security.manage") &&
    !hasPermission(user, "manpower.security.contracts.manage")
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const payload = await request.json();
    const { levelId, employeeId, remarks } = payload;
    const sessionEmployeeId = (user as any)?.employeeId || user?.id;
    const isSuperAdmin = (user?.role || "").trim().toUpperCase().replace(/\s+/g, "_") === "SUPER_ADMIN";

    if (!levelId) {
      return NextResponse.json({ error: "Level ID is required" }, { status: 400 });
    }
    if (employeeId && employeeId !== sessionEmployeeId && !isSuperAdmin) {
      return NextResponse.json(
        { error: "Forbidden: Cannot spoof another employeeId for termination workflow approval" },
        { status: 403 }
      );
    }

    const effectiveEmployeeId = isSuperAdmin ? (employeeId || sessionEmployeeId) : sessionEmployeeId;
    if (!effectiveEmployeeId) {
      return NextResponse.json({ error: "Level ID and Employee ID are required" }, { status: 400 });
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
      const submittedBy = (matchingWorkflow.submittedBy || existingContract.terminationRequestedBy || "").trim().toLowerCase();
      const callerIdentifiers = [
        sessionEmployeeId,
        user?.id,
        user?.name,
        user?.email
      ]
        .filter(Boolean)
        .map((v: any) => String(v).trim().toLowerCase());
      if (submittedBy && callerIdentifiers.includes(submittedBy) && !isSuperAdmin) {
        return NextResponse.json(
          { error: "Forbidden: Maker/Checker Segregation of Duties prevents self-approval of submitted termination workflow" },
          { status: 403 }
        );
      }
    }

    const contract = await mockDb.approveContractWorkflowLevel(params.id, levelId, effectiveEmployeeId, remarks);
    return NextResponse.json(contract);
  } catch (e: any) {
    const msg = e?.message || "Failed to approve termination workflow level";
    const lower = msg.toLowerCase();
    const status = lower.includes("not authorized")
      ? 403
      : lower.includes("previous level") || lower.includes("not found")
        ? 400
        : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
