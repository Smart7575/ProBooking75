export enum OperationType {
  CREATE = 'create',
  GET = 'get',
  LIST = 'list',
  UPDATE = 'update',
  DELETE = 'delete',
  WRITE = 'write',
}

export function formatFirestoreError(
  error: any,
  operation: OperationType,
  path?: string
): string {
  const code = error?.code || 'unknown';
  const message = error?.message || 'An error occurred';

  if (code === 'permission-denied') {
    return `Permission denied during ${operation} operation${path ? ` on ${path}` : ''}. Please check authentication or security rules.`;
  }

  if (code === 'not-found') {
    return `Document not found during ${operation} operation${path ? ` on ${path}` : ''}.`;
  }

  return `Firestore error (${code}): ${message}`;
}
