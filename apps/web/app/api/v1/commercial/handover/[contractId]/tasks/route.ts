import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "../../../../../../../lib/api-guards";

export async function POST(
  req: NextRequest,
  { params }: { params: { contractId: string } }
) {
  const { session, error } = await checkApiAuth(undefined, {
    requiredPermission: "commercial.handover.manage"
  });

  if (error || !session || !session.user) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as any;

  try {
    const contract = await prisma.manpowerContract.findUnique({
      where: { id: params.contractId }
    });

    if (!contract) {
      return NextResponse.json({ error: "Contract not found." }, { status: 404 });
    }

    const body = await req.json();
    const { taskId, taskName, department, status, assignedToId, remarks } = body;

    let updatedTask;

    if (taskId && !taskId.startsWith("default-")) {
      // Update existing persistent task
      updatedTask = await prisma.contractMobilizationChecklist.update({
        where: { id: taskId },
        data: {
          status: status || undefined,
          assignedToId: assignedToId !== undefined ? assignedToId : undefined,
          remarks: remarks !== undefined ? remarks : undefined,
          completedAt: status === "COMPLETED" ? new Date() : (status ? null : undefined),
          completedBy: status === "COMPLETED" ? (user.id || "user") : (status ? null : undefined)
        }
      });
    } else {
      // Create new persistent task (or persist a default task being completed)
      const nameToUse = taskName || (taskId === "default-ops-1" ? "Operations Readiness & Site Inspection Review" :
                        taskId === "default-log-1" ? "Uniform & Equipment Allocation Verification" :
                        taskId === "default-hr-1" ? "HR, Guard Licensing & Gate Pass Clearance" :
                        taskId === "default-fin-1" ? "Finance Setup & Billing Schedule Confirmation" : "Mobilization Task");

      const deptToUse = department || (taskId === "default-ops-1" ? "OPERATIONS" :
                         taskId === "default-log-1" ? "LOGISTICS" :
                         taskId === "default-hr-1" ? "HR" :
                         taskId === "default-fin-1" ? "FINANCE" : "OPERATIONS");

      updatedTask = await prisma.contractMobilizationChecklist.create({
        data: {
          contractId: contract.id,
          taskName: nameToUse,
          department: deptToUse,
          status: status || "COMPLETED",
          assignedToId: assignedToId || null,
          remarks: remarks || null,
          completedAt: (status === "COMPLETED" || !status) ? new Date() : null,
          completedBy: (status === "COMPLETED" || !status) ? (user.id || "user") : null
        }
      });
    }

    return NextResponse.json({
      success: true,
      task: updatedTask
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to update mobilization task." },
      { status: 400 }
    );
  }
}
