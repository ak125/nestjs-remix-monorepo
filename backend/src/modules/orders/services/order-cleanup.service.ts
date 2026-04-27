/**
 * Nettoyage périodique des tables d'idempotence et resume tokens.
 * - Toutes les 15 min : processing orphelins → failed
 * - Toutes les heures : purge expired idempotency + resume tokens
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SupabaseBaseService } from '@database/services/supabase-base.service';

@Injectable()
export class OrderCleanupService extends SupabaseBaseService {
  protected readonly logger = new Logger(OrderCleanupService.name);

  constructor() {
    super();
  }

  /**
   * Toutes les 15 min : marquer les processing orphelins comme failed.
   * Conditionné à order_id IS NULL + updated_at < 15 min (inactivité réelle).
   */
  @Cron('0 */15 * * * *')
  async cleanupOrphanProcessing(): Promise<void> {
    try {
      const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const { data, error } = await this.supabase
        .from('order_idempotency')
        .update({
          status: 'failed',
          updated_at: new Date().toISOString(),
        })
        .eq('status', 'processing')
        .is('order_id', null)
        .lt('updated_at', cutoff)
        .select('idempotency_key');

      if (error) {
        this.logger.error('Error cleaning up orphan processing:', error);
        return;
      }

      if (data && data.length > 0) {
        this.logger.log(
          `Cleaned ${data.length} orphan processing idempotency keys`,
        );
      }
    } catch (err) {
      this.logger.error('Cleanup orphan processing failed:', err);
    }
  }

  /**
   * Toutes les heures : purger les idempotency keys et resume tokens expirés.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async purgeExpired(): Promise<void> {
    try {
      const now = new Date().toISOString();

      // Purger idempotency keys expirées
      const { data: idemData } = await this.supabase
        .from('order_idempotency')
        .delete()
        .lt('expires_at', now)
        .select('idempotency_key');

      // Purger resume tokens expirés
      const { data: tokenData } = await this.supabase
        .from('order_resume_tokens')
        .delete()
        .lt('expires_at', now)
        .select('id');

      const idemCount = idemData?.length || 0;
      const tokenCount = tokenData?.length || 0;

      if (idemCount > 0 || tokenCount > 0) {
        this.logger.log(
          `Purged ${idemCount} expired idempotency keys, ${tokenCount} expired resume tokens`,
        );
      }
    } catch (err) {
      this.logger.error('Purge expired failed:', err);
    }
  }
}
