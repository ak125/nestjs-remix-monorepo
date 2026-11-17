/**
 * Signatures d'agents utilisateur partagées par les deux détecteurs existants,
 * et classement du trafic des événements du parcours (mandat AT).
 *
 *   - GOOGLEBOT_PATTERNS / OTHER_BOT_PATTERNS : signatures de
 *     GooglebotDetectorService (seo), déplacées ici sans changement ;
 *   - SUSPICIOUS_UA_PATTERNS : liste de BotGuardService (bot-guard), déplacée
 *     ici sans changement ;
 *   - classifyUserAgent : human / bot / suspect, utilisé à la réception de
 *     POST /api/seo/funnel/event (seo-monitoring).
 *
 * Hors de `modules/` pour que les trois modules la lisent sans import profond
 * entre modules ni cycle (le barrel `seo` importe SeoModule).
 */

// Signatures de robots connus (reprises de LogIngestionService)
export const GOOGLEBOT_PATTERNS: readonly string[] = [
  'googlebot',
  'googlebot-image',
  'googlebot-news',
  'googlebot-video',
  'google-inspectiontool',
  'storebot-google',
  'google-extended',
  'adsbot-google',
  'mediapartners-google',
  'apis-google',
];

export const OTHER_BOT_PATTERNS: readonly string[] = [
  'bingbot',
  'slurp', // Yahoo
  'duckduckbot',
  'baiduspider',
  'yandexbot',
  'sogou',
  'exabot',
  'facebot',
  'ia_archiver', // Alexa
  'semrushbot',
  'ahrefsbot',
  'dotbot',
  'mj12bot',
];

/** Toutes les signatures de robot connues de GooglebotDetectorService, génériques comprises. */
const KNOWN_BOT_PATTERNS: readonly string[] = [
  ...GOOGLEBOT_PATTERNS,
  ...OTHER_BOT_PATTERNS,
  'crawler',
  'spider',
  'bot',
];

/** Agent utilisateur connu comme robot (règle de GooglebotDetectorService.isBot). */
export function isKnownBotUserAgent(userAgent: string): boolean {
  const ua = userAgent.toLowerCase();
  return KNOWN_BOT_PATTERNS.some((pattern) => ua.includes(pattern));
}

/** Signatures d'agents suspects (clients scriptés, navigateurs pilotés) — BotGuardService. */
export const SUSPICIOUS_UA_PATTERNS: readonly string[] = [
  'python-requests',
  'python-urllib',
  'python/',
  'go-http-client',
  'java/',
  'curl/',
  'wget/',
  'httpclient',
  'libwww',
  'lwp-trivial',
  'scrapy',
  'phantomjs',
  'headlesschrome',
  'selenium',
  'puppeteer',
  'node-fetch',
  'axios/',
  'got/',
  'undici',
];

/** Vrai si l'agent porte une signature de SUSPICIOUS_UA_PATTERNS. */
export function isSuspiciousUserAgent(userAgent: string): boolean {
  const ua = userAgent.toLowerCase();
  return SUSPICIOUS_UA_PATTERNS.some((pattern) => ua.includes(pattern));
}

/**
 * Classe de trafic d'un événement du parcours, calculée à la réception :
 *   - `bot`     : robot connu (signatures de GooglebotDetectorService) ;
 *   - `suspect` : douteux — agent absent, client scripté ou navigateur piloté
 *                 (SUSPICIOUS_UA_PATTERNS de BotGuardService), ou agent qui ne se
 *                 présente pas comme un navigateur (pas de préfixe `Mozilla/`) ;
 *   - `human`   : navigateur ordinaire. L'agent est déclaratif : `human` veut
 *                 dire « aucun signe de robot », pas une preuve d'humanité.
 * Aucune nouvelle liste : les signatures sont celles des deux détecteurs existants.
 */
export type TrafficClass = 'human' | 'bot' | 'suspect';

export function classifyUserAgent(
  userAgent: string | null | undefined,
): TrafficClass {
  const ua = userAgent?.trim() ?? '';
  if (ua === '') return 'suspect';
  if (isKnownBotUserAgent(ua)) return 'bot';
  if (isSuspiciousUserAgent(ua)) return 'suspect';
  if (!/^mozilla\//i.test(ua)) return 'suspect';
  return 'human';
}
