import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import type { R2RouteAudit } from './types';

export interface R2AuditOptions {
  routesRoot: string;
  patterns: string[];
}

function resolveRoutesRoot(input: string): string {
  if (input.startsWith('/')) return input;
  // Resolve relative to monorepo root regardless of cwd (vitest runs from backend/, tsx may run from app/)
  const cwd = process.cwd();
  if (cwd.endsWith('/backend')) {
    return path.resolve(cwd, '..', input);
  }
  return path.resolve(cwd, input);
}

export async function runR2RoutesAudit(opts: R2AuditOptions): Promise<R2RouteAudit> {
  const root = resolveRoutesRoot(opts.routesRoot);

  let exists = false;
  try {
    const s = await stat(root);
    exists = s.isDirectory();
  } catch {
    return { found: false, evidence: [] };
  }
  if (!exists) return { found: false, evidence: [] };

  const evidence: R2RouteAudit['evidence'] = [];
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return { found: false, evidence: [] };
  }

  for (const e of entries) {
    if (!e.isFile()) continue;
    for (const pattern of opts.patterns) {
      if (e.name === pattern) {
        evidence.push({ path: path.join(opts.routesRoot, e.name), pattern });
      }
    }
  }

  return { found: evidence.length > 0, evidence };
}
