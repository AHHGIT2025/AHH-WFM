import crypto from 'crypto';

export function canonicalHash(obj: any): string {
  if (obj === null || obj === undefined) return 'null';
  
  if (typeof obj === 'number' || typeof obj === 'boolean' || typeof obj === 'string') {
    return String(obj);
  }

  if (obj instanceof Date) {
    return obj.toISOString();
  }

  if (Array.isArray(obj)) {
    // Array sorting isn't safe for all objects unless we have a deterministic sort key.
    // We will just map over them. In reality, we should sort based on ID or Code.
    const mapped = obj.map(item => canonicalHash(item)).sort();
    return `[${mapped.join(',')}]`;
  }

  if (typeof obj === 'object') {
    const keys = Object.keys(obj)
      .filter(k => !['createdAt', 'updatedAt', 'id', 'versionId', 'status', 'versionNumber', 'createdById'].includes(k)) // exclude transient fields
      .sort();
    
    const parts = keys.map(k => `${k}:${canonicalHash(obj[k])}`);
    return `{${parts.join(',')}}`;
  }

  return '';
}

export function generateSha256(payload: any): string {
  const hashString = canonicalHash(payload);
  return crypto.createHash('sha256').update(hashString, 'utf8').digest('hex');
}
