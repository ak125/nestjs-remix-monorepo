import {
  isBareSlug,
  classifyPartFamily,
  filterOffFamilyParts,
  detectOffFamilyArtifacts,
} from './r4-family-guard';

/**
 * R4 cross-family pollution guard — pure logic.
 * Family key = mf_id (catalog_family). Conservative: only KNOWN-and-different families
 * are OFF_FAMILY; prose / unknown slug / unknown target ⇒ kept.
 *
 * Fixture: target gamme = brake family (mf_id 10). Map mixes brake parts (10),
 * electrical (20), cooling (30) — arbitrary ids prove there is NO hardcoded denylist:
 * the verdict comes purely from the injected slug→mf_id map.
 */
const TARGET_BRAKE = 10;
const SLUG_MF: ReadonlyMap<string, number> = new Map([
  ['disque-de-frein', 10],
  ['plaquette-de-frein', 10],
  ['etrier-de-frein', 10],
  ['alternateur', 20],
  ['batterie', 20],
  ['poulie-d-alternateur', 20],
  ['radiateur-de-refroidissement', 30],
  ['pompe-a-eau', 30],
]);

describe('r4-family-guard — isBareSlug', () => {
  it('recognises kebab slugs', () => {
    expect(isBareSlug('disque-de-frein')).toBe(true);
    expect(isBareSlug('alternateur')).toBe(true);
    expect(isBareSlug('poulie-d-alternateur')).toBe(true);
  });

  it('rejects prose phrases (spaces / punctuation / parentheses)', () => {
    expect(isBareSlug('Plaquettes de frein (a controler)')).toBe(false);
    expect(isBareSlug('Disque ventile')).toBe(false);
    expect(isBareSlug('codes p2452 p2453')).toBe(false);
  });
});

describe('r4-family-guard — classifyPartFamily', () => {
  it('SAME family is accepted', () => {
    expect(
      classifyPartFamily('plaquette-de-frein', TARGET_BRAKE, SLUG_MF),
    ).toBe('SAME');
    expect(classifyPartFamily('etrier-de-frein', TARGET_BRAKE, SLUG_MF)).toBe(
      'SAME',
    );
  });

  it('OFF-FAMILY (known but different mf_id) is refused', () => {
    expect(classifyPartFamily('alternateur', TARGET_BRAKE, SLUG_MF)).toBe(
      'OFF_FAMILY',
    );
    expect(
      classifyPartFamily('radiateur-de-refroidissement', TARGET_BRAKE, SLUG_MF),
    ).toBe('OFF_FAMILY');
  });

  it('UNKNOWN slug (not in the family map) is accepted — no false positive', () => {
    expect(classifyPartFamily('liquide-de-frein', TARGET_BRAKE, SLUG_MF)).toBe(
      'UNKNOWN',
    );
  });

  it('prose entry is accepted (cannot resolve a family)', () => {
    expect(
      classifyPartFamily(
        'Plaquettes de frein (a controler)',
        TARGET_BRAKE,
        SLUG_MF,
      ),
    ).toBe('UNKNOWN');
  });

  it('UNKNOWN target family ⇒ never OFF_FAMILY (no false positive)', () => {
    expect(classifyPartFamily('alternateur', null, SLUG_MF)).toBe('UNKNOWN');
  });

  it('verdict comes from the map, not a denylist (arbitrary slug, same mf as target = SAME)', () => {
    const customMap = new Map([['totally-made-up-part', TARGET_BRAKE]]);
    expect(
      classifyPartFamily('totally-made-up-part', TARGET_BRAKE, customMap),
    ).toBe('SAME');
  });
});

describe('r4-family-guard — filterOffFamilyParts', () => {
  it('keeps SAME + UNKNOWN, drops OFF_FAMILY, reports dropped', () => {
    const composition = [
      'plaquette-de-frein', // SAME
      'etrier-de-frein', // SAME
      'liquide-de-frein', // UNKNOWN (kept)
      'Disques de frein (a controler)', // prose UNKNOWN (kept)
      'alternateur', // OFF
      'batterie', // OFF
      'poulie-d-alternateur', // OFF
    ];
    const { kept, dropped } = filterOffFamilyParts(
      composition,
      TARGET_BRAKE,
      SLUG_MF,
    );
    expect(kept).toEqual([
      'plaquette-de-frein',
      'etrier-de-frein',
      'liquide-de-frein',
      'Disques de frein (a controler)',
    ]);
    expect(dropped).toEqual([
      'alternateur',
      'batterie',
      'poulie-d-alternateur',
    ]);
  });

  it('null / empty input ⇒ empty result, no crash', () => {
    expect(filterOffFamilyParts(null, TARGET_BRAKE, SLUG_MF)).toEqual({
      kept: [],
      dropped: [],
    });
    expect(filterOffFamilyParts(undefined, TARGET_BRAKE, SLUG_MF)).toEqual({
      kept: [],
      dropped: [],
    });
    expect(filterOffFamilyParts([], TARGET_BRAKE, SLUG_MF)).toEqual({
      kept: [],
      dropped: [],
    });
  });

  it('is idempotent (re-filtering kept output drops nothing)', () => {
    const composition = ['plaquette-de-frein', 'alternateur'];
    const once = filterOffFamilyParts(composition, TARGET_BRAKE, SLUG_MF);
    const twice = filterOffFamilyParts(once.kept, TARGET_BRAKE, SLUG_MF);
    expect(twice.dropped).toEqual([]);
    expect(twice.kept).toEqual(once.kept);
  });

  it('unknown target family ⇒ keeps everything (no destructive false positive)', () => {
    const composition = ['alternateur', 'plaquette-de-frein'];
    const { kept, dropped } = filterOffFamilyParts(composition, null, SLUG_MF);
    expect(dropped).toEqual([]);
    expect(kept).toEqual(composition);
  });
});

describe('r4-family-guard — detectOffFamilyArtifacts (guard flag)', () => {
  it('flags off-family slugs across multiple arrays (composition + symptomes)', () => {
    const composition = ['plaquette-de-frein', 'alternateur'];
    const symptomes = ['poulie-d-alternateur', 'Pedale spongieuse']; // 1 off-family slug + 1 prose
    const found = detectOffFamilyArtifacts(
      [composition, symptomes],
      TARGET_BRAKE,
      SLUG_MF,
    );
    expect(found.sort()).toEqual(['alternateur', 'poulie-d-alternateur']);
  });

  it('returns [] when everything is same/unknown (clean page)', () => {
    const composition = [
      'plaquette-de-frein',
      'etrier-de-frein',
      'liquide-de-frein',
    ];
    expect(
      detectOffFamilyArtifacts([composition], TARGET_BRAKE, SLUG_MF),
    ).toEqual([]);
  });

  it('deduplicates a slug repeated across arrays', () => {
    const found = detectOffFamilyArtifacts(
      [['alternateur'], ['alternateur']],
      TARGET_BRAKE,
      SLUG_MF,
    );
    expect(found).toEqual(['alternateur']);
  });
});

describe('r4-family-guard — anti-reintroduction (R4 writer)', () => {
  // SeoGeneratorService.buildR4FromRag (writer R4 live, via
  // ReferenceService.filterCompositionByFamily) routes frontmatter.composition through
  // filterOffFamilyParts before persisting.
  // This is the single point preventing re-introduction of the cross-family pollution.
  it('drops the off-family bare-slug tail from a frontmatter-style composition, keeps prose + same-family', () => {
    const frontmatterComposition = [
      'Disque de frein (plateau en fonte GG25)', // prose → kept
      'Plaquettes de frein (garnitures sacrificielles)', // prose → kept
      'etrier-de-frein', // SAME family slug → kept
      'alternateur', // OFF-FAMILY → dropped
      'batterie', // OFF-FAMILY → dropped
      'poulie-d-alternateur', // OFF-FAMILY → dropped
    ];
    const { kept, dropped } = filterOffFamilyParts(
      frontmatterComposition,
      TARGET_BRAKE,
      SLUG_MF,
    );
    expect(dropped).toEqual([
      'alternateur',
      'batterie',
      'poulie-d-alternateur',
    ]);
    expect(kept).toEqual([
      'Disque de frein (plateau en fonte GG25)',
      'Plaquettes de frein (garnitures sacrificielles)',
      'etrier-de-frein',
    ]);
  });

  it('a clean frontmatter composition passes through unchanged (no false drop)', () => {
    const clean = ['disque-de-frein', 'plaquette-de-frein', 'etrier-de-frein'];
    const { kept, dropped } = filterOffFamilyParts(
      clean,
      TARGET_BRAKE,
      SLUG_MF,
    );
    expect(dropped).toEqual([]);
    expect(kept).toEqual(clean);
  });
});
