import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../database/services/supabase-base.service';
import { RedisCacheService } from '../../database/services/redis-cache.service';

export interface AccessLogEntry {
  user_id?: string;
  resource: string;
  action?: string;
  access_granted: boolean;
  denial_reason?: string;
  ip_address?: string;
  user_agent?: string;
  session_id?: string;
  execution_time_ms?: number;
  timestamp?: string;
}

@Injectable()
export class AccessLogService extends SupabaseBaseService {
  protected readonly logger = new Logger(AccessLogService.name);
  private readonly ACCESS_LOG_TABLE = '___AUTH_ACCESS_LOGS';

  constructor(private readonly cacheService: RedisCacheService) {
    super();
  }

  /**
   * Enregistrer un accès (autorisé ou refusé)
   */
  async logAccess(entry: AccessLogEntry): Promise<void> {
    try {
      // Préparer les données pour insertion
      const logData = {
        user_id: entry.user_id,
        resource: entry.resource,
        action: entry.action || 'read',
        access_granted: entry.access_granted,
        denial_reason: entry.denial_reason,
        ip_address: entry.ip_address,
        user_agent: entry.user_agent,
        session_id: entry.session_id,
        execution_time_ms: entry.execution_time_ms,
        timestamp: entry.timestamp || new Date().toISOString(),
        created_at: new Date().toISOString(),
      };

      // Insérer dans la base de données
      const { error } = await this.supabase
        .from(this.ACCESS_LOG_TABLE)
        .insert(logData);

      if (error) {
        this.logger.error(`Error logging access: ${error}`);
        return;
      }

      // Optionnel : Mettre en cache les accès récents pour analytics
      if (entry.user_id && entry.access_granted) {
        const cacheKey = `recent_access:${entry.user_id}`;
        const recentAccess = {
          resource: entry.resource,
          action: entry.action,
          timestamp: new Date().toISOString(),
        };

        // Ajouter à la liste des accès récents (maintenir les 10 derniers)
        await this.addToRecentAccessList(cacheKey, recentAccess);
      }

      // Logger pour debug
      this.logger.debug(
        `Access logged: user=${entry.user_id}, resource=${entry.resource}, granted=${entry.access_granted}`,
      );
    } catch (error) {
      this.logger.error(`Error in logAccess: ${error}`);
    }
  }

  /**
   * Récupérer les logs d'accès pour un utilisateur
   */
  async getUserAccessLogs(
    userId: string,
    limit: number = 50,
    startDate?: Date,
    endDate?: Date,
  ): Promise<AccessLogEntry[]> {
    try {
      let query = this.supabase
        .from(this.ACCESS_LOG_TABLE)
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (startDate) {
        query = query.gte('timestamp', startDate.toISOString());
      }

      if (endDate) {
        query = query.lte('timestamp', endDate.toISOString());
      }

      const { data, error } = await query;

      if (error) {
        this.logger.error(`Error fetching user access logs: ${error}`);
        return [];
      }

      return data || [];
    } catch (error) {
      this.logger.error(`Error in getUserAccessLogs: ${error}`);
      return [];
    }
  }

  /**
   * Récupérer les statistiques d'accès pour un utilisateur
   */
  async getUserAccessStats(
    userId: string,
    periodDays: number = 30,
  ): Promise<{
    totalAccesses: number;
    grantedAccesses: number;
    deniedAccesses: number;
    mostAccessedResources: Array<{ resource: string; count: number }>;
    recentDenials: AccessLogEntry[];
  }> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - periodDays);

      // Récupérer tous les logs pour la période
      const logs = await this.getUserAccessLogs(userId, 1000, startDate);

      // Calculer les statistiques
      const totalAccesses = logs.length;
      const grantedAccesses = logs.filter((log) => log.access_granted).length;
      const deniedAccesses = logs.filter((log) => !log.access_granted).length;

      // Ressources les plus accédées
      const resourceCounts: Record<string, number> = {};
      logs.forEach((log) => {
        if (log.access_granted) {
          resourceCounts[log.resource] = (resourceCounts[log.resource] || 0) + 1;
        }
      });

      const mostAccessedResources = Object.entries(resourceCounts)
        .map(([resource, count]) => ({ resource, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Refus récents
      const recentDenials = logs
        .filter((log) => !log.access_granted)
        .slice(0, 10);

      return {
        totalAccesses,
        grantedAccesses,
        deniedAccesses,
        mostAccessedResources,
        recentDenials,
      };
    } catch (error) {
      this.logger.error(`Error in getUserAccessStats: ${error}`);
      return {
        totalAccesses: 0,
        grantedAccesses: 0,
        deniedAccesses: 0,
        mostAccessedResources: [],
        recentDenials: [],
      };
    }
  }

  /**
   * Ajouter à la liste des accès récents en cache
   */
  private async addToRecentAccessList(
    cacheKey: string,
    access: { resource: string; action?: string; timestamp: string },
  ): Promise<void> {
    try {
      // Récupérer la liste actuelle
      const current = await this.cacheService.get(cacheKey);
      let recentList: Array<typeof access> = current ? JSON.parse(current) : [];

      // Ajouter le nouvel accès au début
      recentList.unshift(access);

      // Maintenir seulement les 10 derniers
      recentList = recentList.slice(0, 10);

      // Remettre en cache (1 heure)
      await this.cacheService.set(cacheKey, JSON.stringify(recentList), 3600);
    } catch (error) {
      this.logger.warn(`Error updating recent access list: ${error}`);
    }
  }

  /**
   * Nettoyer les anciens logs d'accès
   */
  async cleanOldAccessLogs(olderThanDays: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const { data, error } = await this.supabase
        .from(this.ACCESS_LOG_TABLE)
        .delete()
        .lt('timestamp', cutoffDate.toISOString());

      if (error) {
        this.logger.error(`Error cleaning old access logs: ${error}`);
        return 0;
      }

      const deletedCount = data?.length || 0;
      this.logger.log(
        `Cleaned ${deletedCount} access logs older than ${olderThanDays} days`,
      );
      return deletedCount;
    } catch (error) {
      this.logger.error(`Error in cleanOldAccessLogs: ${error}`);
      return 0;
    }
  }

  /**
   * Analyser les tentatives d'accès suspectes
   */
  async detectSuspiciousActivity(
    timeWindowMinutes: number = 60,
    maxAttemptsThreshold: number = 50,
  ): Promise<Array<{
    user_id: string;
    attempts: number;
    denialRate: number;
    resources: string[];
  }>> {
    try {
      const startTime = new Date();
      startTime.setMinutes(startTime.getMinutes() - timeWindowMinutes);

      // Récupérer les logs récents
      const { data: logs, error } = await this.supabase
        .from(this.ACCESS_LOG_TABLE)
        .select('*')
        .gte('timestamp', startTime.toISOString())
        .not('user_id', 'is', null);

      if (error || !logs) {
        this.logger.error(`Error fetching logs for suspicious activity: ${error}`);
        return [];
      }

      // Analyser par utilisateur
      const userActivity: Record<string, {
        total: number;
        denied: number;
        resources: Set<string>;
      }> = {};

      logs.forEach((log) => {
        const userId = log.user_id;
        if (!userActivity[userId]) {
          userActivity[userId] = {
            total: 0,
            denied: 0,
            resources: new Set(),
          };
        }

        userActivity[userId].total++;
        if (!log.access_granted) {
          userActivity[userId].denied++;
        }
        userActivity[userId].resources.add(log.resource);
      });

      // Filtrer les activités suspectes
      const suspicious = Object.entries(userActivity)
        .filter(([, activity]) => activity.total >= maxAttemptsThreshold)
        .map(([userId, activity]) => ({
          user_id: userId,
          attempts: activity.total,
          denialRate: activity.denied / activity.total,
          resources: Array.from(activity.resources),
        }))
        .filter(item => item.denialRate > 0.3) // Plus de 30% de refus
        .sort((a, b) => b.attempts - a.attempts);

      if (suspicious.length > 0) {
        this.logger.warn(
          `Detected ${suspicious.length} users with suspicious activity`,
        );
      }

      return suspicious;
    } catch (error) {
      this.logger.error(`Error in detectSuspiciousActivity: ${error}`);
      return [];
    }
  }
}
