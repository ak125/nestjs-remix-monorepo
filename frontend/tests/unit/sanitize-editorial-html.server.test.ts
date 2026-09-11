// @vitest-environment node
import { describe, expect, it } from "vitest";

import { sanitizeEditorialHtml } from "~/utils/sanitize-editorial-html";
import golden from "./fixtures/sanitize-editorial-html.golden.json";

/**
 * sanitizeEditorialHtml — chemin serveur (SSR).
 *
 * Sans `window` global, isomorphic-dompurify charge sa build Node : une fenêtre jsdom
 * propre au process, partagée par tous les rendus serveur (loader de `editorial-parser`,
 * chaque `HtmlContent` rendu côté serveur). Le fichier voisin
 * `sanitize-editorial-html.test.ts` tourne sous l'environnement jsdom de Vitest : il y
 * reçoit la build navigateur et ne couvre donc pas ce chemin.
 *
 * Sortie préservée : fixture golden enregistrée avec isomorphic-dompurify 2.36.0
 * AVANT la montée de version (voir `captured_with`) — contenus éditoriaux publics,
 * formes d'entrée des autres consommateurs, résidus Word, allowlist, vecteurs XSS.
 * Un écart s'analyse ; il ne se ré-enregistre pas.
 */

type GoldenFixture = (typeof golden.fixtures)[number];

describe("sanitizeEditorialHtml (SSR) — précondition", () => {
  it("aucun window global : la build Node d'isomorphic-dompurify est celle exercée", () => {
    expect(typeof (globalThis as { window?: unknown }).window).toBe(
      "undefined",
    );
  });
});

describe("sanitizeEditorialHtml (SSR) — sortie identique à la fixture golden", () => {
  it.each(golden.fixtures)("$id", ({ input, expected }: GoldenFixture) => {
    expect(sanitizeEditorialHtml(input)).toBe(expected);
  });
});
