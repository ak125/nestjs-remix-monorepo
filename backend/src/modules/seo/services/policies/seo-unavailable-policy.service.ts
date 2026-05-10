import { Injectable } from '@nestjs/common';

export type UnavailableKind = '410_GONE' | '412_PRECONDITION';

export interface UnavailableContext {
  /** URL morte demandée. */
  url: string;
  /** Type de contexte legacy : 'z' (zone), 'mq' (marque), 'ty' (type), 'p' (pieces), 'p0' (pieces générique). */
  legacyContextKey?: 'z' | 'mq' | 'ty' | 'p' | 'p0';
  /** Marque parente encore indexable, si pertinent (R8 mort → fallback marque). */
  parentBrandAlias?: string;
}

export interface UnavailableResolution {
  kind: UnavailableKind;
  httpStatus: 410;
  robots: 'noindex,nofollow';
  fallbackLinks: Array<{ label: string; href: string }>;
  contextualContent?: string;
}

/**
 * **STUB PR-2b** — politique 410/412 contextualisée.
 *
 * Le plan v9 section 3.3 + itération 11 précise : raccorder le système 3 couches
 * erreurs 4xx existant côté backend (à auditer en PR-8). Pour l'instant ce service
 * fournit l'API publique + une implémentation minimale (toujours 410, liens secours
 * hardcodés). Branchement réel = PR-8.
 */
@Injectable()
export class SeoUnavailablePolicy {
  resolve(context: UnavailableContext): UnavailableResolution {
    return {
      kind: '410_GONE',
      httpStatus: 410,
      robots: 'noindex,nofollow',
      fallbackLinks: this.computeFallbacks(context),
      contextualContent: this.computeContextualContent(context),
    };
  }

  private computeFallbacks(
    ctx: UnavailableContext,
  ): UnavailableResolution['fallbackLinks'] {
    const links: UnavailableResolution['fallbackLinks'] = [
      { label: 'Accueil', href: '/' },
      { label: 'Conseils', href: '/blog-pieces-auto/conseils' },
    ];
    if (ctx.parentBrandAlias) {
      links.push({
        label: `Catalogue ${ctx.parentBrandAlias}`,
        href: `/constructeurs/${ctx.parentBrandAlias}.html`,
      });
    }
    return links;
  }

  private computeContextualContent(
    ctx: UnavailableContext,
  ): string | undefined {
    if (!ctx.legacyContextKey) return undefined;
    // Templates minimaux (cf. legacy 412.page.php). Enrichir en PR-8.
    const map: Record<
      NonNullable<UnavailableContext['legacyContextKey']>,
      string
    > = {
      z: "Cette zone produit n'est plus disponible.",
      mq: "Cette marque n'est plus référencée dans notre catalogue.",
      ty: "Cette motorisation n'est plus listée.",
      p: 'Cette pièce a été retirée du catalogue.',
      p0: "La fiche produit demandée n'existe plus.",
    };
    return map[ctx.legacyContextKey];
  }
}
