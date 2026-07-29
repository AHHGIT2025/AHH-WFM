import { PreContractVersionService } from '../../apps/web/lib/pre-contract-version-service';
import { prisma } from '@ahh-wfm/database';

jest.mock('@ahh-wfm/database', () => ({
  prisma: {
    surveyTemplateVersion: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    surveyTemplate: {
      findUnique: jest.fn(),
    }
  }
}));

describe('PC-1 Configuration: PreContractVersionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('overlap detection', () => {
    it('should reject when activating a version that overlaps with an ACTIVE version', async () => {
      // Mock existing active versions overlapping
      (prisma.surveyTemplateVersion.findMany as jest.Mock).mockResolvedValue([
        { id: 'v1', status: 'ACTIVE', effectiveFrom: new Date('2026-01-01'), effectiveTo: null }
      ]);
      
      await expect(PreContractVersionService.checkOverlap('SurveyTemplate', 't1', new Date('2026-02-01'), null, null, null))
        .rejects.toThrow('Overlapping ACTIVE versions are not permitted.');
    });

    it('should allow activation when dates do not overlap', async () => {
      (prisma.surveyTemplateVersion.findMany as jest.Mock).mockResolvedValue([
        { id: 'v1', status: 'ACTIVE', effectiveFrom: new Date('2025-01-01'), effectiveTo: new Date('2025-12-31') }
      ]);
      
      await expect(PreContractVersionService.checkOverlap('SurveyTemplate', 't1', new Date('2026-01-01'), null, null, null))
        .resolves.not.toThrow();
    });
  });

  describe('activation rules', () => {
    it('should only activate DRAFT versions', async () => {
      (prisma.surveyTemplateVersion.findUnique as jest.Mock).mockResolvedValue({ id: 'v1', status: 'RETIRED' });
      await expect(PreContractVersionService.activateVersion('SurveyTemplate', 'v1', new Date()))
        .rejects.toThrow('Only DRAFT versions can be activated.');
    });
  });
});
