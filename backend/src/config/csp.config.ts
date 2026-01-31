/**
 * Configuration CSP centralisée
 *
 * RÈGLE: Tout nouveau domaine d'images doit être ajouté à IMAGE_DOMAINS.
 * Le CSP img-src est construit automatiquement depuis cette liste.
 *
 * @see frontend/app/utils/image-optimizer.ts - Doit utiliser les mêmes domaines
 */

// ═══════════════════════════════════════════════════════════════════════════
// 🖼️ DOMAINES D'IMAGES AUTORISÉS - SOURCE UNIQUE
// ═══════════════════════════════════════════════════════════════════════════

export const IMAGE_DOMAINS = {
  /** Supabase Storage - images rack, logos, etc. */
  SUPABASE:
    process.env.SUPABASE_URL || 'https://cxpojprgwgubzjyqzmoq.supabase.co',

  /** imgproxy pour optimisation d'images (resize, webp, avif) */
  IMGPROXY: 'https://www.automecanik.com',

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
    'https://fonts.googleapis.com',
  ],

  scriptSrc: [
    "'self'",
    "'unsafe-inline'",
    'https://www.googletagmanager.com',
    'https://www.google-analytics.com',
  ],

  // img-src: Construit dynamiquement depuis IMAGE_DOMAINS
  imgSrc: ["'self'", 'data:', 'blob:', ...Object.values(IMAGE_DOMAINS)],

  connectSrc: [
    "'self'",
    'ws:',
    'wss:',
    'https://www.google-analytics.com',
    'https://analytics.google.com',
    'https://region1.google-analytics.com',
  ],

  fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
  objectSrc: ["'none'"],
  mediaSrc: ["'self'"],
  frameSrc: ["'none'"],

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
 */
export function buildCSPDirectives(isDev: boolean) {
  return {
    ...CSP_DIRECTIVES,
    connectSrc: getConnectSrcWithHMR(isDev),
  };
}
