/**
 * Réseau de la sonde du parcours d'achat : écritures refusées hors liste blanche
 * (mandat AU) et en-tête de passage Cloudflare (complément n° 2 du mandat EI).
 *
 * Depuis la fusion de #2219, la PROD répond par un défi Cloudflare au runner
 * GitHub (étape « accueil », POST /cdn-cgi/challenge-platform/ refusé par la
 * sonde). Une règle Cloudflare laisse passer sans défi les requêtes qui portent
 * l'en-tête X-AutoMecanik-Probe avec la bonne valeur ; cette valeur est lue dans
 * PURCHASE_PROBE_BYPASS_TOKEN (secret GitHub du même nom).
 *
 * Garanties :
 * - l'en-tête n'est ajouté qu'aux requêtes vers l'origine sondée
 *   (PURCHASE_PROBE_BASE_URL), jamais à un tiers ; il est retiré d'une requête
 *   tierce qui le porterait ;
 * - Playwright applique les en-têtes d'une requête routée à ses redirections, et
 *   n'appelle pas le routage pour elles (vérifié sous Chromium, Playwright 1.61) :
 *   une redirection de l'origine vers un tiers emporterait le jeton. Le
 *   contournement par route.fetch + route.fulfill retire le jeton des redirections
 *   internes, que Cloudflare défierait alors ; il n'est pas retenu. Aucune
 *   redirection hors origine n'existe dans config/caddy/Caddyfile pour www ; si
 *   une apparaît, watchRedirectLeaks la relève et le passage échoue, pour que le
 *   jeton soit renouvelé ;
 * - la valeur n'est jamais affichée : un message d'erreur qui la contiendrait
 *   passe par redact() avant d'être écrit dans le résultat ou le journal.
 *
 * Aucun import à l'exécution : le workflow copie les fichiers .ts de ce dossier
 * dans un répertoire où seul @playwright/test est installé.
 */
import { type BrowserContext, type Request, type Route } from '@playwright/test';

/** Nom de l'en-tête (Cloudflare compare les noms en minuscules). */
export const BYPASS_HEADER = 'x-automecanik-probe';
export const BYPASS_ENV = 'PURCHASE_PROBE_BYPASS_TOKEN';
export const REDACTED = '[jeton masqué]';

/** Écritures permises à la page : méthode + chemin exact. */
export const WRITE_ALLOWLIST = new Set(['POST /api/cart/items', 'POST /auth/check-email']);

/**
 * Lit le jeton de passage. Absent ou mal formé : erreur immédiate, sans passage
 * dégradé. Le message ne contient jamais la valeur.
 */
export function readBypassToken(env: Record<string, string | undefined> = process.env): string {
  const token = env[BYPASS_ENV];
  if (!token) {
    throw new Error(
      `${BYPASS_ENV} requis : valeur de l'en-tête X-AutoMecanik-Probe que la règle Cloudflare ` +
        `laisse passer sans défi (secret GitHub du même nom). Sans elle, la sonde ne part pas.`,
    );
  }
  if (!/^[\x21-\x7e]+$/.test(token)) {
    throw new Error(
      `${BYPASS_ENV} mal formé : caractères ASCII visibles seulement, sans espace ni retour ` +
        `à la ligne (valeur non affichée).`,
    );
  }
  return token;
}

export function isSameOrigin(url: string, origin: string): boolean {
  try {
    return new URL(url).origin === origin;
  } catch {
    return false;
  }
}

/**
 * En-têtes d'une requête : le jeton est ajouté vers l'origine sondée, retiré
 * partout ailleurs. L'objet reçu n'est pas modifié.
 */
export function headersFor(
  url: string,
  origin: string,
  headers: Record<string, string>,
  token: string,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    if (name.toLowerCase() !== BYPASS_HEADER) out[name] = value;
  }
  if (isSameOrigin(url, origin)) out[BYPASS_HEADER] = token;
  return out;
}

/** Remplace chaque occurrence du jeton dans un texte destiné au journal ou au résultat. */
export function redact(text: string, token: string): string {
  return token ? text.split(token).join(REDACTED) : text;
}

/**
 * Chaîne de redirection [première requête, …, requête courante] : si la première
 * vise l'origine sondée (donc porte le jeton) et la courante une autre origine,
 * renvoie cette autre origine (le jeton l'a suivie). Sinon null.
 */
export function leakedOrigin(chain: string[], origin: string): string | null {
  const first = chain[0];
  const current = chain[chain.length - 1];
  if (!first || !current || !isSameOrigin(first, origin) || isSameOrigin(current, origin)) return null;
  try {
    return new URL(current).origin;
  } catch {
    return current.slice(0, 100);
  }
}

function redirectChain(request: Request): string[] {
  const chain = [request.url()];
  for (let prev = request.redirectedFrom(); prev; prev = prev.redirectedFrom()) chain.unshift(prev.url());
  return chain;
}

/**
 * Seul routage de la page : refuse toute écriture hors liste blanche (et la
 * compte), laisse passer le reste avec l'en-tête limité à l'origine sondée.
 */
export async function guardWrites(
  context: BrowserContext,
  origin: string,
  token: string,
  blocked: Map<string, number>,
): Promise<void> {
  await context.route('**/*', (route: Route) => {
    const request = route.request();
    const pass = () =>
      route.continue({
        headers: headersFor(request.url(), origin, request.headers(), token),
      });
    const method = request.method();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return pass();
    const url = new URL(request.url());
    const key = `${method} ${url.origin === origin ? url.pathname : `${url.origin}${url.pathname}`}`;
    if (url.origin === origin && WRITE_ALLOWLIST.has(`${method} ${url.pathname}`)) return pass();
    blocked.set(key, (blocked.get(key) ?? 0) + 1);
    return route.abort('blockedbyclient');
  });
  // Les balises navigator.sendBeacon passent par ce routage (vérifié sous Chromium
  // sur DEV : cwv/beacon et attribution/landing y sont refusées). Elles ne sont pas
  // neutralisées dans la page, pour rester comptées dans blocked_writes.
}

/** Relève les origines tierces atteintes par une redirection partie de l'origine sondée. */
export function watchRedirectLeaks(context: BrowserContext, origin: string, leaks: Set<string>): void {
  context.on('request', (request) => {
    const leaked = leakedOrigin(redirectChain(request), origin);
    if (leaked) leaks.add(leaked);
  });
}

/**
 * Options des appels directs (context.request, hors routage de la page) : tous
 * visent l'origine sondée par un chemin relatif, sans suivre de redirection,
 * pour que le jeton ne parte jamais ailleurs.
 */
export function apiOptions(token: string): {
  headers: Record<string, string>;
  maxRedirects: 0;
} {
  return { headers: { [BYPASS_HEADER]: token }, maxRedirects: 0 };
}
