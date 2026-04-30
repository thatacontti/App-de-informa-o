import * as path from 'node:path';

/**
 * Where the briefing PDF/HTML artefacts are written. Resolves relative
 * to the workspace root so dev and Docker (cwd=/app/apps/web) agree.
 */
export function briefingStorageDir(): string {
  return path.resolve(process.cwd(), 'storage', 'briefings');
}
