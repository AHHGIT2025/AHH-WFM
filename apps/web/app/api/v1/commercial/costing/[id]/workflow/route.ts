import { NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission, isAdminUser } from "@/lib/permissions";
import { generateCostingSnapshot } from "@/lib/precontract-costing";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;
  const estimateId = params.id;

  try {
    const body = await request.json();
    const { action, remarks } = body; // "SUBMIT", "APPROVE", "REJECT", "RETURN"

    if (!action || !["SUBMIT", "APPROVE", "REJECT", "RETURN"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Allowed actions: SUBMIT, APPROVE, REJECT, RETURN." },
        { status: 400 }
      );
    }

    // 1. Permission Check
    const isAuthorized =
      isAdminUser(user) ||
      (action === "SUBMIT" && (hasPermission(user, "precontract.workflow.submit") || hasPermission(user, "precontract.costing.manage"))) ||
      (action !== "SUBMIT" && (hasPermission(user, "precontract.workflow.approve") || hasPermission(user, "precontract.workflow.review"))) ||
      hasPermission(user, "manpower.admin.full_access");

    if (!isAuthorized) {
      return NextResponse.json(
        { error: "Forbidden: You do not have permission to execute commercial costing workflow actions." },
        { status: 403 }
      );
    }

    const estimate = await prisma.preContractCostEstimate.findUnique({
      where: { id: estimateId },
      include: {
        versions: {
          orderBy: { versionNumber: "desc" },
          take: 1,
          include: { items: true }
        }
      }
    });

    if (!estimate) {
      return NextResponse.json({ error: "Costing estimate not found." }, { status: 404 });
    }

    // 2. Company Boundary Check
    if (user?.companyId && !isAdminUser(user) && !hasPermission(user, "precontract.costing.crossCompany") && estimate.companyId && estimate.companyId !== user.companyId) {
      return NextResponse.json({ error: "Forbidden: Company boundary violation." }, { status: 403 });
    }

    // 3. Operation Scope Check
    if (!isAdminUser(user) && !hasPermission(user, "manpower.admin.full_access")) {
      const allowedSG = user?.operationAccess?.allowedSecurityGuarding ?? true;
      const allowedFM = user?.operationAccess?.allowedFacilityManagement ?? true;

      if (estimate.operationType === "SECURITY_GUARDING" && !allowedSG) {
        return NextResponse.json({ error: "Forbidden: You do not have access to Security Guarding operational data." }, { status: 403 });
      }
      if (estimate.operationType === "FACILITY_MANAGEMENT" && !allowedFM) {
        return NextResponse.json({ error: "Forbidden: You do not have access to Facility Management operational data." }, { status: 403 });
      }
    }

    const currentVersion = estimate.versions[0];
    if (!currentVersion) {
      return NextResponse.json({ error: "No version found for this costing estimate." }, { status: 404 });
    }

    // 4. Resolve Central Workflow Instance
    let workflowInstance = await prisma.workflowInstance.findFirst({
      where: {
        referenceId: estimateId,
        moduleType: "PRE_CONTRACT_COSTING"
      },
      include: { history: true }
    });

    if (action === "SUBMIT") {
      if (estimate.status === "IN_WORKFLOW") {
        return NextResponse.json({ error: "Invalid Action: Costing estimate is already in workflow approval." }, { status: 400 });
      }

      // Mandatory Centralized Workflow Resolution from Settings > Workflow Setup
      const template = await prisma.workflowTemplate.findFirst({
        where: {
          isActive: true,
          OR: [
            { moduleType: "PRE_CONTRACT_COSTING" },
            { moduleType: "COMMERCIAL_COSTING" },
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
        orderBy: [
          { isDefault: "desc" },
          { createdAt: "desc" }
        ]
      });

      if (!template || !template.levels || template.levels.length === 0) {
        return NextResponse.json(
          { error: "Missing Workflow Configuration: No active workflow template configured under Settings > Workflow Setup for commercial costing." },
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
            moduleType: "PRE_CONTRACT_COSTING",
            referenceId: estimateId,
            status: "IN_PROGRESS",
            currentLevelNumber: 1,
            companyId: estimate.companyId,
            operationScope: estimate.operationType
          },
          include: { history: true }
        });
      }

      // Log SUBMIT action
      await prisma.workflowActionHistory.create({
        data: {
          instanceId: workflowInstance.id,
          levelNumber: 1,
          action: "SUBMIT",
          actedBy: user?.name || user?.email || user?.id || "USER",
          remarks: remarks?.trim() || "Submitted for commercial costing approval."
        }
      });

      // Update version & header projection
      await prisma.preContractCostEstimateVersion.update({
        where: { id: currentVersion.id },
        data: {
          status: "SUBMITTED",
          workflowTemplateId: template.id,
          workflowInstanceId: workflowInstance.id,
          updatedAt: new Date()
        }
      });

      const updatedEstimate = await prisma.preContractCostEstimate.update({
        where: { id: estimateId },
        data: {
          status: "IN_WORKFLOW",
          updatedAt: new Date()
        }
      });

      return NextResponse.json({
        estimate: updatedEstimate,
        workflow: {
          instanceId: workflowInstance.id,
          action: "SUBMIT",
          status: "IN_PROGRESS",
          currentLevelNumber: 1
        }
      });
    }

    // Processing APPROVE / REJECT / RETURN
    if (!workflowInstance || workflowInstance.status !== "IN_PROGRESS") {
      return NextResponse.json(
        { error: "Invalid Action: No active workflow instance in progress for this costing estimate." },
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

    // Approver Eligibility
    let isLevelApprover = false;
    if (!currentLevel || currentLevel.approvers.length === 0) {
      isLevelApprover = user.role === "SUPER_ADMIN" || user.role === "ADMIN" || hasPermission(user, "manpower.admin.full_access");
    } else {
      isLevelApprover = currentLevel.approvers.some((ap) => {
        if (ap.approverType === "SPECIFIC_EMPLOYEE" && ap.employeeId) {
          return user.id === ap.employeeId;
        }
        if (ap.approverType === "ROLE_BASED" && ap.roleName) {
          return user.role === ap.roleName;
        }
        return user.role === "SUPER_ADMIN" || user.role === "ADMIN" || hasPermission(user, "manpower.admin.full_access");
      });
      if (!isLevelApprover && (user.role === "SUPER_ADMIN" || hasPermission(user, "manpower.admin.full_access"))) {
        isLevelApprover = true;
      }
    }

    if (!isLevelApprover) {
      return NextResponse.json(
        { error: `Forbidden: You are not an authorized approver for Level ${workflowInstance.currentLevelNumber} of this costing workflow.` },
        { status: 403 }
      );
    }

    // Segregation of Duties (SoD) Check
    if (action === "APPROVE" && estimate.createdBy === user.id && user.role !== "SUPER_ADMIN") {
      const isExplicitSelfApprover = currentLevel?.approvers.some(ap => ap.approverType === "SPECIFIC_EMPLOYEE" && ap.employeeId === user.id);
      if (!isExplicitSelfApprover) {
        return NextResponse.json(
          { error: "Forbidden: Segregation of Duties policy prohibits costing preparer from self-approving." },
          { status: 403 }
        );
      }
    }

    let newEstimateStatus = estimate.status;
    let newVersionStatus = currentVersion.status;
    let newWorkflowStatus = workflowInstance.status;
    let newCurrentLevelNumber = workflowInstance.currentLevelNumber;

    if (action === "APPROVE") {
      const nextLevel = levels.find((l) => l.levelNumber === workflowInstance.currentLevelNumber + 1);
      if (nextLevel) {
        newCurrentLevelNumber = nextLevel.levelNumber;
        newWorkflowStatus = "IN_PROGRESS";
        newEstimateStatus = "IN_WORKFLOW";
        newVersionStatus = "SUBMITTED";
      } else {
        // Final Level Approved!
        newWorkflowStatus = "APPROVED";
        newEstimateStatus = "APPROVED";
        newVersionStatus = "APPROVED";

        // Generate SHA-256 snapshot
        const { snapshotJson, checksum } = generateCostingSnapshot(
          estimate,
          currentVersion,
          currentVersion.items
        );

        await prisma.preContractCostEstimateVersion.update({
          where: { id: currentVersion.id },
          data: {
            snapshotJson,
            checksum,
            status: "APPROVED"
          }
        });
      }
    } else if (action === "REJECT") {
      newWorkflowStatus = "REJECTED";
      newEstimateStatus = "REJECTED";
      newVersionStatus = "REJECTED";
    } else if (action === "RETURN") {
      newWorkflowStatus = "REJECTED";
      newEstimateStatus = "DRAFT";
      newVersionStatus = "DRAFT";
    }

    // Update WorkflowInstance & Action History
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

    await prisma.preContractCostEstimateVersion.update({
      where: { id: currentVersion.id },
      data: {
        status: newVersionStatus,
        updatedAt: new Date()
      }
    });

    const updatedEstimate = await prisma.preContractCostEstimate.update({
      where: { id: estimateId },
      data: {
        status: newEstimateStatus,
        updatedAt: new Date()
      },
      include: {
        versions: {
          orderBy: { versionNumber: "desc" },
          include: { items: true, overrides: true }
        }
      }
    });

    return NextResponse.json({
      estimate: updatedEstimate,
      workflow: {
        instanceId: workflowInstance.id,
        action,
        status: newWorkflowStatus,
        currentLevelNumber: newCurrentLevelNumber
      }
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to execute costing workflow action." },
      { status: 500 }
    );
  }
}
