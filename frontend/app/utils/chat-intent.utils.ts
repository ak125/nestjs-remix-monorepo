import {
  type IntentFamily,
  type PageIntent,
  type UserIntent,
  mapUserIntentToFamily,
  mapUserIntentToPageIntent,
} from "~/utils/page-role.types";

export interface ChatIntentRouting {
  userIntent: UserIntent;
  intentFamily: IntentFamily;
  pageIntent: PageIntent;
}

const INTENT_PATTERNS: Array<{ intent: UserIntent; patterns: RegExp[] }> = [
  {
    intent: "fitment",
    patterns: [
      /\bcompatibilite\b/i,
      /\bcompatible\b/i,
      /\bmon vehicule\b/i,
      /\bvin\b/i,
      /\bimmatriculation\b/i,
      /\bmonte\b/i,
    ],
  },
  {
    intent: "troubleshoot",
    patterns: [
      /\bdiagnosti/i,
      /\bpanne\b/i,
      /\bsymptome\b/i,
      /\bbruit\b/i,
      /\bvibration\b/i,
      /\bvoyant\b/i,
      /\bne demarre pas\b/i,
    ],
  },
  {
    intent: "policy",
    patterns: [
      /\blivraison\b/i,
      /\bretour\b/i,
      /\bgaranti/i,
      /\brembourse/i,
      /\bcgv\b/i,
      /\bdelai\b/i,
    ],
  },
  {
    intent: "cost",
    patterns: [
      /\bprix\b/i,
      /\bcout\b/i,
      /\bcombien\b/i,
      /\btarif\b/i,
      /\bpromo\b/i,
      /\breduction\b/i,
    ],
  },
  {
    intent: "compare",
    patterns: [
      /\bcompar/i,
      /\bdifference\b/i,
      /\bversus\b/i,
      /\bvs\b/i,
      /\bmeilleur\b/i,
    ],
  },
  {
    intent: "maintain",
    patterns: [
      /\bentretien\b/i,
      /\bmaintenance\b/i,
      /\bintervalle\b/i,
      /\bquand changer\b/i,
      /\bfrequence\b/i,
    ],
  },
  {
    intent: "do",
    patterns: [
      /\bcomment faire\b/i,
      /\bcomment remplacer\b/i,
      /\btutoriel\b/i,
      /\bhow to\b/i,
      /\binstaller\b/i,
      /\bmonter\b/i,
    ],
  },
  {
    intent: "define",
    patterns: [
      /\bc'?est quoi\b/i,
      /\bdefinition\b/i,
      /\bque signifie\b/i,
      /\bveut dire\b/i,
    ],
  },
  {
    intent: "choose",
    patterns: [
      /\bchoisir\b/i,
      /\bachat\b/i,
      /\bacheter\b/i,
      /\brecommand/i,
      /\bquel\b/i,
      /\bquelle\b/i,
    ],
  },
];

export function classifyChatIntent(message: string): ChatIntentRouting {
  const text = message.trim();

  for (const { intent, patterns } of INTENT_PATTERNS) {
    if (patterns.some((pattern) => pattern.test(text))) {
      return {
        userIntent: intent,
        intentFamily: mapUserIntentToFamily(intent),
        pageIntent: mapUserIntentToPageIntent(intent),
      };
    }
  }

  // Fallback: requête de sélection/achat générique.
  const fallbackIntent: UserIntent = "choose";
  return {
    userIntent: fallbackIntent,
    intentFamily: mapUserIntentToFamily(fallbackIntent),
    pageIntent: mapUserIntentToPageIntent(fallbackIntent),
  };
}
