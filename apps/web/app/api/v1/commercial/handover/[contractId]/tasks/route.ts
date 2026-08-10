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

    if (taskId) {
      // Update existing task
      const updatedTask = await prisma.contractMobilizationChecklist.update({
        where: { id: taskId },
        data: {
          status: status || undefined,
          assignedToId: assignedToId !== undefined ? assignedToId : undefined,
          remarks: remarks !== undefined ? remarks : undefined,
          completedAt: status === "COMPLETED" ? new Date() : (status ? null : undefined),
          completedBy: status === "COMPLETED" ? (user.id || "user") : (status ? null : undefined)
        }
      });

      return NextResponse.json({
        success: true,
        task: updatedTask
      });
    } else {
      // Create new custom task
      if (!taskName) {
        return NextResponse.json({ error: "taskName is required for new task creation." }, { status: 400 });
      }

      const newTask = await prisma.contractMobilizationChecklist.create({
        data: {
          contractId: contract.id,
          taskName,
          department: department || "OPERATIONS",
          status: status || "PENDING",
          assignedToId: assignedToId || null,
          remarks: remarks || null
        }
      });

      return NextResponse.json({
        success: true,
        task: newTask
      });
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to update mobilization task." },
      { status: 400 }
    );
  }
}
