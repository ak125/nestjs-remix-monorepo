/**
 * R6 Guide d'Achat types (frontend mirror).
 * Matches backend R6GuidePayload served by GET /api/r6-guide/:pg_alias.
 */

export interface R6FaqItem {
  question: string;
  answer: string;
}

export interface R6SelectionCriterion {
  key: string;
  label: string;
  guidance: string;
  priority: "required" | "recommended" | "optional";
}

export interface R6DecisionNode {
  id: string;
  question: string;
  options: Array<{
    label: string;
    outcome: string;
  }>;
}

export interface R6UseCase {
  id: string;
  label: string;
  recommendation: string;
}

export interface R6InterestNugget {
  hook: string;
  angle: string;
  rag_source: string;
}

export interface R6GuidePage {
  pg_alias: string;
  pg_id: number;
  title: string;
  heroSubtitle: string | null;
  metaTitle: string;
  metaDescription: string;
  featuredImage: string | null;
  updatedAt: string;
  readingTime: number;
}

export interface R6RiskSection {
  title: string;
  explanation: string;
  consequences: string[];
  costRange: string | null;
  conclusion: string | null;
}

export interface R6TimingSection {
  title: string;
  years: string | null;
  km: string | null;
  note: string | null;
}

export interface R6Argument {
  title: string;
  content: string;
  icon: string | null;
}

export interface R6GuidePayload {
  page: R6GuidePage;
  risk: R6RiskSection;
  timing: R6TimingSection;
  arguments: R6Argument[];
  howToChoose: string | null;
  symptoms: string[];
  selectionCriteria: R6SelectionCriterion[];
  decisionTree: R6DecisionNode[];
  faq: R6FaqItem[];
  useCases: R6UseCase[];
  antiMistakes: string[];
  interestNuggets: R6InterestNugget[];
  selectorMicrocopy: string[];
  compatibilitiesIntro: string | null;
  equipementiersLine: string | null;
  familyCrossSellIntro: string | null;
  microSeoBlock: string | null;
  sourceType: string | null;
  sourceVerified: boolean;
}
