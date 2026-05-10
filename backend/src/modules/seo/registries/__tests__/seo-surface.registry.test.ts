import { RoleId } from '@repo/seo-roles';
import { SeoSurfaceRegistry } from '../seo-surface.registry';

describe('SeoSurfaceRegistry', () => {
  let registry: SeoSurfaceRegistry;

  beforeEach(() => {
    registry = new SeoSurfaceRegistry();
  });

  it('list() returns the 16 canonical surfaces', () => {
    const surfaces = registry.list();
    expect(surfaces).toHaveLength(16);
    expect(surfaces).toContain('R0_HOME');
    expect(surfaces).toContain('UNAVAILABLE_412');
  });

  it('resolveRole() maps surface_key → canonical RoleId', () => {
    expect(registry.resolveRole('R8_VEHICLE')).toBe(RoleId.R8_VEHICLE);
    expect(registry.resolveRole('R1_GAMME_ROUTER')).toBe(RoleId.R1_ROUTER);
    expect(registry.resolveRole('BLOG_ADVICE')).toBe(RoleId.R3_CONSEILS);
  });

  it('getThresholds() returns chiffrée config for surface', () => {
    const t = registry.getThresholds('R1_GAMME_VEHICLE_ROUTER');
    expect(t.min_families).toBe(3);
    expect(t.min_gammes).toBe(5);
    expect(t.strict_canonical_match).toBe(true);
  });

  it('isKnown() acts as a type-guard for surface validity', () => {
    expect(registry.isKnown('R0_HOME')).toBe(true);
    expect(registry.isKnown('NOT_A_SURFACE')).toBe(false);
  });

  it('resolveRole() throws on unknown surface (fail-fast)', () => {
    expect(() => registry.resolveRole('UNKNOWN_SURFACE' as never)).toThrow();
  });
});
