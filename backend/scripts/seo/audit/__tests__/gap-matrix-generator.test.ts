import { describe, it, expect } from 'vitest';
import { renderGapMatrixMarkdown, BASELINE_MATRIX_ROWS } from '../gap-matrix-generator';
import type { GapMatrixRow } from '../types';

describe('Gap matrix generator', () => {
  it('BASELINE_MATRIX_ROWS contains the 10 mappings from itération 8', () => {
    expect(BASELINE_MATRIX_ROWS.length).toBeGreaterThanOrEqual(10);
    expect(BASELINE_MATRIX_ROWS.some((r) => r.php_file === 'index.php')).toBe(true);
    expect(BASELINE_MATRIX_ROWS.some((r) => r.php_file.includes('v7.products.fiche'))).toBe(true);
  });

  it('renderGapMatrixMarkdown renders a markdown table with header', () => {
    const rows: GapMatrixRow[] = [
      {
        php_file: 'foo.php',
        monorepo_equivalent: 'BarService',
        status: '✅',
        gap: 'none',
        priority: 'P0',
        proof_link: 'src/bar.ts:12',
      },
    ];
    const md = renderGapMatrixMarkdown(rows, { generated_at: '2026-05-08T00:00:00Z' });
    expect(md).toContain('| php_file | monorepo_equivalent | status | gap | priority | proof_link |');
    expect(md).toContain('| foo.php | BarService | ✅ | none | P0 | src/bar.ts:12 |');
    expect(md).toContain('Generated: 2026-05-08T00:00:00Z');
  });
});
