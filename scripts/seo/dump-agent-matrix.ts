/**
 * dump-agent-matrix.ts — write the SEO Agent Operating Matrix to disk.
 *
 * Outputs:
 *   audit-reports/seo-agent-matrix.md    (human-readable, with timestamp)
 *   audit-reports/seo-agent-matrix.json  (deterministic — for diff-based CI)
 *
 * Usage (matches the existing pattern, e.g. audit-cross-gamme-overlap.ts):
 *   npx tsx scripts/seo/dump-agent-matrix.ts
 *
 * The CLI instantiates OperatingMatrixService directly with a minimal
 * ConfigService stub backed by process.env. NestJS DI bootstrap is intentionally
 * skipped: tsx (esbuild) does not emit `emitDecoratorMetadata` required by
 * NestJS injection. For app-runtime usage, the service is exposed via
 * OperatingMatrixModule the standard way (when wired into a NestJS module).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { ConfigService } from '@nestjs/config';
import { OperatingMatrixService } from '../../backend/src/config/operating-matrix.service';

function buildConfigStub(): ConfigService {
  const env = process.env;
  return {
    get: <T = unknown>(key: string): T | undefined =>
      env[key] as T | undefined,
  } as unknown as ConfigService;
}

async function main(): Promise<void> {
  const svc = new OperatingMatrixService(buildConfigStub());

  const repoRoot = path.resolve(__dirname, '../..');
  const outDir = path.join(repoRoot, 'audit-reports');
  fs.mkdirSync(outDir, { recursive: true });

  const mdPath = path.join(outDir, 'seo-agent-matrix.md');
  const jsonPath = path.join(outDir, 'seo-agent-matrix.json');

  fs.writeFileSync(mdPath, svc.formatMarkdown(), 'utf-8');
  fs.writeFileSync(jsonPath, svc.formatJsonString(), 'utf-8');

  // eslint-disable-next-line no-console
  console.log(
    `[seo:matrix] wrote ${path.relative(repoRoot, mdPath)} + ${path.relative(repoRoot, jsonPath)}`,
  );
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[seo:matrix] failed', err);
  process.exit(1);
});
