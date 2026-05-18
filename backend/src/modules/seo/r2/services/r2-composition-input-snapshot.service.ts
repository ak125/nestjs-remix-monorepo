/**
 * ADR-066 — R2 Composition Input Snapshot Service
 *
 * Persists the **SoT** (Source of Truth) replay-safe input snapshot to
 * `__seo_r2_composition_inputs` table.
 *
 * Cf MEMORY feedback_seo_sot_is_composition_input_not_content :
 *   - SoT = INPUT of composition, NOT the generated content
 *   - 18 months later, can replay with new model/scoring without re-collecting R1+R8
 *
 * Hash deterministic via `fast-json-stable-stringify` AVANT sha256
 * (cf MEMORY feedback_deterministic_input_hash_canonical_json).
 *
 * Idempotent : UNIQUE(pg_id, type_id, input_hash) means same input → no-op.
 */

import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { SupabaseBaseService } from '../../../../database/services/supabase-base.service';
import type { R2CompositionInput } from '../schemas/r2-composition.schema';

/**
 * Deterministic JSON serializer (sorted keys, no whitespace).
 *
 * Inline implementation (10 lines) instead of external dep `fast-json-stable-stringify`
 * to keep PR 1 dep-light. Behavior identical for our use case (POJO with strings/numbers/
 * booleans/arrays/objects). Does NOT support Date, Map, Set, undefined — but our
 * R2CompositionInput schema is Zod-validated POJO so safe.
 *
 * Cf MEMORY feedback_deterministic_input_hash_canonical_json — clés triées AVANT
 * sha256, JAMAIS JSON.stringify natif (clés non ordonnées = bug silencieux).
 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map(stableStringify).join(',') + ']';
  }
  const keys = Object.keys(value as Record<string, unknown>).sort();
  const pairs = keys.map(
    (k) =>
      JSON.stringify(k) +
      ':' +
      stableStringify((value as Record<string, unknown>)[k]),
  );
  return '{' + pairs.join(',') + '}';
}

@Injectable()
export class R2CompositionInputSnapshotService extends SupabaseBaseService {
  protected readonly logger = new Logger(
    R2CompositionInputSnapshotService.name,
  );

  /**
   * Compute deterministic input_hash via fast-json-stable-stringify.
   * Sorted keys → same logical input always produces same hash.
   *
   * Pure function. Exposed for testing.
   */
  computeInputHash(input: R2CompositionInput): string {
    const canonical = stableStringify({
      r1: input.r1,
      r8: input.r8,
      motor: input.motor,
      cluster: input.cluster,
      catalogSignature: input.catalogSignature.signature,
    });
    return createHash('sha256').update(canonical).digest('hex');
  }

  /**
   * Snapshot input to DB. Idempotent via ON CONFLICT DO NOTHING.
   * Returns the input_hash (whether newly inserted or already existed).
   */
  async snapshot(input: R2CompositionInput): Promise<string> {
    const inputHash = this.computeInputHash(input);

    const { error } = await this.supabase
      .from('__seo_r2_composition_inputs')
      .insert({
        pg_id: input.pgId,
        type_id: input.typeId,
        input_hash: inputHash,
        r1_signals: input.r1,
        r8_signals: input.r8,
        motor_delta: input.motor,
        cluster_key: input.cluster.clusterKey,
        catalog_signature: input.catalogSignature.signature,
      })
      .select();

    // ON CONFLICT — unique violation is expected (idempotent), not an error.
    if (error && error.code !== '23505') {
      this.logger.error(
        `Snapshot failed for (${input.pgId}, ${input.typeId}): ${error.message}`,
      );
      throw new Error(`SoT snapshot failed: ${error.message}`);
    }

    return inputHash;
  }
}
