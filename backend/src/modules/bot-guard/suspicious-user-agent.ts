/**
 * Signatures d'agents utilisateur suspects (clients scriptés, navigateurs
 * pilotés). Liste du BotGuardService, sortie de la classe sans changement pour
 * être partagée avec le classement du trafic des événements du parcours
 * (classifyUserAgent, googlebot-detector.service.ts).
 */
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
