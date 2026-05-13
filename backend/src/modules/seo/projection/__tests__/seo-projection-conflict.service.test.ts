/**
 * Tests SeoProjectionConflictService — classifyDiff helper (pure, no DB).
 */
import { SeoProjectionConflictService } from '../seo-projection-conflict.service';

describe('SeoProjectionConflictService.classifyDiff', () => {
  // Helper minimal : on instantie sans wiring DI (les méthodes pures n'utilisent
  // pas this.supabase). Le service réel est testé en intégration ailleurs.
  const svc = Object.create(SeoProjectionConflictService.prototype) as SeoProjectionConflictService;

  it('safe_apply when current is null', () => {
    const r = svc.classifyDiff(null, 'new-value', 'fact');
    expect(r.kind).toBe('safe_apply');
  });

  it('safe_apply when current is undefined', () => {
    const r = svc.classifyDiff(undefined, 'new-value', 'fact');
    expect(r.kind).toBe('safe_apply');
  });

  it('safe_apply when current and proposed are JSON-equal', () => {
    const r = svc.classifyDiff({ k: 'v' }, { k: 'v' }, 'block');
    expect(r.kind).toBe('safe_apply');
  });

  it('conflict when current and proposed differ (fact)', () => {
    const r = svc.classifyDiff('old', 'new', 'fact');
    expect(r.kind).toBe('conflict');
    expect(r.conflict_kind).toBe('fact_value_diff');
  });

  it('conflict when current and proposed differ (block)', () => {
    const r = svc.classifyDiff('old md', 'new md', 'block');
    expect(r.kind).toBe('conflict');
    expect(r.conflict_kind).toBe('block_content_diff');
  });

  it('conflict when current and proposed differ (source)', () => {
    const r = svc.classifyDiff({ id: 'a' }, { id: 'b' }, 'source');
    expect(r.kind).toBe('conflict');
    expect(r.conflict_kind).toBe('source_diff');
  });

  it('no side effects (pure)', () => {
    const before = { k: 'v', nested: { a: 1 } };
    svc.classifyDiff(before, { k: 'w' }, 'fact');
    expect(before).toEqual({ k: 'v', nested: { a: 1 } });
  });
});
