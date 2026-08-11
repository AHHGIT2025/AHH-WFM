import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "../../../../../lib/api-guards";

export async function GET(req: NextRequest) {
  const { session, error } = await checkApiAuth(undefined, {
    requiredPermission: "commercial.task.view"
  });

  if (error || !session || !session.user) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as any;

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const priority = searchParams.get("priority");
    const contractId = searchParams.get("contractId");
    const prospectClientId = searchParams.get("prospectClientId");
    const preContractCaseId = searchParams.get("preContractCaseId");
    const operationType = searchParams.get("operationType");

    let companyId = user.companyId || undefined;
    if (user.role === "SUPER_ADMIN") {
      companyId = undefined;
    }

    const where: any = {};
    if (companyId) where.companyId = companyId;
    if (operationType && operationType !== "ALL") where.operationType = operationType;
    if (status && status !== "ALL") where.status = status;
    if (priority && priority !== "ALL") where.priority = priority;
    if (contractId) where.contractId = contractId;
    if (prospectClientId) where.prospectClientId = prospectClientId;
    if (preContractCaseId) where.preContractCaseId = preContractCaseId;

    const tasks = await prisma.commercialTask.findMany({
      where,
      orderBy: [
        { priority: "desc" },
        { dueAt: "asc" },
        { createdAt: "desc" }
      ]
    });

    return NextResponse.json({
      success: true,
      tasks
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to fetch commercial tasks." },
      { status: 400 }
    );
  }
}

export async function POST(req: NextRequest) {
  const { session, error } = await checkApiAuth(undefined, {
    requiredPermission: "commercial.task.manage"
  });

  if (error || !session || !session.user) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as any;

  try {
    const body = await req.json();
    const {
      title,
      description,
      dueAt,
      reminderAt,
      priority,
      assignedToId,
      assignedToName,
      prospectClientId,
      preContractCaseId,
      contractId,
      addendumId,
      renewalCaseId,
      operationType
    } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ error: "title is required." }, { status: 400 });
    }

    let targetCompanyId = user.companyId || null;
    let targetOperationType = operationType || "SECURITY_GUARDING";

    if (contractId) {
      const contract = await prisma.manpowerContract.findUnique({ where: { id: contractId } });
      if (!contract) return NextResponse.json({ error: "Referenced contract not found." }, { status: 404 });
      targetOperationType = contract.operationType;
    } else if (prospectClientId) {
      const client = await prisma.manpowerClient.findUnique({ where: { id: prospectClientId } });
      if (!client) return NextResponse.json({ error: "Referenced prospect client not found." }, { status: 404 });
      targetOperationType = client.operationType;
    } else if (preContractCaseId) {
      const pcase = await prisma.preContractCase.findUnique({ where: { id: preContractCaseId } });
      if (!pcase) return NextResponse.json({ error: "Referenced pre-contract case not found." }, { status: 404 });
      if (user.companyId && pcase.companyId && pcase.companyId !== user.companyId) {
        return NextResponse.json({ error: "Cross-company entity linkage prohibited." }, { status: 403 });
      }
      targetCompanyId = pcase.companyId || targetCompanyId;
      if (pcase.operationType) targetOperationType = pcase.operationType;
    }

    const task = await prisma.commercialTask.create({
      data: {
        title: title.trim(),
        description: description ? description.trim() : null,
        dueAt: dueAt ? new Date(dueAt) : null,
        reminderAt: reminderAt ? new Date(reminderAt) : null,
        priority: priority || "MEDIUM",
        status: "PENDING",
        assignedToId: assignedToId || user.id || "unassigned",
        assignedToName: assignedToName || user.name || "Commercial Officer",
        prospectClientId: prospectClientId || null,
        preContractCaseId: preContractCaseId || null,
        contractId: contractId || null,
        addendumId: addendumId || null,
        renewalCaseId: renewalCaseId || null,
        companyId: targetCompanyId,
        operationType: targetOperationType,
        createdById: user.id || "system",
        createdByName: user.name || "Commercial User"
      }
    });

    // Record UserActivityLog mutation audit
    await prisma.userActivityLog.create({
      data: {
        userId: user.id || "system",
        action: "CREATE_COMMERCIAL_TASK",
        entityType: "CommercialTask",
        entityId: task.id,
        afterJson: JSON.stringify({
          title,
          priority: task.priority,
          assignedToId: task.assignedToId,
          dueAt: task.dueAt
        })
      }
    });

    return NextResponse.json({
      success: true,
      task
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to create commercial task." },
      { status: 400 }
    );
  }
}
