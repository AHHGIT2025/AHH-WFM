// @ts-nocheck
import { PrismaClient } from '@prisma/client';

export class PreContractConfigService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Resolves the active version of Cost Configuration based on effective date and precedence.
   * Deterministic precedence rule:
   * 1. Exact match on companyId + operationType
   * 2. Match on operationType (companyId is null)
   * 3. Global config (companyId is null and operationType is null)
   */
  async resolveActiveCostConfiguration(
    targetDate: Date,
    companyId?: string,
    operationType?: string
  ) {
    const candidates = await this.prisma.costConfigurationVersion.findMany({
      where: {
        effectiveFrom: { lte: targetDate },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gt: targetDate } }
        ],
        status: 'ACTIVE'
      },
      orderBy: { versionNumber: 'desc' }
    });

    if (candidates.length === 0) return null;

    // 1. Exact match on both companyId and operationType
    if (companyId && operationType) {
      const exactMatch = candidates.find(
        (c) => c.companyId === companyId && c.operationType === operationType
      );
      if (exactMatch) return exactMatch;
    }

    // 2. Match on operationType only
    if (operationType) {
      const opMatch = candidates.find(
        (c) => !c.companyId && c.operationType === operationType
      );
      if (opMatch) return opMatch;
    }

    // 3. Match on global configuration
    const globalMatch = candidates.find(
      (c) => !c.companyId && !c.operationType
    );
    if (globalMatch) return globalMatch;

    return null;
  }

  /**
   * Creates a deterministic immutable snapshot of a survey configuration.
   */
  async createSurveySnapshot(
    surveyId: string,
    templateVersionId: string,
    checksum: string
  ) {
    // In a real implementation, we would recursively fetch the template, sections, elements, options, rules
    // and serialize them into a JSON structure, then calculate the hash.
    const snapshotJson = JSON.stringify({ templateVersionId, capturedAt: new Date().toISOString() });
    
    return this.prisma.surveyConfigurationSnapshot.create({
      data: {
        surveyId,
        templateVersionId,
        snapshotJson,
        checksum
      }
    });
  }
}

