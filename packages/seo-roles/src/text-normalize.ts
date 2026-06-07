/**
 * Text normalization & light FR stemming for canon matching.
 *
 * Used by canon gates (forbidden-overlap detection) and keyword classification.
 * Zero external dependency — minimal suffix-stripping stemmer covers the
 * production cases (plural, verb infinitive, past participle, common adjective
 * endings). Not a full Porter — see `__tests__/text-normalize.test.ts` for the
 * exact accepted shape.
 *
 * Locale-parameterised at the edge to prevent fr-FR from baking into hot paths
 * — adding EN later means adding a new branch, not refactoring callers.
 */

export type SupportedLocale = "fr-FR";

const FR_STOPWORDS: ReadonlySet<string> = new Set([
  "le", "la", "les", "un", "une", "des", "de", "du", "et", "ou",
  "a", "au", "aux", "en", "sur", "pour", "par", "avec", "sans",
  "ce", "cet", "cette", "ces", "ma", "mon", "mes", "ta", "ton", "tes",
  "sa", "son", "ses", "qui", "que", "quoi", "dont", "ne", "pas",
  // Clitiques d'apostrophe (post-split): qu', c', d', l', m', n', s', t', j'
  "qu", "j",
]);

const MIN_TOKEN_LEN = 2;
const MIN_STEM_LEN = 4;

/**
 * Canonical text normalisation for SEO matching.
 *
 * Steps : lowercase → NFD decompose → drop combining diacritics → unify
 * apostrophes → strip ponctuation (keep apostrophe + alphanum + space) →
 * collapse whitespace.
 *
 * Idempotent : `normalizeSeoText(normalizeSeoText(x)) === normalizeSeoText(x)`.
 */
export function normalizeSeoText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2018\u2019\u02bc\x60]/g, "'")
    .replace(/[^\p{L}\p{N}'\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normalised phrase for multi-word substring matching.
 *
 * Differs from `tokenize` : preserves word order and stopwords so phrases like
 * "guide d achat" or "ajouter au panier" can be matched as substrings against
 * the same normalisation of the source content.
 */
export function normalizePhrase(text: string): string {
  return normalizeSeoText(text).replace(/'/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Numéraux romains de génération de modèle (I..X) → arabe, pour un MATCH robuste
 * keyword ↔ catalogue. `normalizeSeoText` gère déjà accents + tirets + espaces, mais pas
 * `II` ↔ `2`. Seuls les tokens romains PURS sont convertis (`ii`→`2`), jamais un sous-mot
 * (`vti`, `c4` restent). Mapping consistant des DEUX côtés → l'exactitude sémantique n'importe
 * pas (ex. « classe v » et « CLASSE V » donnent tous deux `classe 5` → ils matchent).
 */
const MODEL_ROMAN_TO_ARABIC: Readonly<Record<string, string>> = {
  i: "1", ii: "2", iii: "3", iv: "4", v: "5",
  vi: "6", vii: "7", viii: "8", ix: "9", x: "10",
};

/**
 * Clé canonique de MATCHING d'un nom de modèle véhicule (keyword libre ↔ `auto_modele.modele_name`).
 *
 * Pipeline : {@link normalizeSeoText} (lowercase, accents, tirets/ponctuation → espace, collapse)
 * puis génération romaine → arabe par token. Déterministe & idempotent.
 *
 * Exemples : `"scenic 2"` et `"SCÉNIC II"` → `"scenic 2"` ; `"C4 Picasso"` → `"c4 picasso"` ;
 * `"Clio III"` et `"clio 3"` → `"clio 3"`. Usage : résolution de candidat modèle (blocked-plan)
 * et groupement V-Level — JAMAIS pour de l'affichage (clé interne uniquement).
 */
export function modelMatchKey(modelName: string): string {
  return normalizeSeoText(modelName)
    .split(" ")
    .map((tok) => MODEL_ROMAN_TO_ARABIC[tok] ?? tok)
    .join(" ")
    .trim();
}

/**
 * Tokenise text into matchable units.
 *
 * Drops tokens shorter than {@link MIN_TOKEN_LEN} chars and FR stopwords.
 * Apostrophes split tokens (so "qu'est-ce" → ["est", "ce"], with "qu" filtered
 * by length and "ce" by stopword set).
 */
export function tokenize(
  text: string,
  locale: SupportedLocale = "fr-FR",
): string[] {
  void locale;
  return normalizeSeoText(text)
    .replace(/'/g, " ")
    .split(" ")
    .filter((t) => t.length >= MIN_TOKEN_LEN && !FR_STOPWORDS.has(t));
}

/**
 * Suffix order matters : longer suffixes first so "iquer" wins over "er", and
 * the stemmer always tries the most specific transform.
 *
 * Each entry is tried at most once per call ; first match wins, then we exit.
 * Stem length floor = {@link MIN_STEM_LEN} prevents over-stripping short
 * tokens (`"code"` must NOT collapse to `"cod"`).
 */
const FR_LIGHT_SUFFIXES: readonly string[] = [
  "issement", "issements",
  "iquement", "iquer", "iques", "ique",
  "ements", "ement",
  "ables", "able",
  "istes", "iste",
  "ation", "ations", "ition", "itions",
  "aient", "ions", "iez", "ait", "ais",
  "ant", "ent", "ons",
  "eaux", "aux",
  "eux", "euse", "euses",
  "ees", "ee",
  "er", "ir", "re", "ez",
  "es", "x", "s", "e",
];

function lightStemFr(token: string): string {
  let t = token;
  if (t.length <= MIN_STEM_LEN) return t;
  for (const suffix of FR_LIGHT_SUFFIXES) {
    if (t.length - suffix.length >= MIN_STEM_LEN && t.endsWith(suffix)) {
      t = t.slice(0, -suffix.length);
      break;
    }
  }
  return t;
}

/**
 * Stem a single token to its canonical form for the given locale.
 *
 * fr-FR : light suffix-stripping (plural, verb infinitive, past participle,
 * common adjective endings). Throws for unsupported locales — adding a locale
 * is an explicit decision, not a silent fallback.
 */
export function stem(
  token: string,
  locale: SupportedLocale = "fr-FR",
): string {
  if (locale !== "fr-FR") {
    throw new Error(
      `Stemmer locale "${locale}" not supported. Add an explicit branch in stem() before use.`,
    );
  }
  return lightStemFr(token);
}

/**
 * Convenience : normalise + tokenize + stem in one pass. Returns a `Set` for
 * O(1) membership tests in canon gates.
 */
export function tokenizeAndStem(
  text: string,
  locale: SupportedLocale = "fr-FR",
): ReadonlySet<string> {
  return new Set(tokenize(text, locale).map((t) => stem(t, locale)));
}
