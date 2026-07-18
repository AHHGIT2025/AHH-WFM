import { prisma } from "@ahh-wfm/database";
import { isDbConnected } from "@ahh-wfm/mock-data";

export function resolveMonitoringScope(userContext: any, filters: any) {
  const role = (userContext?.role || "EMPLOYEE").toUpperCase().replace(/\s+/g, "_");
  const operationAccess = userContext?.operationAccess || {};
  const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(role);

  let allowedOps: string[] = [];
  if (isAdmin) {
    allowedOps = ["SECURITY_GUARDING", "FACILITY_MANAGEMENT"];
  } else {
    if (operationAccess.allowedSecurityGuarding === true) allowedOps.push("SECURITY_GUARDING");
    if (operationAccess.allowedFacilityManagement === true) allowedOps.push("FACILITY_MANAGEMENT");
  }

  if (allowedOps.length === 0) {
    throw new Error("FORBIDDEN");
  }

  // Filter validation
  let targetOp: string | undefined = filters?.operationType;
  if (targetOp && targetOp !== "ALL") {
    if (!allowedOps.includes(targetOp)) {
      throw new Error("FORBIDDEN");
    }
    return [targetOp];
  }

  return allowedOps;
}

export function calculateStaleStatus(lastActivityAt: string | Date | null, status: string): "OK" | "WATCH" | "STALE" {
  if (!lastActivityAt) return "OK";

  // Check if status represents an active execution
  const activeStates = ["IN_PROGRESS", "DRAFT", "ACTIVE", "PENDING"];
  if (!activeStates.includes(status.toUpperCase())) {
    return "OK";
  }

  const lastTime = new Date(lastActivityAt).getTime();
  const elapsed = Date.now() - lastTime;

  if (elapsed >= 30 * 60 * 1000) {
    return "STALE";
  } else if (elapsed >= 15 * 60 * 1000) {
    return "WATCH";
  }

  return "OK";
}

export function buildInternalMonitoringDto(data: any) {
  return {
    summary: data.summary,
    activeAssignments: data.activeAssignments || [],
    activePatrols: data.activePatrols || [],
    latestCheckpointActivity: data.latestCheckpointActivity || [],
    checklistQueue: data.checklistQueue || [],
    pendingManualExceptions: data.pendingManualExceptions || [],
    unresolvedSyncConflicts: data.unresolvedSyncConflicts || [],
    recentAuditEvents: data.recentAuditEvents || [],
    staleTasks: data.staleTasks || [],
    filters: data.filters || {}
  };
}

export function buildClientSafeMonitoringDto(data: any) {
  // Client safe DTO excludes internal employee IDs (outside project/service contexts), payroll,
  // internal notes, internal sync conflicts, and security-sensitive audit parameters.
  const clientSafeAssignments = (data.activeAssignments || []).map((x: any) => ({
    assignmentId: x.assignmentId,
    operationType: x.operationType,
    clientName: x.clientName,
    projectName: x.projectName,
    siteName: x.siteName,
    taskType: x.taskType,
    status: x.status,
    shift: x.shift,
    lastActivityAt: x.lastActivityAt,
    staleStatus: x.staleStatus
  }));

  const clientSafePatrols = (data.activePatrols || []).map((x: any) => ({
    patrolExecutionId: x.patrolExecutionId,
    routeName: x.routeName,
    projectName: x.projectName,
    siteName: x.siteName,
    status: x.status,
    startedAt: x.startedAt,
    completedCheckpointCount: x.completedCheckpointCount,
    totalCheckpointCount: x.totalCheckpointCount,
    lastCheckpointAt: x.lastCheckpointAt,
    staleStatus: x.staleStatus
  }));

  const clientSafeCheckpointActivity = (data.latestCheckpointActivity || []).map((x: any) => ({
    checkpointExecutionId: x.checkpointExecutionId,
    checkpointName: x.checkpointName,
    validationStatus: x.validationStatus,
    scanMode: x.scanMode,
    validatedAt: x.validatedAt
  }));

  const clientSafeChecklists = (data.checklistQueue || []).map((x: any) => ({
    checklistExecutionId: x.checklistExecutionId,
    templateName: x.templateName,
    status: x.status,
    submittedAt: x.submittedAt
  }));

  const clientSafeAudits = (data.recentAuditEvents || []).map((x: any) => ({
    auditId: x.auditId,
    operationType: x.operationType,
    actionType: x.actionType,
    actionSource: x.actionSource,
    syncMode: x.syncMode,
    resultStatus: x.resultStatus,
    createdAt: x.createdAt
  }));

  return {
    summary: {
      totalActiveAssignments: clientSafeAssignments.length,
      patrolsInProgress: clientSafePatrols.filter((p: any) => p.status === "IN_PROGRESS").length,
      checklistsPendingReview: clientSafeChecklists.filter((c: any) => c.status === "PENDING_REVIEW").length,
      staleTasksCount: clientSafeAssignments.filter((a: any) => a.staleStatus !== "OK").length + clientSafePatrols.filter((p: any) => p.staleStatus !== "OK").length,
      lastUpdatedAt: data.summary?.lastUpdatedAt
    },
    activeAssignments: clientSafeAssignments,
    activePatrols: clientSafePatrols,
    latestCheckpointActivity: clientSafeCheckpointActivity,
    checklistQueue: clientSafeChecklists,
    pendingManualExceptions: [],
    unresolvedSyncConflicts: [], // Excluded from client view
    recentAuditEvents: clientSafeAudits,
    staleTasks: data.staleTasks ? data.staleTasks.map((t: any) => ({
      id: t.id,
      type: t.type,
      name: t.name,
      lastActivityAt: t.lastActivityAt,
      staleStatus: t.staleStatus
    })) : [],
    filters: data.filters || {}
  };
}

export async function getSecfacLiveMonitoringSnapshot(filters: any, userContext: any) {
  const allowedOps = resolveMonitoringScope(userContext, filters);
  const dbConnected = isDbConnected();

  let assignments: any[] = [];
  let checklistExecutions: any[] = [];
  let patrolExecutions: any[] = [];
  let checkpointExecutions: any[] = [];
  let scanProofs: any[] = [];
  let conflicts: any[] = [];
  let audits: any[] = [];

  const projectId = filters?.project && filters.project !== "ALL" ? filters.project : undefined;
  const siteId = filters?.site && filters.site !== "ALL" ? filters.site : undefined;
  const employeeId = filters?.employee && filters.employee !== "ALL" ? filters.employee : undefined;
  const statusFilter = filters?.status && filters.status !== "ALL" ? filters.status : undefined;

  if (dbConnected) {
    // 1. Fetch Assignments
    assignments = await prisma.secfacAssignment.findMany({
      where: {
        isActive: true,
        operationType: { in: allowedOps },
        projectId: projectId,
        siteId: siteId,
        employeeId: employeeId
      },
      include: {
        employee: true,
        site: true,
        project: true,
        client: true
      }
    });

    // 2. Fetch Active/Pending Checklist Executions
    checklistExecutions = await prisma.secfacChecklistExecution.findMany({
      where: {
        operationType: { in: allowedOps },
        siteId: siteId,
        employeeId: employeeId,
        status: { in: ["DRAFT", "SUBMITTED", "PENDING_REVIEW"] }
      },
      include: {
        employee: true,
        site: true,
        assignment: true,
        checklistTemplate: true
      },
      orderBy: { updatedAt: "desc" }
    });

    // 3. Fetch Active Patrol Executions
    patrolExecutions = await prisma.secfacPatrolExecution.findMany({
      where: {
        status: { in: ["IN_PROGRESS", "PENDING_REVIEW"] },
        employeeId: employeeId,
        assignment: {
          operationType: { in: allowedOps },
          projectId: projectId,
          siteId: siteId
        }
      },
      include: {
        employee: true,
        route: true,
        assignment: { include: { site: true, project: true } },
        checkpoints: { include: { checkpoint: true } }
      },
      orderBy: { updatedAt: "desc" }
    });

    // 4. Fetch Latest Checkpoint Activity (Patrol checkpoint executions)
    checkpointExecutions = await prisma.secfacPatrolExecutionCheckpoint.findMany({
      where: {
        status: { in: ["VALIDATED", "INVALID"] },
        execution: {
          employeeId: employeeId,
          assignment: {
            operationType: { in: allowedOps },
            projectId: projectId,
            siteId: siteId
          }
        }
      },
      include: {
        checkpoint: true,
        execution: {
          include: {
            employee: true,
            route: true
          }
        }
      },
      orderBy: { validatedAt: "desc" },
      take: 20
    });

    // 5. Fetch Pending Manual Exceptions (Scan proofs needing review)
    scanProofs = await prisma.secfacScanProof.findMany({
      where: {
        operationType: { in: allowedOps },
        siteId: siteId,
        employeeId: employeeId,
        OR: [
          { validationStatus: "PENDING_REVIEW" },
          { scanMode: "MANUAL_EXCEPTION", validationStatus: "PENDING" }
        ]
      },
      include: {
        employee: true,
        site: true,
        checkpoint: true,
        assignment: true
      },
      orderBy: { scannedAt: "desc" }
    });

    // 6. Fetch Unresolved Sync Conflicts
    conflicts = await prisma.secfacSyncConflict.findMany({
      where: {
        operationType: { in: allowedOps },
        employeeId: employeeId,
        status: "ACTIVE"
      },
      include: {
        employee: true
      },
      orderBy: { createdAt: "desc" }
    });

    // 7. Fetch Recent Field Audits
    audits = await prisma.secfacFieldExecutionAudit.findMany({
      where: {
        operationType: { in: allowedOps },
        employeeId: employeeId
      },
      include: {
        employee: {
          select: {
            name: true,
            id: true,
            role: true
          }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 20
    });
  } else {
    // Memory Mock-Data Fallback
    const db = require("@ahh-wfm/mock-data").readDb();
    const emps = db.employees || [];
    const sites = db.manpowerSites || [];
    const projects = db.manpowerProjects || [];
    const clients = db.manpowerClients || [];
    const checkpoints = db.secfacCheckpoints || [];
    const templates = db.secfacChecklistTemplates || [];
    const routes = db.secfacPatrolRoutes || [];

    const rawAssignments = db.secfacAssignments || [];
    assignments = rawAssignments
      .filter((x: any) => x.isActive && allowedOps.includes(x.operationType))
      .filter((x: any) => !projectId || x.projectId === projectId)
      .filter((x: any) => !siteId || x.siteId === siteId)
      .filter((x: any) => !employeeId || x.employeeId === employeeId)
      .map((x: any) => ({
        ...x,
        employee: emps.find((e: any) => e.id === x.employeeId),
        site: sites.find((s: any) => s.id === x.siteId),
        project: projects.find((p: any) => p.id === x.projectId),
        client: clients.find((c: any) => c.id === x.clientId)
      }));

    const rawChecklists = db.secfacChecklistExecutions || [];
    checklistExecutions = rawChecklists
      .filter((x: any) => allowedOps.includes(x.operationType))
      .filter((x: any) => !siteId || x.siteId === siteId)
      .filter((x: any) => !employeeId || x.employeeId === employeeId)
      .filter((x: any) => ["DRAFT", "SUBMITTED", "PENDING_REVIEW"].includes(x.status))
      .map((x: any) => ({
        ...x,
        employee: emps.find((e: any) => e.id === x.employeeId),
        site: sites.find((s: any) => s.id === x.siteId),
        assignment: rawAssignments.find((a: any) => a.id === x.assignmentId),
        checklistTemplate: templates.find((t: any) => t.id === x.checklistTemplateId)
      }));

    const rawPatrols = db.secfacPatrolExecutions || [];
    const rawCheckpointsEx = db.secfacPatrolExecutionCheckpoints || [];
    patrolExecutions = rawPatrols
      .filter((x: any) => ["IN_PROGRESS", "PENDING_REVIEW"].includes(x.status))
      .filter((x: any) => !employeeId || x.employeeId === employeeId)
      .map((x: any) => {
        const a = rawAssignments.find((as: any) => as.id === x.assignmentId);
        return {
          ...x,
          assignment: a ? {
            ...a,
            site: sites.find((s: any) => s.id === a.siteId),
            project: projects.find((p: any) => p.id === a.projectId)
          } : null,
          employee: emps.find((e: any) => e.id === x.employeeId),
          route: routes.find((r: any) => r.id === x.routeId)
        };
      })
      .filter((x: any) => x.assignment && allowedOps.includes(x.assignment.operationType))
      .filter((x: any) => !projectId || x.assignment.projectId === projectId)
      .filter((x: any) => !siteId || x.assignment.siteId === siteId)
      .map((x: any) => ({
        ...x,
        checkpoints: rawCheckpointsEx
          .filter((cp: any) => cp.executionId === x.id)
          .map((cp: any) => ({
            ...cp,
            checkpoint: checkpoints.find((c: any) => c.id === cp.checkpointId)
          }))
      }));

    checkpointExecutions = rawCheckpointsEx
      .filter((x: any) => ["VALIDATED", "INVALID"].includes(x.status))
      .map((x: any) => {
        const pe = rawPatrols.find((p: any) => p.id === x.executionId);
        const a = pe ? rawAssignments.find((as: any) => as.id === pe.assignmentId) : null;
        return {
          ...x,
          checkpoint: checkpoints.find((c: any) => c.id === x.checkpointId),
          patrolExecution: pe && a && allowedOps.includes(a.operationType) ? {
            ...pe,
            employee: emps.find((e: any) => e.id === pe.employeeId),
            route: routes.find((r: any) => r.id === pe.routeId),
            assignment: a
          } : null
        };
      })
      .filter((x: any) => x.patrolExecution)
      .filter((x: any) => !projectId || x.patrolExecution.assignment.projectId === projectId)
      .filter((x: any) => !siteId || x.patrolExecution.assignment.siteId === siteId)
      .filter((x: any) => !employeeId || x.patrolExecution.employeeId === employeeId)
      .sort((a: any, b: any) => new Date(b.validatedAt || 0).getTime() - new Date(a.validatedAt || 0).getTime())
      .slice(0, 20);

    const rawScanProofs = db.secfacScanProofs || [];
    scanProofs = rawScanProofs
      .filter((x: any) => allowedOps.includes(x.operationType))
      .filter((x: any) => !siteId || x.siteId === siteId)
      .filter((x: any) => !employeeId || x.employeeId === employeeId)
      .filter((x: any) => x.validationStatus === "PENDING_REVIEW" || (x.scanMode === "MANUAL_EXCEPTION" && x.validationStatus === "PENDING"))
      .map((x: any) => ({
        ...x,
        employee: emps.find((e: any) => e.id === x.employeeId),
        site: sites.find((s: any) => s.id === x.siteId),
        checkpoint: checkpoints.find((c: any) => c.id === x.checkpointId),
        assignment: rawAssignments.find((a: any) => a.id === x.assignmentId)
      }));

    const rawConflicts = db.secfacSyncConflicts || [];
    conflicts = rawConflicts
      .filter((x: any) => allowedOps.includes(x.operationType) && x.status === "ACTIVE")
      .filter((x: any) => !employeeId || x.employeeId === employeeId)
      .map((x: any) => ({
        ...x,
        employee: emps.find((e: any) => e.id === x.employeeId)
      }));

    const rawAudits = db.secfacFieldExecutionAudits || [];
    audits = rawAudits
      .filter((x: any) => allowedOps.includes(x.operationType))
      .filter((x: any) => !employeeId || x.employeeId === employeeId)
      .map((x: any) => {
        const emp = emps.find((e: any) => e.id === x.employeeId);
        return {
          ...x,
          employee: emp ? { name: emp.name, id: emp.id, role: emp.role } : null
        };
      })
      .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 20);
  }

  // 8. Transform Data to Dashboard Format
  const activeAssignmentsDto = assignments.map((a: any) => {
    // Find latest activity time among checklist, patrols, audits
    const relatedChecklists = checklistExecutions.filter((c: any) => c.assignmentId === a.id);
    const relatedPatrols = patrolExecutions.filter((p: any) => p.assignmentId === a.id);
    const relatedAudits = audits.filter((au: any) => au.assignmentId === a.id);

    const times = [new Date(a.updatedAt).getTime()];
    relatedChecklists.forEach((c: any) => times.push(new Date(c.updatedAt).getTime()));
    relatedPatrols.forEach((p: any) => times.push(new Date(p.updatedAt).getTime()));
    relatedAudits.forEach((au: any) => times.push(new Date(au.createdAt).getTime()));

    const lastActivityAt = new Date(Math.max(...times));
    const staleStatus = calculateStaleStatus(lastActivityAt, a.status);

    return {
      assignmentId: a.id,
      operationType: a.operationType,
      clientId: a.clientId,
      clientName: a.client?.companyName || null,
      projectId: a.projectId,
      projectName: a.project?.name || null,
      siteId: a.siteId,
      siteName: a.site?.name || null,
      employeeId: a.employeeId,
      employeeCode: a.employee?.id || null,
      employeeName: a.employee?.name || null,
      taskType: a.patrolRouteId ? "PATROL" : "CHECKLIST",
      status: a.status,
      shift: new Date(a.scheduledStart).toLocaleDateString(),
      lastActivityAt: lastActivityAt.toISOString(),
      staleStatus
    };
  });

  const activePatrolsDto = patrolExecutions.map((p: any) => {
    const totalCp = p.checkpoints?.length || 0;
    const validatedCp = p.checkpoints?.filter((c: any) => c.status === "VALIDATED").length || 0;
    const invalidCp = p.checkpoints?.filter((c: any) => c.status === "INVALID").length || 0;
    const pendingCp = p.checkpoints?.filter((c: any) => c.status === "PENDING_REVIEW").length || 0;

    const times = [new Date(p.updatedAt).getTime()];
    p.checkpoints?.forEach((c: any) => {
      if (c.validatedAt) times.push(new Date(c.validatedAt).getTime());
    });
    const lastActivityAt = new Date(Math.max(...times));
    const staleStatus = calculateStaleStatus(lastActivityAt, p.status);

    return {
      patrolExecutionId: p.id,
      assignmentId: p.assignmentId,
      routeName: p.route?.routeName || "Unknown Route",
      employeeName: p.employee?.name || null,
      employeeCode: p.employee?.id || null,
      projectId: p.assignment?.projectId || null,
      projectName: p.assignment?.project?.name || null,
      siteId: p.assignment?.siteId || null,
      siteName: p.assignment?.site?.name || null,
      status: p.status,
      startedAt: p.startedAt ? new Date(p.startedAt).toISOString() : null,
      completedCheckpointCount: validatedCp,
      totalCheckpointCount: totalCp,
      pendingReviewCount: pendingCp,
      invalidCheckpointCount: invalidCp,
      lastCheckpointAt: lastActivityAt.toISOString(),
      staleStatus
    };
  });

  const latestCheckpointActivityDto = checkpointExecutions.map((c: any) => {
    const execObj = c.execution || c.patrolExecution;
    return {
      checkpointExecutionId: c.id,
      patrolExecutionId: c.executionId,
      checkpointName: c.checkpoint?.checkpointName || "Unknown Checkpoint",
      employeeName: execObj?.employee?.name || null,
      employeeCode: execObj?.employee?.id || null,
      validationStatus: c.status,
      scanMode: c.scanMode || "NFC",
      validatedAt: c.validatedAt ? new Date(c.validatedAt).toISOString() : null
    };
  });

  const checklistQueueDto = checklistExecutions.map((c: any) => ({
    checklistExecutionId: c.id,
    assignmentId: c.assignmentId,
    templateName: c.checklistTemplate?.templateName || "Unknown Template",
    employeeName: c.employee?.name || null,
    employeeCode: c.employee?.id || null,
    status: c.status,
    submittedAt: c.submittedAt ? new Date(c.submittedAt).toISOString() : null,
    reviewedAt: c.reviewedAt ? new Date(c.reviewedAt).toISOString() : null
  }));

  const pendingManualExceptionsDto = scanProofs.map((s: any) => ({
    scanProofId: s.id,
    checkpointName: s.checkpoint?.checkpointName || "Unknown Checkpoint",
    employeeName: s.employee?.name || null,
    employeeCode: s.employee?.id || null,
    assignmentId: s.assignmentId,
    siteId: s.siteId,
    siteName: s.site?.name || null,
    validationStatus: s.validationStatus,
    scanMode: s.scanMode,
    createdAt: new Date(s.scannedAt).toISOString(),
    reason: s.exceptionReason || s.failureReason || null
  }));

  const unresolvedSyncConflictsDto = conflicts.map((c: any) => ({
    syncConflictId: c.id,
    employeeName: c.employee?.name || null,
    employeeCode: c.employee?.id || null,
    actionType: c.actionType,
    conflictType: c.conflictType,
    serverMessage: c.serverMessage,
    recommendedAction: c.recommendedAction,
    status: c.status,
    createdAt: new Date(c.createdAt).toISOString()
  }));

  const recentAuditEventsDto = audits.map((au: any) => ({
    auditId: au.id,
    operationType: au.operationType,
    employeeName: au.employeeName || au.employee?.name || null,
    employeeCode: au.employeeCode || au.employee?.id || null,
    actorName: au.actorName || null,
    actorRole: au.actorRole || null,
    actionType: au.actionType,
    actionSource: au.actionSource,
    syncMode: au.syncMode,
    resultStatus: au.resultStatus,
    resultMessage: au.resultMessage,
    createdAt: new Date(au.createdAt).toISOString()
  }));

  // Identify Stale Tasks explicitly
  const staleTasksDto: any[] = [];
  activeAssignmentsDto.forEach((a: any) => {
    if (a.staleStatus !== "OK") {
      staleTasksDto.push({
        id: a.assignmentId,
        type: "ASSIGNMENT",
        name: a.employeeName + " - " + a.taskType + " (" + a.siteName + ")",
        lastActivityAt: a.lastActivityAt,
        staleStatus: a.staleStatus
      });
    }
  });

  activePatrolsDto.forEach((p: any) => {
    if (p.staleStatus !== "OK") {
      staleTasksDto.push({
        id: p.patrolExecutionId,
        type: "PATROL",
        name: p.employeeName + " - Patrol: " + p.routeName + " (" + p.siteName + ")",
        lastActivityAt: p.lastCheckpointAt,
        staleStatus: p.staleStatus
      });
    }
  });

  // Apply Status filters if needed
  let filteredAssignments = activeAssignmentsDto;
  if (statusFilter && statusFilter !== "ALL") {
    filteredAssignments = activeAssignmentsDto.filter((a: any) => a.status === statusFilter || a.staleStatus === statusFilter);
  }

  const summary = {
    totalActiveAssignments: activeAssignmentsDto.length,
    patrolsInProgress: activePatrolsDto.filter((p: any) => p.status === "IN_PROGRESS").length,
    checklistsPendingReview: checklistQueueDto.filter((c: any) => c.status === "PENDING_REVIEW" || c.status === "SUBMITTED").length,
    manualExceptionsPendingReview: pendingManualExceptionsDto.length,
    unresolvedSyncConflicts: unresolvedSyncConflictsDto.length,
    staleTasksCount: staleTasksDto.length,
    lastUpdatedAt: new Date().toISOString()
  };

  return buildInternalMonitoringDto({
    summary,
    activeAssignments: filteredAssignments,
    activePatrols: activePatrolsDto,
    latestCheckpointActivity: latestCheckpointActivityDto,
    checklistQueue: checklistQueueDto,
    pendingManualExceptions: pendingManualExceptionsDto,
    unresolvedSyncConflicts: unresolvedSyncConflictsDto,
    recentAuditEvents: recentAuditEventsDto,
    staleTasks: staleTasksDto,
    filters: {
      operationType: filters?.operationType || "ALL",
      project: projectId || "ALL",
      site: siteId || "ALL",
      employee: employeeId || "ALL",
      status: statusFilter || "ALL",
      dateRange: filters?.dateRange || "ALL"
    }
  });
}
