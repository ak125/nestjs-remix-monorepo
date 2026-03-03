/**
 * Guide Design System — barrel exports
 * Reusable components for R3 conseil and R6 guide d'achat pages.
 */

// R3 conseil components
export { GuideCard } from "./GuideCard";
export { GuideHero } from "./GuideHero";
export { GuideChecklist } from "./GuideChecklist";
export { GuideSteps } from "./GuideSteps";
export { GuideAlert } from "./GuideAlert";
export { MiniDiagnosticTable } from "./MiniDiagnosticTable";
export { GuideFaq } from "./GuideFaq";
export { GuideParts } from "./GuideParts";
export { SoftCTA } from "./SoftCTA";
export { GlossaryTerm, annotateGlossaryTerms } from "./GlossaryTooltip";
export { buildGuideSchemas } from "./guide-schemas";
export type { GuideSchemaArticle, GuideSchemaOutput } from "./guide-schemas";

// R6 guide d'achat components
export { R6QuizAssistant } from "./R6QuizAssistant";
export { R6CriteriaTable } from "./R6CriteriaTable";
export { R6FaqAccordion } from "./R6FaqAccordion";
export { R6SourcesBlock } from "./R6SourcesBlock";
export { buildR6GuideSchemas } from "./r6-guide-schemas";
export type { R6GuideSchemaOutput } from "./r6-guide-schemas";
