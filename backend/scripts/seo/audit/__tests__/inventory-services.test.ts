import { describe, it, expect } from 'vitest';
import { runInventoryVolet, mapToTargetService } from '../inventory-services';

describe('Volet 1 — inventory services', () => {
  it('runInventoryVolet returns array with at least 1 service in the seo module', async () => {
    const entries = await runInventoryVolet({
      modulesRoot: 'backend/src/modules',
      patterns: ['seo', 'switch', 'template', 'title', 'meta', 'canonical', 'robots', 'indexability'],
    });
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.some((e) => e.path.includes('/seo/'))).toBe(true);
  });

  it('mapToTargetService maps SeoSwitchesService to SeoSwitchSelector cible', () => {
    expect(mapToTargetService('seo-switches.service.ts')).toBe('SeoSwitchSelector');
  });

  it('mapToTargetService returns null when no mapping known', () => {
    expect(mapToTargetService('unrelated.service.ts')).toBe(null);
  });
});
