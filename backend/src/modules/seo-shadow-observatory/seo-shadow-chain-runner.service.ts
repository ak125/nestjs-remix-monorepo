import { Injectable, Logger } from '@nestjs/common';

import type { SurfaceKey } from '@repo/seo-role-contracts';

import { SeoChainOrchestratorService } from '@modules/seo/services/chain/seo-chain-orchestrator.service';

import {
  ChainSeoSnapshotSchema,
  type ChainSeoSnapshot,
  type ShadowObservationInput,
} from './types';

/**
 * Erreur dédiée — permet à l'observatory de distinguer un timeout chaîne
 * (compteur circuit breaker) d'une autre erreur (skip simple).
 */
export class SeoShadowChainTimeoutError extends Error {
  constructor() {
    super('SeoShadowChainRunner timeout');
    this.name = 'SeoShadowChainTimeoutError';
  }
}

/**
 * Adaptateur **unique** entre le module observatory et le `SeoModule`.
 *
 * - Convertit l'input shadow (générique) en `SeoChainInput` (orchestrateur).
 * - Applique un **timeout dur** (2s, cohérent timeouts RPC R7/R8) — sous
 *   slowdown Supabase, on évite l'accumulation de `setImmediate` callbacks.
 * - Valide la sortie via `ChainSeoSnapshotSchema` (output corrompu ⇒ throw,
 *   pas de diff bizarre persisté en `__seo_event_log`).
 *
 * Sampler / Normalizer / DiffEngine / Sink **n'importent rien** de SeoModule —
 * ils restent purs et testables en isolation.
 *
 * @see plan seo-v9 PR-6 §4.4
 */
@Injectable()
export class SeoShadowChainRunner {
  private readonly logger = new Logger(SeoShadowChainRunner.name);
  private static readonly TIMEOUT_MS = 2_000;
  private static readonly BASE_URL = 'https://www.automecanik.com';

  constructor(private readonly orchestrator: SeoChainOrchestratorService) {}

  async compute(input: ShadowObservationInput): Promise<ChainSeoSnapshot> {
    let timer: NodeJS.Timeout | undefined;
    const work = this.computeUnbounded(input);
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new SeoShadowChainTimeoutError()),
        SeoShadowChainRunner.TIMEOUT_MS,
      );
    });
    try {
      return await Promise.race([work, timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private async computeUnbounded(
    input: ShadowObservationInput,
  ): Promise<ChainSeoSnapshot> {
    const chainInput = this.adaptInput(input);
    const out = await this.orchestrator.run(chainInput);
    return ChainSeoSnapshotSchema.parse({
      title: out.template.title ?? null,
      description: out.template.description ?? null,
      h1: out.template.h1 ?? null,
      content: out.template.content ?? null,
      keywords: out.template.keywords ?? null,
      canonical: out.policies.canonical || null,
      robots: out.policies.robots ?? null,
    });
  }

  /**
   * Map l'input générique observatory vers le shape canonique orchestrateur.
   * Surface-specific extraction des `ids` / `pgId` / `typeId`.
   */
  private adaptInput(
    input: ShadowObservationInput,
  ): import('@modules/seo/services/chain/seo-chain-orchestrator.service').SeoChainInput {
    const { surface, ids, vars, requestUrl } = input;
    const variables = (vars ?? {}) as Record<string, string | number>;

    switch (surface) {
      case 'R7_BRAND_HUB':
        return {
          surfaceKey: surface,
          pgId: 0,
          typeId: 0,
          variables: variables as never,
          ids: { brandAlias: String(ids.brandAlias ?? '') },
          baseUrl: SeoShadowChainRunner.BASE_URL,
          requestedUrl: requestUrl,
          breadcrumbs: [],
          brandId: numericOrUndefined(ids.brandId),
        };

      case 'R8_VEHICLE':
        return {
          surfaceKey: surface,
          pgId: 0,
          typeId: numericOrZero(ids.typeId),
          vehicleId: numericOrUndefined(ids.typeId),
          variables: variables as never,
          ids: {
            brandAlias: String(ids.brandAlias ?? ''),
            modeleAlias: String(ids.modeleAlias ?? ''),
            typeAlias: String(ids.typeAlias ?? ''),
          },
          baseUrl: SeoShadowChainRunner.BASE_URL,
          requestedUrl: requestUrl,
          breadcrumbs: [],
          brandId: numericOrUndefined(ids.brandId),
        };

      case 'R1_GAMME_VEHICLE_ROUTER':
        // Retrofit rm-builder : ids/vars depuis `SeoContext` (cf. rm-builder.service.ts:598).
        return {
          surfaceKey: surface,
          pgId: numericOrZero(ids.pgId),
          typeId: numericOrZero(ids.typeId),
          vehicleId: numericOrUndefined(ids.typeId),
          variables: variables as never,
          ids: {
            gammeAlias: String(ids.gammeAlias ?? ''),
            marqueAlias: String(ids.marqueAlias ?? ''),
            modeleAlias: String(ids.modeleAlias ?? ''),
            typeAlias: String(ids.typeAlias ?? ''),
          },
          baseUrl: SeoShadowChainRunner.BASE_URL,
          requestedUrl: requestUrl,
          breadcrumbs: [],
        };

      default:
        throw new SeoShadowSurfaceNotWiredError(surface);
    }
  }
}

export class SeoShadowSurfaceNotWiredError extends Error {
  constructor(surface: SurfaceKey) {
    super(
      `SeoShadowChainRunner: surface ${surface} non câblée (R7+R8 PR-6, R1_GAMME_VEHICLE_ROUTER retrofit RM)`,
    );
    this.name = 'SeoShadowSurfaceNotWiredError';
  }
}

function numericOrUndefined(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function numericOrZero(v: unknown): number {
  return numericOrUndefined(v) ?? 0;
}
