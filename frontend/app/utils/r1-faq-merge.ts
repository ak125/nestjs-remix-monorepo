/**
 * Merge pipeline FAQ (sgpg_faq) with static R1_SELECTOR_FAQ.
 * Dedup by normalized question text. Pipeline FAQ takes priority.
 */

interface FaqItem {
  question: string;
  answer: string;
}

function normalizeFaqKey(question: string): string {
  return question
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Merge two FAQ sources with dedup. Pipeline/DB FAQ takes priority,
 * then selector FAQ fills remaining slots up to maxItems.
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
