/**
 * R1 FAQ resolution — pipeline vs fallback (exclusive mode).
 *
 * Merge policy v2: pipeline ≥ minPipelineItems valid items → pipeline ONLY.
 * Otherwise → fallback entirely. No mixing pipeline + fallback.
 */

import { validateFaqItems } from "~/utils/faq-validator";

import { type R1Source } from "~/utils/r1-source-tracker";

export interface FaqItem {
  question: string;
  answer: string;
}

export function normalizeFaqKey(question: string): string {
  return question
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Exclusive FAQ resolution: pipeline OR fallback, never both.
 * - If pipeline has ≥ minPipelineItems valid items → use pipeline only.
 * - Otherwise → use fallback entirely.
 */
export function resolveR1Faq(
  pipelineFaq: FaqItem[] | null | undefined,
  selectorFaq: FaqItem[],
  minPipelineItems = 3,
): { items: FaqItem[]; source: R1Source } {
  const validated = validateFaqItems(
    (pipelineFaq || []) as Array<{ question: string; answer: string }>,
    8,
  );
  if (validated.length >= minPipelineItems) {
    return { items: validated, source: "prompt" };
  }
  return { items: validateFaqItems(selectorFaq, 6), source: "fallback" };
}
