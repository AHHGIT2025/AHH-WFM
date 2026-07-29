import { SurveySnapshotEngine } from '../../apps/web/lib/survey-snapshot-engine';
import { SurveyResponseValidator } from '../../apps/web/lib/survey-response-validator';
import { prisma } from '@ahh-wfm/database';

jest.mock('@ahh-wfm/database', () => ({
  prisma: {
    preContractSurvey: {
      findUnique: jest.fn(),
    }
  }
}));

describe('PC-1 Survey Data', () => {
  describe('SurveySnapshotEngine', () => {
    it('should calculate identical SHA-256 for reordered object keys', () => {
      const obj1 = { a: 1, b: 2, c: { d: 4, e: 5 } };
      const obj2 = { c: { e: 5, d: 4 }, b: 2, a: 1 };
      
      const canonical1 = SurveySnapshotEngine.canonicalize(obj1);
      const canonical2 = SurveySnapshotEngine.canonicalize(obj2);
      
      expect(SurveySnapshotEngine.calculateSHA256(canonical1))
        .toEqual(SurveySnapshotEngine.calculateSHA256(canonical2));
    });
  });

  describe('SurveyResponseValidator', () => {
    const mockTemplate = {
      elements: [
        { id: 'el1', type: 'NUMBER', isMandatory: true, minValue: 1, maxValue: 10 },
        { id: 'el2', type: 'SINGLE_SELECT', options: [{ value: 'A' }, { value: 'B' }] },
        { id: 'el3', type: 'MULTI_SELECT', options: [{ value: 'X' }, { value: 'Y' }] }
      ]
    };

    it('should fail if mandatory element is missing', () => {
      expect(() => SurveyResponseValidator.validate(mockTemplate, {}))
        .toThrow('Element el1 (undefined) is mandatory.');
    });

    it('should fail if number is out of bounds', () => {
      expect(() => SurveyResponseValidator.validate(mockTemplate, { el1: 15 }))
        .toThrow('Element el1 is above maximum value 10.');
    });

    it('should fail if select option is invalid', () => {
      expect(() => SurveyResponseValidator.validate(mockTemplate, { el1: 5, el2: 'C' }))
        .toThrow('Element el2 has invalid option selected.');
    });

    it('should fail if multi-select option is invalid', () => {
      expect(() => SurveyResponseValidator.validate(mockTemplate, { el1: 5, el3: ['X', 'Z'] }))
        .toThrow('Element el3 contains invalid option Z.');
    });

    it('should pass valid data', () => {
      expect(() => SurveyResponseValidator.validate(mockTemplate, { el1: 5, el2: 'A', el3: ['X', 'Y'] }))
        .not.toThrow();
    });
  });
});
