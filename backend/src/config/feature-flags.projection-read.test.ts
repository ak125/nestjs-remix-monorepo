import { ConfigService } from '@nestjs/config';
import { FeatureFlagsService } from './feature-flags.service';

/**
 * ADR-059 SEO projection READ — dark-launch controls (PR-E1).
 *
 * These invariants pin the *control surface only* — no page is activated by this PR.
 * The decisive property proved here: enabling the projection read for one role on an
 * entity (R3_CONSEILS on `gamme:filtre-a-huile`) can NEVER activate a sibling role
 * (R4_REFERENCE / R6_GUIDE_ACHAT) on the same entity. Role isolation is structural
 * (token `<role>@<entity_key>`, no bare `*`), not a convention.
 */

class FakeConfigService {
  constructor(private readonly env: Record<string, string> = {}) {}
  get<T = string>(key: string): T | undefined {
    return this.env[key] as unknown as T | undefined;
  }
}

const make = (env: Record<string, string> = {}) =>
  new FeatureFlagsService(
    new FakeConfigService(env) as unknown as ConfigService,
  );

const PILOT_ENTITY = 'gamme:filtre-a-huile';

describe('FeatureFlagsService — ADR-059 projection read (PR-E1, dark-launch)', () => {
  describe('defaults ship OFF (no page activated)', () => {
    it('master switch defaults to false', () => {
      expect(make().seoProjectionReadV1).toBe(false);
    });

    it('canary allowlist defaults to empty', () => {
      expect(make().seoProjectionReadCanary).toEqual([]);
    });

    it('flag absent → every (entity, role) resolves to legacy (not eligible)', () => {
      const ff = make();
      expect(ff.isProjectionReadCanary(PILOT_ENTITY, 'R3_CONSEILS')).toBe(
        false,
      );
      expect(ff.isProjectionReadCanary(PILOT_ENTITY, 'R4_REFERENCE')).toBe(
        false,
      );
      expect(ff.isProjectionReadCanary(PILOT_ENTITY, 'R6_GUIDE_ACHAT')).toBe(
        false,
      );
    });
  });

  describe('master switch is a hard prerequisite', () => {
    it('allowlist populated but master OFF → still not eligible', () => {
      const ff = make({
        SEO_PROJECTION_READ_CANARY: `R3_CONSEILS@${PILOT_ENTITY}`,
        // SEO_PROJECTION_READ_V1 intentionally absent → false
      });
      expect(ff.isProjectionReadCanary(PILOT_ENTITY, 'R3_CONSEILS')).toBe(
        false,
      );
    });
  });

  describe('role-scoped eligibility (the pilot: R3_CONSEILS + gamme:filtre-a-huile)', () => {
    const ff = make({
      SEO_PROJECTION_READ_V1: 'true',
      SEO_PROJECTION_READ_CANARY: `R3_CONSEILS@${PILOT_ENTITY}`,
    });

    it('R3 allowlisted → R3 is eligible', () => {
      expect(ff.isProjectionReadCanary(PILOT_ENTITY, 'R3_CONSEILS')).toBe(true);
    });

    it('same entity, R4 NOT allowlisted → R4 stays legacy', () => {
      expect(ff.isProjectionReadCanary(PILOT_ENTITY, 'R4_REFERENCE')).toBe(
        false,
      );
    });

    it('same entity, R6 NOT allowlisted → R6 stays legacy', () => {
      expect(ff.isProjectionReadCanary(PILOT_ENTITY, 'R6_GUIDE_ACHAT')).toBe(
        false,
      );
    });

    it('enabling R3 does NOT bleed to another entity', () => {
      expect(
        ff.isProjectionReadCanary('gamme:disque-de-frein', 'R3_CONSEILS'),
      ).toBe(false);
    });
  });

  describe('role-scoped wildcard <role>@* stays within its role', () => {
    const ff = make({
      SEO_PROJECTION_READ_V1: 'true',
      SEO_PROJECTION_READ_CANARY: 'R3_CONSEILS@*',
    });

    it('enables R3 for any entity', () => {
      expect(ff.isProjectionReadCanary(PILOT_ENTITY, 'R3_CONSEILS')).toBe(true);
      expect(
        ff.isProjectionReadCanary('gamme:disque-de-frein', 'R3_CONSEILS'),
      ).toBe(true);
    });

    it('does NOT enable a sibling role, even wildcarded', () => {
      expect(ff.isProjectionReadCanary(PILOT_ENTITY, 'R4_REFERENCE')).toBe(
        false,
      );
      expect(ff.isProjectionReadCanary(PILOT_ENTITY, 'R6_GUIDE_ACHAT')).toBe(
        false,
      );
    });
  });

  describe('a bare "*" is never honored (cannot cross roles)', () => {
    const ff = make({
      SEO_PROJECTION_READ_V1: 'true',
      SEO_PROJECTION_READ_CANARY: '*',
    });

    it('bare "*" matches no role', () => {
      expect(ff.isProjectionReadCanary(PILOT_ENTITY, 'R3_CONSEILS')).toBe(
        false,
      );
      expect(ff.isProjectionReadCanary(PILOT_ENTITY, 'R4_REFERENCE')).toBe(
        false,
      );
    });
  });

  describe('multi-token allowlist keeps per-token role isolation', () => {
    // Two roles on the SAME entity are allowlisted independently — proving that
    // co-activation is always explicit, never a side effect of one another.
    const ff = make({
      SEO_PROJECTION_READ_V1: 'true',
      SEO_PROJECTION_READ_CANARY: `R3_CONSEILS@${PILOT_ENTITY}, R4_REFERENCE@${PILOT_ENTITY}`,
    });

    it('both explicitly-listed roles are eligible', () => {
      expect(ff.isProjectionReadCanary(PILOT_ENTITY, 'R3_CONSEILS')).toBe(true);
      expect(ff.isProjectionReadCanary(PILOT_ENTITY, 'R4_REFERENCE')).toBe(
        true,
      );
    });

    it('the un-listed sibling (R6) stays legacy', () => {
      expect(ff.isProjectionReadCanary(PILOT_ENTITY, 'R6_GUIDE_ACHAT')).toBe(
        false,
      );
    });
  });

  describe('guards', () => {
    const ff = make({
      SEO_PROJECTION_READ_V1: 'true',
      SEO_PROJECTION_READ_CANARY: `R3_CONSEILS@${PILOT_ENTITY}`,
    });

    it('empty entityKey or role → not eligible', () => {
      expect(ff.isProjectionReadCanary('', 'R3_CONSEILS')).toBe(false);
      expect(ff.isProjectionReadCanary(PILOT_ENTITY, '')).toBe(false);
    });
  });

  describe('the new keys are governed (visible + overridable)', () => {
    it('listFlags() exposes both new keys', () => {
      const flags = make().listFlags();
      expect(flags).toHaveProperty('SEO_PROJECTION_READ_V1');
      expect(flags).toHaveProperty('SEO_PROJECTION_READ_CANARY');
    });

    it('setOverride accepts the new keys and toggles eligibility at runtime', () => {
      const ff = make();
      expect(ff.isProjectionReadCanary(PILOT_ENTITY, 'R3_CONSEILS')).toBe(
        false,
      );
      ff.setOverride('SEO_PROJECTION_READ_V1', 'true');
      ff.setOverride(
        'SEO_PROJECTION_READ_CANARY',
        `R3_CONSEILS@${PILOT_ENTITY}`,
      );
      expect(ff.isProjectionReadCanary(PILOT_ENTITY, 'R3_CONSEILS')).toBe(true);
      // sibling still legacy after override
      expect(ff.isProjectionReadCanary(PILOT_ENTITY, 'R4_REFERENCE')).toBe(
        false,
      );
    });
  });
});
