/**
 * R1 Source Tracker — visibilité pipeline → composants.
 * Track si chaque section R1 affiche du contenu pipeline (P3),
 * des données API computées, ou un fallback hardcodé.
 *
 * En dev : attributs data-r1-source sur les containers DOM.
 * En prod : aucun impact (sourceAttr retourne {}).
 */
import { R1Section } from "~/constants/r1-sections";

import {
  type R1SectionPack,
  type R1SectionData,
} from "~/utils/r1-section-pack";

export type R1Source = "prompt" | "api" | "fallback";

export interface R1SourceEntry {
  source: R1Source;
  /** Colonne DB source (ex: "sgpg_micro_seo_block") */
  field?: string;
  /** Longueur du contenu pipeline (chars) */
  charCount?: number;
}

export type R1SourceMap = Partial<Record<R1Section, R1SourceEntry>>;

/** Section key → R1Section enum mapping for SectionPack */
const SECTION_KEY_MAP: Record<string, R1Section> = {
  hero: R1Section.HERO,
  buyArgs: R1Section.BUY_ARGS,
  safeTable: R1Section.SAFE_TABLE,
  compatErrors: R1Section.COMPAT_ERRORS,
  faq: R1Section.FAQ,
  motorisations: R1Section.MOTORISATIONS,
  equipementiers: R1Section.EQUIPEMENTIERS,
  catalogue: R1Section.CATALOGUE,
  kpiCoverage: R1Section.KPI_COVERAGE,
};

/**
 * Build source map from R1SectionPack.
 * Replaces the old buildR1SourceMap() which inspected raw purchaseGuideData.
 */
export function buildSourceMapFromPack(pack: R1SectionPack): R1SourceMap {
  const map: R1SourceMap = {};

  for (const [key, section] of Object.entries(SECTION_KEY_MAP)) {
    const sectionData = pack.sections[
      key as keyof R1SectionPack["sections"]
    ] as R1SectionData<unknown>;
    if (sectionData) {
      map[section] = { source: sectionData.source };
    }
  }

  // Static sections always API
  for (const s of [
    R1Section.TRUST_STRIP,
    R1Section.COMPAT,
    R1Section.QUICK_NAV,
  ]) {
    map[s] = { source: "api", field: "computed" };
  }

  return map;
}

/**
 * @deprecated Use buildSourceMapFromPack(sectionPack) instead.
 * Kept for backward compatibility during migration.
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

  map[R1Section.HERO] = {
    source:
      hasText(purchaseGuideData?.h1Override) ||
      hasText(purchaseGuideData?.heroSubtitle)
        ? "prompt"
        : "fallback",
    field: "sgpg_h1_override + sgpg_hero_subtitle",
  };

  map[R1Section.BUY_ARGS] = {
    source: hasText(purchaseGuideData?.microSeoBlock) ? "prompt" : "fallback",
    field: "sgpg_micro_seo_block",
    charCount: purchaseGuideData?.microSeoBlock?.length ?? 0,
  };

  map[R1Section.SAFE_TABLE] = {
    source: hasArr(purchaseGuideData?.safeTableRows) ? "prompt" : "fallback",
    field: "sgpg_safe_table_rows",
  };

  map[R1Section.COMPAT_ERRORS] = {
    source: hasArr(purchaseGuideData?.compatErrors) ? "prompt" : "fallback",
    field: "sgpg_anti_mistakes",
  };

  map[R1Section.FAQ] = {
    source: hasArr(purchaseGuideData?.faq) ? "prompt" : "fallback",
    field: "sgpg_faq",
  };

  map[R1Section.MOTORISATIONS] = {
    source: hasText(purchaseGuideData?.compatibilitiesIntro)
      ? "prompt"
      : "fallback",
    field: "sgpg_compatibilities_intro",
  };

  map[R1Section.EQUIPEMENTIERS] = {
    source: hasText(purchaseGuideData?.equipementiersLine)
      ? "prompt"
      : "fallback",
    field: "sgpg_equipementiers_line",
  };

  map[R1Section.CATALOGUE] = {
    source: hasText(purchaseGuideData?.familyCrossSellIntro)
      ? "prompt"
      : "fallback",
    field: "sgpg_family_cross_sell_intro",
  };

  for (const s of [
    R1Section.TRUST_STRIP,
    R1Section.COMPAT,
    R1Section.QUICK_NAV,
    R1Section.KPI_COVERAGE,
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
