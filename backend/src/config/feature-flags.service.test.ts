import type { ConfigService } from '@nestjs/config';
import { FeatureFlagsService } from './feature-flags.service';

const KEY = 'DIAGNOSTIC_PROJECTION_ENABLED';

function makeService(value?: string) {
  const config = {
    get: jest.fn((key: string) => (key === KEY ? value : undefined)),
  };
  return new FeatureFlagsService(config as unknown as ConfigService);
}

describe('FeatureFlagsService.diagnosticProjectionEnabled', () => {
  it('defaults to false when the variable is unset', () => {
    expect(makeService().diagnosticProjectionEnabled).toBe(false);
  });

  it('is true only for the exact string "true"', () => {
    expect(makeService('true').diagnosticProjectionEnabled).toBe(true);
  });

  it.each(['1', 'TRUE', 'yes'])(
    'reads %p as false (bool() compares to the literal "true")',
    (value) => {
      expect(makeService(value).diagnosticProjectionEnabled).toBe(false);
    },
  );

  it('is environment-only: no admin override can switch it on', () => {
    const service = makeService('false');
    expect(() => service.setOverride(KEY, 'true')).toThrow(
      `Unknown flag key: ${KEY}`,
    );
    expect(service.diagnosticProjectionEnabled).toBe(false);
    expect(Object.keys(service.listFlags())).not.toContain(KEY);
  });
});

describe('FeatureFlagsService.sitemapR2Source', () => {
  const CLE = 'SITEMAP_R2_SOURCE';
  const service = (value?: string) =>
    new FeatureFlagsService({
      get: jest.fn((key: string) => (key === CLE ? value : undefined)),
    } as unknown as ConfigService);

  it('vaut legacy quand la variable est absente', () => {
    expect(service().sitemapR2Source).toBe('legacy');
  });

  it("ne vaut vendable que pour la chaîne exacte 'vendable'", () => {
    expect(service('vendable').sitemapR2Source).toBe('vendable');
  });

  it.each(['', 'legacy', 'VENDABLE', 'vendable ', 'true', '1', 'sellable'])(
    'lit %p comme legacy',
    (value) => {
      expect(service(value).sitemapR2Source).toBe('legacy');
    },
  );

  it("reste hors des overrides admin : seul l'environnement bascule", () => {
    const s = service('legacy');
    expect(() => s.setOverride(CLE, 'vendable')).toThrow(
      `Unknown flag key: ${CLE}`,
    );
    expect(s.sitemapR2Source).toBe('legacy');
    expect(Object.keys(s.listFlags())).not.toContain(CLE);
  });
});
