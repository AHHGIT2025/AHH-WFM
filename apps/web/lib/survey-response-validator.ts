export class SurveyResponseValidator {
  /**
   * Validates survey responses against the template structure.
   */
  static validate(templateDefinition: any, responses: any) {
    // 1. Basic format check
    if (!responses || typeof responses !== 'object') {
      throw new Error('Responses must be an object.');
    }

    const errors: string[] = [];

    // 2. Iterate elements defined in template
    const elements = templateDefinition.elements || [];
    
    for (const element of elements) {
      const responseValue = responses[element.id];
      
      // Check mandatory
      if (element.isMandatory && (responseValue === undefined || responseValue === null || responseValue === '')) {
        errors.push(`Element ${element.id} (${element.label}) is mandatory.`);
        continue;
      }

      if (responseValue !== undefined && responseValue !== null) {
        // Validate by type
        switch (element.type) {
          case 'NUMBER':
            if (typeof responseValue !== 'number') {
              errors.push(`Element ${element.id} must be a number.`);
            } else {
              if (element.minValue !== undefined && responseValue < element.minValue) {
                errors.push(`Element ${element.id} is below minimum value ${element.minValue}.`);
              }
              if (element.maxValue !== undefined && responseValue > element.maxValue) {
                errors.push(`Element ${element.id} is above maximum value ${element.maxValue}.`);
              }
            }
            break;
            
          case 'SINGLE_SELECT':
            const options = element.options || [];
            const validValues = options.map((o: any) => o.value);
            if (!validValues.includes(responseValue)) {
              errors.push(`Element ${element.id} has invalid option selected.`);
            }
            break;

          case 'MULTI_SELECT':
            if (!Array.isArray(responseValue)) {
              errors.push(`Element ${element.id} must be an array of values.`);
            } else {
              const multiOptions = element.options || [];
              const multiValidValues = multiOptions.map((o: any) => o.value);
              for (const v of responseValue) {
                if (!multiValidValues.includes(v)) {
                  errors.push(`Element ${element.id} contains invalid option ${v}.`);
                }
              }
            }
            break;

          case 'REPEATING_ROW':
            if (!Array.isArray(responseValue)) {
              errors.push(`Element ${element.id} must be an array of rows.`);
            }
            // Real implementation would recursively validate columns in the repeating row.
            break;
        }

        // Check mandatory evidence
        if (element.requiresEvidence) {
          const evidenceKey = `${element.id}_evidence`;
          const evidenceVal = responses[evidenceKey];
          if (!evidenceVal || (Array.isArray(evidenceVal) && evidenceVal.length === 0)) {
            errors.push(`Element ${element.id} requires mandatory evidence attachment.`);
          }
        }
      }
    }

    if (errors.length > 0) {
      throw new Error('Validation failed: ' + errors.join('; '));
    }
  }
}
