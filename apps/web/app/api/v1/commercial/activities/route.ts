import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "../../../../../lib/api-guards";

export async function GET(req: NextRequest) {
  const { session, error } = await checkApiAuth(undefined, {
    requiredPermission: "commercial.activity.view"
  });

  if (error || !session || !session.user) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as any;

  try {
    const { searchParams } = new URL(req.url);
    const activityType = searchParams.get("activityType");
    const prospectClientId = searchParams.get("prospectClientId");
    const preContractCaseId = searchParams.get("preContractCaseId");
    const contractId = searchParams.get("contractId");
    const addendumId = searchParams.get("addendumId");
    const renewalCaseId = searchParams.get("renewalCaseId");
    const operationType = searchParams.get("operationType");
    const feedMode = searchParams.get("feedMode") === "true";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    let companyId = user.companyId || undefined;
    if (user.role === "SUPER_ADMIN") {
      companyId = undefined;
    }

    const where: any = {};
    if (companyId) where.companyId = companyId;
    if (operationType && operationType !== "ALL") where.operationType = operationType;
    if (activityType && activityType !== "ALL") where.activityType = activityType;
    if (prospectClientId) where.prospectClientId = prospectClientId;
    if (preContractCaseId) where.preContractCaseId = preContractCaseId;
    if (contractId) where.contractId = contractId;
    if (addendumId) where.addendumId = addendumId;
    if (renewalCaseId) where.renewalCaseId = renewalCaseId;

    // Fetch stored commercial activity records
    const activities = await prisma.commercialActivity.findMany({
      where,
      orderBy: { interactionDate: "desc" },
      skip: (page - 1) * limit,
      take: limit
    });

    const totalActivities = await prisma.commercialActivity.count({ where });

    if (!feedMode) {
      return NextResponse.json({
        success: true,
        activities,
        pagination: {
          page,
          limit,
          total: totalActivities,
          totalPages: Math.ceil(totalActivities / limit)
        }
      });
    }

    // Hybrid Feed Aggregation: Activities + Tasks + Workflow History
    const taskWhere: any = {};
    if (companyId) taskWhere.companyId = companyId;
    if (operationType && operationType !== "ALL") taskWhere.operationType = operationType;
    if (prospectClientId) taskWhere.prospectClientId = prospectClientId;
    if (preContractCaseId) taskWhere.preContractCaseId = preContractCaseId;
    if (contractId) taskWhere.contractId = contractId;
    if (addendumId) taskWhere.addendumId = addendumId;
    if (renewalCaseId) taskWhere.renewalCaseId = renewalCaseId;

    const tasks = await prisma.commercialTask.findMany({
      where: taskWhere,
      orderBy: { createdAt: "desc" },
      take: 10
    });

    // Format items into unified feed structure
    const activityFeedItems = activities.map((act) => ({
      id: `ACT-${act.id}`,
      feedType: "ACTIVITY",
      activityType: act.activityType,
      title: act.subject,
      description: act.notes,
      timestamp: act.interactionDate,
      actorName: act.createdByName || "Commercial User",
      metadata: {
        direction: act.direction,
        phoneNumber: act.phoneNumber,
        durationMinutes: act.durationMinutes,
        callOutcome: act.callOutcome,
        meetingLocation: act.meetingLocation,
        meetingLink: act.meetingLink,
        attendees: act.attendees,
        externalProvider: act.externalProvider,
        externalItemId: act.externalItemId,
        externalWebLink: act.externalWebLink
      }
    }));

    const taskFeedItems = tasks.map((t) => ({
      id: `TASK-${t.id}`,
      feedType: "TASK",
      activityType: "TASK",
      title: `Task: ${t.title}`,
      description: t.description,
      timestamp: t.createdAt,
      actorName: t.createdByName || "Commercial System",
      metadata: {
        taskId: t.id,
        status: t.status,
        priority: t.priority,
        assignedToName: t.assignedToName,
        dueAt: t.dueAt,
        completedAt: t.completedAt
      }
    }));

    const combinedFeed = [...activityFeedItems, ...taskFeedItems].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return NextResponse.json({
      success: true,
      feed: combinedFeed,
      pagination: {
        page,
        limit,
        total: totalActivities + tasks.length,
        totalPages: Math.ceil((totalActivities + tasks.length) / limit)
      }
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to fetch commercial activities." },
      { status: 400 }
    );
  }
}

export async function POST(req: NextRequest) {
  const { session, error } = await checkApiAuth(undefined, {
    requiredPermission: "commercial.activity.manage"
  });

  if (error || !session || !session.user) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as any;

  try {
    const body = await req.json();
    const {
      activityType,
      subject,
      notes,
      interactionDate,
      direction,
      phoneNumber,
      durationMinutes,
      callOutcome,
      meetingLocation,
      meetingLink,
      attendees,
      externalProvider,
      externalItemId,
      externalWebLink,
      prospectClientId,
      preContractCaseId,
      contractId,
      addendumId,
      renewalCaseId,
      operationType
    } = body;

    if (!activityType || !["EMAIL", "CALL", "MEETING", "NOTE"].includes(activityType)) {
      return NextResponse.json(
        { error: "Valid activityType ('EMAIL', 'CALL', 'MEETING', 'NOTE') is required." },
        { status: 400 }
      );
    }

    if (!subject || !subject.trim()) {
      return NextResponse.json({ error: "subject is required." }, { status: 400 });
    }

    // Related Entity Ownership & Company Validation
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

    const activity = await prisma.commercialActivity.create({
      data: {
        activityType,
        subject: subject.trim(),
        notes: notes ? notes.trim() : null,
        interactionDate: interactionDate ? new Date(interactionDate) : new Date(),
        direction: direction || null,
        phoneNumber: phoneNumber || null,
        durationMinutes: durationMinutes ? parseInt(durationMinutes, 10) : null,
        callOutcome: callOutcome || null,
        meetingLocation: meetingLocation || null,
        meetingLink: meetingLink || null,
        attendees: attendees || null,
        externalProvider: externalProvider || null,
        externalItemId: externalItemId || null,
        externalWebLink: externalWebLink || null,
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
        action: externalProvider ? "LINK_OUTLOOK_ACTIVITY" : "CREATE_COMMERCIAL_ACTIVITY",
        entityType: "CommercialActivity",
        entityId: activity.id,
        afterJson: JSON.stringify({
          activityType,
          subject,
          contractId,
          prospectClientId,
          externalProvider,
          externalItemId
        })
      }
    });

    return NextResponse.json({
      success: true,
      activity
    });
  } catch (err: any) {
    if (err.code === "P2002") {
      try {
        const existing = await prisma.commercialActivity.findFirst({
          where: { externalProvider: req.body ? (req as any).externalProvider : undefined, externalItemId: req.body ? (req as any).externalItemId : undefined }
        });
        return NextResponse.json({
          success: true,
          alreadyExists: true,
          activity: existing,
          message: "External provider item already linked idempotently."
        });
      } catch (_) {}
    }
    return NextResponse.json(
      { error: err.message || "Failed to log commercial activity." },
      { status: 400 }
    );
  }
}
