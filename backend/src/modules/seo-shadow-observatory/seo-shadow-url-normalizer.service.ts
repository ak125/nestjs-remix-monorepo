import { Injectable } from '@nestjs/common';

const CANONICAL_HOST = 'www.automecanik.com';
const CANONICAL_BASE = `https://${CANONICAL_HOST}`;

/**
 * Normalise les URLs canonical avant comparaison legacy↔chain.
 *
 * Sans normalisation, `https://www.automecanik.com/Foo/`
 * et `https://www.automecanik.com/foo` produiraient `canonical_eq=false`
 * → faux positifs en masse. La normalisation enforce :
 *   - Protocole `https:`.
 *   - Hostname canonique `www.automecanik.com`.
 *   - Pathname lowercase + URI-decoded.
 *   - Pas de trailing slash (sauf root `/`).
 *   - Pas de query string ni fragment.
 *
 * @see plan seo-v9 PR-6 §4.3
 */
@Injectable()
export class SeoShadowUrlNormalizer {
  /** Retourne la forme canonique stricte ou `null` si l'URL est invalide. */
  normalize(url: string | null | undefined): string | null {
    if (!url) return null;
    try {
      const u = new URL(url, CANONICAL_BASE);
      let path = decodeURI(u.pathname).toLowerCase();
      if (path.length > 1 && path.endsWith('/')) {
        path = path.slice(0, -1);
      }
      return `${CANONICAL_BASE}${path}`;
    } catch {
      return null;
    }
  }

  /**
   * Pour les surfaces où le legacy ne bake pas le canonical backend-side
   * (ex: R7 — frontend Remix dérive de `pathname`), on reconstruit la même
   * valeur que produirait le frontend, à partir du `requestUrl`.
   */
  reconstructLegacy(
    rpcCanonical: string | null | undefined,
    requestUrl: string,
  ): string | null {
    return this.normalize(rpcCanonical) ?? this.normalize(requestUrl);
  }
}
