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
 * 1. Coût par appel : il ne doit pas dépendre du nombre d'appels déjà servis par le
 *    process. Avec isomorphic-dompurify 2.36.0 (jsdom 28), chaque appel laissait sur la
 *    fenêtre partagée des écouteurs jamais retirés, que chaque ajout suivant parcourt :
 *    le temps par appel croissait avec l'uptime.
 * 2. Sortie préservée : fixture golden enregistrée avec isomorphic-dompurify 2.36.0
 *    AVANT la montée de version (voir `captured_with`) — contenus éditoriaux publics,
 *    formes d'entrée des autres consommateurs, résidus Word, allowlist, vecteurs XSS.
 *    Un écart s'analyse ; il ne se ré-enregistre pas.
 */

type GoldenFixture = (typeof golden.fixtures)[number];

const fixtureInput = (id: string): string => {
  const fixture = golden.fixtures.find((f) => f.id === id);
  if (!fixture) throw new Error(`fixture golden absente : ${id}`);
  return fixture.input;
};

/**
 * Harnais de coût. Le signal est le temps : aucun compteur public n'expose l'état de la
 * fenêtre jsdom interne, et lire ou patcher les internes de jsdom lierait le test à une
 * version précise. Robustesse CI :
 *  - échauffement JIT exclu de la comparaison ;
 *  - médiane par lot, insensible à une pause GC isolée ;
 *  - minimum de plusieurs lots en début et en fin de série : une contention CPU peut
 *    ralentir un lot, jamais l'accélérer, donc le minimum estime le coût propre ;
 *  - un macrotask entre deux appels, comme des rendus SSR successifs.
 * Seuil, mesuré avec ce harnais sur ce fragment : ratio fin/début ≈ 5,4 avec 2.36.0
 * (0,61 → 3,31 ms, croissance linéaire), ≈ 0,8 à 0,95 avec 4.2.0. Un coût final plus de
 * deux fois supérieur au coût initial signale la croissance sans marge étroite dans un
 * sens ni dans l'autre.
 */
const COST_FIXTURE_ID = "tests-existants/balises-editoriales";
const WARMUP_CALLS = 200;
const TOTAL_CALLS = 5_000;
const BATCH_CALLS = 100;
const BATCHES_COMPARED = 5;
const MAX_LATE_TO_EARLY_RATIO = 2;
// En cas de régression, la série dure bien plus que le délai Vitest par défaut : le test
// doit échouer sur le ratio mesuré, pas sur un dépassement de délai.
const COST_TEST_TIMEOUT_MS = 120_000;

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

const nextMacrotask = (): Promise<void> =>
  new Promise((resolve) => setImmediate(resolve));

describe("sanitizeEditorialHtml (SSR) — précondition", () => {
  it("aucun window global : la build Node d'isomorphic-dompurify est celle exercée", () => {
    expect(typeof (globalThis as { window?: unknown }).window).toBe(
      "undefined",
    );
  });
});

describe("sanitizeEditorialHtml (SSR) — coût par appel indépendant de l'uptime", () => {
  it(
    "le coût médian par appel ne croît pas avec le nombre d'appels servis",
    async () => {
      const html = fixtureInput(COST_FIXTURE_ID);
      const durations: number[] = [];
      for (let call = 0; call < TOTAL_CALLS; call++) {
        const start = performance.now();
        sanitizeEditorialHtml(html);
        durations.push(performance.now() - start);
        await nextMacrotask();
      }

      const batchMedians: number[] = [];
      for (
        let from = WARMUP_CALLS;
        from + BATCH_CALLS <= TOTAL_CALLS;
        from += BATCH_CALLS
      ) {
        batchMedians.push(median(durations.slice(from, from + BATCH_CALLS)));
      }
      const early = Math.min(...batchMedians.slice(0, BATCHES_COMPARED));
      const late = Math.min(...batchMedians.slice(-BATCHES_COMPARED));

      expect(
        late / early,
        `coût médian par appel : ${early.toFixed(3)} ms en début de série, ` +
          `${late.toFixed(3)} ms après ${TOTAL_CALLS} appels`,
      ).toBeLessThan(MAX_LATE_TO_EARLY_RATIO);
    },
    COST_TEST_TIMEOUT_MS,
  );
});

describe("sanitizeEditorialHtml (SSR) — sortie identique à la fixture golden", () => {
  it.each(golden.fixtures)("$id", ({ input, expected }: GoldenFixture) => {
    expect(sanitizeEditorialHtml(input)).toBe(expected);
  });
});
