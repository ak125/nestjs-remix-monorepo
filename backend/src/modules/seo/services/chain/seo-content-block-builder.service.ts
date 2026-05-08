import { Injectable } from '@nestjs/common';

import { type SurfaceKey } from '@repo/seo-role-contracts';

import type { ResolvedLink } from './seo-internal-linking.service';
import type { BreadcrumbListJsonLd } from './seo-ariane-breadcrumb.service';
import type { SwitchVariant } from './seo-switch-selector.service';

/**
 * Bloc de contenu structuré (équivalent moderne de la concaténation HTML PHP).
 *
 * Chaque bloc a un `type` discriminé (lead / paragraph / link / fact-list /
 * cta) qui peut être rendu différemment côté Remix selon la surface.
 */
export type SeoContentBlock =
  | { type: 'lead'; html: string }
  | { type: 'paragraph'; html: string }
  | { type: 'fact-list'; items: Array<{ label: string; value: string }> }
  | { type: 'cta'; html: string; anchor?: string }
  | { type: 'switch-variant'; alias: number; html: string }
  | { type: 'link'; html: string; target: string };

export interface SeoChainTemplateData {
  /** Champs déjà hydratés (variables remplacées, switches résolus). */
  title: string;
  description: string;
  h1: string;
  preview: string;
  content: string;
  /** Mots-clés pré-calculés en amont (caller). */
  keywords: string;
}

export interface SeoChainPolicies {
  canonical: string;
  robots: string;
  /** Raisons éventuelles d'un noindex (vide si index,follow). */
  blockingReasons?: string[];
}

export interface SeoChainAriadne {
  jsonLd: BreadcrumbListJsonLd;
  textTrail: string;
}

export interface SeoChainMetadata {
  /** Surface effective (R0_HOME, R1_GAMME_VEHICLE_ROUTER, …). */
  surfaceKey: SurfaceKey;
  /** Identifiant du template choisi (ex: `__seo_gamme_car:124`). */
  templateId: string | null;
  /** Pour audit/fingerprint : ids des variantes switch sélectionnées. */
  variantIds: Record<string, string | number | null>;
  /** Liens internes résolus (count). */
  internalLinkCount: number;
  /** Version de la chaîne (utile pour les logs et le diff shadow). */
  chainVersion: string;
  renderedAt: string;
}

/**
 * Output canonique de la chaîne SEO (consommé par les contrôleurs PR-3+).
 *
 * Structure exhaustive : tout ce dont un controller a besoin pour répondre
 * `<title>`, `<meta>`, `<link rel="canonical">`, JSON-LD, et le rendu HTML
 * de la page (via `contentBlocks`).
 */
export interface SeoChainOutput {
  surfaceKey: SurfaceKey;
  template: SeoChainTemplateData;
  contentBlocks: SeoContentBlock[];
  policies: SeoChainPolicies;
  ariane: SeoChainAriadne;
  metadata: SeoChainMetadata;
}

export interface BuildBlocksInput {
  template: SeoChainTemplateData;
  /** Variantes switch sélectionnées (par alias → ligne brute). */
  variants: Record<number, SwitchVariant | null>;
  /** Liens internes résolus (issu de `SeoInternalLinkingService`). */
  links: Map<string, ResolvedLink>;
}

/**
 * Service d'assemblage des `contentBlocks` à partir des autres briques de la
 * chaîne SEO. Logique pure (pas de DB, pas de HTTP).
 *
 * @see plan seo-v9 §3.1 — `SeoContentBlockBuilder`
 */
@Injectable()
export class SeoContentBlockBuilder {
  buildBlocks(input: BuildBlocksInput): SeoContentBlock[] {
    const blocks: SeoContentBlock[] = [];

    if (input.template.preview && input.template.preview.trim()) {
      blocks.push({ type: 'lead', html: input.template.preview });
    }

    if (input.template.content && input.template.content.trim()) {
      blocks.push({ type: 'paragraph', html: input.template.content });
    }

    for (const [alias, variant] of Object.entries(input.variants)) {
      if (!variant) continue;
      const html = this.extractVariantHtml(variant);
      if (html) {
        blocks.push({
          type: 'switch-variant',
          alias: Number.parseInt(alias, 10),
          html,
        });
      }
    }

    for (const link of input.links.values()) {
      if (link.isLink) {
        blocks.push({ type: 'link', html: link.html, target: link.marker });
      }
    }

    return blocks;
  }

  /**
   * Extrait le champ HTML pertinent d'une ligne switch brute. Les schémas
   * varient (`sis_content`, `sgcs_content`, `sts_content`, …) — on tente
   * dans l'ordre.
   */
  private extractVariantHtml(variant: SwitchVariant): string {
    const candidates = [
      'sis_content',
      'sgcs_content',
      'sfgcs_content',
      'sts_content',
    ];
    for (const key of candidates) {
      const value = variant[key];
      if (typeof value === 'string' && value.trim()) return value;
    }
    return '';
  }
}
