import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "../../../../../../lib/api-guards";
import { hasPermission } from "../../../../../../lib/permissions";

const DEFAULT_MOBILIZATION_TASKS = [
  { taskName: "Operations Readiness & Site Inspection Review", department: "OPERATIONS" },
  { taskName: "Uniform & Equipment Allocation Verification", department: "LOGISTICS" },
  { taskName: "HR, Guard Licensing & Gate Pass Clearance", department: "HR" },
  { taskName: "Finance Setup & Billing Schedule Confirmation", department: "FINANCE" }
];

export async function GET(
  req: NextRequest,
  { params }: { params: { contractId: string } }
) {
  const { session, error } = await checkApiAuth(undefined, {
    requiredPermission: "commercial.handover.view"
  });

  if (error || !session || !session.user) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as any;

  try {
    const contract = await prisma.manpowerContract.findUnique({
      where: { id: params.contractId },
      include: {
        client: true,
        projects: true,
        manpowerRequirements: true,
        mobilizationChecklists: {
          orderBy: { createdAt: "asc" }
        },
        handoverLogs: {
          orderBy: { createdAt: "desc" }
        }
      }
    });

    if (!contract) {
      return NextResponse.json({ error: "Contract not found." }, { status: 404 });
    }

    // Auto-seed default tasks if none exist
    let checklists = contract.mobilizationChecklists;
    if (checklists.length === 0) {
      checklists = await prisma.$transaction(
        DEFAULT_MOBILIZATION_TASKS.map(task =>
          prisma.contractMobilizationChecklist.create({
            data: {
              contractId: contract.id,
              taskName: task.taskName,
              department: task.department,
              status: "PENDING"
            }
          })
        )
      );
    }

    const totalTasks = checklists.length;
    const completedTasks = checklists.filter(t => t.status === "COMPLETED" || t.status === "EXEMPTED").length;
    const isReadyForHandover = totalTasks > 0 && completedTasks === totalTasks;

    return NextResponse.json({
      success: true,
      contract: {
        id: contract.id,
        contractNumber: contract.contractNumber,
        title: contract.title,
        status: contract.status,
        operationType: contract.operationType,
        mobilisationStatus: contract.mobilisationStatus,
        startDate: contract.startDate,
        endDate: contract.endDate,
        client: contract.client ? { id: contract.client.id, name: contract.client.name } : null,
        projectsCount: contract.projects.length,
        manpowerRequirementsCount: contract.manpowerRequirements.length
      },
      readiness: {
        totalTasks,
        completedTasks,
        completionPercentage: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
        isReadyForHandover
      },
      checklists,
      handoverLogs: contract.handoverLogs
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to fetch handover status." },
      { status: 400 }
    );
  }
}
