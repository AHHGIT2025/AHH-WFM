import { prisma } from "@ahh-wfm/database";
import { validateClearanceCompanyAndAccess, validateClearanceApproverSoD } from "@/lib/clearance-auth";

export interface ClearanceActionPayload {
  stepId?: string;
  notes?: string;
  remarks?: string;
  signatureName?: string;
}

export async function executeClearanceApprove(
  clearanceId: string,
  user: any,
  data: ClearanceActionPayload
): Promise<{ success: boolean; error?: string; status?: number }> {
  const clearance = await prisma.clearanceRequest.findUnique({
    where: { id: clearanceId },
    include: { approvalSteps: true }
  });

  if (!clearance) {
    return { success: false, error: "Clearance not found", status: 404 };
  }

  const accessError = validateClearanceCompanyAndAccess(user, clearance);
  if (accessError) {
    return { success: false, error: "Forbidden: Company boundary violation", status: 403 };
  }

  // Find step: either by data.stepId or active pending step assigned to user
  let step = null;
  if (data.stepId) {
    step = await prisma.clearanceApprovalStep.findUnique({
      where: { id: data.stepId }
    });
  } else {
    const canonicalEmployeeId = user.employeeId || user.id;
    step = clearance.approvalSteps.find(s => 
      s.status === "PENDING" && 
      (s.assignedApproverId === user.id || s.assignedApproverId === canonicalEmployeeId)
    ) || clearance.approvalSteps.find(s => s.status === "PENDING");
  }

  if (!step || step.clearanceRequestId !== clearanceId) {
    return { success: false, error: "Invalid approval step", status: 400 };
  }

  const sodError = validateClearanceApproverSoD(user, clearance, step);
  if (sodError) {
    return { success: false, error: "Forbidden: Segregation of Duties restriction", status: 403 };
  }

  // Update step
  await prisma.clearanceApprovalStep.update({
    where: { id: step.id },
    data: { 
      status: "APPROVED",
      notes: data.notes || step.notes,
      remarks: data.remarks || step.remarks,
      signatureName: data.signatureName,
      signatureDate: new Date(),
      actedAt: new Date(),
      actedById: user.id
    }
  });

  // Record response
  await prisma.clearanceApprovalResponse.create({
    data: {
      stepId: step.id,
      actionType: "APPROVE",
      actorId: user.id || "system",
      remarks: data.remarks
    }
  });
  
  // Log history
  await prisma.clearanceHistory.create({
    data: {
      clearanceRequestId: clearance.id,
      actorId: user.id || "system",
      actionType: "APPROVE",
      details: `Step ${step.sectionName} was APPROVED.`
    }
  });

  const allSteps = await prisma.clearanceApprovalStep.findMany({
    where: { clearanceRequestId: clearanceId }
  });
  
  const allDone = allSteps.every(s => s.status === "APPROVED" || s.status === "NOT_APPLICABLE" || s.status === "SKIPPED");
  
  if (allDone) {
    await prisma.clearanceRequest.update({
      where: { id: clearanceId },
      data: { 
        status: "COMPLETED",
        finalApprovedAt: new Date(),
        completedAt: new Date()
      }
    });
  }

  return { success: true };
}

export async function executeClearanceReject(
  clearanceId: string,
  user: any,
  data: ClearanceActionPayload
): Promise<{ success: boolean; error?: string; status?: number }> {
  const clearance = await prisma.clearanceRequest.findUnique({
    where: { id: clearanceId },
    include: { approvalSteps: true }
  });

  if (!clearance) {
    return { success: false, error: "Clearance not found", status: 404 };
  }

  const accessError = validateClearanceCompanyAndAccess(user, clearance);
  if (accessError) {
    return { success: false, error: "Forbidden: Company boundary violation", status: 403 };
  }

  let step = null;
  if (data.stepId) {
    step = await prisma.clearanceApprovalStep.findUnique({
      where: { id: data.stepId }
    });
  } else {
    const canonicalEmployeeId = user.employeeId || user.id;
    step = clearance.approvalSteps.find(s => 
      s.status === "PENDING" && 
      (s.assignedApproverId === user.id || s.assignedApproverId === canonicalEmployeeId)
    ) || clearance.approvalSteps.find(s => s.status === "PENDING");
  }

  if (!step || step.clearanceRequestId !== clearanceId) {
    return { success: false, error: "Invalid approval step", status: 400 };
  }

  const sodError = validateClearanceApproverSoD(user, clearance, step);
  if (sodError) {
    return { success: false, error: "Forbidden: Segregation of Duties restriction", status: 403 };
  }

  // Update step
  await prisma.clearanceApprovalStep.update({
    where: { id: step.id },
    data: { 
      status: "REJECTED",
      notes: data.notes || step.notes,
      remarks: data.remarks || step.remarks,
      signatureName: data.signatureName,
      signatureDate: new Date(),
      actedAt: new Date(),
      actedById: user.id
    }
  });

  // Record response
  await prisma.clearanceApprovalResponse.create({
    data: {
      stepId: step.id,
      actionType: "REJECT",
      actorId: user.id || "system",
      remarks: data.remarks
    }
  });
  
  // Log history
  await prisma.clearanceHistory.create({
    data: {
      clearanceRequestId: clearance.id,
      actorId: user.id || "system",
      actionType: "REJECT",
      details: `Step ${step.sectionName} was REJECTED.`
    }
  });

  await prisma.clearanceRequest.update({
    where: { id: clearanceId },
    data: { status: "REJECTED" }
  });

  return { success: true };
}

export async function executeClearanceReturn(
  clearanceId: string,
  user: any,
  data: ClearanceActionPayload
): Promise<{ success: boolean; error?: string; status?: number }> {
  const clearance = await prisma.clearanceRequest.findUnique({
    where: { id: clearanceId },
    include: { approvalSteps: true }
  });

  if (!clearance) {
    return { success: false, error: "Clearance not found", status: 404 };
  }

  const accessError = validateClearanceCompanyAndAccess(user, clearance);
  if (accessError) {
    return { success: false, error: "Forbidden: Company boundary violation", status: 403 };
  }

  let step = null;
  if (data.stepId) {
    step = await prisma.clearanceApprovalStep.findUnique({
      where: { id: data.stepId }
    });
  } else {
    const canonicalEmployeeId = user.employeeId || user.id;
    step = clearance.approvalSteps.find(s => 
      s.status === "PENDING" && 
      (s.assignedApproverId === user.id || s.assignedApproverId === canonicalEmployeeId)
    ) || clearance.approvalSteps.find(s => s.status === "PENDING");
  }

  if (!step || step.clearanceRequestId !== clearanceId) {
    return { success: false, error: "Invalid approval step", status: 400 };
  }

  const sodError = validateClearanceApproverSoD(user, clearance, step);
  if (sodError) {
    return { success: false, error: "Forbidden: Segregation of Duties restriction", status: 403 };
  }

  // Update step
  await prisma.clearanceApprovalStep.update({
    where: { id: step.id },
    data: { 
      status: "RETURNED",
      notes: data.notes || step.notes,
      remarks: data.remarks || step.remarks,
      signatureName: data.signatureName,
      signatureDate: new Date(),
      actedAt: new Date(),
      actedById: user.id
    }
  });

  // Record response
  await prisma.clearanceApprovalResponse.create({
    data: {
      stepId: step.id,
      actionType: "RETURN",
      actorId: user.id || "system",
      remarks: data.remarks
    }
  });
  
  // Log history
  await prisma.clearanceHistory.create({
    data: {
      clearanceRequestId: clearance.id,
      actorId: user.id || "system",
      actionType: "RETURN",
      details: `Step ${step.sectionName} was RETURNED.`
    }
  });

  await prisma.clearanceRequest.update({
    where: { id: clearanceId },
    data: { status: "RETURNED_FOR_CORRECTION" }
  });

  return { success: true };
}

export async function executeClearanceMarkNotApplicable(
  clearanceId: string,
  user: any,
  data: ClearanceActionPayload
): Promise<{ success: boolean; error?: string; status?: number }> {
  const clearance = await prisma.clearanceRequest.findUnique({
    where: { id: clearanceId },
    include: { approvalSteps: true }
  });

  if (!clearance) {
    return { success: false, error: "Clearance not found", status: 404 };
  }

  const accessError = validateClearanceCompanyAndAccess(user, clearance);
  if (accessError) {
    return { success: false, error: "Forbidden: Company boundary violation", status: 403 };
  }

  let step = null;
  if (data.stepId) {
    step = await prisma.clearanceApprovalStep.findUnique({
      where: { id: data.stepId }
    });
  } else {
    const canonicalEmployeeId = user.employeeId || user.id;
    step = clearance.approvalSteps.find(s => 
      s.status === "PENDING" && 
      (s.assignedApproverId === user.id || s.assignedApproverId === canonicalEmployeeId)
    ) || clearance.approvalSteps.find(s => s.status === "PENDING");
  }

  if (!step || step.clearanceRequestId !== clearanceId) {
    return { success: false, error: "Invalid approval step", status: 400 };
  }

  const sodError = validateClearanceApproverSoD(user, clearance, step);
  if (sodError) {
    return { success: false, error: "Forbidden: Segregation of Duties restriction", status: 403 };
  }

  // Update step
  await prisma.clearanceApprovalStep.update({
    where: { id: step.id },
    data: { 
      status: "NOT_APPLICABLE",
      notes: data.notes || step.notes,
      remarks: data.remarks || step.remarks,
      signatureName: data.signatureName,
      signatureDate: new Date(),
      actedAt: new Date(),
      actedById: user.id
    }
  });

  // Record response
  await prisma.clearanceApprovalResponse.create({
    data: {
      stepId: step.id,
      actionType: "MARK_NOT_APPLICABLE",
      actorId: user.id || "system",
      remarks: data.remarks
    }
  });

  // Log history
  await prisma.clearanceHistory.create({
    data: {
      clearanceRequestId: clearance.id,
      actorId: user.id || "system",
      actionType: "MARK_NOT_APPLICABLE",
      details: `Step ${step.sectionName} was MARKED_NOT_APPLICABLE.`
    }
  });

  // Check remaining steps
  const allSteps = await prisma.clearanceApprovalStep.findMany({
    where: { clearanceRequestId: clearanceId }
  });

  const remainingPending = allSteps.filter(s => s.status === "PENDING");
  if (remainingPending.length === 0) {
    const hasRejected = allSteps.some(s => s.status === "REJECTED");
    if (!hasRejected) {
      await prisma.clearanceRequest.update({
        where: { id: clearanceId },
        data: { status: "COMPLETED" }
      });
    }
  }

  return { success: true };
}
