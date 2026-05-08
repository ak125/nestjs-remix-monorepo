import { stat } from 'node:fs/promises';
import type { PhpVsRemixComparison } from './types';

export interface PhpVsRemixOptions {
  snapshotDir: string | null;
  sampleUrls: string[];
}

export async function runPhpVsRemixComparison(opts: PhpVsRemixOptions): Promise<PhpVsRemixComparison> {
  if (!opts.snapshotDir) {
    return { available: false, samples: [] };
  }
  try {
    await stat(opts.snapshotDir);
  } catch {
    return { available: false, samples: [] };
  }

  const samples = opts.sampleUrls.map((url) => ({
    url,
    php_snapshot_present: false,
    remix_diff: 'snapshot_not_implemented_yet — to enrich in PR-2 once first PR-4 baseline captured',
  }));

  return { available: true, samples };
}
