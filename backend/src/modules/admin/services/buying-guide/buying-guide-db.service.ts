import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '../../../../database/services/supabase-base.service';
import {
  MIN_VERIFIED_CONFIDENCE,
  MIN_QUALITY_SCORE,
  FAMILY_MARKERS,
} from '../../../../config/buying-guide-quality.constants';
import type { SectionValidationResult } from './buying-guide.types';
import { BuyingGuideSectionExtractor } from './buying-guide-section-extractor.service';

/**
 * Database operations for buying guide enrichment.
 * Extends SupabaseBaseService for direct DB access.
 */
@Injectable()
export class BuyingGuideDbService extends SupabaseBaseService {
  protected override readonly logger = new Logger(BuyingGuideDbService.name);

  constructor(configService: ConfigService) {
    super(configService);
  }

  async fetchGammeMetadata(
    pgId: string,
  ): Promise<{ gammeName: string; family: string; pgAlias: string } | null> {
    const { data, error } = await this.client
      .from('pieces_gamme')
      .select('pg_id, pg_name, pg_parent, pg_level, pg_alias')
      .eq('pg_id', pgId)
      .single();

    if (error || !data) {
      this.logger.warn(`Gamme metadata not found for pgId=${pgId}`);
      return null;
    }

    const gammeName = (data.pg_name as string) || 'cette pièce';

    // Infer family key from gamme name using FAMILY_MARKERS
    let family = 'unknown';
    const lower = gammeName.toLowerCase();
    for (const [key, markers] of Object.entries(FAMILY_MARKERS)) {
      if (markers.some((m) => lower.includes(m))) {
        family = key;
        break;
      }
    }

    const pgAlias = (data.pg_alias as string) || '';
    return { gammeName, family, pgAlias };
  }

  buildUpdatePayload(
    sections: Record<string, SectionValidationResult>,
    sourceUri: string,
    sourceRef: string,
    avgConfidence: number,
    qualityScore: number,
  ): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      sgpg_source_type: 'rag',
      sgpg_source_uri: sourceUri,
      sgpg_source_ref: sourceRef,
      sgpg_source_verified:
        avgConfidence >= MIN_VERIFIED_CONFIDENCE &&
        qualityScore >= MIN_QUALITY_SCORE,
      sgpg_source_verified_by: 'pipeline:rag-enrich',
      sgpg_source_verified_at: new Date().toISOString(),
    };

    // Map each OK section to its DB column
    for (const [key, result] of Object.entries(sections)) {
      if (!result.ok) continue;

      switch (key) {
        case 'intro_role':
          payload.sgpg_intro_role = result.content;
          break;
        case 'risk':
          if (typeof result.content === 'object' && result.content !== null) {
            const risk = result.content as {
              explanation: string;
              consequences: string[];
              costRange: string;
              conclusion: string;
            };
            payload.sgpg_risk_explanation = risk.explanation;
            payload.sgpg_risk_consequences = risk.consequences;
            payload.sgpg_risk_cost_range = risk.costRange;
            payload.sgpg_risk_conclusion = risk.conclusion;
          }
          break;
        case 'symptoms':
          payload.sgpg_symptoms = result.content;
          break;
        case 'selection_criteria':
          payload.sgpg_selection_criteria = result.content;
          break;
        case 'anti_mistakes':
          payload.sgpg_anti_mistakes = result.content;
          break;
        case 'decision_tree':
          payload.sgpg_decision_tree = result.content;
          break;
        case 'faq':
          payload.sgpg_faq = result.content;
          break;
        case 'how_to_choose':
          payload.sgpg_how_to_choose = result.content;
          break;
        case 'use_cases':
          payload.sgpg_use_cases = result.content;
          break;
      }
    }

    // Sanitize ARRAY columns before write (prevent QA flags, fragments, keywords leaking into data)
    if (Array.isArray(payload.sgpg_symptoms)) {
      payload.sgpg_symptoms = BuyingGuideSectionExtractor.sanitizeStringArray(
        payload.sgpg_symptoms,
      );
    }
    if (Array.isArray(payload.sgpg_anti_mistakes)) {
      payload.sgpg_anti_mistakes =
        BuyingGuideSectionExtractor.sanitizeStringArray(
          payload.sgpg_anti_mistakes,
        );
    }

    return payload;
  }

  async upsertBuyingGuide(
    pgId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    // Anti-regression guard: never overwrite longer content with shorter
    const longTextFields = [
      'sgpg_how_to_choose',
      'sgpg_intro_role',
      'sgpg_risk_explanation',
    ] as const;

    const fieldsToCheck = longTextFields.filter(
      (f) => typeof payload[f] === 'string',
    );

    if (fieldsToCheck.length > 0) {
      // Read existing field values directly — PostgREST does NOT support length() in .select()
      const { data: existing } = await this.client
        .from('__seo_gamme_purchase_guide')
        .select(fieldsToCheck.join(', '))
        .eq('sgpg_pg_id', pgId)
        .single();

      if (existing) {
        for (const field of fieldsToCheck) {
          const existingValue = (existing as Record<string, string | null>)[
            field
          ];
          const existingLen = existingValue?.length ?? 0;
          const newLen = (payload[field] as string).length;
          if (existingLen > 0 && newLen < existingLen * 0.5) {
            this.logger.warn(
              `Anti-regression BLOCKED: ${field} for pgId=${pgId} would shrink from ${existingLen}c to ${newLen}c (${Math.round((newLen / existingLen) * 100)}%). Skipping field.`,
            );
            delete payload[field];
          }
        }
      }
    }

    // Skip update if all fields were removed by anti-regression
    if (Object.keys(payload).length === 0) {
      this.logger.warn(
        `Anti-regression: all fields skipped for pgId=${pgId}, no update`,
      );
      return;
    }

    const { error } = await this.client
      .from('__seo_gamme_purchase_guide')
      .update(payload)
      .eq('sgpg_pg_id', pgId);

    if (error) {
      this.logger.error(
        `Failed to update buying guide for pgId=${pgId}: ${error.message}`,
      );
      throw new Error(`DB update failed: ${error.message}`);
    }

    this.logger.log(`Buying guide updated for pgId=${pgId}`);
  }
}
