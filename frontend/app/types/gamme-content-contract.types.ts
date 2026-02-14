export type GammeContentQualityFlag =
  | "GENERIC_PHRASES"
  | "MISSING_REQUIRED_TERMS"
  | "TOO_SHORT"
  | "TOO_LONG"
  | "FAQ_TOO_SMALL"
  | "SYMPTOMS_TOO_SMALL"
  | "DUPLICATE_ITEMS"
  | "MISSING_SOURCE_PROVENANCE";

export interface GammeContentQuality {
  score: number;
  flags: GammeContentQualityFlag[];
  version: "GammeContentContract.v1";
  source: string;
  verified: boolean;
}

export interface GammeBuyingGuideQuality {
  score: number;
  flags: GammeContentQualityFlag[];
  version: "GammeBuyingGuide.v1";
  source: string;
  verified: boolean;
}

/**
 * Contrat éditorial source (sans H1).
 * Le H1 reste piloté exclusivement par data.content.h1 (SEO/CMS).
 */
export interface BuyingGuideContractV1 {
  id: number;
  pgId: string;
  intro: {
    title: string;
    role: string;
    syncParts: string[];
  };
  risk: {
    title: string;
    explanation: string;
    consequences: string[];
    costRange: string;
    conclusion: string;
  };
  timing: {
    title: string;
    years: string;
    km: string;
    note: string;
  };
  arguments: Array<{
    title: string;
    content: string;
    icon?: string;
  }>;
  howToChoose: string | null;
  symptoms: string[];
  antiMistakes: string[];
  faq: Array<{ question: string; answer: string }>;
  quality: GammeContentQuality;
}
/** @deprecated utiliser BuyingGuideContractV1 */
export type GammeContentContractV1 = BuyingGuideContractV1;

export interface GammeBuyingGuideDecisionOption {
  label: string;
  outcome: "continue" | "check" | "replace" | "stop";
  nextId?: string;
  note?: string;
}

export interface GammeBuyingGuideDecisionNode {
  id: string;
  question: string;
  options: GammeBuyingGuideDecisionOption[];
}

export interface GammeBuyingGuideSelectionCriterion {
  key: string;
  label: string;
  guidance: string;
  priority: "required" | "recommended";
}

export interface GammeBuyingGuideUseCase {
  id: string;
  label: string;
  recommendation: string;
}

export interface GammeBuyingGuidePairing {
  required: string[];
  recommended: string[];
  checks: string[];
}

export interface GammeBuyingGuideTrustArgument {
  title: string;
  content: string;
  icon: string;
}

export interface GammeBuyingGuideInputs {
  vehicle: string;
  position: string;
  dimensionsOrReference: string;
  discType: string;
  constraints: string[];
}

export interface GammeBuyingGuideOutput {
  selectedSpec: string;
  pairingAdvice: string[];
  warnings: string[];
}

/**
 * Contrat orienté achat (sans H1)
 * Doit servir la décision de sélection avant commande.
 */
export interface GammeBuyingGuideV1 {
  id: number;
  pgId: string;
  inputs: GammeBuyingGuideInputs;
  decisionTree: GammeBuyingGuideDecisionNode[];
  compatibilityRules: string[];
  antiMistakes: string[];
  selectionCriteria: GammeBuyingGuideSelectionCriterion[];
  useCases: GammeBuyingGuideUseCase[];
  pairing: GammeBuyingGuidePairing;
  output: GammeBuyingGuideOutput;
  faq: Array<{ question: string; answer: string }>;
  symptoms: string[];
  trustArguments: GammeBuyingGuideTrustArgument[];
  quality: GammeBuyingGuideQuality;
}
