import { Injectable } from '@nestjs/common';
import { type SurfaceKey } from '@repo/seo-role-contracts';

export interface CanonicalInput {
  surfaceKey: SurfaceKey;
  /** Slugs canoniques résolus en amont (pas le path requesté brut). */
  ids: {
    gammeAlias?: string;
    marqueAlias?: string;
    modeleAlias?: string;
    typeAlias?: string;
    brandAlias?: string;
    pieceRef?: string;
    pgAlias?: string;
    blogSlug?: string;
    staticPath?: string;
  };
  /** Hôte HTTPS canonique (ex: 'https://www.automecanik.com'). */
  baseUrl: string;
}

/**
 * Calcule l'URL canonical strict par surface SEO. Logique pure (pas de DB ni HTTP).
 *
 * Conventions URL alignées sur les routes Remix actuelles :
 *   R1_GAMME_ROUTER          → /pieces/{pgAlias}
 *   R1_GAMME_VEHICLE_ROUTER  → /pieces/{gammeAlias}/{marqueAlias}/{modeleAlias}/{typeAlias}.html
 *   R7_BRAND_HUB             → /constructeurs/{brandAlias}.html
 *   R8_VEHICLE               → /constructeurs/{brandAlias}/{modeleAlias}/{typeAlias}
 *   R0_HOME                  → /
 *   STATIC_PAGE              → /{staticPath}
 *   BLOG_ADVICE              → /blog-pieces-auto/conseils/{blogSlug}
 *   BLOG_ARTICLE             → /blog-pieces-auto/article/{blogSlug}
 *   R2_PRODUCT               → /produit/{pieceRef}
 *
 * Surfaces R2_PRODUCT_LIST, R2_PRODUCT_IN_VEHICLE, R3_*, R6_BUYING_GUIDE,
 * UNAVAILABLE_410/412 : throw `SeoCanonicalError` (à compléter dans PRs futurs).
 */
@Injectable()
export class SeoCanonicalService {
  computeCanonical(input: CanonicalInput): string {
    const { surfaceKey, ids, baseUrl } = input;
    const path = this.computePath(surfaceKey, ids);
    return `${baseUrl}${path}`;
  }

  private computePath(
    surfaceKey: SurfaceKey,
    ids: CanonicalInput['ids'],
  ): string {
    switch (surfaceKey) {
      case 'R0_HOME':
        return '/';
      case 'R1_GAMME_ROUTER':
        return `/pieces/${this.requireId(ids.pgAlias, 'pgAlias', surfaceKey)}`;
      case 'R1_GAMME_VEHICLE_ROUTER':
        return `/pieces/${this.requireId(ids.gammeAlias, 'gammeAlias', surfaceKey)}/${this.requireId(ids.marqueAlias, 'marqueAlias', surfaceKey)}/${this.requireId(ids.modeleAlias, 'modeleAlias', surfaceKey)}/${this.requireId(ids.typeAlias, 'typeAlias', surfaceKey)}.html`;
      case 'R7_BRAND_HUB':
        return `/constructeurs/${this.requireId(ids.brandAlias, 'brandAlias', surfaceKey)}.html`;
      case 'R8_VEHICLE':
        return `/constructeurs/${this.requireId(ids.brandAlias, 'brandAlias', surfaceKey)}/${this.requireId(ids.modeleAlias, 'modeleAlias', surfaceKey)}/${this.requireId(ids.typeAlias, 'typeAlias', surfaceKey)}`;
      case 'STATIC_PAGE':
        return `/${this.requireId(ids.staticPath, 'staticPath', surfaceKey).replace(/^\//, '')}`;
      case 'BLOG_ADVICE':
        return `/blog-pieces-auto/conseils/${this.requireId(ids.blogSlug, 'blogSlug', surfaceKey)}`;
      case 'BLOG_ARTICLE':
        return `/blog-pieces-auto/article/${this.requireId(ids.blogSlug, 'blogSlug', surfaceKey)}`;
      case 'R2_PRODUCT':
        return `/produit/${this.requireId(ids.pieceRef, 'pieceRef', surfaceKey)}`;
      // Surfaces sans canonical défini en PR-2b (à compléter dans PRs futurs).
      case 'R2_PRODUCT_LIST':
      case 'R2_PRODUCT_IN_VEHICLE':
      case 'R3_ADVICE':
      case 'R3_DIAG_SECTION':
      case 'R6_BUYING_GUIDE':
      case 'UNAVAILABLE_410':
      case 'UNAVAILABLE_412':
        throw new SeoCanonicalError(
          `Canonical non défini pour surface ${surfaceKey} en PR-2b. À compléter dans PR-2c+ ou PR différé.`,
        );
      default: {
        const exhaustive: never = surfaceKey;
        throw new SeoCanonicalError(`Surface inconnue : ${String(exhaustive)}`);
      }
    }
  }

  private requireId(
    value: string | undefined,
    name: string,
    surfaceKey: SurfaceKey,
  ): string {
    if (!value) {
      throw new SeoCanonicalError(
        `Champ ids.${name} requis pour surface ${surfaceKey}`,
      );
    }
    return value;
  }
}

export class SeoCanonicalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SeoCanonicalError';
  }
}
