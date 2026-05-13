/**
 * ADR-059 Phase B PR-6b — Service de détection + persistence des conflits.
 *
 * Conflict policy (ADR-059 §Décision) :
 *  - "Apply only safe changes" : ajout fact nouveau OK ;
 *    modification valeur existante → push dans `__seo_projection_conflicts`
 *  - "Conflicts never auto-applied" : resolution='pending' par défaut
 *  - "No destructive update" : INSERT nouvelle version, UPDATE active_version_id ;
 *    ancienne row jamais touchée
 *
 * Ce service est intentionnellement minimal en PR-6b (skeleton). La logique
 * fine de diff entity-by-entity sera enrichie en PR-6b-followup si besoin.
 */
import { Injectable, Logger } from '@nestjs/common';

import { SupabaseBaseService } from '../../../database/services/supabase-base.service';

export type ConflictKind = 'fact_value_diff' | 'block_content_diff' | 'source_diff';

export interface ConflictRecord {
  entity_id: string;
  fact_key: string | null;
  block_key: string | null;
  current_value: unknown;
  proposed_value: unknown;
  reason: string;
  run_id: string;
}

@Injectable()
export class SeoProjectionConflictService extends SupabaseBaseService {
  private readonly conflictLogger = new Logger(SeoProjectionConflictService.name);

  async recordConflict(record: ConflictRecord): Promise<void> {
    const { error } = await this.supabase
      .from('__seo_projection_conflicts')
      .insert({
        entity_id: record.entity_id,
        fact_key: record.fact_key,
        block_key: record.block_key,
        current_value: record.current_value,
        proposed_value: record.proposed_value,
        reason: record.reason,
        resolution: 'pending',
        run_id: record.run_id,
      });
    if (error) {
      this.conflictLogger.error(
        `failed to record conflict for ${record.entity_id}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Pure helper : décide kind du conflict depuis 2 valeurs (current/proposed).
   * Aucun side-effect, aucun LLM, aucune inférence sémantique.
   */
  classifyDiff(
    current: unknown,
    proposed: unknown,
    target: 'fact' | 'block' | 'source',
  ): { kind: 'safe_apply' | 'conflict'; conflict_kind?: ConflictKind } {
    if (current === undefined || current === null) {
      return { kind: 'safe_apply' };
    }
    if (JSON.stringify(current) === JSON.stringify(proposed)) {
      return { kind: 'safe_apply' };
    }
    const conflict_kind: ConflictKind =
      target === 'fact'
        ? 'fact_value_diff'
        : target === 'block'
          ? 'block_content_diff'
          : 'source_diff';
    return { kind: 'conflict', conflict_kind };
  }
}
