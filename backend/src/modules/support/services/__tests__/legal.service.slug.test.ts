/**
 * Slug d'un document légal — le slug sert d'identifiant de lecture
 * (`getDocument` le compare au slug stocké), donc sa forme ne doit pas changer.
 *
 * Les espaces et tirets consécutifs sont réduits en un seul passage, puis un
 * seul tiret de bord au plus reste à retirer : temps linéaire quelle que soit
 * la longueur du titre. Les sorties attendues sont celles de l'ancienne chaîne
 * (`\s+` → `-`, `-+` → `-`, puis retrait des tirets de bord).
 */

import { LegalService } from '../legal.service';

const generateSlug = (title: string): string =>
  (
    Object.create(LegalService.prototype) as {
      generateSlug(t: string): string;
    }
  ).generateSlug(title);

describe('LegalService — slug d’un document', () => {
  it.each([
    ['Conditions Générales de Vente', 'conditions-generales-de-vente'],
    ['  Politique de confidentialité  ', 'politique-de-confidentialite'],
    ['Retours & échanges — 2026', 'retours-echanges-2026'],
    ['a - b', 'a-b'],
    ['a -\t- b', 'a-b'],
    ['--- CGV ---', 'cgv'],
    ['- x -', 'x'],
    ['!!!', ''],
    ['---', ''],
    ['Ça coûte 10€ !', 'ca-coute-10'],
  ])('%j → %j', (title, slug) => {
    expect(generateSlug(title)).toBe(slug);
  });

  it('reste linéaire sur une longue suite de tirets', () => {
    const title = `a${'-'.repeat(200_000)}b${' -'.repeat(100_000)}`;
    const start = process.hrtime.bigint();
    expect(generateSlug(title)).toBe('a-b');
    const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
    expect(elapsedMs).toBeLessThan(1_000);
  });
});
