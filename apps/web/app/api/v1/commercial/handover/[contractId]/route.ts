import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "../../../../../../lib/api-guards";

const DEFAULT_MOBILIZATION_TASKS = [
  { id: "default-ops-1", taskName: "Operations Readiness & Site Inspection Review", department: "OPERATIONS", status: "PENDING", isDefault: true },
  { id: "default-log-1", taskName: "Uniform & Equipment Allocation Verification", department: "LOGISTICS", status: "PENDING", isDefault: true },
  { id: "default-hr-1", taskName: "HR, Guard Licensing & Gate Pass Clearance", department: "HR", status: "PENDING", isDefault: true },
  { id: "default-fin-1", taskName: "Finance Setup & Billing Schedule Confirmation", department: "FINANCE", status: "PENDING", isDefault: true }
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

    // Pure read-only checklist resolution without database mutations
    const storedChecklists = contract.mobilizationChecklists;
    const checklists = storedChecklists.length > 0 ? storedChecklists : DEFAULT_MOBILIZATION_TASKS;

    const totalTasks = checklists.length;
    const completedTasks = checklists.filter((t: any) => t.status === "COMPLETED" || t.status === "EXEMPTED").length;
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
