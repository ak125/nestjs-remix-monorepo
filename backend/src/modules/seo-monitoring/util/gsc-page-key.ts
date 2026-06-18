/**
 * Canonicalise une clé « page » pour qu'elle JOIN exactement les lignes GSC
 * (`__seo_gsc_daily` / `__seo_gsc_daily_pages`), dont la colonne `page` est l'URL
 * ABSOLUE renvoyée par l'API Search Console (préfixée par la propriété GSC).
 *
 * CHECK-0 (2026-06-18) : GSC stocke `https://www.automecanik.com/<path>` (sans slash
 * final) ; GA4 stocke des chemins (`/<path>`). Une clé mal normalisée = 0 ligne jointe
 * = faux « aucun effet » (landmine #1 de la boucle OBSERVE).
 *
 * Règles déterministes & idempotentes :
 *  - entrée déjà absolue (`http(s)://…`) → conservée telle quelle (l'opérateur a collé
 *    l'URL GSC exacte), simplement trim + retrait du/des slash(es) final(aux) hors origine ;
 *  - entrée = chemin (`/blog-…` ou `blog-…`) → préfixée par `gscSiteUrl` (MÊME source que
 *    le fetcher GSC : `GoogleCredentialsService.getGSCSiteUrl()`), slash final du préfixe ôté.
 *
 * Ne touche AUCUNE URL canonique / route / slug — hygiène de jointure interne en lecture
 * du format GSC existant (cf. mémoire `feedback_no_url_changes_ever`).
 */
export function canonicalizeGscPageKey(
  input: string,
  gscSiteUrl: string,
): string {
  const raw = (input ?? '').trim();
  if (!raw) return raw;

  if (/^https?:\/\//i.test(raw)) {
    return stripTrailingSlash(raw);
  }

  const base = stripTrailingSlash((gscSiteUrl ?? '').trim());
  const path = raw.startsWith('/') ? raw : `/${raw}`;
  return stripTrailingSlash(`${base}${path}`);
}

/**
 * Retire le(s) slash(es) final(aux) en gardant au moins 1 caractère significatif
 * (l'origine `https://host` et la racine `/` restent intactes).
 */
function stripTrailingSlash(u: string): string {
  return u.replace(/(.)\/+$/, '$1');
}
