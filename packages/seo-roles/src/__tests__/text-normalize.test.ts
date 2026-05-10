import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  normalizeSeoText,
  normalizePhrase,
  tokenize,
  stem,
  tokenizeAndStem,
} from "../text-normalize";

describe("normalizeSeoText — diacritics + ponctuation + lowercase", () => {
  test("strips French diacritics via NFD", () => {
    assert.equal(normalizeSeoText("Voyant Allumé"), "voyant allume");
    assert.equal(normalizeSeoText("FRÊIN À DISQUE"), "frein a disque");
    assert.equal(normalizeSeoText("Définition"), "definition");
  });

  test("unifies smart quotes to ASCII apostrophe", () => {
    assert.equal(normalizeSeoText("qu’est-ce que"), "qu'est ce que");
    assert.equal(normalizeSeoText("d’achat"), "d'achat");
  });

  test("strips ponctuation but preserves apostrophe", () => {
    assert.equal(normalizeSeoText("guide d'achat !"), "guide d'achat");
    assert.equal(normalizeSeoText("voyant moteur, allume."), "voyant moteur allume");
  });

  test("collapses whitespace", () => {
    assert.equal(normalizeSeoText("  voyant   moteur  "), "voyant moteur");
    assert.equal(normalizeSeoText("voyant\tmoteur\nallume"), "voyant moteur allume");
  });

  test("idempotent", () => {
    const once = normalizeSeoText("Voyant — Allumé !");
    assert.equal(normalizeSeoText(once), once);
  });
});

describe("normalizePhrase — multi-word substring matching", () => {
  test("preserves stopwords for phrase match", () => {
    assert.equal(normalizePhrase("ajouter au panier"), "ajouter au panier");
    assert.equal(normalizePhrase("guide d'achat"), "guide d achat");
  });
});

describe("tokenize — drops short tokens and stopwords", () => {
  test("removes FR stopwords", () => {
    assert.deepEqual(tokenize("le filtre a huile pour la voiture"), [
      "filtre",
      "huile",
      "voiture",
    ]);
  });

  test("drops tokens shorter than 2 chars", () => {
    // Apostrophe split: "à chaud" → "a chaud" → tokens ["chaud"] (a is stopword).
    assert.deepEqual(tokenize("à chaud"), ["chaud"]);
  });

  test("splits apostrophe contractions and drops clitiques", () => {
    // "qu'est-ce" → "qu est ce" → ["est"] (qu+ce are stopwords).
    // "c'est" → "c est" → ["est"] (c is < 2 chars).
    assert.deepEqual(tokenize("qu'est-ce que c'est"), ["est", "est"]);
  });

  test("preserves alphanum tokens like DTC codes", () => {
    assert.deepEqual(tokenize("code DTC P0420"), ["code", "dtc", "p0420"]);
  });
});

describe("stem — light FR suffix stripping", () => {
  test("plural forms reduce to singular root", () => {
    assert.equal(stem("voyants"), stem("voyant"));
    assert.equal(stem("plaquettes"), stem("plaquette"));
  });

  test("verb infinitive vs adjective converge", () => {
    // "diagnostiquer" (verb) and "diagnostique" (adj) must share a stem
    // so the canon gate catches both forms in forbidden-overlap matching.
    assert.equal(stem("diagnostiquer"), stem("diagnostique"));
  });

  test("preserves short tokens (no over-stripping)", () => {
    assert.equal(stem("code"), "code");
    assert.equal(stem("dtc"), "dtc");
    assert.equal(stem("obd"), "obd");
  });

  test("does not collapse tokens to fewer than 4 chars", () => {
    // Even with a matching suffix, the resulting stem must remain ≥ 4 chars.
    assert.ok(stem("odeur").length >= 4);
    assert.ok(stem("essence").length >= 4);
  });

  test("throws on unsupported locale", () => {
    assert.throws(
      // @ts-expect-error — testing runtime guard
      () => stem("test", "en-US"),
      /Stemmer locale .* not supported/,
    );
  });
});

describe("tokenizeAndStem — composed canon-gate API", () => {
  test("returns a Set for O(1) membership tests", () => {
    const stems = tokenizeAndStem("Voyants moteur allumés en continu");
    assert.ok(stems instanceof Set);
    // "voyants" and "voyant" share their stem → contained
    const voyantStem = stem("voyant");
    assert.equal(stems.has(voyantStem), true);
  });
});
