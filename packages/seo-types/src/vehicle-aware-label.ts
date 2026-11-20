/**
 * 🚗 Vehicle-aware label helper for R2 SEO headings (H1 + meta_title)
 *
 * Shared between backend (`seo-template.service.ts:processTemplates`) and
 * frontend (`PiecesHeader.tsx`, `pieces-vehicle.loader.server.ts`).
 *
 * Enrichit conditionnellement `type_name` avec `power_ps` (et `fuel` si non
 * implicite) quand `type_name` est ambigu — deux `type_ids` peuvent partager
 * un même `type_name` (ex. `"2.0 HDi"` pour 140 ch et 163 ch).
 *
 * Cause racine : audit empirique 2026-05-26
 * (`audit/seo-h1-meta-empirical-verification-2026-05-26.md`) a confirmé 3
 * duplicates R2 H1 + 1 duplicate R2 title (1 EXACT lev=0) sur 100 paires
 * intra-gamme.
 *
 * GATE 1 doctrine — empirical implementation path proven 2026-05-26 :
 * - Backend `seo-template.service.ts` couvre <title> HEAD pour les ~118
 *   pg_ids avec template DB existant (~1.2% du catalogue), via Redis cache
 *   `seo:processed:{pg_id}:{type_id}:{modifier}` TTL 24h.
 * - Frontend `PiecesHeader.tsx` couvre le `<h1>` visible utilisateur + le
 *   `<title>` HEAD pour les pg_ids sans template DB (fallback dans
 *   `pieces-vehicle.loader.server.ts`).
 *
 * Invariants critiques :
 * - **Idempotent** : si `type_name` contient déjà `${powerPs} ch`, no-op.
 * - **Normalisation `powerPs`** : `"140 ch"` accepté en input → strip suffixe
 *   → pas de `"140 ch ch"`.
 * - **Conditionnel strict** : si `isAmbiguous === false` → no-op exact, zero
 *   régression sur 97% des paires non-ambiguës.
 * - **Fallback safe** : si `power_ps` absent, type_name vide, ou pattern
 *   non-match → no-op.
 */

export interface VehicleLabelInput {
  typeName?: string;
  powerPs?: string;
  fuel?: string;
}

export interface EnrichedTypeName {
  value: string;
  isEnriched: boolean;
}

/**
 * Pattern conservateur : `type_name` ambigu = motorisation au format standard
 * `<displacement>[.<decimal>]( <abbrev>)?` où abbrev ≤ 5 chars (ex. "2.0 HDi",
 * "1.4", "1.6 TDI", "3.0 V6", "2.0 RC", "2,0 HDi" virgule décimale FR).
 *
 * Cas non-matchés (fallback no-op safe) :
 *   - "2.0i" (sans espace) — pattern requiert `\s+` avant abbrev
 *   - "1.4 HDI 16V" (3 parties) — pattern accepte 1 abbrev max
 *   - "GTI", "Dynamique Cuir", "Hybrid Touring" — pas de displacement initial
 */
const AMBIGUOUS_TYPE_NAME_PATTERN = /^\d+([.,]\d+)?(\s+[A-Za-z0-9]{1,5})?$/i;

/** Carburant qu'un jeton de `type_name` suffit à exprimer. */
export type FuelImpliedByToken = "Diesel" | "Essence";

export interface FuelImplyingTypeToken {
  /** Jeton tel qu'écrit dans `auto_type.type_name` (comparaison insensible à la casse). */
  token: string;
  fuel: FuelImpliedByToken;
  /**
   * `true` : jeton de la liste historique de l'enrichissement des titres
   * (`enrichTypeNameForHeadings`, H1 compris). Ce sous-ensemble reproduit
   * exactement l'ancien motif `\b(HDI|HDi|TDI|TDi|DCI|dCi|CDI|JTD|TDCI|CRDI|D)\b`
   * (insensible à la casse) : le H1 ne change pas.
   */
  legacyHeading?: true;
}

/**
 * Jetons de `type_name` qui disent déjà le carburant (liste unique, mandat DW
 * du 2026-11-19). Source de chaque entrée, mesurée le 2026-11-19 sur les
 * `auto_type` affichés (`type_display = '1'`, 28 505 types) : part des types
 * contenant le jeton (mot entier, casse ignorée) dont `type_fuel` appartient à
 * la famille indiquée. Seuil d'entrée : 98 %. `D` (96,7 %) est gardé parce
 * qu'il figure dans la liste historique et dans le mandat. Écartés sous le
 * seuil : `GDi` (94,1 %), `T-GDi` (90,7 %), `Skyactiv-D` (81,2 %), `MPI`
 * (97,5 %). `D-4D` (91,3 %) reste couvert par `D`. Mesures par jeton :
 * `docs/audit/mandat-dw-20261119/jetons-carburant.tsv`.
 */
export const FUEL_IMPLYING_TYPE_TOKENS: readonly FuelImplyingTypeToken[] =
  Object.freeze([
    { token: "D", fuel: "Diesel", legacyHeading: true },
    { token: "TD", fuel: "Diesel" },
    { token: "TDI", fuel: "Diesel", legacyHeading: true },
    { token: "SDI", fuel: "Diesel" },
    { token: "HDI", fuel: "Diesel", legacyHeading: true },
    { token: "BlueHDi", fuel: "Diesel" },
    { token: "e-HDi", fuel: "Diesel" },
    { token: "dCi", fuel: "Diesel", legacyHeading: true },
    { token: "CDI", fuel: "Diesel", legacyHeading: true },
    { token: "CDTI", fuel: "Diesel" },
    { token: "TDCI", fuel: "Diesel", legacyHeading: true },
    { token: "CRDI", fuel: "Diesel", legacyHeading: true },
    { token: "CRD", fuel: "Diesel" },
    { token: "JTD", fuel: "Diesel", legacyHeading: true },
    { token: "JTDM", fuel: "Diesel" },
    { token: "Multijet", fuel: "Diesel" },
    { token: "DTI", fuel: "Diesel" },
    { token: "TID", fuel: "Diesel" },
    { token: "TTID", fuel: "Diesel" },
    { token: "DID", fuel: "Diesel" },
    { token: "DDiS", fuel: "Diesel" },
    { token: "CTDI", fuel: "Diesel" },
    { token: "D4D", fuel: "Diesel" },
    { token: "BlueTEC", fuel: "Diesel" },
    { token: "TD4", fuel: "Diesel" },
    { token: "SD4", fuel: "Diesel" },
    { token: "ED4", fuel: "Diesel" },
    { token: "i-DTEC", fuel: "Diesel" },
    { token: "EcoBlue", fuel: "Diesel" },
    { token: "PureTech", fuel: "Essence" },
    { token: "TSI", fuel: "Essence" },
    { token: "FSI", fuel: "Essence" },
    { token: "TFSI", fuel: "Essence" },
    { token: "THP", fuel: "Essence" },
    { token: "VTi", fuel: "Essence" },
    { token: "TCe", fuel: "Essence" },
    { token: "EcoBoost", fuel: "Essence" },
    { token: "CVVT", fuel: "Essence" },
    { token: "JTS", fuel: "Essence" },
    { token: "CGI", fuel: "Essence" },
    { token: "Kompressor", fuel: "Essence" },
    { token: "GTI", fuel: "Essence" },
    { token: "T-Jet", fuel: "Essence" },
    { token: "VTEC", fuel: "Essence" },
    { token: "i-VTEC", fuel: "Essence" },
    { token: "Skyactiv-G", fuel: "Essence" },
    { token: "DIG-T", fuel: "Essence" },
  ] as const);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&");
}

/**
 * Carburants implicites pour l'enrichissement des titres (H1 + title des types
 * ambigus) : sous-ensemble `legacyHeading` de la liste unique, même motif que
 * l'historique. Quand `type_name` contient un de ces jetons, on n'ajoute pas le
 * `fuel` explicitement → évite la redondance "Diesel HDI 140 ch".
 */
const FUEL_IMPLICIT_PATTERN = new RegExp(
  `\\b(${FUEL_IMPLYING_TYPE_TOKENS.filter((t) => t.legacyHeading)
    .map((t) => escapeRegExp(t.token))
    .join("|")})\\b`,
  "i",
);

/**
 * Motifs par jeton : mot entier délimité par un caractère non alphanumérique
 * ASCII (le tiret compte comme séparateur : `e-HDi`, `1.6-TDI`), casse ignorée.
 * Pas de lookbehind : le module est aussi chargé côté navigateur (H1 R2).
 */
const FUEL_TOKEN_MATCHERS: ReadonlyArray<{
  fuel: FuelImpliedByToken;
  pattern: RegExp;
}> = FUEL_IMPLYING_TYPE_TOKENS.map((t) => ({
  fuel: t.fuel,
  pattern: new RegExp(
    `(?:^|[^A-Za-z0-9])${escapeRegExp(t.token)}(?![A-Za-z0-9])`,
    "i",
  ),
}));

/**
 * `true` si `typeName` contient un jeton dont le carburant est EXACTEMENT
 * `fuel` (casse et espaces ignorés). Un hybride (`Diesel-Électrique`), un GPL
 * ou un éthanol n'est jamais tenu pour implicite : son carburant reste écrit.
 */
export function isFuelImpliedByTypeName(
  typeName?: string,
  fuel?: string,
): boolean {
  const name = (typeName ?? "").trim();
  const wanted = (fuel ?? "").trim().toLowerCase();
  if (!name || !wanted) return false;
  return FUEL_TOKEN_MATCHERS.some(
    (m) => m.fuel.toLowerCase() === wanted && m.pattern.test(name),
  );
}

// Quantifiers bornés pour éviter ReDoS (js/polynomial-redos) — les inputs
// réels (DB `auto_type.type_name`, `type_power_ps`) sont contraints (motorisation
// standard, puissance ≤4 chiffres) ; 0-3 espaces suffisent pour matcher les
// formes canoniques "140 ch", "140  ch", "140ch".
function normalizePowerPs(powerPs?: string): string {
  return (powerPs ?? "").replace(/\s{0,3}ch\s{0,3}$/i, "").trim();
}

function alreadyContainsPower(typeName: string, powerPs?: string): boolean {
  const power = normalizePowerPs(powerPs);
  if (!power) return false;
  const escaped = power.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\s{0,3}ch\\b`, "i").test(typeName);
}

export function isTypeNameAmbiguousForSeo(
  typeName?: string,
  powerPs?: string,
): boolean {
  const baseName = (typeName ?? "").trim();
  const power = normalizePowerPs(powerPs);
  if (!baseName || !power) return false;
  if (alreadyContainsPower(baseName, power)) return false;
  return AMBIGUOUS_TYPE_NAME_PATTERN.test(baseName);
}

export function enrichTypeNameForHeadings(
  input: VehicleLabelInput,
): EnrichedTypeName {
  const baseName = (input.typeName ?? "").trim();
  const power = normalizePowerPs(input.powerPs);

  if (!isTypeNameAmbiguousForSeo(baseName, power)) {
    return { value: baseName, isEnriched: false };
  }

  const fuelImplicit = FUEL_IMPLICIT_PATTERN.test(baseName);
  const fuel = (input.fuel ?? "").trim();
  const suffix = !fuelImplicit && fuel ? `${fuel} ${power} ch` : `${power} ch`;

  return {
    value: `${baseName} ${suffix}`.replace(/\s+/g, " ").trim(),
    isEnriched: true,
  };
}

/**
 * Graphie d'affichage du carburant. `auto_type.type_fuel` porte deux graphies
 * du même carburant (« Essence-Electrique » et « Essence-Électrique »,
 * « Electrique » et « Électrique ») : le titre n'en montre qu'une. Affichage
 * seulement, la base n'est pas modifiée (complément 1 du mandat DW).
 */
export function normalizeFuelForDisplay(fuel?: string): string {
  return (fuel ?? "")
    .trim()
    .replace(/(^|[^A-Za-zÀ-ÿ])Electrique(?![A-Za-zÀ-ÿ])/g, "$1Électrique");
}

/**
 * Code moteur ajouté au `<title>` R2 d'une page en collision (complément 1 du
 * mandat DW) : deux types du même modèle, servis dans la même gamme, qui ont
 * le même libellé {@link buildR2TitleTypeLabel}.
 *
 * - `ownCodes` : codes moteur du type de la page ;
 * - `collidingCodes` : codes moteur de chaque type en collision avec elle.
 *
 * Renvoie le premier code du type (ordre stable, comparaison par point de
 * code) s'il diffère du premier code de chacun des types en collision. Sinon
 * `null` : la collision n'est pas départagée et l'appelant le signale.
 * Aucune collision → `null` aussi ; le titre reste alors sans code.
 */
export function pickR2TitleMotorCode(
  ownCodes: readonly string[],
  collidingCodes: readonly (readonly string[])[],
): string | null {
  if (collidingCodes.length === 0) return null;
  const first = (codes: readonly string[]): string =>
    codes
      .map((c) => c.trim())
      .filter(Boolean)
      .sort()[0] ?? "";
  const own = first(ownCodes);
  if (!own) return null;
  return collidingCodes.every((codes) => first(codes) !== own) ? own : null;
}

/**
 * Libellé motorisation du `<title>` R2 de la forme « <type> [carburant]
 * <puissance> ch » (mandat DW du 2026-11-19, essai sur deux gammes pilotées
 * par leur template `__seo_gamme_car.sgc_title`, marqueur
 * `#VTypeCarburantPuissance#`).
 *
 * - Carburant écrit sauf s'il est déjà dans `typeName` (texte ou jeton
 *   implicite, cf. {@link isFuelImpliedByTypeName}) ; absent → rien d'inventé.
 * - Puissance écrite sauf si `typeName` la porte déjà ; absente → omise.
 * - Idempotent : un `typeName` déjà enrichi (« 1.4 75 ch », sortie de
 *   {@link enrichTypeNameForHeadings}) donne le même libellé que le type brut ;
 *   le carburant s'insère alors avant la puissance.
 */
export function buildR2TitleTypeLabel(input: VehicleLabelInput): string {
  const baseName = (input.typeName ?? "").trim();
  const power = normalizePowerPs(input.powerPs);
  const rawFuel = (input.fuel ?? "").trim();
  const fuel = normalizeFuelForDisplay(rawFuel);
  const lowerName = baseName.toLowerCase();

  const writeFuel =
    fuel !== "" &&
    !lowerName.includes(fuel.toLowerCase()) &&
    !lowerName.includes(rawFuel.toLowerCase()) &&
    !isFuelImpliedByTypeName(baseName, fuel);

  let label = baseName;
  if (power && alreadyContainsPower(baseName, power)) {
    if (writeFuel) {
      const escaped = power.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      label = baseName.replace(
        new RegExp(`\\b${escaped}\\s{0,3}ch\\b`, "i"),
        (m) => `${fuel} ${m}`,
      );
    }
  } else {
    label = [baseName, writeFuel ? fuel : "", power ? `${power} ch` : ""]
      .filter(Boolean)
      .join(" ");
  }
  return label.replace(/\s+/g, " ").trim();
}

/**
 * Exceptions de casse des noms de marque et de modèle du `<title>` R2
 * (complément 2 du mandat DW, 2026-11-19). Liste unique : clé = mot en
 * capitales tel qu'en base, valeur = graphie affichée.
 *
 * - Sigles qui contiennent une voyelle, gardés en capitales (relevés dans
 *   `auto_modele` le 2026-11-19, hors parenthèses ; plus BMW, DS, MG, GTI,
 *   TDI cités par le mandat).
 * - Mots de deux lettres écrits en casse normale (« Santa Fe », « Ka »).
 *
 * Les autres cas suivent les règles de {@link normalizeVehicleNameCase}.
 */
export const VEHICLE_NAME_CASE_EXCEPTIONS: Readonly<Record<string, string>> =
  Object.freeze({
    ADV: "ADV",
    AMG: "AMG",
    APV: "APV",
    ASX: "ASX",
    BMW: "BMW",
    CLA: "CLA",
    CLE: "CLE",
    CUV: "CUV",
    DS: "DS",
    EQA: "EQA",
    EQB: "EQB",
    EQC: "EQC",
    EQE: "EQE",
    EQS: "EQS",
    EQT: "EQT",
    EQV: "EQV",
    GLA: "GLA",
    GLE: "GLE",
    GTI: "GTI",
    MG: "MG",
    RAV: "RAV",
    SAC: "SAC",
    SAV: "SAV",
    SUV: "SUV",
    TDI: "TDI",
    XRE: "XRE",
    BE: "Be",
    FE: "Fe",
    KA: "Ka",
    LE: "Le",
    UP: "Up",
  });

const ROMAN_NUMERAL = /^(XL|L?X{0,3})(IX|IV|V?I{0,3})$/;
const VOWEL = /[AEIOUYÀÂÄÉÈÊËÎÏÔÖÙÛÜŸ]/;

function normalizeNamePart(part: string): string {
  if (part === "") return part;
  const exception = VEHICLE_NAME_CASE_EXCEPTIONS[part];
  if (exception !== undefined) return exception;
  // Casse mixte ou minuscules (« Série », « eK », « dCi »), chiffres
  // (« C4 », « 3008 », « 16V ») : la base l'a déjà écrit, rien ne change.
  if (part !== part.toUpperCase() || /\d/.test(part)) return part;
  const letters = part.replace(/[^A-ZÀ-ÖØ-Þ]/g, "");
  if (letters.length <= 2) return part; // sigle court : GT, SW, CX
  if (ROMAN_NUMERAL.test(part)) return part; // III, VIII
  if (!VOWEL.test(part)) return part; // sigle sans voyelle : GTC, RCZ
  const lower = part.toLocaleLowerCase("fr-FR");
  return lower.charAt(0).toLocaleUpperCase("fr-FR") + lower.slice(1);
}

/**
 * Casse normale d'un nom de marque ou de modèle pour le `<title>` R2
 * (complément 2 du mandat DW) : « PEUGEOT » → « Peugeot », « CLIO III » →
 * « Clio III », « LAND ROVER » → « Land Rover ».
 *
 * Gardés tels quels : exceptions de {@link VEHICLE_NAME_CASE_EXCEPTIONS},
 * chiffres romains, mots avec chiffre, sigles de deux lettres ou sans
 * voyelle, mots déjà en casse mixte, contenu entre parenthèses (codes
 * châssis) et composés « lettre-MOT » (« C-MAX », « T-ROC »). Le nom du type
 * n'y passe pas : il garde sa casse.
 */
export function normalizeVehicleNameCase(name?: string | null): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  let depth = 0;
  return words
    .map((word) => {
      const inParens = depth > 0 || word.startsWith("(");
      depth += (word.match(/\(/g) ?? []).length;
      depth = Math.max(0, depth - (word.match(/\)/g) ?? []).length);
      if (inParens || /^[A-Z]-[A-Z]/.test(word)) return word;
      return word
        .split(/([-/])/)
        .map((part) =>
          part === "-" || part === "/" ? part : normalizeNamePart(part),
        )
        .join("");
    })
    .join(" ");
}

/**
 * Nom d'affichage du `<title>` R2 : le nom corrigé en base
 * (`modele_name_meta`, `type_name_meta`) s'il est renseigné, sinon le nom
 * brut. Espaces réduits (complément 2 du mandat DW).
 */
export function pickVehicleDisplayName(
  displayName?: string | null,
  rawName?: string | null,
): string {
  const display = (displayName ?? "").replace(/\s+/g, " ").trim();
  return display !== "" ? display : (rawName ?? "").replace(/\s+/g, " ").trim();
}

/**
 * Clé de comparaison de deux titres ou libellés R2 : sans casse ni espaces
 * en trop. « 1.5 DCI » et « 1.5 dCi » sont le même titre pour un moteur de
 * recherche (complément 2 du mandat DW).
 */
export function r2TitleCollisionKey(label: string): string {
  return label.toLocaleLowerCase("fr-FR").replace(/\s+/g, " ").trim();
}
