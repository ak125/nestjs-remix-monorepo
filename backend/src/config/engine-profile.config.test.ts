import {
  deriveEngineProfile,
  derivePowerTier,
  deriveEuroNorm,
  normalizeFuel,
  getEngineProfileIssues,
  getEngineProfileDescription,
  ENGINE_PROFILE_ISSUES,
  ENGINE_PROFILE_DESCRIPTIONS,
  SEO_R8_MOTOR_ISSUES_OPENERS,
  type EngineProfileKey,
} from './engine-profile.config';

describe('normalizeFuel', () => {
  it('maps plain diesel/essence', () => {
    expect(normalizeFuel('Diesel')).toBe('diesel');
    expect(normalizeFuel('Essence')).toBe('essence');
  });

  it('maps accented hybride_essence variants', () => {
    expect(normalizeFuel('Essence-Électrique')).toBe('hybride_essence');
    expect(normalizeFuel('essence-electrique')).toBe('hybride_essence');
  });

  it('maps hybride_diesel', () => {
    expect(normalizeFuel('Diesel-Électrique')).toBe('hybride_diesel');
  });

  it('maps electrique alone', () => {
    expect(normalizeFuel('Électrique')).toBe('electrique');
  });

  it('maps GPL / ethanol', () => {
    expect(normalizeFuel('GPL')).toBe('gpl');
    expect(normalizeFuel('Essence-Éthanol')).toBe('ethanol');
    expect(normalizeFuel('E85')).toBe('ethanol');
  });

  it('defaults to inconnu', () => {
    expect(normalizeFuel(undefined)).toBe('inconnu');
    expect(normalizeFuel(null)).toBe('inconnu');
    expect(normalizeFuel('')).toBe('inconnu');
    expect(normalizeFuel('Something Weird')).toBe('inconnu');
  });
});

describe('derivePowerTier', () => {
  it.each<[number, string]>([
    [60, 'p1_mini'],
    [74, 'p1_mini'],
    [75, 'p2_basse'],
    [99, 'p2_basse'],
    [100, 'p3_moyenne'],
    [129, 'p3_moyenne'],
    [130, 'p4_haute'],
    [169, 'p4_haute'],
    [170, 'p5_sport'],
    [229, 'p5_sport'],
    [230, 'p6_tres_haute'],
    [600, 'p6_tres_haute'],
  ])('tier for %i ps = %s', (ps, expected) => {
    expect(derivePowerTier(ps)).toBe(expected);
  });

  it('defaults to p3_moyenne on non-finite / zero', () => {
    expect(derivePowerTier(0)).toBe('p3_moyenne');
    expect(derivePowerTier(NaN)).toBe('p3_moyenne');
    expect(derivePowerTier(-5)).toBe('p3_moyenne');
  });
});

describe('deriveEngineProfile', () => {
  it('composes a valid key for DS 3 siblings (SQL audit sample)', () => {
    expect(deriveEngineProfile('Essence', 75)).toBe('essence_p2_basse');
    expect(deriveEngineProfile('Diesel', '106')).toBe('diesel_p3_moyenne');
    expect(deriveEngineProfile('Essence', 197)).toBe('essence_p5_sport');
  });

  it('handles missing inputs with defensive defaults', () => {
    expect(deriveEngineProfile(undefined, undefined)).toBe(
      'inconnu_p3_moyenne',
    );
    expect(deriveEngineProfile('Essence', '')).toBe('essence_p3_moyenne');
  });
});

describe('deriveEuroNorm', () => {
  it.each<[number | string, string | null]>([
    [1990, 'Euro 1'],
    ['1997', 'Euro 2'],
    [2002, 'Euro 3'],
    [2007, 'Euro 4'],
    [2011, 'Euro 5'],
    [2015, 'Euro 6b'],
    [2019, 'Euro 6c'],
    [2023, 'Euro 6d'],
  ])('year %s → %s', (year, expected) => {
    expect(deriveEuroNorm(year)).toBe(expected);
  });

  it('returns null for missing or unreasonable year', () => {
    expect(deriveEuroNorm(null)).toBeNull();
    expect(deriveEuroNorm('')).toBeNull();
    expect(deriveEuroNorm(1980)).toBeNull();
  });
});

describe('getEngineProfileIssues', () => {
  it('returns the direct dict when key exists', () => {
    const issues = getEngineProfileIssues('diesel_p3_moyenne');
    expect(issues.length).toBeGreaterThanOrEqual(6);
    expect(issues.some((s) => s.toLowerCase().includes('egr'))).toBe(true);
    expect(issues.some((s) => s.toLowerCase().includes('fap'))).toBe(true);
  });

  it('cascades ethanol → essence on same tier', () => {
    const ethanolP3 = getEngineProfileIssues(
      'ethanol_p3_moyenne' as EngineProfileKey,
    );
    const essenceP3 = getEngineProfileIssues('essence_p3_moyenne');
    expect(ethanolP3).toEqual(essenceP3);
  });

  it('cascades gpl → essence on same tier', () => {
    const gplP1 = getEngineProfileIssues('gpl_p1_mini' as EngineProfileKey);
    const essenceP1 = getEngineProfileIssues('essence_p1_mini');
    expect(gplP1).toEqual(essenceP1);
  });

  it('falls back to inconnu for entirely unknown key', () => {
    // Force a shape that has no explicit entry, no essence/diesel cascade
    // (hybride_diesel is explicitly undefined; cascade routes to inconnu)
    const unknownIssues = getEngineProfileIssues(
      'hybride_diesel_p1_mini' as EngineProfileKey,
    );
    expect(Array.isArray(unknownIssues)).toBe(true);
    expect(unknownIssues.length).toBeGreaterThanOrEqual(3);
  });

  it('each defined issue list is deduplicated and non-empty', () => {
    for (const [key, list] of Object.entries(ENGINE_PROFILE_ISSUES)) {
      expect(list!.length).toBeGreaterThan(0);
      const deduped = new Set(list);
      expect(deduped.size).toBe(list!.length);
      // Also check: no entry is blank or whitespace-only
      for (const entry of list!) {
        expect(entry.trim().length).toBeGreaterThan(5);
      }
      // sanity : encode-safe French
      expect(typeof key).toBe('string');
    }
  });

  it('sibling profiles have distinct vocabulary (Jaccard < 0.60)', () => {
    // DS 3 sample : essence_p2_basse vs diesel_p3_moyenne vs essence_p5_sport
    const a = getEngineProfileIssues('essence_p2_basse')
      .join(' ')
      .toLowerCase();
    const b = getEngineProfileIssues('diesel_p3_moyenne')
      .join(' ')
      .toLowerCase();
    const c = getEngineProfileIssues('essence_p5_sport')
      .join(' ')
      .toLowerCase();

    const words = (s: string) =>
      new Set(
        s
          .split(/\W+/)
          .filter((w) => w.length >= 4)
          .map((w) => w.normalize('NFD').replace(/[̀-ͯ]/g, '')),
      );
    const jaccard = (x: Set<string>, y: Set<string>) => {
      const inter = new Set([...x].filter((w) => y.has(w)));
      const union = new Set([...x, ...y]);
      return inter.size / union.size;
    };
    const wa = words(a);
    const wb = words(b);
    const wc = words(c);
    expect(jaccard(wa, wb)).toBeLessThan(0.6);
    expect(jaccard(wa, wc)).toBeLessThan(0.6);
    expect(jaccard(wb, wc)).toBeLessThan(0.6);
  });
});

describe('getEngineProfileDescription', () => {
  it('returns non-empty description for essence/diesel tiers', () => {
    expect(
      getEngineProfileDescription('essence_p1_mini').length,
    ).toBeGreaterThan(30);
    expect(
      getEngineProfileDescription('diesel_p4_haute').length,
    ).toBeGreaterThan(30);
  });

  it('falls back for unknown profile', () => {
    const desc = getEngineProfileDescription(
      'hybride_diesel_p2_basse' as EngineProfileKey,
    );
    expect(typeof desc).toBe('string');
    expect(desc.length).toBeGreaterThan(10);
  });

  it('every defined description is non-empty and meaningful', () => {
    for (const [, desc] of Object.entries(ENGINE_PROFILE_DESCRIPTIONS)) {
      expect(desc!.trim().length).toBeGreaterThan(40);
    }
  });
});

describe('SEO_R8_MOTOR_ISSUES_OPENERS', () => {
  it('has a prime pool size for max distribution', () => {
    expect(SEO_R8_MOTOR_ISSUES_OPENERS.length).toBe(7);
  });

  it('every opener contains at least one placeholder', () => {
    for (const opener of SEO_R8_MOTOR_ISSUES_OPENERS) {
      expect(opener).toMatch(/\{(brand|model|type|power|fuel)\}/);
    }
  });

  it('openers are distinct (no copy-paste duplicates)', () => {
    const set = new Set(SEO_R8_MOTOR_ISSUES_OPENERS);
    expect(set.size).toBe(SEO_R8_MOTOR_ISSUES_OPENERS.length);
  });
});
