/**
 * buildR2H1Emitted — reproduction BYTE-IDENTIQUE du H1 R2 (pièces) réellement émis.
 *
 * Source de vérité = le `<h1>` rendu par `PiecesHeader.tsx:115-121` (route
 * `pieces.$gamme.$marque.$modele.$type`). Aujourd'hui ce H1 est composé inline dans le
 * JSX à partir des helpers déjà partagés de ce package (`pickH1Suffix`,
 * `enrichTypeNameForHeadings`, `SEO_PRICE_VARIATIONS`). On centralise l'assemblage ici
 * pour que le frontend rende ce builder ET que le fingerprint hashe la même fonction
 * (plan rév.9, Track A, PR-D).
 *
 * ⚠️ NE PAS confondre avec `buildR2H1` (backend `r2-heading-policy.utils.ts:11`,
 * format « {rangeLabel} pour {label} ») : contrat de planning R2 **distinct**, autre page,
 * autre string — n'a jamais été ce que `PiecesHeader` émet. Ne pas fusionner.
 *
 * Règle d'assemblage BYTE-CRITIQUE : le JSX rend ses enfants `{a} {b}{" "}{c}…` comme
 * `[a, b, c, …].map(p => p ?? "").join(" ")` — un champ `undefined` (ex. `marque?.toUpperCase()`)
 * rend une chaîne VIDE (et un double-espace), JAMAIS le texte littéral "undefined". On reproduit
 * donc `.map(p => p ?? "").join(" ")`, surtout PAS un template `${}`.
 *
 * Pur : compose les helpers partagés (inchangés) + un join déterministe. Aucune I/O.
 */

import {
  pickH1Suffix,
  SEO_PRICE_VARIATIONS,
  type ContextKeys,
} from "./seo-variations.js";
import {
  buildR2TitleTypeLabel,
  enrichTypeNameForHeadings,
  normalizeVehicleNameCase,
  pickVehicleDisplayName,
  r2TitleCollisionKey,
} from "./vehicle-aware-label.js";

export interface R2H1EmittedInput {
  /** `gamme.name` (jamais uppercase). */
  gammeName: string;
  /** `vehicle.marque` brut — le builder applique `.toUpperCase()` (peut être absent). */
  marque?: string;
  /** `vehicle.modele` brut — le builder applique `.toUpperCase()` (peut être absent). */
  modele?: string;
  /** `type_name` DÉJÀ résolu au call site (`vehicle.typeName || vehicle.type`, cf. PiecesHeader:72). */
  typeName?: string;
  typePowerPs?: string | number;
  typeFuel?: string;
  /** `{ typeId, pgId }` — clé de rotation déterministe (typeId du véhicule, pgId = gamme.id). */
  ctx: ContextKeys;
  /** Pool technique per-gamme (`__seo_gamme_car_switch.sgcs_alias=2`). Vide → rotation prix. */
  compSwitch2?: readonly string[];
  /** Override legacy `prixPasCherText` (brut, peut être absent → "au meilleur prix"). */
  literalFallback?: string;
}

/** Reproduit `PiecesHeader.tsx:115-121` au byte près (visible H1 R2). */
export function buildR2H1Emitted(input: R2H1EmittedInput): string {
  const finalText = pickH1Suffix({
    compSwitch2: input.compSwitch2,
    priceVariations: SEO_PRICE_VARIATIONS,
    ctx: input.ctx,
    literalFallback: input.literalFallback ?? "au meilleur prix",
  });

  const enrichedTypeLabel = enrichTypeNameForHeadings({
    typeName: input.typeName,
    powerPs: input.typePowerPs?.toString(),
    fuel: input.typeFuel,
  }).value;

  return [
    input.gammeName,
    input.marque?.toUpperCase(),
    input.modele?.toUpperCase(),
    enrichedTypeLabel,
    finalText,
  ]
    .map((part) => part ?? "")
    .join(" ");
}

/**
 * H1 propre des pages R2 (gamme × véhicule), mandat EN du 2026-11-20 :
 * phrase courte, sans fragment collé ni accroche, unique par page.
 *
 * Format validé le 2026-11-20 à 23:01 (principe « H1 court, puissance ajoutée
 * seulement quand il faut distinguer ») :
 * - niveau 0 : `<Gamme> <Marque> <Modèle> <Version>` ;
 * - niveau 1 : niveau 0 + `<puissance> ch`, quand un autre type servi dans la
 *   gamme donne le même H1 de niveau 0 ;
 * - niveau 2 : le titre R2 de #2212 (`<type> [carburant] <puissance> ch` et,
 *   si le service de départage l'a trouvé, code moteur ou noms bruts), quand
 *   la puissance ne suffit pas.
 *
 * Noms et casse identiques au titre de #2212 : marque brute en casse normale
 * ({@link normalizeVehicleNameCase}), nom d'affichage du modèle en casse
 * normale, nom d'affichage du type dans sa casse ({@link pickVehicleDisplayName}).
 */
export type R2H1Level = 0 | 1 | 2;

/** Véhicule d'une page R2, tel que lu dans `auto_type` / `auto_modele` / `auto_marque`. */
export interface R2H1Vehicle {
  typeId: string;
  marqueName: string;
  modeleName: string;
  modeleNameMeta?: string | null;
  typeName: string;
  typeNameMeta?: string | null;
  powerPs?: string | null;
  fuel?: string | null;
}

/** Départage du titre R2 (`R2TitleCollisionService.resolveTitle`), repris au niveau 2. */
export interface R2H1TitleResolution {
  motorCode: string;
  rawNames: boolean;
}

/**
 * Partie véhicule du H1 R2 propre, au niveau demandé. Au niveau 2, elle est
 * identique à la partie véhicule du `<title>` R2 (gabarit
 * `#VMarqueAffichage# #VModeleAffichage# #VTypeCarburantPuissance#`).
 */
export function buildR2H1VehicleLabel(
  v: R2H1Vehicle,
  level: R2H1Level,
  title: R2H1TitleResolution = { motorCode: "", rawNames: false },
): string {
  const raw = level === 2 && title.rawNames;
  const marque = normalizeVehicleNameCase(v.marqueName);
  const modele = normalizeVehicleNameCase(
    raw ? v.modeleName : pickVehicleDisplayName(v.modeleNameMeta, v.modeleName),
  );
  const type = raw
    ? (v.typeName ?? "").replace(/\s+/g, " ").trim()
    : pickVehicleDisplayName(v.typeNameMeta, v.typeName);
  const typeLabel =
    level === 0
      ? type
      : level === 1
        ? buildR2TitleTypeLabel({ typeName: type, powerPs: v.powerPs ?? "" })
        : [
            buildR2TitleTypeLabel({
              typeName: type,
              powerPs: v.powerPs ?? "",
              fuel: v.fuel ?? "",
            }),
            title.motorCode,
          ]
            .filter(Boolean)
            .join(" ");
  return [marque, modele, typeLabel].filter(Boolean).join(" ");
}

/** H1 R2 propre complet : `<Gamme> <partie véhicule>`. */
export function buildR2CleanH1(
  gammeName: string,
  v: R2H1Vehicle,
  level: R2H1Level,
  title?: R2H1TitleResolution,
): string {
  return [
    gammeName.replace(/\s+/g, " ").trim(),
    buildR2H1VehicleLabel(v, level, title),
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Niveau du H1 d'une page : le plus bas qui la distingue des autres types
 * servis dans la même gamme (`siblings` : types affichés ayant des pièces dans
 * la gamme ; le type de la page y est ignoré). Comparaison sans casse ni
 * espaces en trop ({@link r2TitleCollisionKey}).
 *
 * - aucun autre type de même H1 de niveau 0 → 0 ;
 * - sinon, aucun d'eux de même H1 de niveau 1 → 1 ;
 * - sinon → 2 (titre R2). Une collision qui subsiste au niveau 2 est un
 *   doublon de fiche en base (même nom, même puissance, mêmes codes), traité
 *   hors de ce H1.
 */
export function resolveR2H1Level(
  own: R2H1Vehicle,
  siblings: readonly R2H1Vehicle[],
): R2H1Level {
  const key = (v: R2H1Vehicle, level: 0 | 1) =>
    r2TitleCollisionKey(buildR2H1VehicleLabel(v, level));
  let pool = siblings.filter((s) => s.typeId !== own.typeId);
  for (const level of [0, 1] as const) {
    const ownKey = key(own, level);
    pool = pool.filter((s) => key(s, level) === ownKey);
    if (pool.length === 0) return level;
  }
  return 2;
}
