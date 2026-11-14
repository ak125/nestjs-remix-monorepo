// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  extractEditorialBlocks,
  priceSectionMentionsPrice,
} from "~/utils/editorial-parser";

/**
 * Titre du H2 #2 de la page R1 (pieces.$slug.tsx) : « prix » n'y figure que si la
 * section en parle. Relevé du 2026-10-31 sur les 168 gammes affichées : 93 sections
 * avec un bloc de prix, 75 sans bloc, aucune avec des blocs sans prix. La règle ne
 * change donc aucune gamme tant qu'un contenu ne retire pas son bloc de prix (lot
 * filtre à huile, pg 7).
 */
describe("priceSectionMentionsPrice", () => {
  it("section sans bloc : titre historique", () => {
    expect(priceSectionMentionsPrice([])).toBe(true);
  });

  it("bloc de prix : titre historique", () => {
    const { priceSection } = extractEditorialBlocks(
      "<h2>Filtre à huile prix : fourchettes selon le type</h2><p>De 5 € à 30 € selon la marque.</p>",
    );
    expect(priceSection).toHaveLength(1);
    expect(priceSectionMentionsPrice(priceSection)).toBe(true);
  });

  it.each([
    ["coût", "<p>Le coût dépend du montage.</p>"],
    ["euros", "<p>Comptez une dizaine d'euros.</p>"],
    ["entité", "<p>Dès 5&euro;.</p>"],
    ["pas cher", "<p>Un filtre pas cher.</p>"],
  ])("mention « %s » : titre historique", (_nom, html) => {
    expect(priceSectionMentionsPrice([`<h3>Qualité</h3>${html}`])).toBe(true);
  });

  it("blocs de qualité seulement : « Qualité et marques »", () => {
    const { priceSection } = extractEditorialBlocks(
      "<h2>Qualité d'un filtre à huile : ce qui compte</h2><p>Le papier filtrant et le clapet de dérivation.</p>",
    );
    expect(priceSection).toHaveLength(1);
    expect(priceSectionMentionsPrice(priceSection)).toBe(false);
  });

  it("le mot dans un attribut ne compte pas", () => {
    expect(
      priceSectionMentionsPrice([
        '<h3>Qualité</h3><p><a href="/guide/prix-filtre">Le guide</a> des marques.</p>',
      ]),
    ).toBe(false);
  });
});
