/**
 * UserAgentClass + classifyUserAgent() — ségrégation bot/human pour aggregation.
 *
 * Mirror strict de `.spec/00-canon/seo-runtime/cwv-taxonomy.yaml` §user_agent_classes.
 *
 * Canon : bots écrits dans __seo_event_log (debug), humans dans __seo_cwv_raw
 * (aggregation pure). Évite la pollution p75 humains par les visites crawlers.
 *
 * Patterns case-insensitive. First-match-wins par catégorie (search → ai → other → human).
 */

export const USER_AGENT_CLASS_VALUES = [
  'human',
  'bot_search',
  'bot_ai',
  'bot_other',
] as const;

export type UserAgentClass = (typeof USER_AGENT_CLASS_VALUES)[number];

// Patterns sont des sous-chaînes (case-insensitive). Ordre = priorité.
const BOT_SEARCH_PATTERNS: readonly string[] = [
  'googlebot',
  'bingbot',
  'duckduckbot',
  'yandexbot',
  'baiduspider',
  'facebookexternalhit',
  'linkedinbot',
  'twitterbot',
  'slackbot',
];

const BOT_AI_PATTERNS: readonly string[] = [
  'gptbot',
  'claudebot',
  'claude-web',
  'chatgpt-user',
  'oai-searchbot',
  'perplexitybot',
  'perplexity-user',
  'anthropic-ai',
  'bytespider',
  'amazonbot',
  'applebot',
  'google-extended',
  'ccbot',
  'diffbot',
];

const BOT_OTHER_PATTERNS: readonly string[] = [
  'ahrefsbot',
  'semrushbot',
  'dotbot',
  'mj12bot',
  'petalbot',
  'webpagetest',
  'pingdom',
  'uptimerobot',
  'lighthouse',
  'chrome-lighthouse',
  'speedcurve',
  'headlesschrome',
];

export function isUserAgentClass(value: unknown): value is UserAgentClass {
  return (
    typeof value === 'string' &&
    (USER_AGENT_CLASS_VALUES as readonly string[]).includes(value)
  );
}

/**
 * Classify a UA string.
 *
 * Null/empty → 'human' (graceful fallback — un UA absent côté beacon est
 * exceptionnel mais on ne veut pas dropper la metric ; le filtre bot s'applique
 * sur match positif uniquement).
 *
 * Order : search → ai → other → human. Un UA qui match plusieurs catégories
 * tombe dans la première (typiquement bot_search prend la priorité).
 */
export function classifyUserAgent(ua: string | null | undefined): UserAgentClass {
  if (!ua) return 'human';
  const lower = ua.toLowerCase();

  for (const pattern of BOT_SEARCH_PATTERNS) {
    if (lower.includes(pattern)) return 'bot_search';
  }
  for (const pattern of BOT_AI_PATTERNS) {
    if (lower.includes(pattern)) return 'bot_ai';
  }
  for (const pattern of BOT_OTHER_PATTERNS) {
    if (lower.includes(pattern)) return 'bot_other';
  }
  return 'human';
}

export function isBot(uaClass: UserAgentClass): boolean {
  return uaClass !== 'human';
}
