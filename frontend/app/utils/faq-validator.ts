/**
 * FAQ validation gate — filtre les questions malformées avant rendu.
 * Élimine les fragments concaténés, questions trop longues, réponses trop courtes.
 */

interface FAQItem {
  question: string;
  answer: string;
}

/** Détecte 2+ verbes interrogatifs enchaînés dans une même question. */
const DOUBLE_INTERROGATIVE =
  /(Quand|Comment|À quoi sert|Pourquoi|Quel(?:le)?s?|Combien|Où|Est-ce).*\b(Quand|Comment|À quoi sert|Pourquoi|Quel(?:le)?s?|Combien|Où|Est-ce)/i;

export function isValidFaqItem(item: FAQItem): boolean {
  const q = item.question?.trim();
  const a = item.answer?.trim();

  if (!q || !a) return false;
  if (q.length > 110) return false;
  if (a.length < 20) return false;
  if (!q.endsWith("?")) return false;
  if (DOUBLE_INTERROGATIVE.test(q)) return false;

  return true;
}

/** Filtre + déduplique les FAQ items. Cap à maxItems (défaut 6). */
export function validateFaqItems(items: FAQItem[], maxItems = 6): FAQItem[] {
  const seen = new Set<string>();
  return items
    .filter((item) => {
      if (!isValidFaqItem(item)) return false;
      const key = item.question.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, maxItems);
}
