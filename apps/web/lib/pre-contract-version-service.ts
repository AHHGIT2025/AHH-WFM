import { prisma } from '@ahh-wfm/database';

export class PreContractVersionService {
  /**
   * Validates if a new effective date overlaps with an existing ACTIVE version
   * for the same entity and precedence level.
   */
  static async checkOverlap(entityType: 'SurveyTemplate' | 'SiteConditionCategory' | 'CostConfiguration', entityId: string, effectiveFrom: Date, effectiveTo: Date | null, companyId: string | null, operationScope: string | null) {
    // This is a simplified check. A robust check would query the DB for ACTIVE versions of the same entity 
    // that have intersecting date ranges and the same precedence scope.
    let overlapping = 0;
    
    if (entityType === 'SurveyTemplate') {
      const activeVersions = await prisma.surveyTemplateVersion.findMany({
        where: {
          templateId: entityId,
          status: 'ACTIVE',
        }
      });
      overlapping = activeVersions.filter(v => {
        if (!v.effectiveFrom) return false; // Should not happen for ACTIVE
        const start = v.effectiveFrom.getTime();
        const end = v.effectiveTo ? v.effectiveTo.getTime() : Infinity;
        const newStart = effectiveFrom.getTime();
        const newEnd = effectiveTo ? effectiveTo.getTime() : Infinity;
        return (newStart <= end && newEnd >= start);
      }).length;
    }
    
    if (overlapping > 0) {
      throw new Error('Overlapping ACTIVE versions are not permitted.');
    }
  }

  static async activateVersion(entityType: 'SurveyTemplate', versionId: string, effectiveFrom: Date, effectiveTo?: Date) {
    // 1. Fetch version
    const version = await prisma.surveyTemplateVersion.findUnique({ where: { id: versionId } });
    if (!version || version.status !== 'DRAFT') throw new Error('Only DRAFT versions can be activated.');
    
    // 2. Fetch template scope
    const template = await prisma.surveyTemplate.findUnique({ where: { id: version.templateId } });
    
    // 3. Check overlaps
    await this.checkOverlap(entityType, version.templateId, effectiveFrom, effectiveTo || null, template?.companyId || null, template?.operationScope || null);
    
    // 4. Update
    return prisma.surveyTemplateVersion.update({
      where: { id: versionId },
      data: {
        status: 'ACTIVE',
        effectiveFrom,
        effectiveTo,
      }
    });
  }

  static async retireVersion(entityType: 'SurveyTemplate', versionId: string) {
    const version = await prisma.surveyTemplateVersion.findUnique({ where: { id: versionId } });
    if (!version || version.status !== 'ACTIVE') throw new Error('Only ACTIVE versions can be retired.');
    
    return prisma.surveyTemplateVersion.update({
      where: { id: versionId },
      data: {
        status: 'RETIRED',
        effectiveTo: new Date()
      }
    });
  }
}
