import { Injectable, Logger, Optional, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import {
  MIN_VERIFIED_CONFIDENCE,
  MIN_QUALITY_SCORE,
  FAMILY_MARKERS,
} from '../../../../config/buying-guide-quality.constants';
import type { SectionValidationResult } from './buying-guide.types';
import { BuyingGuideSectionExtractor } from './buying-guide-section-extractor.service';
import { FeatureFlagsService } from '../../../../config/feature-flags.service';
import { WriteGuardCasService } from '../../../../config/write-guard-cas.service';
import { WriteGuardLedgerService } from '../../../../config/write-guard-ledger.service';
import { getOwnedFieldsForGroup } from '../../../../config/field-catalog.constants';
import type { RoleId } from '../../../../config/role-ids';

/** Optional context for P1.5 Write Guard (observe mode first, enforce later) */
export interface WriteGuardContext {
  roleId: RoleId;
  correlationId: string;
  baseHash?: string;
}

/**
 * Database operations for buying guide enrichment.
 * Extends SupabaseBaseService for direct DB access.
 *
 * P1.5: When WriteGuard is enabled and context is provided,
 * performs ownership check + CAS + write receipt around the existing merge logic.
 * The merge logic itself is NEVER modified by the guard.
 */
@Injectable()
export class BuyingGuideDbService extends SupabaseBaseService {
  protected override readonly logger = new Logger(BuyingGuideDbService.name);

  constructor(
    configService: ConfigService,
    @Optional()
    @Inject(FeatureFlagsService)
    private readonly featureFlags?: FeatureFlagsService,
    @Optional()
    @Inject(WriteGuardCasService)
    private readonly casService?: WriteGuardCasService,
    @Optional()
    @Inject(WriteGuardLedgerService)
    private readonly ledger?: WriteGuardLedgerService,
  ) {
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
          // Quality gate: reject how_to_choose below 1000 chars
          if (
            typeof result.content === 'string' &&
            result.content.length < 1000
          ) {
            this.logger.warn(
              `QUALITY_GATE: R6 how_to_choose rejected (${result.content.length}c < 1000c minimum)`,
            );
            break; // skip writing this field
          }
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
    context?: WriteGuardContext,
  ): Promise<void> {
    // ── Intelligent merge: enrich, don't replace ──
    // For long text fields, we merge new content INTO existing content
    // instead of replacing it. The rule is:
    //   - If existing is empty → write new (first generation)
    //   - If new is longer → replace (genuine enrichment)
    //   - If new is shorter but adds unique content → append new paragraphs
    //   - If new is shorter and adds nothing → keep existing (anti-regression)
    const longTextFields = [
      'sgpg_how_to_choose',
      'sgpg_intro_role',
      'sgpg_risk_explanation',
      'sgpg_risk_conclusion',
      'sgpg_decision_tree',
      'sgpg_use_cases',
    ] as const;

    const fieldsToMerge = longTextFields.filter(
      (f) => typeof payload[f] === 'string',
    );

    if (fieldsToMerge.length > 0) {
      const { data: existing } = await this.client
        .from('__seo_gamme_purchase_guide')
        .select(fieldsToMerge.join(', '))
        .eq('sgpg_pg_id', pgId)
        .single();

      if (existing) {
        for (const field of fieldsToMerge) {
          const existingValue = (
            existing as unknown as Record<string, string | null>
          )[field];
          const existingLen = existingValue?.length ?? 0;
          const newValue = payload[field] as string;
          const newLen = newValue.length;

          if (existingLen === 0) {
            // First generation — write freely
            this.logger.log(
              `Enrich: ${field} pgId=${pgId} first write (${newLen}c)`,
            );
          } else if (newLen >= existingLen) {
            // New is longer or equal — genuine enrichment, replace
            this.logger.log(
              `Enrich: ${field} pgId=${pgId} upgraded ${existingLen}c → ${newLen}c (+${newLen - existingLen}c)`,
            );
          } else {
            // New is shorter — merge unique paragraphs from new into existing (never shrink)
            const merged = this.mergeTextContent(existingValue!, newValue);
            if (merged.length > existingLen) {
              // Merge added new content
              payload[field] = merged;
              this.logger.log(
                `Enrich: ${field} pgId=${pgId} merged ${existingLen}c + ${newLen}c → ${merged.length}c (+${merged.length - existingLen}c new paragraphs)`,
              );
            } else {
              // New content adds nothing unique — keep existing
              this.logger.warn(
                `Enrich: ${field} pgId=${pgId} new content (${newLen}c) adds nothing to existing (${existingLen}c). Keeping existing.`,
              );
              delete payload[field];
            }
          }
        }
      }
    }

    // ── Anti-regression for ARRAY fields ──
    // If the new array is drastically shorter than existing, keep existing.
    const arrayFields = [
      'sgpg_symptoms',
      'sgpg_anti_mistakes',
      'sgpg_selection_criteria',
      'sgpg_faq',
      'sgpg_risk_consequences',
    ] as const;

    const arrayFieldsInPayload = arrayFields.filter((f) =>
      Array.isArray(payload[f]),
    );

    if (arrayFieldsInPayload.length > 0) {
      const { data: existingArrays } = await this.client
        .from('__seo_gamme_purchase_guide')
        .select(arrayFieldsInPayload.join(', '))
        .eq('sgpg_pg_id', pgId)
        .single();

      if (existingArrays) {
        for (const field of arrayFieldsInPayload) {
          const existingArr = (
            existingArrays as unknown as Record<string, unknown[]>
          )[field];
          const newArr = payload[field] as unknown[];
          if (
            Array.isArray(existingArr) &&
            existingArr.length > 0 &&
            newArr.length < existingArr.length * 0.9
          ) {
            this.logger.warn(
              `Enrich: ${field} pgId=${pgId} array regression blocked ` +
                `(${existingArr.length} → ${newArr.length} items). Keeping existing.`,
            );
            delete payload[field];
          }
        }
      }
    }

    // Skip update if all fields were removed
    if (Object.keys(payload).length === 0) {
      this.logger.warn(
        `Enrich: all fields skipped for pgId=${pgId}, no update needed`,
      );
      return;
    }

    // ── P1.5 WriteGuard: ownership check + CAS (observe or enforce) ──
    const guardEnabled =
      this.featureFlags?.writeGuardEnabled &&
      this.casService &&
      this.ledger &&
      context?.roleId;

    if (guardEnabled && context) {
      // 1. Ownership check: are all payload fields owned by this role?
      const violations = this.casService!.checkOwnership(
        context.roleId,
        '__seo_gamme_purchase_guide',
        Object.keys(payload),
      );
      if (violations.length > 0) {
        for (const v of violations) {
          this.logger.warn(
            `WriteGuard: ownership_denied — role=${context.roleId} field=${v.field} owner=${v.declaredOwner}`,
          );
          await this.ledger!.recordCollision({
            pgId: parseInt(pgId),
            tableName: '__seo_gamme_purchase_guide',
            fieldName: v.field,
            resourceGroup: 'purchase_guide_main',
            requestingRole: context.roleId,
            ownerRole: v.declaredOwner,
            conflictReason: 'ownership_denied',
            resolution:
              this.featureFlags!.writeGuardMode === 'enforce'
                ? 'held'
                : 'allowed_observe_mode',
            correlationId: context.correlationId,
          });
        }
        if (this.featureFlags!.writeGuardMode === 'enforce') {
          // Strip non-owned fields instead of blocking entire write
          for (const v of violations) {
            delete payload[v.field];
          }
          if (Object.keys(payload).length === 0) {
            this.logger.warn(
              `WriteGuard: all fields stripped for pgId=${pgId}, no update`,
            );
            return;
          }
        }
      }

      // 2. CAS scoped: has my owned data changed since I read it?
      if (context.baseHash) {
        const casResult = await this.casService!.checkScoped(
          context.roleId,
          'purchase_guide_main',
          parseInt(pgId),
          context.baseHash,
        );
        if (!casResult.allowed) {
          this.logger.warn(
            `WriteGuard: stale_base — role=${context.roleId} pgId=${pgId} ` +
              `base=${context.baseHash.slice(0, 12)} current=${casResult.currentHash.slice(0, 12)}`,
          );
          await this.ledger!.recordCollision({
            pgId: parseInt(pgId),
            tableName: '__seo_gamme_purchase_guide',
            resourceGroup: 'purchase_guide_main',
            requestingRole: context.roleId,
            conflictReason: 'stale_base',
            baseHash: context.baseHash,
            currentHash: casResult.currentHash,
            resolution:
              this.featureFlags!.writeGuardMode === 'enforce'
                ? 'held'
                : 'allowed_observe_mode',
            correlationId: context.correlationId,
          });
          if (this.featureFlags!.writeGuardMode === 'enforce') {
            throw new Error(
              `WriteGuard: write blocked (stale_base) for pgId=${pgId}`,
            );
          }
        }
      }
    }

    // ── Existing write (UNCHANGED) ──
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

    // ── P1.5 WriteGuard: write receipt (post-write reread) ──
    if (guardEnabled && context) {
      try {
        const ownedFields = getOwnedFieldsForGroup(
          context.roleId,
          'purchase_guide_main',
        );
        const postWriteHash = await this.casService!.readAndHash(
          'purchase_guide_main',
          parseInt(pgId),
          ownedFields,
        );
        await this.ledger!.recordWriteReceipt({
          pgId: parseInt(pgId),
          tableName: '__seo_gamme_purchase_guide',
          resourceGroup: 'purchase_guide_main',
          roleId: context.roleId,
          correlationId: context.correlationId,
          baseHash: context.baseHash,
          newHash: postWriteHash,
          writeStrategy: 'merge',
          fields: ownedFields.map((f) => f.field),
        });
      } catch (receiptErr) {
        // Write receipt failure must NOT block the main write
        this.logger.error(
          `WriteGuard: receipt failed for pgId=${pgId}: ${(receiptErr as Error).message}`,
        );
      }
    }
  }

  /**
   * Merge new text content into existing, keeping existing paragraphs
   * and appending only unique new paragraphs.
   */
  private mergeTextContent(existing: string, incoming: string): string {
    // Split into paragraphs (double newline or <p> tags)
    const existingParas = existing
      .split(/\n\n|<\/p>\s*<p>/)
      .map((p) => p.trim())
      .filter(Boolean);
    const incomingParas = incoming
      .split(/\n\n|<\/p>\s*<p>/)
      .map((p) => p.trim())
      .filter(Boolean);

    // Normalize for comparison (lowercase, strip HTML, collapse whitespace)
    const normalize = (s: string) =>
      s
        .replace(/<[^>]*>/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();

    const existingNormalized = new Set(existingParas.map(normalize));

    // Find paragraphs in incoming that are NOT in existing (unique additions)
    const uniqueNew = incomingParas.filter((p) => {
      const norm = normalize(p);
      // Skip very short paragraphs (less than 30 chars normalized)
      if (norm.length < 30) return false;
      // Check if this paragraph already exists (fuzzy: first 50 chars match)
      const prefix = norm.substring(0, 50);
      return ![...existingNormalized].some((e) => e.startsWith(prefix));
    });

    if (uniqueNew.length === 0) return existing;

    // Append unique new paragraphs at the end
    return existing + '\n\n' + uniqueNew.join('\n\n');
  }
}
