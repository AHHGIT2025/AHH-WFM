import { createHash } from 'crypto';
import { prisma } from '@ahh-wfm/database';

export class SurveySnapshotEngine {
  /**
   * Sorts object keys recursively to ensure deterministic output for JSON stringification.
   */
  static canonicalize(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    
    if (Array.isArray(obj)) {
      // We don't sort array elements, just their properties if they are objects
      return obj.map((item) => this.canonicalize(item));
    }
    
    const sortedKeys = Object.keys(obj).sort();
    const result: Record<string, any> = {};
    for (const key of sortedKeys) {
      result[key] = this.canonicalize(obj[key]);
    }
    return result;
  }

  static calculateSHA256(canonicalData: any): string {
    const jsonString = JSON.stringify(canonicalData);
    const hash = createHash('sha256');
    hash.update(jsonString);
    return hash.digest('hex');
  }

  static async generateSnapshot(surveyId: string) {
    const survey = await prisma.preContractSurvey.findUnique({
      where: { id: surveyId },
      include: {
        case: {
          include: {
            prospectClient: true,
            prospectiveSite: true
          }
        },
        snapshot: {
          include: { templateVersion: { include: { template: true } } }
        },
        responses: true
      }
    });

    if (!survey) throw new Error('Survey not found.');

    const rawSnapshotData = {
      surveyId: (survey as any).id,
      companyId: (survey as any).companyId,
      operationScope: (survey as any).operationType,
      templateVersionId: (survey as any).snapshot?.templateVersionId,
      template: {
        id: (survey as any).snapshot?.templateVersion.template.id,
        title: (survey as any).snapshot?.templateVersion.template.title,
        version: (survey as any).snapshot?.templateVersion.versionNumber,
      },
      client: {
        id: (survey as any).case?.prospectClientId,
        name: (survey as any).case?.prospectClient?.clientName,
      },
      site: {
        id: (survey as any).prospectiveSiteId,
        name: (survey as any).case?.prospectiveSite?.siteName,
      },
      responses: (survey as any).responses 
    };

    const canonicalData = this.canonicalize(rawSnapshotData);
    const sha256Hash = this.calculateSHA256(canonicalData);

    return {
      snapshot: canonicalData,
      sha256: sha256Hash
    };
  }
}
