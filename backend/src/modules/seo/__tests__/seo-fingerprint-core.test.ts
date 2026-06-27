import {
  SeoFingerprintCore,
  SEO_FINGERPRINT_VERSION,
  type SeoFingerprintField,
} from '../utils/seo-fingerprint-core';
import type {
  ResolvedPageSeo,
  ResolvedSeoField,
} from '../types/resolved-seo-field';

/**
 * SeoFingerprintCore (D-1) — empreinte PURE des balises émises.
 *
 * Prouve : exactHash = signal HARD (égalité exacte) ; normalizeSeoText accent/casse-correct ;
 * tokens triés/uniques + Jaccard JS ; discriminant factuel (puissance) sépare les sœurs ;
 * pur & déterministe. Cf. plan rév.9 §Verification.
 */

function field(value: string): ResolvedSeoField {
  return {
    value,
    sourceStage: 'runtime_db',
    truthLevel: 1,
    sourceId: null,
    evidenceIds: [],
    resolverVersion: 'test',
    degraded: false,
    degradeReason: null,
  };
}

function page(
  title: string,
  description: string,
  h1: string,
  surface: ResolvedPageSeo['surface'] = 'R8',
  entityKey = 'type:19051',
): ResolvedPageSeo {
  return {
    title: field(title),
    description: field(description),
    h1: field(h1),
    surface,
    entityKey,
  };
}

const SHA256_HEX = /^[0-9a-f]{64}$/;

describe('SeoFingerprintCore.computeField', () => {
  it('produit un sha256 hex 64c pour exactHash et normalizedHash', () => {
    const fp = SeoFingerprintCore.computeField('title', 'Filtre à huile');
    expect(fp.exactHash).toMatch(SHA256_HEX);
    expect(fp.normalizedHash).toMatch(SHA256_HEX);
  });

  it('est déterministe (même entrée → mêmes hashes)', () => {
    const a = SeoFingerprintCore.computeField(
      'h1',
      'Disque de frein avant Clio III',
    );
    const b = SeoFingerprintCore.computeField(
      'h1',
      'Disque de frein avant Clio III',
    );
    expect(a.exactHash).toBe(b.exactHash);
    expect(a.normalizedHash).toBe(b.normalizedHash);
    expect(a.tokens).toEqual(b.tokens);
  });

  it('tokenise en tokens triés + uniques (stopwords FR retirés)', () => {
    const fp = SeoFingerprintCore.computeField(
      'h1',
      'Plaquette de frein de frein',
    );
    // "de" = stopword retiré ; "frein" dédupliqué ; tri lexical.
    expect(fp.tokens).toEqual(['frein', 'plaquette']);
  });

  it('gère une valeur vide LÉGITIME sans crash (raw="", tokens=[])', () => {
    const fp = SeoFingerprintCore.computeField('description', '');
    expect(fp.raw).toBe('');
    expect(fp.tokens).toEqual([]);
    expect(fp.exactHash).toMatch(SHA256_HEX);
  });

  it('échoue BRUYAMMENT sur un non-string (no-silent-fallback, pas de coercion en "")', () => {
    // Branche inatteignable via le type, mais un resolver dégradé ne doit jamais
    // collisionner silencieusement sur sha256('').
    expect(() =>
      SeoFingerprintCore.computeField('title', null as unknown as string),
    ).toThrow(/doit être un string/);
    expect(() =>
      SeoFingerprintCore.computeField('h1', undefined as unknown as string),
    ).toThrow(/no-silent-fallback/);
  });

  it('fields() expose l’ordre déterministe title/description/h1', () => {
    expect(SeoFingerprintCore.fields()).toEqual(['title', 'description', 'h1']);
  });
});

describe('SeoFingerprintCore — exactHash = collision HARD', () => {
  it('deux balises identiques → isExactCollision true', () => {
    const a = SeoFingerprintCore.computeField(
      'title',
      'Disque de frein Renault Clio',
    );
    const b = SeoFingerprintCore.computeField(
      'title',
      'Disque de frein Renault Clio',
    );
    expect(SeoFingerprintCore.isExactCollision(a, b)).toBe(true);
  });

  it('discriminant factuel (puissance) sépare les sœurs → PAS de collision exacte', () => {
    // Cas réel : deux motorisations d'un même modèle. La gate dure NE doit PAS firer.
    const ch140 = SeoFingerprintCore.computeField(
      'title',
      'Disque de frein Clio III 1.5 dCi 140 ch',
    );
    const ch163 = SeoFingerprintCore.computeField(
      'title',
      'Disque de frein Clio III 1.5 dCi 163 ch',
    );
    expect(SeoFingerprintCore.isExactCollision(ch140, ch163)).toBe(false);
  });
});

describe('SeoFingerprintCore — normalizeSeoText accent/casse-correct', () => {
  it('casse + accents différents → exactHash différent MAIS normalizedHash identique', () => {
    const a = SeoFingerprintCore.computeField('h1', 'Filtre à huile');
    const b = SeoFingerprintCore.computeField('h1', 'FILTRE A HUILE');
    expect(SeoFingerprintCore.isExactCollision(a, b)).toBe(false);
    expect(SeoFingerprintCore.isNormalizedCollision(a, b)).toBe(true);
  });

  it('espaces multiples collapsés par la normalize (collision normalisée)', () => {
    const a = SeoFingerprintCore.computeField('title', 'Disque   de  frein');
    const b = SeoFingerprintCore.computeField('title', 'Disque de frein');
    expect(SeoFingerprintCore.isNormalizedCollision(a, b)).toBe(true);
  });

  it('deux textes réellement différents → PAS de collision normalisée', () => {
    const a = SeoFingerprintCore.computeField('title', 'Disque de frein');
    const b = SeoFingerprintCore.computeField('title', 'Plaquette de frein');
    expect(SeoFingerprintCore.isNormalizedCollision(a, b)).toBe(false);
  });
});

describe('SeoFingerprintCore.tokenJaccard', () => {
  it('tokens identiques → 1', () => {
    const a = SeoFingerprintCore.computeField('title', 'Disque de frein avant');
    const b = SeoFingerprintCore.computeField('title', 'frein disque avant');
    expect(SeoFingerprintCore.tokenJaccard(a, b)).toBe(1);
  });

  it('tokens disjoints → 0', () => {
    const a = SeoFingerprintCore.computeField('title', 'plaquette frein');
    const b = SeoFingerprintCore.computeField(
      'title',
      'amortisseur suspension',
    );
    expect(SeoFingerprintCore.tokenJaccard(a, b)).toBe(0);
  });

  it('recouvrement partiel → ratio intersection/union', () => {
    // {disque,frein,avant} vs {disque,frein,arriere} → inter=2, union=4 → 0.5
    const a = SeoFingerprintCore.computeField('title', 'disque frein avant');
    const b = SeoFingerprintCore.computeField('title', 'disque frein arriere');
    expect(SeoFingerprintCore.tokenJaccard(a, b)).toBeCloseTo(0.5, 5);
  });

  it('deux champs vides → 0 (jamais NaN)', () => {
    const a = SeoFingerprintCore.computeField('description', '');
    const b = SeoFingerprintCore.computeField('description', '');
    expect(SeoFingerprintCore.tokenJaccard(a, b)).toBe(0);
  });
});

describe('SeoFingerprintCore.compute (page)', () => {
  it('mappe les 3 champs + surface + entityKey + version', () => {
    const fp = SeoFingerprintCore.compute(
      page('T', 'D', 'H', 'R8', 'type:19051'),
    );
    expect(fp.surface).toBe('R8');
    expect(fp.entityKey).toBe('type:19051');
    expect(fp.version).toBe(SEO_FINGERPRINT_VERSION);
    const expected: SeoFingerprintField[] = ['title', 'description', 'h1'];
    expect(Object.keys(fp.fields).sort()).toEqual([...expected].sort());
    expect(fp.fields.title.field).toBe('title');
    expect(fp.fields.title.raw).toBe('T');
  });

  it('deux pages sœurs au title identique → collision exacte sur le champ title', () => {
    const a = SeoFingerprintCore.compute(page('Même titre', 'desc A', 'h1 A'));
    const b = SeoFingerprintCore.compute(page('Même titre', 'desc B', 'h1 B'));
    expect(
      SeoFingerprintCore.isExactCollision(a.fields.title, b.fields.title),
    ).toBe(true);
    expect(
      SeoFingerprintCore.isExactCollision(
        a.fields.description,
        b.fields.description,
      ),
    ).toBe(false);
  });
});
