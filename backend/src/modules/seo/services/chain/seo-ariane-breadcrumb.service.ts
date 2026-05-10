import { Injectable } from '@nestjs/common';
import { type SurfaceKey } from '@repo/seo-role-contracts';

/**
 * Élément de fil d'Ariane (lib + URL absolue).
 *
 * `url` doit être une URL absolue HTTPS pour que le JSON-LD `BreadcrumbList`
 * passe la validation Schema.org.
 */
export interface BreadcrumbItem {
  name: string;
  url: string;
}

export interface AriadneBuildInput {
  surfaceKey: SurfaceKey;
  /** Items déjà ordonnés du plus général (Accueil) au plus spécifique. */
  items: BreadcrumbItem[];
}

/**
 * JSON-LD `BreadcrumbList` strict (Schema.org).
 * @see https://schema.org/BreadcrumbList
 */
export interface BreadcrumbListJsonLd {
  '@context': 'https://schema.org';
  '@type': 'BreadcrumbList';
  itemListElement: Array<{
    '@type': 'ListItem';
    position: number;
    name: string;
    item: string;
  }>;
}

/**
 * Service builder du fil d'Ariane SEO (JSON-LD `BreadcrumbList`).
 *
 * Logique pure (pas de DB, pas de HTTP). Le caller fournit les items déjà
 * ordonnés ; ce service ne fait que :
 *   - valider la cohérence (au moins 1 item, URLs absolues HTTPS)
 *   - produire le JSON-LD `BreadcrumbList` (Schema.org)
 *   - produire la liste textuelle (anciennement `mta_ariane`) pour rendu HTML
 *
 * Source canonique des items côté legacy : `___meta_tags_ariane.mta_ariane`.
 * En cible PR-2c+ : ce service est consommé par `SeoMetaRegistryService` pour
 * les pages standard, et par les controllers R0/R7/R8 pour les hubs.
 *
 * @see plan seo-v9 §3.2 — `SeoArianeBreadcrumbService`
 */
@Injectable()
export class SeoArianeBreadcrumbService {
  /** Construit le JSON-LD `BreadcrumbList`. Throw si items invalides. */
  buildJsonLd(input: AriadneBuildInput): BreadcrumbListJsonLd {
    this.validate(input);
    return {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: input.items.map((item, idx) => ({
        '@type': 'ListItem',
        position: idx + 1,
        name: item.name,
        item: item.url,
      })),
    };
  }

  /**
   * Construit la liste textuelle (compatibilité `mta_ariane` legacy : "A > B > C").
   */
  buildTextTrail(input: AriadneBuildInput): string {
    this.validate(input);
    return input.items.map((i) => i.name).join(' > ');
  }

  private validate(input: AriadneBuildInput): void {
    if (!Array.isArray(input.items) || input.items.length === 0) {
      throw new SeoBreadcrumbError(
        `Ariane vide pour surface ${input.surfaceKey} : au moins 1 item requis.`,
      );
    }
    for (const [idx, item] of input.items.entries()) {
      if (!item.name || !item.name.trim()) {
        throw new SeoBreadcrumbError(
          `Ariane[${idx}].name vide pour surface ${input.surfaceKey}.`,
        );
      }
      if (!item.url || !/^https:\/\//.test(item.url)) {
        throw new SeoBreadcrumbError(
          `Ariane[${idx}].url doit être absolue HTTPS (reçu : "${item.url}").`,
        );
      }
    }
  }
}

export class SeoBreadcrumbError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SeoBreadcrumbError';
  }
}
