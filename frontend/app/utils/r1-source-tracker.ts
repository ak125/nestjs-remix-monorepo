/**
 * R1 Source Tracker — visibilité pipeline → composants.
 * Track si chaque section R1 affiche du contenu pipeline (P3),
 * des données API computées, ou un fallback hardcodé.
 *
 * En dev : attributs data-r1-source sur les containers DOM.
 * En prod : aucun impact (sourceAttr retourne {}).
 */
import { R1Section } from "~/constants/r1-sections";

export type R1Source = "prompt" | "api" | "fallback";

export interface R1SourceEntry {
  source: R1Source;
  /** Colonne DB source (ex: "sgpg_micro_seo_block") */
  field?: string;
  /** Longueur du contenu pipeline (chars) */
  charCount?: number;
}

export type R1SourceMap = Partial<Record<R1Section, R1SourceEntry>>;

/**
 * Construit le source map en inspectant purchaseGuideData.
 * Si un champ R1 existe et est non-vide → source="prompt" (pipeline P3).
 * Sinon → source="fallback" (composant utilise ses defaults hardcodés).
 *
 * Note: on ne distingue pas "prompt" de "api" car le pipeline
 * écrit dans les mêmes colonnes sgpg_* que l'API lit.
 * Si sgpg_* est rempli et sgpg_is_draft=false, c'est du pipeline validé.
 */
export function buildR1SourceMap(
  purchaseGuideData?: {
    microSeoBlock?: string | null;
    safeTableRows?: unknown[] | null;
    compatErrors?: string[] | null;
    faq?: unknown[] | null;
    compatibilitiesIntro?: string | null;
    equipementiersLine?: string | null;
    familyCrossSellIntro?: string | null;
    heroSubtitle?: string | null;
    h1Override?: string | null;
    arguments?: unknown[] | null;
  } | null,
): R1SourceMap {
  const map: R1SourceMap = {};

  const hasText = (v?: string | null) => !!(v && v.trim().length > 0);
  const hasArr = (v?: unknown[] | null) => !!(v && v.length > 0);

  // S_HERO : h1Override + heroSubtitle
  map[R1Section.HERO] = {
    source:
      hasText(purchaseGuideData?.h1Override) ||
      hasText(purchaseGuideData?.heroSubtitle)
        ? "prompt"
        : "fallback",
    field: "sgpg_h1_override + sgpg_hero_subtitle",
  };

  // S_BUY_ARGS : microSeoBlock + arguments (proof badges)
  map[R1Section.BUY_ARGS] = {
    source: hasText(purchaseGuideData?.microSeoBlock) ? "prompt" : "fallback",
    field: "sgpg_micro_seo_block",
    charCount: purchaseGuideData?.microSeoBlock?.length ?? 0,
  };

  // S_SAFE_TABLE : safeTableRows
  map[R1Section.SAFE_TABLE] = {
    source: hasArr(purchaseGuideData?.safeTableRows) ? "prompt" : "fallback",
    field: "sgpg_safe_table_rows",
  };

  // S_COMPAT_ERRORS : compatErrors (from antiMistakes)
  map[R1Section.COMPAT_ERRORS] = {
    source: hasArr(purchaseGuideData?.compatErrors) ? "prompt" : "fallback",
    field: "sgpg_anti_mistakes",
  };

  // S_FAQ : faq
  map[R1Section.FAQ] = {
    source: hasArr(purchaseGuideData?.faq) ? "prompt" : "fallback",
    field: "sgpg_faq",
  };

  // S_MOTORISATIONS : compatibilitiesIntro
  map[R1Section.MOTORISATIONS] = {
    source: hasText(purchaseGuideData?.compatibilitiesIntro)
      ? "prompt"
      : "fallback",
    field: "sgpg_compatibilities_intro",
  };

  // S_EQUIPEMENTIERS : equipementiersLine
  map[R1Section.EQUIPEMENTIERS] = {
    source: hasText(purchaseGuideData?.equipementiersLine)
      ? "prompt"
      : "fallback",
    field: "sgpg_equipementiers_line",
  };

  // S_CATALOGUE : familyCrossSellIntro
  map[R1Section.CATALOGUE] = {
    source: hasText(purchaseGuideData?.familyCrossSellIntro)
      ? "prompt"
      : "fallback",
    field: "sgpg_family_cross_sell_intro",
  };

  // Sections computees (donnees API, pas de pipeline) :
  // S_PROOF_STATS, S_REASSURANCE, S_COMPAT, S_QUICK_STEPS
  for (const s of [
    R1Section.PROOF_STATS,
    R1Section.REASSURANCE,
    R1Section.COMPAT,
    R1Section.QUICK_STEPS,
  ]) {
    map[s] = { source: "api", field: "computed" };
  }

  return map;
}

/**
 * Attributs DOM pour le source tracking (dev only).
 * En production, retourne un objet vide → zero overhead.
 */
export function sourceAttr(
  sourceMap: R1SourceMap | undefined,
  section: R1Section,
): Record<string, string> {
  if (process.env.NODE_ENV !== "development" || !sourceMap) return {};
  const entry = sourceMap[section];
  if (!entry) return {};
  return {
    "data-r1-source": entry.source,
    ...(entry.field ? { "data-r1-field": entry.field } : {}),
    ...(entry.charCount ? { "data-r1-chars": String(entry.charCount) } : {}),
  };
}
