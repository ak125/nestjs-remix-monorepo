/**
 * ADR-059 Phase B PR-6b — SeoProjectionRefreshProcessor.
 *
 * Workflow :
 *  1. Validate `RefreshJobData` (Zod strict)
 *  2. READ_ONLY gate au processor
 *  3. REFRESH MATERIALIZED VIEW CONCURRENTLY (hors-transaction, lock-free)
 *
 * Concurrency = 1 (single-flight, debounce coalescing géré côté queue via jobId).
 *
 * GARDE-FOU NON-NÉGOCIABLE :
 *  - JAMAIS d'INSERT/UPDATE projection tables ici (= write worker)
 *  - JAMAIS de logique de diff ou de conflits
 *  - JAMAIS d'écriture wiki
 *  - JAMAIS de REFRESH sans CONCURRENTLY (lock global interdit en prod)
 */
import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';

import { SupabaseBaseService } from '../../../database/services/supabase-base.service';

import {
  REFRESH_CONCURRENCY,
  SEO_PROJECTION_REFRESH_QUEUE,
} from './projection-contract.constants';
import {
  RefreshJobData,
  RefreshJobDataSchema,
  RefreshJobResult,
} from './dto/projection-job.dto';

function isReadOnly(): boolean {
  const v = process.env.READ_ONLY?.toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

/**
 * Liste fixe des MVs à refresh. Toute MV ajoutée dans le futur doit l'être ici
 * explicitement (pas de découverte runtime — déterminisme).
 */
export const SEO_PROJECTION_MATERIALIZED_VIEWS = [
  'mv_seo_entity_facts_current',
  'mv_seo_content_blocks_current',
] as const;

@Processor({ name: SEO_PROJECTION_REFRESH_QUEUE, concurrency: REFRESH_CONCURRENCY })
export class SeoProjectionRefreshProcessor extends SupabaseBaseService {
  private readonly refreshLogger = new Logger(SeoProjectionRefreshProcessor.name);

  @Process('refresh')
  async handleRefresh(job: Job<RefreshJobData>): Promise<RefreshJobResult> {
    const startedAt = Date.now();
    const parsed = RefreshJobDataSchema.safeParse(job.data);
    if (!parsed.success) {
      this.refreshLogger.error(
        `refresh job ${job.id} invalid payload: ${parsed.error.issues
          .map((i) => i.message)
          .join('; ')}`,
      );
      return {
        status: 'failed',
        refreshed_views: [],
        duration_ms: Date.now() - startedAt,
      };
    }

    if (isReadOnly()) {
      this.refreshLogger.warn(`refresh job ${job.id} skipped: READ_ONLY=true`);
      return {
        status: 'skipped_read_only',
        refreshed_views: [],
        duration_ms: Date.now() - startedAt,
      };
    }

    const refreshed: string[] = [];
    try {
      for (const view of SEO_PROJECTION_MATERIALIZED_VIEWS) {
        await this.refreshMaterializedViewConcurrently(view);
        refreshed.push(view);
      }
      return {
        status: 'success',
        refreshed_views: refreshed,
        duration_ms: Date.now() - startedAt,
      };
    } catch (err) {
      this.refreshLogger.error(
        `refresh job ${job.id} failed after ${refreshed.length} views: ${
          (err as Error).message
        }`,
      );
      return {
        status: 'failed',
        refreshed_views: refreshed,
        duration_ms: Date.now() - startedAt,
      };
    }
  }

  /**
   * Exécute `REFRESH MATERIALIZED VIEW CONCURRENTLY <mv>` via RPC dédiée.
   *
   * Supabase JS client ne supporte pas `.raw()` direct ; on délègue à une
   * fonction PL/pgSQL `refresh_seo_projection_mv(mv_name text)` à créer en
   * migration accompagnante (hors scope PR-6b strict — PR-6b-followup
   * ou ajout dans PR-6a si revue le demande).
   *
   * Pour PR-6b skeleton : on log l'intent ; l'implémentation effective de
   * la RPC SQL est différée. Le contrat de cette méthode reste stable.
   */
  private async refreshMaterializedViewConcurrently(viewName: string): Promise<void> {
    this.refreshLogger.log(
      `REFRESH MATERIALIZED VIEW CONCURRENTLY ${viewName} (skeleton — RPC backing pending)`,
    );
    // Note : appel RPC effectif lorsque la fonction SQL `refresh_seo_projection_mv`
    // sera disponible (PR-6b-followup migration).
    // await this.supabase.rpc('refresh_seo_projection_mv', { mv_name: viewName });
  }
}
