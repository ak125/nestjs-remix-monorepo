/**
 * V-Level — éligibilité gamme-term (garde anti re-contamination cross-gamme).
 *
 * Garantit que l'élection V2/V3/V4 d'une gamme ne peut PAS reprendre un keyword d'une AUTRE pièce.
 * Cas concrets (incident décontamination plaquette 2026-06-07) :
 *   - plaquette-de-frein (402) ne doit pas élire « disque de frein clio 3 »
 *   - disque-de-frein (82) ne doit pas élire « plaquette de frein clio 3 »
 *   - cable-de-frein-a-main (124) reste inchangé (ses propres keywords éligibles)
 *
 * @see ../vlevel-invariants.ts (GAMME_PART_TERMS, isKeywordEligibleForGamme)
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { GAMME_PART_TERMS, isKeywordEligibleForGamme } from "../index";

const DISQUE = 82;
const PLAQUETTE = 402;
const CABLE = 124;

describe("V-Level gamme-term — anti re-contamination", () => {
  test("plaquette (402) n'élit PAS un keyword disque (cross-gamme)", () => {
    assert.equal(isKeywordEligibleForGamme("disque de frein clio 3", PLAQUETTE), false);
    assert.equal(isKeywordEligibleForGamme("disque de frein 207", PLAQUETTE), false);
    assert.equal(isKeywordEligibleForGamme("prix disque de frein megane 3", PLAQUETTE), false);
  });

  test("plaquette (402) élit ses propres keywords (y compris intent combiné)", () => {
    assert.equal(isKeywordEligibleForGamme("plaquette de frein clio 3", PLAQUETTE), true);
    assert.equal(isKeywordEligibleForGamme("plaquettes clio 3", PLAQUETTE), true);
    // « disque et plaquette » mentionne plaquette → légitimement éligible (intent combiné)
    assert.equal(isKeywordEligibleForGamme("disque et plaquette de frein clio 4", PLAQUETTE), true);
  });

  test("disque (82) n'élit PAS un keyword plaquette (cross-gamme)", () => {
    assert.equal(isKeywordEligibleForGamme("plaquette de frein clio 3", DISQUE), false);
    assert.equal(isKeywordEligibleForGamme("plaquettes clio 3", DISQUE), false);
  });

  test("disque (82) élit ses propres keywords", () => {
    assert.equal(isKeywordEligibleForGamme("disque de frein clio 3", DISQUE), true);
    assert.equal(isKeywordEligibleForGamme("disque et plaquette de frein clio 4", DISQUE), true);
  });

  test("cable (124) inchangé — ses keywords éligibles, accent-insensible", () => {
    assert.equal(isKeywordEligibleForGamme("cable de frein a main 307", CABLE), true);
    assert.equal(isKeywordEligibleForGamme("câble frein à main clio 2", CABLE), true);
    // cross-gamme (disque/plaquette) exclu de l'élection cable
    assert.equal(isKeywordEligibleForGamme("disque de frein 307", CABLE), false);
    assert.equal(isKeywordEligibleForGamme("plaquette de frein 307", CABLE), false);
  });

  test("gamme NON mappée → aucun filtre (comportement actuel strictement préservé)", () => {
    assert.equal(isKeywordEligibleForGamme("disque de frein clio 3", 999), true);
    assert.equal(isKeywordEligibleForGamme("n'importe quoi", 1), true);
  });

  test("entrée vide / null safe", () => {
    assert.equal(isKeywordEligibleForGamme("", PLAQUETTE), false);
    assert.equal(isKeywordEligibleForGamme(undefined as unknown as string, PLAQUETTE), false);
    assert.equal(isKeywordEligibleForGamme("", 999), true); // gamme non mappée = pas de filtre
  });

  test("les 3 gammes frein sont mappées (couple disque/plaquette/cable)", () => {
    for (const pg of [DISQUE, PLAQUETTE, CABLE]) {
      assert.ok(GAMME_PART_TERMS[pg] instanceof RegExp, `pg ${pg} doit avoir un terme`);
    }
  });
});
