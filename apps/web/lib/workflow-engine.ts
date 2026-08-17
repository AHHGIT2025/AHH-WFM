import { prisma } from '@ahh-wfm/database';
import { isUserEligibleApprover, UserSessionContext } from './workflow/approver-resolution';

export const PC1_WORKFLOW_MODULE_TYPES = [
  'PRE_CONTRACT_CASE',
  'SITE_SURVEY',
  'COSTING',
  'COMMERCIAL_PROPOSAL',
  'CLIENT_ACCEPTANCE',
  'CONTRACT_CONVERSION',
  'VARIATION_COSTING',
  'CONTRACT_ADDENDUM'
] as const;

export type PC1WorkflowModuleType = typeof PC1_WORKFLOW_MODULE_TYPES[number];

export interface ExecuteWorkflowActionParams {
  instanceId: string;
  action: 'APPROVE' | 'RETURN' | 'REJECT';
  user: UserSessionContext;
  remarks?: string;
  creatorId?: string | null;
}

export class WorkflowEngine {
  static async submitCase(moduleType: string, referenceId: string, companyId: string | null, operationScope: string | null, userId: string) {
    // 1. Find active default workflow template
    const template = await prisma.workflowTemplate.findFirst({
      where: {
        moduleType,
        isActive: true,
        isDefault: true,
        ...(operationScope ? { operationType: operationScope } : {})
      },
      include: {
        levels: {
          orderBy: { levelNumber: 'asc' },
          include: { approvers: true }
        }
      }
    }) || await prisma.workflowTemplate.findFirst({
      where: {
        moduleType,
        isActive: true,
        ...(operationScope ? { operationType: operationScope } : {})
      },
      include: {
        levels: {
          orderBy: { levelNumber: 'asc' },
          include: { approvers: true }
        }
      }
    });

    if (!template) {
      throw new Error(`No active workflow configuration exists for ${moduleType}.`);
    }

    // 2. Create Workflow Instance permanently bound to this templateId
    const instance = await prisma.workflowInstance.create({
      data: {
        templateId: template.id,
        moduleType,
        referenceId,
        status: 'IN_PROGRESS',
        currentLevelNumber: 1,
        companyId,
        operationScope,
        history: {
          create: {
            levelNumber: 1,
            action: 'SUBMIT',
            actedBy: userId,
            remarks: 'Submitted to workflow'
          }
        }
      }
    });

    return instance;
  }

  static async approve(instanceId: string, userId: string, remarks?: string) {
    const instance = await prisma.workflowInstance.findUnique({
      where: { id: instanceId },
      include: { template: { include: { levels: { orderBy: { levelNumber: 'asc' } } } } }
    });

    if (!instance || instance.status !== 'IN_PROGRESS') {
      throw new Error('Invalid or closed workflow instance.');
    }

    const currentLevel = instance.template.levels.find(l => l.levelNumber === instance.currentLevelNumber);
    if (!currentLevel) {
      throw new Error('Workflow configuration error: Level not found.');
    }

    // Record the approval
    await prisma.workflowActionHistory.create({
      data: {
        instanceId,
        levelNumber: instance.currentLevelNumber,
        action: 'APPROVE',
        actedBy: userId,
        remarks: remarks || null
      }
    });

    // Check parallel approval rule if ALL_REQUIRED
    if (currentLevel.approvalRule === 'ALL_REQUIRED') {
      // Fail closed if parallel approvals are not certified
      throw new Error('UNSUPPORTED_WORKFLOW_RULE: ALL_REQUIRED parallel signoff is not supported.');
    }

    // Move to next level or complete
    const isLastLevel = instance.currentLevelNumber >= instance.template.levels.length;
    
    if (isLastLevel) {
      return prisma.workflowInstance.update({
        where: { id: instanceId },
        data: { status: 'APPROVED' }
      });
    } else {
      return prisma.workflowInstance.update({
        where: { id: instanceId },
        data: { currentLevelNumber: instance.currentLevelNumber + 1 }
      });
    }
  }

  static async reject(instanceId: string, userId: string, remarks: string) {
    await prisma.workflowActionHistory.create({
      data: {
        instanceId,
        levelNumber: 0,
        action: 'REJECT',
        actedBy: userId,
        remarks: remarks || 'Workflow rejected'
      }
    });

    return prisma.workflowInstance.update({
      where: { id: instanceId },
      data: { status: 'REJECTED' }
    });
  }

  static async returnForCorrection(instanceId: string, userId: string, remarks: string) {
    await prisma.workflowActionHistory.create({
      data: {
        instanceId,
        levelNumber: 0,
        action: 'RETURN',
        actedBy: userId,
        remarks: remarks || 'Returned for correction'
      }
    });

    return prisma.workflowInstance.update({
      where: { id: instanceId },
      data: { status: 'RETURNED', currentLevelNumber: 1 }
    });
  }

  /**
   * Thin, safe action dispatcher with atomic validation, eligibility check,
   * SoD guard, and fail-closed parallel rule protection.
   */
  static async executeAction(params: ExecuteWorkflowActionParams) {
    const { instanceId, action, user, remarks, creatorId } = params;

    const instance = await prisma.workflowInstance.findUnique({
      where: { id: instanceId },
      include: {
        template: {
          include: {
            levels: {
              orderBy: { levelNumber: 'asc' },
              include: { approvers: true }
            }
          }
        }
      }
    });

    if (!instance) {
      throw new Error('Workflow instance not found.');
    }

    if (instance.status !== 'IN_PROGRESS') {
      throw new Error(`Workflow instance is not pending (Current status: ${instance.status}).`);
    }

    const currentLevel = instance.template.levels.find(l => l.levelNumber === instance.currentLevelNumber);
    if (!currentLevel) {
      throw new Error(`Workflow level ${instance.currentLevelNumber} not found.`);
    }

    if (currentLevel.approvalRule === 'ALL_REQUIRED') {
      throw new Error('UNSUPPORTED_WORKFLOW_RULE: ALL_REQUIRED parallel signoff is not supported.');
    }

    // Authoritative Approver Eligibility Resolution
    const eligibility = await isUserEligibleApprover(user, currentLevel.approvers, {
      instanceCompanyId: instance.companyId,
      creatorId,
      approvalRule: currentLevel.approvalRule
    });

    if (!eligibility.isEligible) {
      throw new Error(eligibility.reason || 'Forbidden: You are not authorized to act on this workflow step.');
    }

    if (action === 'APPROVE') {
      return await WorkflowEngine.approve(instanceId, user.id, remarks);
    } else if (action === 'REJECT') {
      if (!remarks || remarks.trim() === '') {
        throw new Error('Remarks are mandatory for REJECT action.');
      }
      return await WorkflowEngine.reject(instanceId, user.id, remarks);
    } else if (action === 'RETURN') {
      if (!remarks || remarks.trim() === '') {
        throw new Error('Remarks are mandatory for RETURN action.');
      }
      return await WorkflowEngine.returnForCorrection(instanceId, user.id, remarks);
    } else {
      throw new Error(`Invalid workflow action: ${action}`);
    }
  }
}