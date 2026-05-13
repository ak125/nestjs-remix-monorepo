/**
 * ADR-059 Phase B PR-7a — SeoProjectionReadAdapter.
 *
 * Seul point d'accès lecture autorisé pour la projection runtime SEO.
 * **AUCUNE page R0-R8 ne lit `__seo_entity_*` directement** : tout passe
 * par cet adapter qui invoque la RPC SECURITY DEFINER `get_active_seo_projection`.
 *
 * Garde-fous architecturaux (ADR-059 §"No Direct Page SQL") :
 *  - Cet adapter est la SEULE surface autorisée pour lecture projection
 *  - Aucun `.from('__seo_entity_*')` direct ici (uniquement `.rpc(...)`)
 *  - Zod validation strict du payload retourné
 *  - 0 LLM, 0 write DB, 0 wiki canon write
 *
 * Future enrichissement (PR-7b ou followup) :
 *  - Cache Redis 5min advisory (lecture rapide pages)
 *  - GrowthBook feature flag `seo_projection_read_v1` avec circuit breaker
 *  - Fallback deterministic legacy si projection vide/RPC indisponible
 */
import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';

import { SupabaseBaseService } from '../../../database/services/supabase-base.service';


// ────────────────────────────────────────────────────────────────────────────
// Zod schemas — strict validation du payload RPC
// ────────────────────────────────────────────────────────────────────────────

const EntityIdSchema = z
  .string()
  .regex(/^(gamme|vehicle|constructeur|diagnostic):[a-z0-9][a-z0-9-]*[a-z0-9]$/);

const RoleSchema = z.string().regex(/^R[0-9]_[A-Z_]+$/).nullable();

const SourceSchema = z
  .object({
    id: z.string().nullable(),
    type: z.string().nullable(),
    confidence_base: z.number().min(0).max(1).nullable(),
    url: z.string().nullable(),
  })
  .strict();

const BlockSchema = z
  .object({
    role: z.string(),
    section: z.string().nullable(),
    content_md: z.string(),
    content_hash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  })
  .strict();

export const ProjectionPayloadSchema = z
  .object({
    entity_id: EntityIdSchema,
    entity_type: z.enum(['gamme', 'vehicle', 'constructeur', 'diagnostic']),
    slug: z.string(),
    projection_contract_version: z.string().regex(/^\d+\.\d+\.\d+$/),
    facts: z.record(z.string(), z.unknown()),
    blocks: z.array(BlockSchema),
    sources: z.array(SourceSchema),
    fetched_at: z.string(),
  })
  .strict();

export type ProjectionPayload = z.infer<typeof ProjectionPayloadSchema>;


// ────────────────────────────────────────────────────────────────────────────
// Adapter
// ────────────────────────────────────────────────────────────────────────────

export interface GetActiveProjectionOptions {
  /** Optional role filter (e.g. 'R3_CONSEILS'). NULL = all roles. */
  role?: string | null;
}

export interface ProjectionReadResult {
  status: 'success' | 'empty' | 'rpc_failed' | 'validation_failed';
  payload: ProjectionPayload | null;
  error: string | null;
}

@Injectable()
export class SeoProjectionReadAdapter extends SupabaseBaseService {
  private readonly readLogger = new Logger(SeoProjectionReadAdapter.name);

  /**
   * Lit la projection active pour une entité.
   *
   * @returns `ProjectionReadResult` typé. Status :
   *  - `success` : payload non vide
   *  - `empty` : projection inexistante (no facts + no blocks)
   *  - `rpc_failed` : RPC erreur (DB indisponible, permission, etc.)
   *  - `validation_failed` : payload retourné ne match pas le Zod schema (régression contract)
   *
   * Pour le caller (loader Remix / SSR) : `status==='success'` → render avec
   * payload ; autre status → fallback legacy path (PR-7b).
   */
  async getActiveProjection(
    entityId: string,
    options: GetActiveProjectionOptions = {},
  ): Promise<ProjectionReadResult> {
    // Validate input avant RPC (defense en profondeur — la RPC valide aussi)
    const idCheck = EntityIdSchema.safeParse(entityId);
    if (!idCheck.success) {
      return {
        status: 'validation_failed',
        payload: null,
        error: `invalid entity_id: ${entityId} (${idCheck.error.issues[0]?.message})`,
      };
    }
    if (options.role !== undefined && options.role !== null) {
      const roleCheck = RoleSchema.safeParse(options.role);
      if (!roleCheck.success) {
        return {
          status: 'validation_failed',
          payload: null,
          error: `invalid role: ${options.role}`,
        };
      }
    }

    const { data, error } = await this.supabase.rpc('get_active_seo_projection', {
      p_entity_id: entityId,
      p_role: options.role ?? null,
    });

    if (error) {
      this.readLogger.warn(
        `RPC get_active_seo_projection failed for ${entityId}: ${error.message}`,
      );
      return {
        status: 'rpc_failed',
        payload: null,
        error: error.message,
      };
    }

    const parsed = ProjectionPayloadSchema.safeParse(data);
    if (!parsed.success) {
      this.readLogger.error(
        `RPC payload validation failed for ${entityId}: ${parsed.error.issues
          .map((i) => i.message)
          .join('; ')}`,
      );
      return {
        status: 'validation_failed',
        payload: null,
        error: parsed.error.issues.map((i) => i.message).join('; '),
      };
    }

    const payload = parsed.data;
    const isEmpty =
      Object.keys(payload.facts).length === 0 && payload.blocks.length === 0;
    return {
      status: isEmpty ? 'empty' : 'success',
      payload,
      error: null,
    };
  }
}
