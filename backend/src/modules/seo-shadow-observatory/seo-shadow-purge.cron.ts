import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient, createClient } from '@supabase/supabase-js';

import { getEffectiveSupabaseKey } from '@common/utils';

/**
 * Purge quotidienne des observations shadow > 30 jours dans `__seo_event_log`.
 *
 * **Note ScheduleModule désactivé** dans le monorepo (conflit `@nestjs/schedule` v6
 * vs `@nestjs/common` v10 — cf. `app.module.ts:150-153`). Cette classe expose
 * `purgeOldEvents()` ; le déclenchement réel est fait :
 *   - soit par crontab système + curl sur un endpoint admin (pattern actuel
 *     pour les autres jobs SEO — cf. `quality-history-snapshot.service.ts`),
 *   - soit automatiquement via le décorateur `@Cron` quand ScheduleModule
 *     sera ré-activé.
 *
 * **Garanties** :
 *   - `READ_ONLY=true` → no-op silencieux (gate au processor, **pas** au
 *     scheduler — cf. mémoire `feedback_readonly_gate_at_processor_not_scheduler`).
 *   - WHERE clause cible **strictement** `payload->>'subtype' LIKE 'seo.shadow.%.divergence'`
 *     ; ne touche aucun autre consommateur de `__seo_event_log`.
 *   - Cutoff = `now - 30 jours` (au-delà l'historique n'éclaire plus une décision).
 *   - Échec Supabase loggué mais n'interrompt pas le scheduler — retentera
 *     demain.
 *
 * @see plan seo-v9 PR-6 §5.4a
 */
@Injectable()
export class SeoShadowPurgeCron {
  private readonly logger = new Logger(SeoShadowPurgeCron.name);
  private readonly supabase: SupabaseClient;
  private static readonly RETENTION_DAYS = 30;
  private static readonly TABLE = '__seo_event_log';

  constructor(private readonly cfg: ConfigService) {
    const url = cfg.get<string>('SUPABASE_URL') ?? '';
    const key = getEffectiveSupabaseKey();
    this.supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  /**
   * Méthode appelable manuellement (admin endpoint) ou par cron externe.
   * Idempotente — exécutions multiples = même état final.
   */
  async purgeOldEvents(): Promise<{ deleted: number; skipped?: string }> {
    if (this.cfg.get<string>('READ_ONLY') === 'true') {
      this.logger.log('[SEO_SHADOW_PURGE] skipped — READ_ONLY=true');
      return { deleted: 0, skipped: 'read_only' };
    }
    const cutoff = new Date(
      Date.now() - SeoShadowPurgeCron.RETENTION_DAYS * 24 * 3600 * 1000,
    );
    const { data, error, count } = await this.supabase
      .from(SeoShadowPurgeCron.TABLE)
      .delete({ count: 'exact' })
      .like('payload->>subtype', 'seo.shadow.%.divergence')
      .lt('created_at', cutoff.toISOString())
      .select('id');
    if (error) {
      this.logger.error(
        `[SEO_SHADOW_PURGE] failed: ${error.message}`,
        error.stack,
      );
      return { deleted: 0 };
    }
    const deleted = count ?? data?.length ?? 0;
    this.logger.log(
      `[SEO_SHADOW_PURGE] removed ${deleted} rows older than ${SeoShadowPurgeCron.RETENTION_DAYS}d`,
    );
    return { deleted };
  }
}
