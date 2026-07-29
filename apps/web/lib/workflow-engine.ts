import { prisma } from '@ahh-wfm/database';

export class WorkflowEngine {
  static async submitCase(moduleType: string, referenceId: string, companyId: string | null, operationScope: string | null, userId: string) {
    // 1. Find active workflow template
    const template = await prisma.workflowTemplate.findFirst({
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

    // 2. Create Workflow Instance
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
        remarks
      }
    });

    // Check parallel approval rule if ALL_REQUIRED
    if (currentLevel.approvalRule === 'ALL_REQUIRED') {
      // For PC-1 we assume ANY_ONE for simplicity unless multiple distinct approvers explicitly required.
      // A full implementation would check how many required approvers have approved.
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
        remarks
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
        remarks
      }
    });

    return prisma.workflowInstance.update({
      where: { id: instanceId },
      data: { status: 'RETURNED' }
    });
  }
}
