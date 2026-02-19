/**
 * Validation runtime du contrat GammePageDataV1
 *
 * Strategie :
 *  - Fast path : safeParse global (passe ~80% du temps)
 *  - Slow path : validation section par section
 *    - Tier 1 (meta, content, breadcrumbs) : REQUIS → throw si echec
 *    - Tier 2/3 : OPTIONNEL → degrade a undefined + log warning
 */

import {
  type GammePageDataV1,
  GAMME_PAGE_CONTRACT_VERSION,
  GammePageMetaSchema,
  GammePageContentSchema,
  BreadcrumbsSchema,
  TIER2_SCHEMAS,
  TIER3_SCHEMAS,
} from "~/types/gamme-page-contract.types";
import { logger } from "~/utils/logger";

export interface ParseResult {
  data: GammePageDataV1;
  /** Noms des sections qui ont echoue la validation (degradees a undefined/null) */
  degraded: string[];
}

export function parseGammePageData(raw: unknown): ParseResult {
  if (!raw || typeof raw !== "object") {
    throw new Error("[GammePageContract] Input is not an object");
  }

  const input = raw as Record<string, unknown>;
  const degraded: string[] = [];

  // --- Tier 1 : requis (throw si echec) ---

  const metaResult = GammePageMetaSchema.safeParse(input.meta);
  if (!metaResult.success) {
    logger.error(
      `[GammePageContract] Tier 1 FAIL: meta — ${metaResult.error.issues.map((i) => i.message).join(", ")}`,
    );
    throw new Error("GammePageContract.v1: meta validation failed");
  }

  const contentResult = GammePageContentSchema.safeParse(input.content);
  if (!contentResult.success) {
    logger.error(
      `[GammePageContract] Tier 1 FAIL: content — ${contentResult.error.issues.map((i) => i.message).join(", ")}`,
    );
    throw new Error("GammePageContract.v1: content validation failed");
  }

  const breadcrumbsResult = BreadcrumbsSchema.safeParse(input.breadcrumbs);
  if (!breadcrumbsResult.success) {
    logger.error(
      `[GammePageContract] Tier 1 FAIL: breadcrumbs — ${breadcrumbsResult.error.issues.map((i) => i.message).join(", ")}`,
    );
    throw new Error("GammePageContract.v1: breadcrumbs validation failed");
  }

  // --- Tier 2 : structurel optionnel (degrade a undefined) ---

  const tier2: Record<string, unknown> = {};
  for (const [key, schema] of Object.entries(TIER2_SCHEMAS)) {
    const result = schema.safeParse(input[key]);
    if (result.success) {
      tier2[key] = result.data;
    } else {
      // Section absente (undefined/null) = OK, pas degradee
      if (input[key] !== undefined && input[key] !== null) {
        degraded.push(key);
        logger.warn(
          `[GammePageContract] Tier 2 degraded: ${key} — ${result.error.issues[0]?.message}`,
        );
      }
      tier2[key] = undefined;
    }
  }

  // --- Tier 3 : enrichissement optionnel (degrade a null) ---

  const tier3: Record<string, unknown> = {};
  for (const [key, schema] of Object.entries(TIER3_SCHEMAS)) {
    const result = schema.safeParse(input[key]);
    if (result.success) {
      tier3[key] = result.data;
    } else {
      if (input[key] !== undefined && input[key] !== null) {
        degraded.push(key);
        logger.warn(
          `[GammePageContract] Tier 3 degraded: ${key} — ${result.error.issues[0]?.message}`,
        );
      }
      tier3[key] = null;
    }
  }

  // --- Assemblage ---

  const data: GammePageDataV1 = {
    _v: GAMME_PAGE_CONTRACT_VERSION,
    pageRole: input.pageRole as GammePageDataV1["pageRole"],
    status: 200,
    meta: metaResult.data,
    content: contentResult.data,
    breadcrumbs: breadcrumbsResult.data,
    // Tier 2
    famille: tier2.famille as GammePageDataV1["famille"],
    performance: tier2.performance as GammePageDataV1["performance"],
    motorisations: tier2.motorisations as GammePageDataV1["motorisations"],
    catalogueMameFamille:
      tier2.catalogueMameFamille as GammePageDataV1["catalogueMameFamille"],
    equipementiers: tier2.equipementiers as GammePageDataV1["equipementiers"],
    conseils: tier2.conseils as GammePageDataV1["conseils"],
    informations: tier2.informations as GammePageDataV1["informations"],
    seoSwitches: tier2.seoSwitches as GammePageDataV1["seoSwitches"],
    guide: tier2.guide as GammePageDataV1["guide"],
    // Tier 3
    purchaseGuideData:
      tier3.purchaseGuideData as GammePageDataV1["purchaseGuideData"],
    gammeBuyingGuide:
      tier3.gammeBuyingGuide as GammePageDataV1["gammeBuyingGuide"],
    substitution: tier3.substitution as GammePageDataV1["substitution"],
    reference: tier3.reference as GammePageDataV1["reference"],
  };

  return { data, degraded };
}
