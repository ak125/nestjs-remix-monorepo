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

/**
 * @deprecated Use resolveR1Faq() instead. Kept for JSON-LD backward compat
 * where we want maximum FAQ coverage regardless of source.
 */
export function mergeR1Faq(
  pipelineFaq: FaqItem[] | null | undefined,
  selectorFaq: FaqItem[],
  maxItems = 8,
): FaqItem[] {
  const seen = new Map<string, FaqItem>();

  // Pipeline/DB FAQ first (prioritaire)
  for (const item of pipelineFaq || []) {
    const q = item.question?.trim();
    const a = item.answer?.trim();
    if (!q || !a) continue;
    const key = normalizeFaqKey(q);
    if (!seen.has(key)) {
      seen.set(key, { question: q, answer: a });
    }
  }

  // Selector FAQ fills remaining slots (deduped)
  for (const item of selectorFaq) {
    const q = item.question?.trim();
    const a = item.answer?.trim();
    if (!q || !a) continue;
    const key = normalizeFaqKey(q);
    if (!seen.has(key)) {
      seen.set(key, { question: q, answer: a });
    }
  }

  return Array.from(seen.values()).slice(0, maxItems);
}
