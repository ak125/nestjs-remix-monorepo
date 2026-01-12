import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { SubstitutionLogEntry, LockType } from '../types/substitution.types';

/**
 * SubstitutionLoggerService - Analytics du Moteur de Substitution
 *
 * Logging asynchrone pour ne pas bloquer les réponses.
 * Tracking: funnel 412, conversions, A/B testing.
 */
@Injectable()
export class SubstitutionLoggerService extends SupabaseBaseService {
  protected readonly logger = new Logger(SubstitutionLoggerService.name);

  constructor(configService: ConfigService) {
    super(configService);
  }

  /**
   * Log async - ne bloque pas la réponse
   * Fire and forget pattern
   */
  logAsync(entry: SubstitutionLogEntry): void {
    // Fire and forget - ne bloque pas la réponse
    setImmediate(async () => {
      try {
        await this.supabase.from('__substitution_logs').insert({
          original_url: entry.original_url,
          substitution_type: entry.substitution_type,
          lock_type: entry.lock_type,
          original_intent: entry.original_intent,
          substitute_content_id: entry.substitute_content_id,
          http_status_served: entry.http_status_served,
          user_agent: entry.user_agent,
          is_bot: entry.is_bot,
          created_at: entry.timestamp.toISOString(),
        });
      } catch (error) {
        // Ne pas faire échouer la requête principale pour un log
        this.logger.warn(`Failed to log substitution: ${error.message}`);
      }
    });
  }

  /**
   * Marquer un funnel comme complété
   * Appelé quand l'utilisateur résout le lock et accède au catalogue
   */
  async markFunnelCompleted(
    sessionId: string,
    timeToComplete: number,
    exitUrl: string,
  ): Promise<void> {
    try {
      await this.supabase
        .from('__substitution_logs')
        .update({
          completed: true,
          time_to_complete: timeToComplete,
          exit_url: exitUrl,
        })
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(1);
    } catch (error) {
      this.logger.warn(`Failed to mark funnel completed: ${error.message}`);
    }
  }

  /**
   * Enregistrer le préremplissage véhicule
   */
  async logVehiclePrefill(
    sessionId: string,
    prefillSource: 'url' | 'referer' | 'cookie' | 'history' | 'session',
  ): Promise<void> {
    try {
      await this.supabase
        .from('__substitution_logs')
        .update({
          vehicle_prefilled: true,
          prefill_source: prefillSource,
        })
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(1);
    } catch (error) {
      this.logger.warn(`Failed to log vehicle prefill: ${error.message}`);
    }
  }

  /**
   * Obtenir les stats du funnel par type de lock
   */
  async getFunnelStats(): Promise<{
    funnel: Record<
      LockType,
      { total: number; completed: number; rate: number }
    >;
  }> {
    try {
      const { data, error } = await this.supabase
        .from('v_substitution_funnel')
        .select('*');

      if (error) {
        this.logger.error(`Failed to get funnel stats: ${error.message}`);
        return { funnel: {} as any };
      }

      const funnel: Record<
        string,
        { total: number; completed: number; rate: number }
      > = {};
      for (const row of data || []) {
        funnel[row.lock_type] = {
          total: row.total_entries,
          completed: row.completions,
          rate: row.rate,
        };
      }

      return { funnel: funnel as any };
    } catch (error) {
      this.logger.error(`Exception getting funnel stats: ${error.message}`);
      return { funnel: {} as any };
    }
  }

  /**
   * Obtenir les stats quotidiennes
   */
  async getDailyStats(days: number = 30): Promise<{
    daily: Array<{
      day: string;
      status_200: number;
      status_404: number;
      status_410: number;
      status_412: number;
    }>;
  }> {
    try {
      const { data, error } = await this.supabase
        .from('v_substitution_daily')
        .select('*')
        .limit(days * 4); // 4 status codes par jour max

      if (error) {
        this.logger.error(`Failed to get daily stats: ${error.message}`);
        return { daily: [] };
      }

      // Grouper par jour
      const dailyMap = new Map<
        string,
        {
          status_200: number;
          status_404: number;
          status_410: number;
          status_412: number;
        }
      >();

      for (const row of data || []) {
        const day = row.day;
        if (!dailyMap.has(day)) {
          dailyMap.set(day, {
            status_200: 0,
            status_404: 0,
            status_410: 0,
            status_412: 0,
          });
        }
        const entry = dailyMap.get(day)!;
        switch (row.http_status_served) {
          case 200:
            entry.status_200 = row.count;
            break;
          case 404:
            entry.status_404 = row.count;
            break;
          case 410:
            entry.status_410 = row.count;
            break;
          case 412:
            entry.status_412 = row.count;
            break;
        }
      }

      const daily = Array.from(dailyMap.entries()).map(([day, stats]) => ({
        day,
        ...stats,
      }));

      return { daily };
    } catch (error) {
      this.logger.error(`Exception getting daily stats: ${error.message}`);
      return { daily: [] };
    }
  }

  /**
   * Obtenir les URLs les plus fréquentes par type
   */
  async getTopUrls(
    substitutionType: string,
    limit: number = 20,
  ): Promise<Array<{ url: string; count: number }>> {
    try {
      const { data, error } = await this.supabase
        .from('__substitution_logs')
        .select('original_url')
        .eq('substitution_type', substitutionType)
        .order('created_at', { ascending: false })
        .limit(1000);

      if (error) {
        this.logger.error(`Failed to get top URLs: ${error.message}`);
        return [];
      }

      // Compter manuellement (Supabase ne supporte pas GROUP BY directement)
      const urlCounts = new Map<string, number>();
      for (const row of data || []) {
        const url = row.original_url;
        urlCounts.set(url, (urlCounts.get(url) || 0) + 1);
      }

      return Array.from(urlCounts.entries())
        .map(([url, count]) => ({ url, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
    } catch (error) {
      this.logger.error(`Exception getting top URLs: ${error.message}`);
      return [];
    }
  }
}
