import { Injectable, Logger } from '@nestjs/common';

import { type SurfaceKey } from '@repo/seo-role-contracts';

import { SeoSurfaceRegistry } from '../../registries/seo-surface.registry';
import { SeoCanonicalService } from '../policies/seo-canonical.service';
import {
  SeoIndexabilityPolicyService,
  type IndexabilityVerdict,
} from '../policies/seo-indexability-policy.service';

import {
  SeoTemplateRenderer,
  type TemplateVariables,
} from './seo-template-renderer.service';
import {
  SeoSwitchSelector,
  type SwitchVariant,
} from './seo-switch-selector.service';
import { SeoInternalLinkingService } from './seo-internal-linking.service';
import {
  SeoArianeBreadcrumbService,
  type BreadcrumbItem,
} from './seo-ariane-breadcrumb.service';
import {
  SeoContentBlockBuilder,
  type SeoChainOutput,
  type SeoChainTemplateData,
} from './seo-content-block-builder.service';

/**
 * Inputs canoniques de la chaîne SEO.
 *
 * `pgId` / `typeId` couvrent le legacy (R1/R3/R8 catalogue).
 * `ids` couvre le canonical builder (slugs déjà résolus en amont).
 * `breadcrumbs` couvre l'ariane (ordonnés du plus général au plus spécifique).
 */
export interface SeoChainInput {
  surfaceKey: SurfaceKey;
  pgId: number;
  typeId: number;
  vehicleId?: number | null;
  variables: TemplateVariables;
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
  baseUrl: string;
  /** URL requestée par le client (pour le check `URL ≠ canonical`). */
  requestedUrl?: string;
  /** Items breadcrumb déjà ordonnés (général → spécifique). */
  breadcrumbs: BreadcrumbItem[];
  /** Inputs optionnels pour le verdict d'indexabilité (volume catalogue). */
  indexability?: {
    availableFamilies?: number;
    availableGammes?: number;
    r2Conditions?: import('@repo/seo-role-contracts').R2IndexabilityConditions;
  };
  /** Si fourni, override le brand_id pour la lookup template R7_BRAND_HUB. */
  brandId?: number;
}

/**
 * Orchestrateur stateless de la chaîne SEO seo-v9.
 *
 * Compose en cascade :
 *   1. SeoSurfaceRegistry        → résolution surface + role
 *   2. SeoTemplateRenderer       → template + variables
 *   3. SeoSwitchSelector         → variantes déterministes (alias 1/2/3)
 *   4. SeoInternalLinkingService → résolution `#LinkGamme*#`
 *   5. SeoArianeBreadcrumbService → JSON-LD BreadcrumbList
 *   6. SeoCanonicalService       → URL canonique stricte
 *   7. SeoIndexabilityPolicyService → verdict robots (+ R2 gate)
 *   8. SeoContentBlockBuilder    → assembly final
 *
 * Aucune logique métier dans cette classe : elle ne fait QUE composer.
 *
 * @see plan seo-v9 §3.4 — `DynamicSeoV4UltimateService` (orchestrateur)
 *
 * **Note PR-2c** : V4 (`DynamicSeoV4UltimateService.generateCompleteSeo()`) n'est
 * PAS refactoré pour appeler cet orchestrateur. V4 reste intact (compat 4
 * endpoints debug `/api/seo-dynamic-v4/*`). PR-3+ wire les controllers réels
 * (`rm-builder`, `gamme-rest`, `brand-rpc`, `vehicle-rpc`) via cet orchestrator
 * + feature flag `SEO_CHAIN_<surface>_MODE`.
 */
@Injectable()
export class SeoChainOrchestratorService {
  private readonly logger = new Logger(SeoChainOrchestratorService.name);
  private static readonly CHAIN_VERSION = 'seo-v9-pr2c';

  constructor(
    private readonly surfaces: SeoSurfaceRegistry,
    private readonly renderer: SeoTemplateRenderer,
    private readonly switchSelector: SeoSwitchSelector,
    private readonly linking: SeoInternalLinkingService,
    private readonly ariane: SeoArianeBreadcrumbService,
    private readonly canonical: SeoCanonicalService,
    private readonly indexability: SeoIndexabilityPolicyService,
    private readonly blocks: SeoContentBlockBuilder,
  ) {}

  async run(input: SeoChainInput): Promise<SeoChainOutput> {
    // 1. surface (fail-fast si inconnue)
    if (!this.surfaces.isKnown(input.surfaceKey)) {
      throw new Error(`Surface ${input.surfaceKey} inconnue dans le registry`);
    }

    // 2-3. template + variants (en parallèle)
    const [templateRow, variantsByAlias] = await Promise.all([
      this.renderer.fetchTemplate(input.surfaceKey, input.pgId, {
        brandId: input.brandId,
      }),
      this.fetchVariants(input),
    ]);

    // 2.b application des variables sur les champs templates
    const template = this.applyTemplateFields(input, templateRow);

    // 4. linking (extrait markers depuis tous les champs hydratés)
    const allText = `${template.title} ${template.description} ${template.h1} ${template.preview} ${template.content}`;
    const markers = this.extractMarkers(allText);
    const links = await this.linking.resolveMarkers({
      sourceSurfaceKey: input.surfaceKey,
      markers,
    });

    // 5. ariane (skip si breadcrumbs vide)
    const arianeOut =
      input.breadcrumbs.length > 0
        ? {
            jsonLd: this.ariane.buildJsonLd({
              surfaceKey: input.surfaceKey,
              items: input.breadcrumbs,
            }),
            textTrail: this.ariane.buildTextTrail({
              surfaceKey: input.surfaceKey,
              items: input.breadcrumbs,
            }),
          }
        : null;

    // 6. canonical (peut throw pour les surfaces non couvertes en PR-2b)
    const canonicalUrl = this.tryCanonical(input);

    // 7. indexability verdict
    const verdict: IndexabilityVerdict = canonicalUrl
      ? this.indexability.computeIndexability({
          surfaceKey: input.surfaceKey,
          requestedUrl: input.requestedUrl ?? canonicalUrl,
          canonicalUrl,
          availableFamilies: input.indexability?.availableFamilies,
          availableGammes: input.indexability?.availableGammes,
          r2Conditions: input.indexability?.r2Conditions,
        })
      : {
          robots: 'noindex,follow',
          blockingReasons: ['canonical_not_supported_in_pr2c'],
        };

    // 8. content blocks assembly
    const contentBlocks = this.blocks.buildBlocks({
      template,
      variants: variantsByAlias,
      links,
    });

    return {
      surfaceKey: input.surfaceKey,
      template,
      contentBlocks,
      policies: {
        canonical: canonicalUrl ?? '',
        robots: verdict.robots,
        blockingReasons: verdict.blockingReasons,
      },
      ariane: arianeOut ?? this.emptyAriane(input.surfaceKey),
      metadata: {
        surfaceKey: input.surfaceKey,
        templateId: templateRow
          ? this.computeTemplateId(input, templateRow)
          : null,
        variantIds: this.summarizeVariants(variantsByAlias),
        internalLinkCount: this.countLinks(links),
        chainVersion: SeoChainOrchestratorService.CHAIN_VERSION,
        renderedAt: new Date().toISOString(),
      },
    };
  }

  // ───────────────── helpers ─────────────────

  private async fetchVariants(
    input: SeoChainInput,
  ): Promise<Record<number, SwitchVariant | null>> {
    // PR-2c : on tire les alias usuels (1, 2, 3) sur ITEM_SWITCH si la surface
    // est R1/R3 catalogue. Les autres surfaces n'utilisent pas de switch dans
    // cette PR (R0/R7/R8 → wiring complet en PR-3+).
    const map: Record<number, SwitchVariant | null> = {};
    if (
      input.surfaceKey !== 'R1_GAMME_ROUTER' &&
      input.surfaceKey !== 'R1_GAMME_VEHICLE_ROUTER'
    ) {
      return map;
    }
    const aliases = [1, 2, 3];
    for (const alias of aliases) {
      try {
        const variant = await this.switchSelector.pickVariant({
          family: 'ITEM_SWITCH',
          where: { sis_pg_id: input.pgId },
          aliasColumn: 'sis_alias',
          alias,
          seed: {
            surfaceKey: input.surfaceKey,
            pgId: input.pgId,
            vehicleId: input.vehicleId ?? input.typeId,
            alias,
          },
        });
        map[alias] = variant;
      } catch (e) {
        this.logger.warn(
          `[SeoChainOrchestrator] pickVariant alias ${alias} échec : ${(e as Error).message}`,
        );
        map[alias] = null;
      }
    }
    return map;
  }

  private applyTemplateFields(
    input: SeoChainInput,
    templateRow: Record<string, unknown> | null,
  ): SeoChainTemplateData {
    const candidates: Record<string, [string, string, boolean]> = {
      title: ['sgc_title', 'sg_title', true],
      description: ['sgc_descrip', 'sg_descrip', true],
      h1: ['sgc_h1', 'sg_h1', false],
      preview: ['sgc_preview', 'sg_preview', true],
      content: ['sgc_content', 'sg_content', false],
    } as Record<string, [string, string, boolean]>;

    const out: SeoChainTemplateData = {
      title: '',
      description: '',
      h1: '',
      preview: '',
      content: '',
      keywords: this.buildKeywords(input.variables),
    };

    if (!templateRow) return out;

    for (const [field, [colA, colB, useMeta]] of Object.entries(candidates)) {
      const raw = String(
        (templateRow[colA] ?? templateRow[colB] ?? '') as string,
      );
      if (!raw) continue;
      out[field as keyof SeoChainTemplateData] = this.renderer.applyVariables({
        surfaceKey: input.surfaceKey,
        templateText: raw,
        variables: input.variables,
        pgId: input.pgId,
        typeId: input.typeId,
        useMeta,
        minPriceFormat: field === 'description' ? 'descrip' : 'title',
      });
    }

    return out;
  }

  private buildKeywords(v: TemplateVariables): string {
    return [
      v.gammeMeta,
      v.marqueMeta,
      v.modeleMeta,
      v.typeMeta,
      v.nbCh ? `${v.nbCh} ch` : '',
      v.annee,
      v.carosserie,
      v.fuel,
      v.codeMoteur,
    ]
      .filter(Boolean)
      .join(', ');
  }

  private extractMarkers(text: string): string[] {
    const set = new Set<string>();
    const re = /#LinkGamme(?:Car)?_\d+#/gi;
    for (const m of text.match(re) ?? []) set.add(m);
    return [...set];
  }

  private tryCanonical(input: SeoChainInput): string | null {
    try {
      return this.canonical.computeCanonical({
        surfaceKey: input.surfaceKey,
        ids: input.ids,
        baseUrl: input.baseUrl,
      });
    } catch {
      // Surfaces non couvertes en PR-2b (R3, R6, R2_LIST, …) : on ne casse pas
      // la chaîne, on renvoie null. Le verdict robots applique son default.
      return null;
    }
  }

  private computeTemplateId(
    input: SeoChainInput,
    row: Record<string, unknown>,
  ): string {
    const idVal = row.sgc_id ?? row.sg_id ?? row.sm_id ?? input.pgId;
    return `${input.surfaceKey}:${String(idVal)}`;
  }

  private summarizeVariants(
    variants: Record<number, SwitchVariant | null>,
  ): Record<string, string | number | null> {
    const out: Record<string, string | number | null> = {};
    for (const [alias, variant] of Object.entries(variants)) {
      if (!variant) {
        out[alias] = null;
        continue;
      }
      const id =
        (variant.sis_id as string | number | undefined) ??
        (variant.sgcs_id as string | number | undefined) ??
        (variant.sts_id as string | number | undefined) ??
        null;
      out[alias] = id ?? null;
    }
    return out;
  }

  private countLinks(links: Map<string, { isLink: boolean }>): number {
    let n = 0;
    for (const link of links.values()) if (link.isLink) n++;
    return n;
  }

  private emptyAriane(_surfaceKey: SurfaceKey): SeoChainOutput['ariane'] {
    return {
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [],
      },
      textTrail: '',
    } as SeoChainOutput['ariane'];
  }
}

// Re-export indexability verdict shape for convenience.
export type { IndexabilityVerdict };
