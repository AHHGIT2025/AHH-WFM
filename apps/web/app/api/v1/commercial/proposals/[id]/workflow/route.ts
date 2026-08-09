import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "../../../../../../../lib/api-guards";
import { hasPermission } from "../../../../../../../lib/permissions";
import { generateProposalSnapshot } from "../../../../../../../lib/precontract-proposal";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const proposalId = params.id;
  const body = await req.json();
  const { action, remarks } = body;

  const validActions = ["SUBMIT", "APPROVE", "REJECT", "RETURN"];
  if (!action || !validActions.includes(action)) {
    return NextResponse.json(
      { error: `Invalid Workflow Action: Action must be one of: ${validActions.join(", ")}` },
      { status: 400 }
    );
  }

  let requiredPerm = "precontract.workflow.submit";
  if (action === "APPROVE" || action === "REJECT" || action === "RETURN") {
    requiredPerm = "precontract.workflow.approve";
  }

  const { session, error } = await checkApiAuth(undefined, { requiredPermission: requiredPerm });
  if (error || !session || !session.user) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as any;

  try {
    const proposal = await prisma.preContractProposal.findUnique({
      where: { id: proposalId },
      include: {
        case: { include: { prospectClient: true } },
        versions: {
          orderBy: { versionNumber: "desc" },
          take: 1
        }
      }
    });

    if (!proposal) {
      return NextResponse.json({ error: "Proposal not found." }, { status: 404 });
    }

    const currentVersion = proposal.versions[0];
    if (!currentVersion) {
      return NextResponse.json({ error: "Proposal version not found." }, { status: 404 });
    }

    let workflowInstance = await prisma.workflowInstance.findFirst({
      where: {
        referenceId: proposalId,
        moduleType: "PRE_CONTRACT_PROPOSAL"
      },
      include: { history: true }
    });

    if (action === "SUBMIT") {
      if (proposal.status === "IN_WORKFLOW") {
        return NextResponse.json({ error: "Invalid Action: Proposal is already in workflow approval." }, { status: 400 });
      }

      if (currentVersion.status === "APPROVED_INTERNAL" || currentVersion.status === "ISSUED_TO_CLIENT") {
        return NextResponse.json({ error: "Invalid Action: Approved or issued proposals cannot be resubmitted. Create a new revision." }, { status: 400 });
      }

      const template = await prisma.workflowTemplate.findFirst({
        where: {
          isActive: true,
          OR: [
            { moduleType: "PRE_CONTRACT_PROPOSAL" },
            { moduleType: "PRE_CONTRACT_COSTING" },
            { moduleType: "PRE_CONTRACT_CASE" }
          ],
          levels: { some: {} }
        },
        include: {
          levels: {
            orderBy: { levelNumber: "asc" },
            include: { approvers: true }
          }
        },
        orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }]
      });

      if (!template || !template.levels || template.levels.length === 0) {
        return NextResponse.json(
          { error: "Missing Workflow Configuration: No active workflow template configured under Settings > Workflow Setup for commercial proposals." },
          { status: 400 }
        );
      }

      if (workflowInstance) {
        workflowInstance = await prisma.workflowInstance.update({
          where: { id: workflowInstance.id },
          data: {
            templateId: template.id,
            status: "IN_PROGRESS",
            currentLevelNumber: 1,
            updatedAt: new Date()
          },
          include: { history: true }
        });
      } else {
        workflowInstance = await prisma.workflowInstance.create({
          data: {
            templateId: template.id,
            moduleType: "PRE_CONTRACT_PROPOSAL",
            referenceId: proposalId,
            status: "IN_PROGRESS",
            currentLevelNumber: 1,
            companyId: proposal.companyId,
            operationScope: proposal.operationType
          },
          include: { history: true }
        });
      }

      await prisma.workflowActionHistory.create({
        data: {
          instanceId: workflowInstance.id,
          levelNumber: 1,
          action: "SUBMIT",
          actedBy: user?.name || user?.email || user?.id || "USER",
          remarks: remarks?.trim() || "Submitted for commercial proposal approval."
        }
      });

      await prisma.preContractProposalVersion.update({
        where: { id: currentVersion.id },
        data: {
          status: "IN_WORKFLOW",
          workflowTemplateId: template.id,
          workflowInstanceId: workflowInstance.id,
          updatedAt: new Date()
        }
      });

      const updatedProposal = await prisma.preContractProposal.update({
        where: { id: proposalId },
        data: {
          status: "IN_WORKFLOW",
          updatedAt: new Date()
        },
        include: {
          case: { include: { prospectClient: true } },
          versions: { orderBy: { versionNumber: "desc" }, take: 1 }
        }
      });

      return NextResponse.json({
        proposal: updatedProposal,
        workflow: {
          instanceId: workflowInstance.id,
          action,
          status: "IN_PROGRESS",
          currentLevelNumber: 1
        }
      });
    }

    if (!workflowInstance || workflowInstance.status !== "IN_PROGRESS") {
      return NextResponse.json(
        { error: "Invalid Action: No active workflow in progress for this proposal." },
        { status: 400 }
      );
    }

    const template = await prisma.workflowTemplate.findUnique({
      where: { id: workflowInstance.templateId },
      include: {
        levels: {
          orderBy: { levelNumber: "asc" },
          include: { approvers: true }
        }
      }
    });

    const levels = template?.levels || [];
    const currentLevel = levels.find((l) => l.levelNumber === workflowInstance.currentLevelNumber);

    let isLevelApprover = false;
    if (!currentLevel || currentLevel.approvers.length === 0) {
      isLevelApprover = user.role === "SUPER_ADMIN" || user.role === "ADMIN" || hasPermission(user, "manpower.admin.full_access");
    } else {
      isLevelApprover = currentLevel.approvers.some((ap) => {
        if (ap.approverType === "SPECIFIC_EMPLOYEE" && ap.employeeId) return user.id === ap.employeeId;
        if (ap.approverType === "ROLE_BASED" && ap.roleName) return user.role === ap.roleName;
        return user.role === "SUPER_ADMIN" || user.role === "ADMIN" || hasPermission(user, "manpower.admin.full_access");
      });
      if (!isLevelApprover && (user.role === "SUPER_ADMIN" || hasPermission(user, "manpower.admin.full_access"))) {
        isLevelApprover = true;
      }
    }

    if (!isLevelApprover) {
      return NextResponse.json(
        { error: `Forbidden: You are not an authorized approver for Level ${workflowInstance.currentLevelNumber} of this proposal workflow.` },
        { status: 403 }
      );
    }

    if (action === "APPROVE" && currentVersion.createdBy === user.id && user.role !== "SUPER_ADMIN") {
      const isExplicitSelfApprover = currentLevel?.approvers.some(ap => ap.approverType === "SPECIFIC_EMPLOYEE" && ap.employeeId === user.id);
      if (!isExplicitSelfApprover) {
        return NextResponse.json(
          { error: "Forbidden: Segregation of Duties policy prohibits proposal preparer from self-approving." },
          { status: 403 }
        );
      }
    }

    let newProposalStatus = proposal.status;
    let newVersionStatus = currentVersion.status;
    let newWorkflowStatus = workflowInstance.status;
    let newCurrentLevelNumber = workflowInstance.currentLevelNumber;

    if (action === "APPROVE") {
      const nextLevel = levels.find((l) => l.levelNumber === workflowInstance.currentLevelNumber + 1);
      if (nextLevel) {
        newCurrentLevelNumber = nextLevel.levelNumber;
        newWorkflowStatus = "IN_PROGRESS";
        newProposalStatus = "IN_WORKFLOW";
        newVersionStatus = "IN_WORKFLOW";
      } else {
        newWorkflowStatus = "APPROVED";
        newProposalStatus = "APPROVED_INTERNAL";
        newVersionStatus = "APPROVED_INTERNAL";

        const { snapshotJson, checksum } = generateProposalSnapshot(proposal, currentVersion);

        await prisma.preContractProposalVersion.update({
          where: { id: currentVersion.id },
          data: {
            snapshotJson,
            snapshotChecksum: checksum,
            status: "APPROVED_INTERNAL"
          }
        });
      }
    } else if (action === "REJECT") {
      newWorkflowStatus = "REJECTED";
      newProposalStatus = "REJECTED";
      newVersionStatus = "REJECTED";
    } else if (action === "RETURN") {
      newWorkflowStatus = "REJECTED";
      newProposalStatus = "DRAFT";
      newVersionStatus = "DRAFT";
    }

    await prisma.workflowInstance.update({
      where: { id: workflowInstance.id },
      data: {
        status: newWorkflowStatus,
        currentLevelNumber: newCurrentLevelNumber,
        updatedAt: new Date()
      }
    });

    await prisma.workflowActionHistory.create({
      data: {
        instanceId: workflowInstance.id,
        levelNumber: workflowInstance.currentLevelNumber,
        action,
        actedBy: user?.name || user?.email || user?.id || "USER",
        remarks: remarks?.trim() || `Workflow action ${action} executed.`
      }
    });

    await prisma.preContractProposalVersion.update({
      where: { id: currentVersion.id },
      data: {
        status: newVersionStatus,
        updatedAt: new Date()
      }
    });

    const updatedProposal = await prisma.preContractProposal.update({
      where: { id: proposalId },
      data: {
        status: newProposalStatus,
        updatedAt: new Date()
      },
      include: {
        case: { include: { prospectClient: true } },
        versions: { orderBy: { versionNumber: "desc" }, take: 1 }
      }
    });

    return NextResponse.json({
      proposal: updatedProposal,
      workflow: {
        instanceId: workflowInstance.id,
        action,
        status: newWorkflowStatus,
        currentLevelNumber: newCurrentLevelNumber
      }
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to execute proposal workflow action." },
      { status: 500 }
    );
  }
}
