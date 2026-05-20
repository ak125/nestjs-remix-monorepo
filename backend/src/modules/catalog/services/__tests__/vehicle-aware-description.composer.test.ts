import {
  composeVehicleAwareDescription,
  pickGammeKeywordModifier,
  type DescriptionComposerInput,
} from '../vehicle-aware-description.composer';

const base: DescriptionComposerInput = {
  gammeName: 'Plaquette de frein',
  marqueName: 'PEUGEOT',
  modeleName: '207',
  typeName: '1.4 HDI',
  powerPs: '68',
  count: 24,
  minPrice: 9,
  typeId: 19354,
  pgId: 402,
};

// crude FR finite-verb presence check for the test: each frame must carry a verb
const FRAME_VERBS = /\b(Trouvez|Comparez|comparez|Commandez|sélectionnez|Besoin|Équipez|équipez|Découvrez|disponibles?)\b/;

describe('composeVehicleAwareDescription', () => {
  it('produces a complete sentence containing the authoritative gamme name and the vehicle', () => {
    const d = composeVehicleAwareDescription(base);
    expect(d.toLowerCase()).toContain('plaquette de frein');
    expect(d).toContain('PEUGEOT 207');
    expect(d).toContain('1.4 HDI');
    expect(d).toMatch(FRAME_VERBS); // has a verb -> not a verbless fragment
    expect(d).not.toMatch(/#|undefined|null/); // no residual placeholder/garbage
  });

  it('gives DISTINCT descriptions for two motorisations of the same model (anti-cannibalization)', () => {
    const hdi = composeVehicleAwareDescription({ ...base, typeId: 19354, typeName: '1.4 HDI' });
    const d19 = composeVehicleAwareDescription({ ...base, typeId: 57720, typeName: '1.9 D', minPrice: 10 });
    expect(hdi).not.toEqual(d19);
    expect(d19).toMatch(FRAME_VERBS);
    expect(d19).toContain('1.9 D');
  });

  it('omits the price clause cleanly when minPrice is missing (no "dès €")', () => {
    const d = composeVehicleAwareDescription({ ...base, minPrice: undefined });
    expect(d).not.toContain('€');
    expect(d).not.toMatch(/dès\s*\./);
    expect(d).toMatch(FRAME_VERBS);
  });

  it('formats price in French (comma decimal + €)', () => {
    const d = composeVehicleAwareDescription({ ...base, typeId: 1, pgId: 0, minPrice: 9.5 });
    expect(d).toContain('9,50');
    expect(d).toContain('€');
  });

  it('omits the count clause when count is 0 or missing, staying grammatical', () => {
    const d = composeVehicleAwareDescription({ ...base, count: 0 });
    expect(d).not.toMatch(/\b0 références\b/);
    expect(d).toMatch(FRAME_VERBS);
  });

  it('falls back to "votre véhicule" when vehicle data is absent', () => {
    const d = composeVehicleAwareDescription({
      gammeName: 'Filtre à huile',
      typeId: 5,
      pgId: 7,
      count: 12,
      minPrice: 6,
    });
    expect(d).toContain('véhicule');
    expect(d).toMatch(FRAME_VERBS);
    expect(d).not.toMatch(/#|undefined|null/);
  });

  it('appends a validated keyword modifier to the gamme term when provided', () => {
    const d = composeVehicleAwareDescription({ ...base, keywordModifier: 'avant' });
    expect(d.toLowerCase()).toContain('plaquette de frein avant');
  });

  it('is deterministic: same input -> same output', () => {
    expect(composeVehicleAwareDescription(base)).toEqual(composeVehicleAwareDescription(base));
  });
});

describe('pickGammeKeywordModifier (anti-contamination gate)', () => {
  const kws = (arr: Array<[string, number]>) => arr.map(([keyword, volume]) => ({ keyword, volume }));

  it('REJECTS a keyword that does not contain the gamme core words (disque vs plaquette)', () => {
    const mod = pickGammeKeywordModifier('Plaquette de frein', kws([['disque de frein', 50000]]));
    expect(mod).toBeNull();
  });

  it('returns the extra modifier when the keyword contains the gamme core (+ a modifier)', () => {
    const mod = pickGammeKeywordModifier(
      'Plaquette de frein',
      kws([['plaquette de frein avant', 500], ['disque de frein', 50000]]),
    );
    expect(mod).toBe('avant');
  });

  it('returns null when the only matching keyword is the bare gamme term (no added modifier)', () => {
    const mod = pickGammeKeywordModifier('Filtre à huile', kws([['filtre à huile', 5000]]));
    expect(mod).toBeNull();
  });

  it('ignores brand/model long-tail modifiers (keeps generic single-word modifiers only)', () => {
    const mod = pickGammeKeywordModifier(
      'Filtre à huile',
      kws([['filtre à huile purflux', 500], ['filtre à huile c3', 500]]),
    );
    // brand "purflux" / model "c3" are not generic position/qualifier modifiers -> null
    expect(mod).toBeNull();
  });
});
