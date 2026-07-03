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
import { enrichTypeNameForHeadings } from "./vehicle-aware-label.js";

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
