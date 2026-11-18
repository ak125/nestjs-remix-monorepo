/**
 * Garde « lecture seule » commune aux connecteurs de portail fournisseur.
 *
 * Mise au panier et validation de commande déclenchent de vraies commandes
 * facturables. Les connecteurs lisent seulement : prix, remise, prix net et
 * disponibilité. Cette garde avorte toute requête d'écriture (méthode autre que
 * GET/HEAD) dont le chemin ou la cible de postback ASP.NET (`__EVENTTARGET`)
 * désigne un panier, une commande, un devis ou une validation. Une lecture GET
 * reste permise : un portail charge des ressources dont le nom contient « cart »
 * (pictogramme, script d'en-tête) sans rien ajouter au panier.
 *
 * Deux points d'application, pour ne pas dépendre d'un seul :
 * - `installReadOnlyGuard(context)` sur le contexte navigateur (requêtes de la page) ;
 * - `assertReadOnlyRequest(...)` avant chaque appel direct `context.request.*`,
 *   que l'interception de route du navigateur ne voit pas.
 *
 * Mandat BK (17/11/2026) : l'envoi réel d'une commande fournisseur n'existe pas ;
 * il fera l'objet d'un mandat distinct.
 */
import type { BrowserContext, Route } from 'playwright';

/** Chemin ou cible désignant une écriture panier / commande. */
const FORBIDDEN_WRITE_TARGET =
  /panier|cart|basket|checkout|commande|order|ajout|ajouter|incart|cmdcde|cmdadd|devis|valid/i;

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Cible `__EVENTTARGET` d'un postback WebForms encodé en formulaire, ou null. */
function eventTarget(postData: string | null | undefined): string | null {
  if (!postData) return null;
  const m = postData.match(/(?:^|&)__EVENTTARGET=([^&]*)/);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1].replace(/\+/g, ' '));
  } catch {
    return m[1];
  }
}

/**
 * Vrai si la requête serait une écriture panier / commande sur le portail.
 * `postData` : corps brut (formulaire encodé) quand il est connu.
 */
export function isForbiddenPortalWrite(
  method: string,
  url: string,
  postData?: string | null,
): boolean {
  if (READ_METHODS.has(method.toUpperCase())) return false;
  let path = url;
  try {
    path = new URL(url).pathname;
  } catch {
    // URL relative : on teste la chaîne telle quelle
  }
  if (FORBIDDEN_WRITE_TARGET.test(path)) return true;
  const target = eventTarget(postData);
  return target != null && FORBIDDEN_WRITE_TARGET.test(target);
}

/** Lève une erreur explicite si l'appel direct serait une écriture panier / commande. */
export function assertReadOnlyRequest(
  method: string,
  url: string,
  postData?: string | null,
): void {
  if (isForbiddenPortalWrite(method, url, postData)) {
    throw new Error(
      `Connecteur en lecture seule : requête panier/commande refusée (${method.toUpperCase()} ${safePath(url)})`,
    );
  }
}

function safePath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url.split('?')[0];
  }
}

/** Sous-ensemble de `Route` utilisé par le gestionnaire (testable sans navigateur). */
export type GuardRoute = Pick<Route, 'abort' | 'continue'> & {
  request(): { method(): string; url(): string; postData(): string | null };
};

/** Gestionnaire de route : avorte l'écriture interdite, laisse passer le reste. */
export async function readOnlyRouteHandler(
  route: GuardRoute,
  onBlocked?: (method: string, path: string) => void,
): Promise<void> {
  const req = route.request();
  if (isForbiddenPortalWrite(req.method(), req.url(), req.postData())) {
    onBlocked?.(req.method(), safePath(req.url()));
    await route.abort('blockedbyclient');
    return;
  }
  await route.continue();
}

/** Installe la garde sur toutes les requêtes du contexte navigateur. */
export async function installReadOnlyGuard(
  context: BrowserContext,
  onBlocked?: (method: string, path: string) => void,
): Promise<void> {
  await context.route('**/*', (route) =>
    readOnlyRouteHandler(route as unknown as GuardRoute, onBlocked),
  );
}
