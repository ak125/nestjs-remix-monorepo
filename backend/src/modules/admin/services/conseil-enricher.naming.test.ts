/**
 * Tests — authoritative gamme display-name resolution (conseil R3 enrichment).
 *
 * Regression guard for the "pb caractère" incident: section headings such as
 * "Quand changer les temoin d usure" were built from the SLUG
 * (`pgAlias.replace(/-/g, ' ')`), which is ASCII — accents stripped and the
 * apostrophe collapsed to a space. The fix sources the display term from the
 * authoritative `pieces_gamme.pg_name` ("Témoin d'usure"), which carries both
 * the accents AND the apostrophe.
 *
 * The DB fetch lives in the service; the pure formatting is `formatGammeDisplayName`.
 */

import { formatGammeDisplayName } from './conseil-enricher.service';

describe('formatGammeDisplayName — authoritative term, mid-sentence casing', () => {
  // Identity fallback so we can assert the fallback path was taken.
  const idRestore = (s: string) => s;

  it('uses pg_name and restores the apostrophe (the slug had lost it)', () => {
    expect(
      formatGammeDisplayName("Témoin d'usure", 'temoin-d-usure', idRestore),
    ).toBe("témoin d'usure");
    expect(
      formatGammeDisplayName(
        "Courroie d'accessoire",
        'courroie-d-accessoire',
        idRestore,
      ),
    ).toBe("courroie d'accessoire");
  });

  it('keeps the accents the slug had stripped', () => {
    expect(formatGammeDisplayName('Démarreur', 'demarreur', idRestore)).toBe(
      'démarreur',
    );
    expect(
      formatGammeDisplayName('Filtre à huile', 'filtre-a-huile', idRestore),
    ).toBe('filtre à huile');
  });

  it('lower-cases the first letter for mid-sentence interpolation ("les ${name}")', () => {
    // Title template is "Quand changer les {name} :" — {name} is never sentence-initial.
    expect(
      formatGammeDisplayName(
        'Plaquette de frein',
        'plaquette-de-frein',
        idRestore,
      ),
    ).toBe('plaquette de frein');
  });

  it('lower-cases a leading accented capital that is NOT an acronym (Étrier → étrier)', () => {
    // Load-bearing: the ^[A-ZÀ-Ý]{2,} guard must NOT treat "Ét" as an acronym.
    expect(
      formatGammeDisplayName('Étrier de frein', 'etrier-de-frein', idRestore),
    ).toBe('étrier de frein');
    expect(formatGammeDisplayName('É', 'e', idRestore)).toBe('é');
    expect(formatGammeDisplayName('A', 'a', idRestore)).toBe('a');
  });

  it('preserves acronym / all-caps initial tokens (ABS, FAP, ÉTRIER, ABS capteur)', () => {
    expect(formatGammeDisplayName('ABS', 'abs', idRestore)).toBe('ABS');
    expect(
      formatGammeDisplayName('FAP catalysé', 'fap-catalyse', idRestore),
    ).toBe('FAP catalysé');
    expect(
      formatGammeDisplayName('ABS capteur', 'abs-capteur', idRestore),
    ).toBe('ABS capteur');
    expect(formatGammeDisplayName('ÉTRIER', 'etrier', idRestore)).toBe(
      'ÉTRIER',
    );
  });

  it('passes an already-lower-cased name through unchanged', () => {
    expect(
      formatGammeDisplayName('filtre à huile', 'filtre-a-huile', idRestore),
    ).toBe('filtre à huile');
  });

  it('falls back to restoreAccents(slug) when pg_name is missing — never the raw slug', () => {
    const spy = jest.fn((s: string) => s.replace('temoin', 'témoin'));
    expect(formatGammeDisplayName(null, 'temoin-d-usure', spy)).toBe(
      'témoin d usure',
    );
    expect(spy).toHaveBeenCalledWith('temoin d usure');

    expect(formatGammeDisplayName(undefined, 'demarreur', idRestore)).toBe(
      'demarreur',
    );
    expect(formatGammeDisplayName('   ', 'demarreur', idRestore)).toBe(
      'demarreur',
    );
    expect(formatGammeDisplayName('', '', idRestore)).toBe('');
  });

  it('applies mid-sentence casing on the FALLBACK path too (contract consistency)', () => {
    // Even if restoreAccents yields a capitalized token, the determiner-position
    // contract holds: first char is lower-cased (acronyms still preserved).
    expect(
      formatGammeDisplayName(null, 'demarreur', (s) => `D${s.slice(1)}`),
    ).toBe('demarreur');
    expect(formatGammeDisplayName(null, 'abs', () => 'ABS')).toBe('ABS');
  });
});
