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
        templateVersion: {
          include: { template: true }
        },
        case: {
          include: {
            client: true,
            site: true
          }
        }
      }
    });

    if (!survey) throw new Error('Survey not found.');

    // Note: For PC-1 we assume the full snapshot includes all sections/elements.
    // In a real implementation we would recursively fetch sections -> elements -> options -> rules.
    const rawSnapshotData = {
      surveyId: survey.id,
      companyId: survey.companyId,
      operationScope: survey.operationScope,
      templateVersionId: survey.templateVersionId,
      template: {
        id: survey.templateVersion.template.id,
        title: survey.templateVersion.template.title,
        version: survey.templateVersion.versionNumber,
      },
      client: {
        id: survey.case?.client?.id,
        name: survey.case?.client?.clientName,
      },
      site: {
        id: survey.case?.site?.id,
        name: survey.case?.site?.siteName,
      },
      responses: survey.responses // Assuming responses is a JSON field
    };

    const canonicalData = this.canonicalize(rawSnapshotData);
    const sha256Hash = this.calculateSHA256(canonicalData);

    return {
      snapshot: canonicalData,
      sha256: sha256Hash
    };
  }
}
