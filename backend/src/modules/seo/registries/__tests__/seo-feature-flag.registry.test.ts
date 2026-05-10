import { SeoFeatureFlagRegistry } from '../seo-feature-flag.registry';

describe('SeoFeatureFlagRegistry', () => {
  let registry: SeoFeatureFlagRegistry;
  const ENV_KEYS = [
    'SEO_CHAIN_RM_MODE',
    'SEO_CHAIN_GAMME_MODE',
    'SEO_CHAIN_R7_MODE',
    'SEO_CHAIN_R8_MODE',
    'SEO_CHAIN_HOME_MODE',
    'SEO_CHAIN_R2_MODE',
    'SEO_CHAIN_BLOG_MODE',
    'SEO_CHAIN_DUPLICATE_GATE_MODE',
  ];

  beforeEach(() => {
    registry = new SeoFeatureFlagRegistry();
    for (const k of ENV_KEYS) delete process.env[k];
  });

  afterAll(() => {
    for (const k of ENV_KEYS) delete process.env[k];
  });

  it('mode() defaults to off when env var is unset', () => {
    expect(registry.mode('R8')).toBe('off');
    expect(registry.mode('RM')).toBe('off');
  });

  it('mode() returns the env-supplied value when valid', () => {
    process.env.SEO_CHAIN_R8_MODE = 'shadow';
    process.env.SEO_CHAIN_RM_MODE = 'on';
    expect(registry.mode('R8')).toBe('shadow');
    expect(registry.mode('RM')).toBe('on');
  });

  it('mode() falls back to off on invalid env value (defensive)', () => {
    process.env.SEO_CHAIN_R8_MODE = 'bogus';
    expect(registry.mode('R8')).toBe('off');
  });

  it('snapshot() returns 8 entries with current modes', () => {
    process.env.SEO_CHAIN_R7_MODE = 'shadow';
    const snap = registry.snapshot();
    expect(Object.keys(snap)).toHaveLength(8);
    expect(snap.R7).toBe('shadow');
    expect(snap.R8).toBe('off');
  });

  it('list() returns the 8 canonical chain flags', () => {
    expect(registry.list()).toHaveLength(8);
    expect(registry.list()).toContain('DUPLICATE_GATE');
  });
});
