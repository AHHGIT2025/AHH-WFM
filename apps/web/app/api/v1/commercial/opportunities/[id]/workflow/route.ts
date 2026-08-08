import { NextResponse } from "next/server";
import { prisma, PreContractLifecycle } from "@ahh-wfm/database";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission, isAdminUser } from "@/lib/permissions";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;
  const caseId = params.id;

  try {
    const body = await request.json();
    const { action, remarks } = body; // action: "SUBMIT", "APPROVE", "REJECT", "RETURN"

    if (!action || !["SUBMIT", "APPROVE", "REJECT", "RETURN"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Allowed actions: SUBMIT, APPROVE, REJECT, RETURN." },
        { status: 400 }
      );
    }

    // 1. Pre-Contract Workflow Permission Check
    const isAuthorized =
      isAdminUser(user) ||
      (action === "SUBMIT" && (hasPermission(user, "precontract.workflow.submit") || hasPermission(user, "precontract.case.manage"))) ||
      (action !== "SUBMIT" && (hasPermission(user, "precontract.workflow.approve") || hasPermission(user, "precontract.workflow.review"))) ||
      hasPermission(user, "manpower.admin.full_access");

    if (!isAuthorized) {
      return NextResponse.json(
        { error: "Forbidden: You do not have permission to execute commercial opportunity workflow actions." },
        { status: 403 }
      );
    }

    const opportunityCase = await prisma.preContractCase.findUnique({
      where: { id: caseId }
    });

    if (!opportunityCase) {
      return NextResponse.json(
        { error: "Opportunity case not found." },
        { status: 404 }
      );
    }

    // 2. Company Boundary Check
    if (user?.companyId && !isAdminUser(user) && opportunityCase.companyId && opportunityCase.companyId !== user.companyId) {
      return NextResponse.json({ error: "Forbidden: Company boundary violation." }, { status: 403 });
    }

    // 3. SG / FM Scope Isolation Check
    if (!isAdminUser(user) && !hasPermission(user, "manpower.admin.full_access")) {
      const userAllowedSG = user?.operationAccess?.allowedSecurityGuarding ?? true;
      const userAllowedFM = user?.operationAccess?.allowedFacilityManagement ?? true;

      if (opportunityCase.operationType === "SECURITY_GUARDING" && !userAllowedSG) {
        return NextResponse.json(
          { error: "Forbidden: You do not have access to Security Guarding operational data." },
          { status: 403 }
        );
      }
      if (opportunityCase.operationType === "FACILITY_MANAGEMENT" && !userAllowedFM) {
        return NextResponse.json(
          { error: "Forbidden: You do not have access to Facility Management operational data." },
          { status: 403 }
        );
      }
    }

    // 4. Resolve Central Workflow Instance & Template Configured in Settings > Workflow Setup
    let workflowInstance = await prisma.workflowInstance.findFirst({
      where: {
        referenceId: caseId,
        moduleType: "PRE_CONTRACT_CASE"
      },
      include: { history: true }
    });

    if (action === "SUBMIT") {
      if (opportunityCase.lifecycle === "IN_WORKFLOW") {
        return NextResponse.json(
          { error: "Invalid Action: Opportunity is already in workflow approval." },
          { status: 400 }
        );
      }

      // Mandatory Centralized Workflow Resolution from Settings > Workflow Setup
      const template = await prisma.workflowTemplate.findFirst({
        where: {
          isActive: true,
          OR: [
            { moduleType: "PRE_CONTRACT_CASE" },
            { moduleType: "COMMERCIAL_OPPORTUNITY" }
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

      // Reject submission if no active workflow template with levels is configured
      if (!template || !template.levels || template.levels.length === 0) {
        return NextResponse.json(
          { error: "Missing Workflow Configuration: No active workflow template configured under Settings > Workflow Setup for commercial opportunity cases." },
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
            moduleType: "PRE_CONTRACT_CASE",
            referenceId: caseId,
            status: "IN_PROGRESS",
            currentLevelNumber: 1,
            companyId: opportunityCase.companyId,
            operationScope: opportunityCase.operationType
          },
          include: { history: true }
        });
      }

      // Log SUBMIT in immutable WorkflowActionHistory
      await prisma.workflowActionHistory.create({
        data: {
          instanceId: workflowInstance.id,
          levelNumber: 1,
          action: "SUBMIT",
          actedBy: user?.name || user?.email || user?.id || "USER",
          remarks: remarks?.trim() || "Submitted for commercial governance approval."
        }
      });

      const updatedCase = await prisma.preContractCase.update({
        where: { id: caseId },
        data: {
          lifecycle: "IN_WORKFLOW",
          workflowInstanceId: workflowInstance.id,
          workflowTemplateId: template.id,
          updatedAt: new Date()
        }
      });

      return NextResponse.json({
        case: updatedCase,
        workflow: {
          instanceId: workflowInstance.id,
          action: "SUBMIT",
          status: "IN_PROGRESS",
          currentLevelNumber: 1,
          actedBy: user?.name || user?.email
        }
      });
    }

    // 5. Processing APPROVE / REJECT / RETURN Actions
    if (!workflowInstance || workflowInstance.status !== "IN_PROGRESS") {
      return NextResponse.json(
        { error: "Invalid Action: No active workflow instance in progress for this opportunity." },
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

    // Validate Approver Role / Employee Eligibility at current level
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
        if (ap.approverType === "DEPT_HEAD" || ap.approverType === "CONTRACT_ADMIN") {
          return user.role === "SUPER_ADMIN" || user.role === "ADMIN" || hasPermission(user, "manpower.admin.full_access");
        }
        return false;
      });

      // Super Admin explicit override if configured
      if (!isLevelApprover && (user.role === "SUPER_ADMIN" || hasPermission(user, "manpower.admin.full_access"))) {
        isLevelApprover = true;
      }
    }

    if (!isLevelApprover) {
      return NextResponse.json(
        { error: `Forbidden: You are not an authorized approver for Level ${workflowInstance.currentLevelNumber} (${currentLevel?.levelName || "Approval"}) of this workflow.` },
        { status: 403 }
      );
    }

    // Segregation of Duties (SoD): Requester cannot self-approve unless explicitly authorized in level approvers
    if (action === "APPROVE" && opportunityCase.createdBy === user.id && user.role !== "SUPER_ADMIN") {
      const isExplicitSelfApprover = currentLevel?.approvers.some(ap => ap.approverType === "SPECIFIC_EMPLOYEE" && ap.employeeId === user.id);
      if (!isExplicitSelfApprover) {
        return NextResponse.json(
          { error: "Forbidden: Segregation of Duties policy prohibits opportunity requester from self-approving." },
          { status: 403 }
        );
      }
    }

    let newCaseLifecycle: PreContractLifecycle = opportunityCase.lifecycle;
    let newWorkflowStatus = workflowInstance.status;
    let newCurrentLevelNumber = workflowInstance.currentLevelNumber;

    if (action === "APPROVE") {
      const nextLevel = levels.find((l) => l.levelNumber === workflowInstance.currentLevelNumber + 1);

      if (nextLevel) {
        // Multi-level Progression: Advance to next level; case lifecycle REMAINS IN_WORKFLOW!
        newCurrentLevelNumber = nextLevel.levelNumber;
        newWorkflowStatus = "IN_PROGRESS";
        newCaseLifecycle = "IN_WORKFLOW";
      } else {
        // Final Level Approved: Transition case lifecycle to COMPLETED (Won/Approved)
        newWorkflowStatus = "APPROVED";
        newCaseLifecycle = "COMPLETED";
      }
    } else if (action === "RETURN") {
      newWorkflowStatus = "RETURNED";
      newCurrentLevelNumber = 1;
      newCaseLifecycle = "DRAFT";
    } else if (action === "REJECT") {
      newWorkflowStatus = "REJECTED";
      newCaseLifecycle = "CANCELLED";
    }

    // Record Immutable WorkflowActionHistory Entry
    await prisma.workflowActionHistory.create({
      data: {
        instanceId: workflowInstance.id,
        levelNumber: workflowInstance.currentLevelNumber,
        action,
        actedBy: user?.name || user?.email || user?.id || "USER",
        remarks: remarks?.trim() || `Workflow level ${workflowInstance.currentLevelNumber} action ${action} executed.`
      }
    });

    // Update WorkflowInstance State
    await prisma.workflowInstance.update({
      where: { id: workflowInstance.id },
      data: {
        status: newWorkflowStatus,
        currentLevelNumber: newCurrentLevelNumber,
        updatedAt: new Date()
      }
    });

    // Update Opportunity Case State
    const updatedCase = await prisma.preContractCase.update({
      where: { id: caseId },
      data: {
        lifecycle: newCaseLifecycle,
        businessOutcome: newCaseLifecycle === "COMPLETED" ? "WON" : newCaseLifecycle === "CANCELLED" ? "LOST" : opportunityCase.businessOutcome,
        updatedAt: new Date()
      }
    });

    return NextResponse.json({
      case: updatedCase,
      workflow: {
        instanceId: workflowInstance.id,
        action,
        status: newWorkflowStatus,
        currentLevelNumber: newCurrentLevelNumber,
        actedBy: user?.name || user?.email,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error("COMMERCIAL OPPORTUNITIES WORKFLOW ERROR:", error);
    return NextResponse.json(
      { error: error.message || "Failed to execute workflow action." },
      { status: 500 }
    );
  }
}
