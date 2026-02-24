/**
 * P3 Image Gates — 3 checks de coherence image
 *
 * - missing_og_image: pg_img absent ou invalide (source de l'OG social)
 * - missing_hero_policy_match: hero_policy non respectee pour le page type
 * - missing_alt_text: images dans le contenu HTML sans attribut alt
 *
 * Block-only: aucune repair strategy (les images ne sont pas auto-generables).
 *
 * @see .spec/00-canon/image-matrix-v1.md §5
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getImagePenalty } from '../../../config/buying-guide-quality.constants';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import type {
  ExtendedGateResult,
  HardGateName,
} from '../../../workers/types/content-refresh.types';

// ── Hero policy par page type (ref: image-matrix-v1.md §2) ──

const HERO_POLICY: Record<
  string,
  'photo' | 'gradient' | 'illustration' | 'none'
> = {
  R1_pieces: 'photo',
  R3_guide_achat: 'photo',
  R3_conseil: 'photo',
  R5_diagnostic: 'illustration',
  R6_panne: 'illustration',
  R4_reference: 'none',
};

// Images considered invalid (placeholder or missing)
const INVALID_IMAGES = new Set(['no.webp', '/images/pieces/default.png', '']);

// ── Regex for img tags ──
const IMG_TAG_REGEX = /<img\b[^>]*>/gi;
const ALT_ATTR_REGEX = /\balt\s*=\s*(?:"([^"]*)"|'([^']*)')/i;

@Injectable()
export class ImageGatesService extends SupabaseBaseService {
  protected override readonly logger = new Logger(ImageGatesService.name);

  constructor(configService: ConfigService) {
    super(configService);
  }

  // ── Public runner ──

  async runImageGates(
    pgId: number,
    pageType: string,
    content: string,
    pgImg?: string | null,
  ): Promise<ExtendedGateResult[]> {
    return [
      await this.checkOgImage(pgId, pageType, pgImg),
      this.checkHeroPolicyMatch(pageType, pgImg),
      this.checkAltText(content),
    ];
  }

  // ── Gate 1: missing_og_image ──

  private async checkOgImage(
    pgId: number,
    pageType: string,
    pgImg?: string | null,
  ): Promise<ExtendedGateResult> {
    // If pg_img was already passed, use it; otherwise query DB
    let resolvedImg = pgImg;

    if (resolvedImg === undefined && pgId > 0) {
      try {
        const { data } = await this.client
          .from('pieces_gamme')
          .select('pg_img')
          .eq('pg_id', pgId)
          .single();
        resolvedImg = data?.pg_img as string | null | undefined;
      } catch {
        // Non-blocking: DB failure should not crash gate
      }
    }

    const isValid = !!resolvedImg && !INVALID_IMAGES.has(resolvedImg);
    const penalty = getImagePenalty('MISSING_IMAGE', pageType);

    // R4_reference has 0 penalty — always PASS
    if (penalty === 0) {
      return this.makeResult(
        'missing_og_image',
        'PASS',
        0,
        ['No OG image required for this page type'],
        { warn: 0, fail: 1 },
      );
    }

    return this.makeResult(
      'missing_og_image',
      isValid ? 'PASS' : 'WARN',
      isValid ? 0 : 1,
      [
        isValid
          ? `OG image source: ${resolvedImg}`
          : `Missing or invalid pg_img: "${resolvedImg ?? 'null'}"`,
      ],
      { warn: 0, fail: 1 },
      isValid
        ? undefined
        : [
            {
              location: 'pg_img',
              issue: `pg_img absent ou invalide (${resolvedImg ?? 'null'})`,
            },
          ],
    );
  }

  // ── Gate 2: missing_hero_policy_match ──

  private checkHeroPolicyMatch(
    pageType: string,
    pgImg?: string | null,
  ): ExtendedGateResult {
    const policy = HERO_POLICY[pageType];

    // Unknown page type or non-photo policy → always PASS
    if (
      !policy ||
      policy === 'none' ||
      policy === 'illustration' ||
      policy === 'gradient'
    ) {
      return this.makeResult(
        'missing_hero_policy_match',
        'PASS',
        0,
        [`Hero policy "${policy || 'unknown'}" — no image required`],
        { warn: 0, fail: 1 },
      );
    }

    // policy = "photo" → needs a real image
    const hasImage = !!pgImg && !INVALID_IMAGES.has(pgImg);

    return this.makeResult(
      'missing_hero_policy_match',
      hasImage ? 'PASS' : 'WARN',
      hasImage ? 0 : 1,
      [
        hasImage
          ? `Hero photo policy satisfied: ${pgImg}`
          : `Hero policy "photo" requires pg_img but got "${pgImg ?? 'null'}"`,
      ],
      { warn: 0, fail: 1 },
      hasImage
        ? undefined
        : [
            {
              location: 'hero_policy',
              issue: `Policy "photo" non respectee — pg_img manquant`,
            },
          ],
    );
  }

  // ── Gate 3: missing_alt_text ──

  private checkAltText(content: string): ExtendedGateResult {
    const imgTags = content.match(IMG_TAG_REGEX) || [];

    if (imgTags.length === 0) {
      return this.makeResult(
        'missing_alt_text',
        'PASS',
        0,
        ['No images in content'],
        { warn: 1, fail: 3 },
      );
    }

    const missingAlt: Array<{ location: string; issue: string }> = [];

    for (const tag of imgTags) {
      const altMatch = tag.match(ALT_ATTR_REGEX);
      const altValue = altMatch ? (altMatch[1] ?? altMatch[2] ?? '') : '';

      if (!altValue.trim()) {
        // Extract src for location info
        const srcMatch = tag.match(/\bsrc\s*=\s*"([^"]*)"/i);
        const src = srcMatch?.[1] || 'unknown';
        missingAlt.push({
          location: src,
          issue: `Image sans alt text: ${tag.substring(0, 80)}...`,
        });
      }
    }

    const count = missingAlt.length;

    let verdict: ExtendedGateResult['verdict'] = 'PASS';
    if (count >= 3) verdict = 'FAIL';
    else if (count >= 1) verdict = 'WARN';

    return this.makeResult(
      'missing_alt_text',
      verdict,
      count,
      [`${count}/${imgTags.length} images sans alt text`],
      { warn: 1, fail: 3 },
      missingAlt.length > 0 ? missingAlt : undefined,
    );
  }

  // ── Helper ──

  private makeResult(
    gate: HardGateName,
    verdict: ExtendedGateResult['verdict'],
    measured: number,
    details: string[],
    thresholds: { warn: number; fail: number },
    triggerItems?: Array<{ location: string; issue: string }>,
  ): ExtendedGateResult {
    return {
      gate,
      verdict,
      details,
      measured,
      warnThreshold: thresholds.warn,
      failThreshold: thresholds.fail,
      ...(triggerItems && triggerItems.length > 0 ? { triggerItems } : {}),
    };
  }
}
