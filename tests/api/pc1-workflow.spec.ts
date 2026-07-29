import { WorkflowEngine } from '../../apps/web/lib/workflow-engine';
import { prisma } from '@ahh-wfm/database';

jest.mock('@ahh-wfm/database', () => ({
  prisma: {
    workflowTemplate: {
      findFirst: jest.fn(),
    },
    workflowInstance: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    workflowActionHistory: {
      create: jest.fn(),
    }
  }
}));

describe('PC-1 Workflow: WorkflowEngine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('submitCase', () => {
    it('should throw if no active template exists', async () => {
      (prisma.workflowTemplate.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(WorkflowEngine.submitCase('PRE_CONTRACT_CASE', 'ref1', null, null, 'user1'))
        .rejects.toThrow('No active workflow configuration exists for PRE_CONTRACT_CASE.');
    });

    it('should create an instance and history on successful submission', async () => {
      const template = { id: 't1', levels: [{ levelNumber: 1 }] };
      (prisma.workflowTemplate.findFirst as jest.Mock).mockResolvedValue(template);
      (prisma.workflowInstance.create as jest.Mock).mockResolvedValue({ id: 'inst1', status: 'IN_PROGRESS' });

      const instance = await WorkflowEngine.submitCase('PRE_CONTRACT_CASE', 'ref1', null, null, 'user1');
      expect(instance).toBeDefined();
      expect(prisma.workflowInstance.create).toHaveBeenCalled();
    });
  });

  describe('approve', () => {
    it('should move to next level if intermediate level', async () => {
      const instance = {
        id: 'inst1',
        status: 'IN_PROGRESS',
        currentLevelNumber: 1,
        template: { levels: [{ levelNumber: 1 }, { levelNumber: 2 }] }
      };
      (prisma.workflowInstance.findUnique as jest.Mock).mockResolvedValue(instance);
      
      await WorkflowEngine.approve('inst1', 'user1');
      expect(prisma.workflowInstance.update).toHaveBeenCalledWith(expect.objectContaining({
        data: { currentLevelNumber: 2 }
      }));
    });

    it('should mark APPROVED if final level', async () => {
      const instance = {
        id: 'inst1',
        status: 'IN_PROGRESS',
        currentLevelNumber: 2,
        template: { levels: [{ levelNumber: 1 }, { levelNumber: 2 }] }
      };
      (prisma.workflowInstance.findUnique as jest.Mock).mockResolvedValue(instance);
      
      await WorkflowEngine.approve('inst1', 'user1');
      expect(prisma.workflowInstance.update).toHaveBeenCalledWith(expect.objectContaining({
        data: { status: 'APPROVED' }
      }));
    });
  });
});
