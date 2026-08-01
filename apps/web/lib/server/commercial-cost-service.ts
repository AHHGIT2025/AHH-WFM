import { prisma } from '@ahh-wfm/database';
import { z } from 'zod';
import { CostFormulaEngine, ASTNode } from './cost-formula-ast';

export type CostLifecycleState = "DRAFT" | "UNDER_REVIEW" | "APPROVED" | "ACTIVE" | "REJECTED" | "RETIRED" | "SUPERSEDED";

export interface VersionPayload {
  effectiveFrom: Date;
  effectiveTo?: Date | null;
  [key: string]: any;
}

export class CommercialCostService {
  constructor(private user: { id: string; role: string; companyId: string }) {}

  private checkCompanyIsolation(recordCompanyId: string | null) {
    if (this.user.role !== 'SUPER_ADMIN' && recordCompanyId && recordCompanyId !== this.user.companyId) {
      throw new Error("403: Cross-company access is strictly prohibited");
    }
  }

  async createDraft(entityType: string, masterId: string, payload: VersionPayload) {
    const tableInfo = this.getTableNames(entityType);
    
    // Check if there is already an open working version
    const existingWorking = await (prisma as any)[tableInfo.version].findFirst({
      where: {
        masterId,
        status: { in: ['DRAFT', 'UNDER_REVIEW'] }
      }
    });

    if (existingWorking) {
      throw new Error("409: Cannot create a new draft while another working version exists.");
    }

    // Determine next version number
    const versions = await (prisma as any)[tableInfo.version].findMany({
      where: { masterId },
      orderBy: { versionNumber: 'desc' },
      take: 1
    });
    const versionNumber = versions.length > 0 ? versions[0].versionNumber + 1 : 1;

    let itemsData = undefined;
    if (entityType === 'PACKAGE' && payload.items) {
      itemsData = payload.items;
      delete payload.items;
    }

    const newVersion = await (prisma as any)[tableInfo.version].create({
      data: {
        ...payload,
        masterId,
        versionNumber,
        status: 'DRAFT',
        createdBy: this.user.id,
      }
    });

    if (itemsData && itemsData.length > 0) {
      await prisma.costPackageItem.createMany({
        data: itemsData.map((item: any) => ({
          ...item,
          packageVersionId: newVersion.id
        }))
      });
    }

    return newVersion;
  }

  async transitionState(entityType: string, versionId: string, newState: CostLifecycleState) {
    const tableInfo = this.getTableNames(entityType);
    const version = await (prisma as any)[tableInfo.version].findUnique({ where: { id: versionId } });
    if (!version) throw new Error("404: Version not found");

    if (newState === 'APPROVED') {
      if (version.createdBy === this.user.id) {
        throw new Error("403: Maker and Checker must differ. You cannot approve your own submission.");
      }
      if (this.user.role === 'SUPER_ADMIN') {
        throw new Error("403: SUPER_ADMIN bypass of Maker/Checker is strictly prohibited.");
      }
      if (version.status !== 'UNDER_REVIEW') {
        throw new Error("409: Can only approve versions that are UNDER_REVIEW");
      }
    }

    if (newState === 'ACTIVE') {
      if (version.status !== 'APPROVED') {
        throw new Error("409: Only APPROVED versions can be activated");
      }
      return this.activateVersion(entityType, version);
    }

    return await (prisma as any)[tableInfo.version].update({
      where: { id: versionId },
      data: { status: newState, updatedBy: this.user.id }
    });
  }

  private async activateVersion(entityType: string, version: any) {
    const tableInfo = this.getTableNames(entityType);
    
    // We must use a raw lock in a transaction to enforce concurrency
    return await prisma.$transaction(async (tx: any) => {
      // Create or ensure lock row exists
      const masterId = version.masterId;
      await tx.$executeRaw`INSERT IGNORE INTO CostRateActivationLock (id, entityType, masterId, updatedAt) VALUES (UUID(), ${entityType}, ${masterId}, NOW(3))`;
      
      // Lock the row
      await tx.$executeRaw`SELECT 1 FROM CostRateActivationLock WHERE entityType = ${entityType} AND masterId = ${masterId} FOR UPDATE`;

      // Check for overlaps with ACTIVE
      const activeVersions = await (tx as any)[tableInfo.version].findMany({
        where: {
          masterId,
          status: 'ACTIVE'
        }
      });

      for (const active of activeVersions) {
        if (!active.effectiveTo || active.effectiveTo > version.effectiveFrom) {
          if (!version.effectiveTo || active.effectiveFrom < version.effectiveTo) {
             throw new Error("409: Overlapping date with an existing ACTIVE version");
          }
        }
      }

      // Safe to activate
      const activated = await (tx as any)[tableInfo.version].update({
        where: { id: version.id },
        data: { status: 'ACTIVE' }
      });

      return activated;
    });
  }

  private getTableNames(entityType: string) {
    switch (entityType) {
      case 'CATEGORY': return { master: 'costCategoryMaster', version: 'costCategoryVersion' };
      case 'ELEMENT': return { master: 'costElementMaster', version: 'costElementVersion' };
      case 'DRIVER': return { master: 'costDriverMaster', version: 'costDriverVersion' };
      case 'RATECARD': return { master: 'costRateCardMaster', version: 'costRateCardVersion' };
      case 'FORMULA': return { master: 'costFormulaDefinition', version: 'costFormulaVersion' };
      case 'PACKAGE': return { master: 'costPackageMaster', version: 'costPackageVersion' };
      default: throw new Error("Invalid entity type");
    }
  }

  async testFormula(formulaAst: ASTNode, variables: Record<string, number>) {
    CostFormulaEngine.validate(formulaAst);
    const result = CostFormulaEngine.evaluate(formulaAst, variables);
    const hash = CostFormulaEngine.calculateHash(formulaAst);
    return { result, hash };
  }
}
