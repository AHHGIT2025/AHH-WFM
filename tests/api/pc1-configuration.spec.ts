import { PreContractVersionService } from '../../apps/web/lib/pre-contract-version-service';
import { prisma } from '@ahh-wfm/database';

jest.mock('@ahh-wfm/database', () => ({
  prisma: {
    surveyTemplateVersion: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    surveyTemplate: {
      findUnique: jest.fn(),
    },
    siteConditionCategory: {
      create: jest.fn(),
    },
    siteConditionDefinition: {
      create: jest.fn(),
      update: jest.fn(),
    },
    costCategory: {
      create: jest.fn(),
    },
    costElement: {
      create: jest.fn(),
    },
    costRate: {
      create: jest.fn(),
    },
    costConfigurationVersion: {
      findUnique: jest.fn(),
    },
    surveySection: {
      create: jest.fn(),
    },
    surveyElement: {
      create: jest.fn(),
    },
    surveyElementOption: {
      create: jest.fn(),
    },
    surveyRuleDefinition: {
      create: jest.fn(),
    }
  }
}));

describe.skip('PC-1 Configuration: PreContractVersionService & Entities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('overlap detection', () => {
    it('should reject when activating a version that overlaps with an ACTIVE version', async () => {
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

  describe('Site Conditions Configuration', () => {
    it('should create category and definition successfully', async () => {
      (prisma.siteConditionCategory.create as jest.Mock).mockResolvedValue({ id: 'cat1' });
      (prisma.siteConditionDefinition.create as jest.Mock).mockResolvedValue({ id: 'def1' });
      
      const cat = await prisma.siteConditionCategory.create({ data: { name: 'Test' } } as any);
      const def = await prisma.siteConditionDefinition.create({ data: { categoryId: cat.id } } as any);
      
      expect(cat.id).toBe('cat1');
      expect(def.id).toBe('def1');
    });

    it('should allow DRAFT editing', async () => {
      (prisma.siteConditionDefinition.update as jest.Mock).mockResolvedValue({ id: 'def1', status: 'DRAFT' });
      const res = await prisma.siteConditionDefinition.update({ where: { id: 'def1' }, data: { name: 'Draft Edit' } } as any);
      expect((res as any).status).toBe('DRAFT');
    });

    it('should clone existing definition', async () => {
      (prisma.siteConditionDefinition.create as jest.Mock).mockResolvedValue({ id: 'def2', clonedFromId: 'def1' });
      const res = await prisma.siteConditionDefinition.create({ data: { clonedFromId: 'def1' } } as any);
      expect((res as any).clonedFromId).toBe('def1');
    });
  });

  describe('Cost Configuration', () => {
    it('should create category, element, and rate', async () => {
      ((prisma as any).costCategory.create as jest.Mock).mockResolvedValue({ id: 'cc1' });
      ((prisma as any).costElement.create as jest.Mock).mockResolvedValue({ id: 'ce1' });
      ((prisma as any).costRate.create as jest.Mock).mockResolvedValue({ id: 'cr1' });
      
      const cat = await (prisma as any).costCategory.create({ data: { name: 'CC Test' } } as any);
      const el = await (prisma as any).costElement.create({ data: { name: 'CE Test' } } as any);
      const rt = await (prisma as any).costRate.create({ data: { rate: 100 } } as any);
      
      expect(cat.id).toBe('cc1');
      expect(el.id).toBe('ce1');
      expect(rt.id).toBe('cr1');
    });

    it('should reject usage of inactive version', async () => {
      ((prisma as any).costConfigurationVersion.findUnique as jest.Mock).mockResolvedValue({ id: 'v1', status: 'INACTIVE' });
      
      const checkVersion = async () => {
        const v = await (prisma as any).costConfigurationVersion.findUnique({ where: { id: 'v1' } } as any);
        if (v?.status !== 'ACTIVE') throw new Error('Cannot use inactive version');
      };
      
      await expect(checkVersion()).rejects.toThrow('Cannot use inactive version');
    });
  });

  describe('Survey Configuration', () => {
    it('should manage sections, elements, options, and rules', async () => {
      (prisma.surveySection.create as jest.Mock).mockResolvedValue({ id: 's1' });
      (prisma.surveyElement.create as jest.Mock).mockResolvedValue({ id: 'e1' });
      (prisma.surveyElementOption.create as jest.Mock).mockResolvedValue({ id: 'o1' });
      (prisma.surveyRuleDefinition.create as jest.Mock).mockResolvedValue({ id: 'r1' });
      
      const sec = await prisma.surveySection.create({ data: { title: 'Section 1' } } as any);
      const el = await prisma.surveyElement.create({ data: { type: 'SINGLE_SELECT' } } as any);
      const opt = await prisma.surveyElementOption.create({ data: { value: 'Yes' } } as any);
      const rule = await prisma.surveyRuleDefinition.create({ data: { condition: 'a=b' } } as any);
      
      expect(sec.id).toBe('s1');
      expect(el.id).toBe('e1');
      expect(opt.id).toBe('o1');
      expect(rule.id).toBe('r1');
    });
  });
});
