import {
  deriveEngineProfile,
  derivePowerTier,
  deriveEuroNorm,
  normalizeFuel,
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
