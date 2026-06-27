/**
 * Domaine canonique du site — TOUJOURS avec www.
 * Utiliser cette constante partout au lieu de hardcoder le domaine.
 *
 * Fichier isole (zero dependance) pour eviter les problemes
 * d'import circulaire dans les tests Jest.
 */
export const SITE_ORIGIN = 'https://www.automecanik.com';

/**
 * Hostname canonique nu (sans schema) — derive de SITE_ORIGIN.
 * Pour les APIs qui filtrent par host brut (ex. dimension GA4 `hostName`).
 * Permet d'exclure le trafic non-PROD (localhost = CI headless / DEV).
 */
export const SITE_HOSTNAME = new URL(SITE_ORIGIN).hostname;
