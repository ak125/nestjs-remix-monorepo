/**
 * Configuration CSP centralisée
 *
 * RÈGLE: Tout nouveau domaine d'images doit être ajouté à IMAGE_DOMAINS.
 * Le CSP img-src est construit automatiquement depuis cette liste.
 *
 * @see frontend/app/utils/image-optimizer.ts - Doit utiliser les mêmes domaines
 */

import { SITE_ORIGIN } from './app.config';

// ═══════════════════════════════════════════════════════════════════════════
// 🖼️ DOMAINES D'IMAGES AUTORISÉS - SOURCE UNIQUE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Sanitize a CSP source : retire whitespace / control chars qui invalident
 * l'en-tête `Content-Security-Policy`. Les secrets GitHub stockés ont
 * souvent un newline final → `setHeader` lève `ERR_INVALID_CHAR` et toute
 * réponse retourne 500. Vérifié sur perf-gates.yml run 25173022159
 * ([helmet/index.cjs:123](node_modules/helmet/index.cjs#L123)).
 */
const sanitizeCspSource = (raw: string): string =>
  // eslint-disable-next-line no-control-regex
  raw.replace(/[\x00-\x20\x7F]+/g, '');

export const IMAGE_DOMAINS = {
  /** Supabase Storage - images rack, logos, etc. */
  SUPABASE: sanitizeCspSource(process.env.SUPABASE_URL || ''),

  /** imgproxy pour optimisation d'images (resize, webp, avif) */
  IMGPROXY: SITE_ORIGIN,

  /** Google Analytics - pixel de tracking */
  GOOGLE_ANALYTICS: 'https://www.google-analytics.com',

  /** Google Tag Manager - pixel de tracking */
  GOOGLE_TAG_MANAGER: 'https://www.googletagmanager.com',
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// 🔒 DIRECTIVES CSP COMPLÈTES
// ═══════════════════════════════════════════════════════════════════════════

export const CSP_DIRECTIVES = {
  defaultSrc: ["'self'"],

  styleSrc: [
    "'self'",
    "'unsafe-inline'", // Pour Tailwind CSS
  ],

  scriptSrc: [
    "'self'",
    'https://www.googletagmanager.com',
    'https://www.google-analytics.com',
    'https://tagmanager.google.com',
  ],

  // img-src: Construit dynamiquement depuis IMAGE_DOMAINS (filter sources vides
  // pour éviter `img-src 'self' data: blob:  https://…` → safe en cas d'env var absente).
  imgSrc: [
    "'self'",
    'data:',
    'blob:',
    ...Object.values(IMAGE_DOMAINS).filter((s) => s.length > 0),
  ],

  connectSrc: [
    "'self'",
    'ws:',
    'wss:',
    'https://www.google-analytics.com',
    'https://analytics.google.com',
    'https://region1.google-analytics.com',
  ],

  fontSrc: ["'self'", 'data:'], // Google Fonts retiré — fonts self-hosted
  objectSrc: ["'none'"],
  mediaSrc: ["'self'"],
  frameSrc: ["'self'"],

  formAction: [
    "'self'",
    'https://paiement.systempay.fr',
    'https://paiement-secure.test.lyra-collect.com',
    'https://tpeweb.paybox.com', // Paybox PRODUCTION
    'https://preprod-tpeweb.paybox.com', // Paybox PREPROD
  ],

  baseUri: ["'self'"],
  frameAncestors: ["'self'"],
  scriptSrcAttr: ["'none'"],
  upgradeInsecureRequests: [] as string[],
};

// ═══════════════════════════════════════════════════════════════════════════
// 🛠️ HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Retourne les sources connectSrc avec les URLs HMR en dev
 */
export function getConnectSrcWithHMR(isDev: boolean): string[] {
  const base: string[] = [...CSP_DIRECTIVES.connectSrc];
  if (isDev) {
    base.push('http://127.0.0.1:24678', 'http://localhost:24678');
  }
  return base;
}

/**
 * Construit les directives CSP complètes pour Helmet
 * @param nonce - Nonce cryptographique par requête (remplace 'unsafe-inline' dans scriptSrc)
 */
export function buildCSPDirectives(isDev: boolean, nonce?: string) {
  const scriptSrc = [...CSP_DIRECTIVES.scriptSrc];
  if (nonce) {
    scriptSrc.push(`'nonce-${nonce}'`);
  } else {
    scriptSrc.push("'unsafe-inline'");
  }
  return {
    ...CSP_DIRECTIVES,
    scriptSrc,
    connectSrc: getConnectSrcWithHMR(isDev),
  };
}
