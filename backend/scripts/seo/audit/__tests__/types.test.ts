import { describe, it, expect } from 'vitest';
import { GapMatrixRowSchema, AuditReportSchema, GapStatus, Priority } from '../types';

describe('Audit types', () => {
  it('GapMatrixRow accepts valid row', () => {
    const row = {
      php_file: 'v7.products.car.gamme.php',
      monorepo_equivalent: 'GammeResponseBuilderService',
      status: '✅' as GapStatus,
      gap: 'none',
      priority: 'P0' as Priority,
      proof_link: 'backend/src/modules/gamme-rest/services/gamme-response-builder.service.ts:71',
    };
    expect(() => GapMatrixRowSchema.parse(row)).not.toThrow();
  });

  it('GapMatrixRow rejects invalid status', () => {
    const bad = { php_file: 'x', monorepo_equivalent: 'y', status: 'BAD', gap: '', priority: 'P0', proof_link: '' };
    expect(() => GapMatrixRowSchema.parse(bad)).toThrow();
  });

  it('AuditReport requires all 5 volet outputs', () => {
    const minimal = {
      generated_at: new Date().toISOString(),
      gap_matrix: [],
      service_inventory: [],
      diff_samples: [],
      r2_routes_audit: { found: false, evidence: [] },
      r2_volume_stats: { total_pieces: 0, indexable_estimate: 0 },
      php_vs_remix_comparison: { available: false, samples: [] },
    };
    expect(() => AuditReportSchema.parse(minimal)).not.toThrow();
  });
});
