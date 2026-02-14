/**
 * gamme-contract-qa.utils.ts — Passthrough layer
 *
 * Quality gates and fallbacks are handled entirely backend-side
 * (buying-guide-data.service.ts + buying-guide-enricher.service.ts).
 * The frontend trusts the backend contract and only deduplicates.
 */
import {
  type GammeBuyingGuideV1,
  type GammeContentQualityFlag,
} from "~/types/gamme-content-contract.types";

type FamilyKey =
  | "freinage"
  | "moteur"
  | "suspension"
  | "transmission"
  | "electrique"
  | "climatisation";

type FamilyContext =
  | {
      mf_id: number;
      mf_name: string;
      mf_pic: string;
    }
  | null
  | undefined;

interface ValidateContext {
  famille?: FamilyContext;
  pgName?: string;
}

interface SectionFallbacks {
  decisionTree: boolean;
  compatibilityRules: boolean;
  antiMistakes: boolean;
  selectionCriteria: boolean;
  useCases: boolean;
  pairing: boolean;
  faq: boolean;
  symptoms: boolean;
  trustArguments: boolean;
}

export interface GammeContractQcResult {
  score: number;
  flags: GammeContentQualityFlag[];
  sectionFallbacks: SectionFallbacks;
  pgName: string;
  familyKey: FamilyKey | null;
}

const NO_FALLBACK: SectionFallbacks = {
  decisionTree: false,
  compatibilityRules: false,
  antiMistakes: false,
  selectionCriteria: false,
  useCases: false,
  pairing: false,
  faq: false,
  symptoms: false,
  trustArguments: false,
};

function cleanText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim();
}

/**
 * Validate the backend-provided buying guide contract.
 * Returns the backend's quality score/flags directly — no frontend re-validation.
 */
export function validateGammeContract(
  contract: GammeBuyingGuideV1 | null | undefined,
  context: ValidateContext = {},
): GammeContractQcResult {
  const pgName = cleanText(context.pgName || contract?.pgId || "cette piece");

  if (!contract) {
    return {
      score: 0,
      flags: ["MISSING_SOURCE_PROVENANCE"],
      sectionFallbacks: {
        decisionTree: true,
        compatibilityRules: true,
        antiMistakes: true,
        selectionCriteria: true,
        useCases: true,
        pairing: true,
        faq: true,
        symptoms: true,
        trustArguments: true,
      },
      pgName,
      familyKey: null,
    };
  }

  // Trust the backend quality score and flags
  return {
    score: contract.quality?.score ?? 100,
    flags: contract.quality?.flags ?? [],
    sectionFallbacks: { ...NO_FALLBACK },
    pgName,
    familyKey: null,
  };
}

/**
 * Apply section fallbacks — now a passthrough since backend handles all fallbacks.
 * Only strips quality source label for display.
 */
export function applySectionFallbacks(
  contract: GammeBuyingGuideV1 | null | undefined,
  qc: GammeContractQcResult,
): GammeBuyingGuideV1 | null {
  if (!contract) return null;

  return {
    ...contract,
    quality: {
      ...contract.quality,
      score: qc.score,
      flags: qc.flags,
    },
  };
}
