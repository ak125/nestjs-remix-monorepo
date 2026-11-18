/**
 * Résolution des règles de remise fournisseur × marque × famille / sous-famille
 * (complément CH-2). Verrouille l'ordre décidé par Marwane le 18/11 :
 * marque × sous-famille > marque × famille > marque > sous-famille > famille >
 * fournisseur ; une promo datée prime sur la règle de même niveau pendant sa
 * période (début inclus, fin exclue).
 */
import {
  isBaseImportProfile,
  priceRuleStatus,
  resolvePriceRule,
  samePriceRuleKey,
  selectedByImport,
  type PriceRule,
} from './supplier-price-rule';

const CAL = '35';
const SEIM = '1200';
const OTHER = '1300';
const CABLES = 'NU17';
const CABLES_ALLUMAGE = '1738';
const AT = new Date('2026-12-10T12:00:00Z');

let nextId = 1;
function rule(overrides: Partial<PriceRule>): PriceRule {
  return {
    id: nextId++,
    supplierId: CAL,
    brandPmId: null,
    scopeLevel: 'SUPPLIER',
    scopeCode: null,
    effectiveFrom: null,
    effectiveTo: null,
    active: true,
    version: 1,
    remisePct: 10,
    margePct: null,
    ...overrides,
  };
}

const supplier = rule({ remisePct: 10 });
const family = rule({ scopeLevel: 'FAMILY', scopeCode: CABLES, remisePct: 20 });
const subfamily = rule({
  scopeLevel: 'SUBFAMILY',
  scopeCode: CABLES_ALLUMAGE,
  remisePct: 30,
});
const brand = rule({ scopeLevel: 'BRAND', brandPmId: SEIM, remisePct: 40 });
const brandFamily = rule({
  scopeLevel: 'FAMILY',
  brandPmId: SEIM,
  scopeCode: CABLES,
  remisePct: 50,
});
const brandSubfamily = rule({
  scopeLevel: 'SUBFAMILY',
  brandPmId: SEIM,
  scopeCode: CABLES_ALLUMAGE,
  remisePct: 60,
});
const ALL = [
  supplier,
  family,
  subfamily,
  brand,
  brandFamily,
  brandSubfamily,
] as const;

const seimCable = {
  supplierId: CAL,
  brandPmId: SEIM,
  famCode: CABLES,
  sfamCode: CABLES_ALLUMAGE,
  at: AT,
};

describe('resolvePriceRule — la portée la plus précise gagne', () => {
  // On retire les règles une à une, de la plus précise à la moins précise :
  // chaque fois, la suivante dans l'ordre décidé doit gagner.
  it.each([
    ['marque × sous-famille', 6, brandSubfamily],
    ['marque × famille', 5, brandFamily],
    ['marque', 4, brand],
    ['sous-famille', 3, subfamily],
    ['famille', 2, family],
    ['fournisseur', 1, supplier],
  ])('%s', (_label, keep, expected) => {
    const rules = ALL.slice(0, keep);
    expect(resolvePriceRule(rules, seimCable)).toBe(expected);
  });

  it('une autre marque ne prend pas la règle SEIM', () => {
    expect(resolvePriceRule(ALL, { ...seimCable, brandPmId: OTHER })).toBe(
      subfamily,
    );
  });

  it('une autre famille ne prend ni la règle câbles ni la marque × famille', () => {
    expect(
      resolvePriceRule(ALL, {
        ...seimCable,
        famCode: 'NU19',
        sfamCode: '1905',
      }),
    ).toBe(brand);
  });

  it('sans contexte de famille : marque, sinon fournisseur', () => {
    expect(
      resolvePriceRule(ALL, { supplierId: CAL, brandPmId: SEIM, at: AT }),
    ).toBe(brand);
    expect(resolvePriceRule(ALL, { supplierId: CAL, at: AT })).toBe(supplier);
  });

  it('autre fournisseur : aucune règle', () => {
    expect(
      resolvePriceRule(ALL, { ...seimCable, supplierId: '71' }),
    ).toBeNull();
  });

  it('ignore les règles inactives et les lignes sans remise ni marge', () => {
    const rules = [
      { ...brandSubfamily, active: false },
      { ...brandFamily, remisePct: null, margePct: null },
      supplier,
    ];
    expect(resolvePriceRule(rules, seimCable)).toBe(supplier);
  });

  it('une marge seule fait une règle', () => {
    const margeOnly = rule({
      scopeLevel: 'BRAND',
      brandPmId: SEIM,
      remisePct: null,
      margePct: 35,
    });
    expect(resolvePriceRule([supplier, margeOnly], seimCable)).toBe(margeOnly);
  });
});

describe('resolvePriceRule — promotion datée', () => {
  const promo = rule({
    scopeLevel: 'FAMILY',
    brandPmId: SEIM,
    scopeCode: CABLES,
    remisePct: 55,
    effectiveFrom: '2026-12-01T00:00:00.000Z',
    effectiveTo: '2027-01-01T00:00:00.000Z',
  });

  it('prime sur la règle permanente de même niveau pendant sa période', () => {
    expect(resolvePriceRule([brandFamily, promo], seimCable)).toBe(promo);
    expect(resolvePriceRule([promo, brandFamily], seimCable)).toBe(promo);
  });

  it('début inclus, fin exclue', () => {
    const rules = [brandFamily, promo];
    expect(
      resolvePriceRule(rules, {
        ...seimCable,
        at: new Date('2026-12-01T00:00:00Z'),
      }),
    ).toBe(promo);
    expect(
      resolvePriceRule(rules, {
        ...seimCable,
        at: new Date('2027-01-01T00:00:00Z'),
      }),
    ).toBe(brandFamily);
    expect(
      resolvePriceRule(rules, {
        ...seimCable,
        at: new Date('2026-11-30T23:59:59Z'),
      }),
    ).toBe(brandFamily);
  });

  it('ne passe pas devant une règle plus précise', () => {
    expect(resolvePriceRule([brandSubfamily, promo], seimCable)).toBe(
      brandSubfamily,
    );
  });

  it('deux promos qui se chevauchent : la plus récemment commencée', () => {
    const flash = {
      ...promo,
      id: 900,
      effectiveFrom: '2026-12-08T00:00:00.000Z',
      effectiveTo: '2026-12-15T00:00:00.000Z',
      remisePct: 70,
    };
    expect(resolvePriceRule([promo, flash], seimCable)).toBe(flash);
  });

  it('même portée et même période : la version la plus haute', () => {
    const v2 = { ...brandFamily, id: 901, version: 2, remisePct: 52 };
    expect(resolvePriceRule([v2, brandFamily], seimCable)).toBe(v2);
  });
});

describe('priceRuleStatus', () => {
  const promo = rule({
    scopeLevel: 'FAMILY',
    brandPmId: SEIM,
    scopeCode: CABLES,
    effectiveFrom: '2026-12-01T00:00:00.000Z',
    effectiveTo: '2027-01-01T00:00:00.000Z',
  });
  const rules = [brandFamily, promo, supplier];

  it('règle permanente remplacée par la promo pendant sa période', () => {
    expect(priceRuleStatus(brandFamily, rules, AT)).toEqual({
      status: 'remplacee',
      supersededBy: promo.id,
    });
    expect(priceRuleStatus(promo, rules, AT).status).toBe('en_vigueur');
  });

  it('avant et après la période', () => {
    const before = new Date('2026-11-01T00:00:00Z');
    const after = new Date('2027-02-01T00:00:00Z');
    expect(priceRuleStatus(promo, rules, before).status).toBe('a_venir');
    expect(priceRuleStatus(promo, rules, after).status).toBe('expiree');
    expect(priceRuleStatus(brandFamily, rules, after).status).toBe(
      'en_vigueur',
    );
  });

  it('une règle de famille n’est pas « remplacée » par une règle moins précise', () => {
    expect(priceRuleStatus(supplier, rules, AT).status).toBe('en_vigueur');
  });

  it('inactive, sans valeur', () => {
    expect(
      priceRuleStatus({ ...supplier, active: false }, rules, AT).status,
    ).toBe('inactive');
    expect(
      priceRuleStatus({ ...supplier, remisePct: null }, rules, AT).status,
    ).toBe('sans_taux');
  });
});

describe('clé de règle et garde d’import', () => {
  it('même clé : dates comparées en instant, pas en texte', () => {
    const a = rule({
      scopeLevel: 'FAMILY',
      brandPmId: SEIM,
      scopeCode: CABLES,
      effectiveFrom: '2026-12-01T00:00:00.000Z',
    });
    const b = { ...a, id: 999, effectiveFrom: '2026-12-01T00:00:00+00:00' };
    expect(samePriceRuleKey(a, b)).toBe(true);
    expect(samePriceRuleKey(a, { ...b, brandPmId: OTHER })).toBe(false);
    expect(
      samePriceRuleKey(a, { ...b, effectiveTo: '2027-01-01T00:00:00Z' }),
    ).toBe(false);
  });

  it('profil de base = fournisseur, sans marque ni date, actif', () => {
    expect(isBaseImportProfile(supplier)).toBe(true);
    expect(
      isBaseImportProfile({ ...supplier, effectiveTo: '2027-01-01T00:00:00Z' }),
    ).toBe(false);
    expect(isBaseImportProfile(brand)).toBe(false);
    expect(isBaseImportProfile({ ...supplier, active: false })).toBe(false);
  });

  it('niveaux retenus par l’import actuel : fournisseur et marque', () => {
    expect(
      ['SUPPLIER', 'BRAND', 'FAMILY', 'SUBFAMILY'].filter((l) =>
        selectedByImport(l as PriceRule['scopeLevel']),
      ),
    ).toEqual(['SUPPLIER', 'BRAND']);
  });
});
