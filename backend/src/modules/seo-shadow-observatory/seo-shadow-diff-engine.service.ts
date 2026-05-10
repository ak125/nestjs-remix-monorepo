import { createHash } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import type { SurfaceKey } from '@repo/seo-role-contracts';

import type {
  ChainSeoSnapshot,
  DiffResult,
  FieldDiff,
  LegacySeoSnapshot,
} from './types';
import { SeoShadowUrlNormalizer } from './seo-shadow-url-normalizer.service';

const TEXT_FIELDS = [
  'title',
  'description',
  'h1',
  'content',
  'keywords',
] as const satisfies readonly FieldDiff['field'][];

/**
 * Compare un snapshot legacy ↔ chain et produit un diff field-level.
 *
 * Garanties :
 *   - Aucune URL canonical brute en sortie — uniquement des hashes 12 hex
 *     (cardinalité maîtrisée pour `__seo_event_log` + Loki).
 *   - Normalisation canonical avant comparaison (cf. UrlNormalizer).
 *   - **R8 canonical skip** : la frontend Remix R8 applique un redirect 301
 *     (`marque_alias-marque_id` mismatch) que le backend ne reproduit pas
 *     ; comparer les canonicals produirait une avalanche de faux positifs.
 *     On marque `equal=null` + `skip_reason='r8_frontend_redirect_logic_not_reproduced'`.
 *     `policy_divergence` R8 reste donc piloté par `robots_eq` uniquement.
 *
 * @see plan seo-v9 PR-6 §4.5 — limite connue R8.
 */
@Injectable()
export class SeoShadowDiffEngine {
  constructor(private readonly normalizer: SeoShadowUrlNormalizer) {}

  compare(
    legacy: LegacySeoSnapshot,
    chain: ChainSeoSnapshot,
    requestUrl: string,
    surface: SurfaceKey,
  ): DiffResult {
    const diffs: FieldDiff[] = [];

    for (const field of TEXT_FIELDS) {
      diffs.push(this.compareText(field, legacy[field], chain[field]));
    }

    diffs.push(this.compareCanonical(surface, legacy, chain, requestUrl));
    diffs.push(this.compareRobots(legacy.robots ?? null, chain.robots));

    const divergenceTypes = diffs
      .filter((d) => d.equal === false)
      .map((d) => d.field);

    const canonicalDiff = diffs.find((d) => d.field === 'canonical');
    const robotsDiff = diffs.find((d) => d.field === 'robots');
    const policyDivergence =
      canonicalDiff?.equal === false || robotsDiff?.equal === false;

    return {
      diffs,
      divergenceTypes,
      policyDivergence,
      summary: {
        surface,
        divergenceCount: divergenceTypes.length,
        divergenceTypes,
      },
    };
  }

  private compareText(
    field: (typeof TEXT_FIELDS)[number],
    legacy: string | null | undefined,
    chain: string | null,
  ): FieldDiff {
    const l = legacy ?? null;
    const c = chain ?? null;
    if (l === null && c === null) {
      return {
        field,
        equal: null,
        legacyHash: null,
        chainHash: null,
        legacyLen: null,
        chainLen: null,
      };
    }
    return {
      field,
      equal: l === c,
      legacyHash: hash(l),
      chainHash: hash(c),
      legacyLen: l !== null ? l.length : null,
      chainLen: c !== null ? c.length : null,
    };
  }

  private compareCanonical(
    surface: SurfaceKey,
    legacy: LegacySeoSnapshot,
    chain: ChainSeoSnapshot,
    requestUrl: string,
  ): FieldDiff {
    if (surface === 'R8_VEHICLE') {
      return {
        field: 'canonical',
        equal: null,
        legacyHash: null,
        chainHash: null,
        legacyLen: null,
        chainLen: null,
        skip_reason: 'r8_frontend_redirect_logic_not_reproduced',
      };
    }
    const legacyNorm = this.normalizer.reconstructLegacy(
      legacy.canonical ?? null,
      requestUrl,
    );
    const chainNorm = this.normalizer.normalize(chain.canonical);
    if (legacyNorm === null && chainNorm === null) {
      return {
        field: 'canonical',
        equal: null,
        legacyHash: null,
        chainHash: null,
        legacyLen: null,
        chainLen: null,
      };
    }
    return {
      field: 'canonical',
      equal: legacyNorm === chainNorm,
      legacyHash: hash(legacyNorm),
      chainHash: hash(chainNorm),
      legacyLen: legacyNorm !== null ? legacyNorm.length : null,
      chainLen: chainNorm !== null ? chainNorm.length : null,
    };
  }

  private compareRobots(
    legacy: string | null,
    chain: string | null,
  ): FieldDiff {
    if (legacy === null && chain === null) {
      return {
        field: 'robots',
        equal: null,
        legacyHash: null,
        chainHash: null,
        legacyLen: null,
        chainLen: null,
      };
    }
    if (legacy === null || chain === null) {
      // Un seul côté absent — non comparable, pas de policy_divergence.
      return {
        field: 'robots',
        equal: null,
        legacyHash: hash(legacy),
        chainHash: hash(chain),
        legacyLen: legacy !== null ? legacy.length : null,
        chainLen: chain !== null ? chain.length : null,
      };
    }
    const lNorm = legacy.replace(/\s+/g, '').toLowerCase();
    const cNorm = chain.replace(/\s+/g, '').toLowerCase();
    return {
      field: 'robots',
      equal: lNorm === cNorm,
      legacyHash: hash(legacy),
      chainHash: hash(chain),
      legacyLen: legacy.length,
      chainLen: chain.length,
    };
  }
}

function hash(value: string | null): string | null {
  if (value === null) return null;
  return createHash('sha256').update(value).digest('hex').slice(0, 12);
}
