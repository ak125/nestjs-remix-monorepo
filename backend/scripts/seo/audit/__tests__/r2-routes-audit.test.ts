import { describe, it, expect } from 'vitest';
import { runR2RoutesAudit } from '../r2-routes-audit';

describe('Volet 3 — R2 routes audit', () => {
  it('returns found=false when no R2 route patterns match', async () => {
    const result = await runR2RoutesAudit({
      routesRoot: '/tmp/empty-routes-test',
      patterns: ['produit.$ref.tsx', 'pieces.$piece_id.tsx'],
    });
    expect(result.found).toBe(false);
    expect(result.evidence).toEqual([]);
  });

  it('returns found=true when at least one route matches the pattern', async () => {
    const result = await runR2RoutesAudit({
      routesRoot: 'frontend/app/routes',
      patterns: ['pieces.$slug.tsx'],
    });
    expect(result.found).toBe(true);
    expect(result.evidence.length).toBeGreaterThan(0);
  });
});
