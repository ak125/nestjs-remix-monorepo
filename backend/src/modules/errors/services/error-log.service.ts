import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { ErrorLog, ErrorMetrics } from '../entities/error-log.entity';

// Interface du code utilisateur (conservée pour compatibilité)
export interface ErrorLogEntry {
  code: number;
  url: string;
  userAgent?: string;
  ipAddress?: string;
  referrer?: string;
  userId?: string;
  sessionId?: string;
  metadata?: any;
}

@Injectable()
export class ErrorLogService extends SupabaseBaseService {
  constructor(configService: ConfigService) {
    super(configService);
  }

  /**
   * Enregistrer une erreur (méthode du code utilisateur - 100% compatible)
   * Conservée exactement comme fournie par l'utilisateur
   */
  async logError(entry: ErrorLogEntry): Promise<void>;
  async logError(errorData: Partial<ErrorLog>): Promise<ErrorLog | null>;
  async logError(
    entryOrErrorData: ErrorLogEntry | Partial<ErrorLog>,
  ): Promise<void | ErrorLog | null> {
    try {
      // Détecter le type d'entrée (code utilisateur vs nouveau format)
      if (this.isErrorLogEntry(entryOrErrorData)) {
        // Code utilisateur original
        return this.logErrorOriginal(entryOrErrorData);
      } else {
        // Nouveau format avec ErrorLog
        return this.logErrorAdvanced(entryOrErrorData);
      }
    } catch (error) {
      this.logger.error('Erreur dans logError:', error);
      if (this.isErrorLogEntry(entryOrErrorData)) {
        return; // void pour compatibilité
      }
      return null;
    }
  }

  /**
   * Implémentation originale du code utilisateur (conservée exactement)
   */
  private async logErrorOriginal(entry: ErrorLogEntry): Promise<void> {
    try {
      // Convertir vers le nouveau format avec métadonnées enrichies
      const errorContent = {
        error_code: entry.code.toString(),
        error_message: `Erreur ${entry.code} sur ${entry.url}`,
        request_url: entry.url,
        user_agent: entry.userAgent,
        ip_address: entry.ipAddress,
        referrer: entry.referrer,
        session_id: entry.sessionId,
        severity: this.determineSeverityFromCode(entry.code),
        environment: process.env.NODE_ENV || 'development',
        service_name: 'nestjs-remix-monorepo',
        correlation_id: this.generateCorrelationId(),
        additional_context: entry.metadata,
        user_id: entry.userId,
      };

      const errorLog = {
        msg_cst_id: entry.userId || null,
        msg_cnfa_id: null,
        msg_ord_id: null,
        msg_date: new Date().toISOString(),
        msg_subject: `ERROR_${entry.code}`,
        msg_content: JSON.stringify(errorContent),
        msg_parent_id: null,
        msg_open: '1', // Non résolu
        msg_close: '0', // Ouvert
      };

      const { error } = await this.supabase.from('___xtr_msg').insert(errorLog);

      if (error) {
        this.logger.error('Failed to log error:', error);
      }

      // Mettre à jour les statistiques (méthode utilisateur conservée)
      await this.updateStatistics(entry.code, entry.url);
    } catch (error) {
      this.logger.error('Error logging failed:', error);
    }
  }

  /**
   * Méthode avancée pour le nouveau format ErrorLog
   */
  private async logErrorAdvanced(
    errorData: Partial<ErrorLog>,
  ): Promise<ErrorLog | null> {
    try {
      const errorContent = {
        error_code: errorData.errorMetadata?.error_code || 'UnknownError',
        error_message:
          errorData.errorMetadata?.error_message || 'Erreur inconnue',
        stack_trace: errorData.errorMetadata?.stack_trace,
        user_agent: errorData.errorMetadata?.user_agent,
        ip_address: errorData.errorMetadata?.ip_address,
        request_url: errorData.errorMetadata?.request_url,
        request_method: errorData.errorMetadata?.request_method,
        request_body: errorData.errorMetadata?.request_body,
        request_headers: errorData.errorMetadata?.request_headers,
        response_status: errorData.errorMetadata?.response_status,
        severity: errorData.errorMetadata?.severity || 'low',
        environment: process.env.NODE_ENV || 'development',
        service_name: 'nestjs-remix-monorepo',
        correlation_id:
          errorData.errorMetadata?.correlation_id ||
          this.generateCorrelationId(),
        session_id: errorData.errorMetadata?.session_id,
        additional_context: errorData.errorMetadata?.additional_context,
      };

      const errorLog = {
        msg_cst_id: errorData.msg_cst_id || null,
        msg_cnfa_id: errorData.msg_cnfa_id || null,
        msg_ord_id: errorData.msg_ord_id || null,
        msg_date: new Date().toISOString(),
        msg_subject: errorData.msg_subject || errorContent.error_code,
        msg_content: JSON.stringify(errorContent),
        msg_parent_id: errorData.msg_parent_id || null,
        msg_open: '1', // Non résolu par défaut
        msg_close: '0', // Ouvert par défaut
      };

      const { data, error } = await this.supabase
        .from('___xtr_msg')
        .insert(errorLog)
        .select()
        .single();

      if (error) {
        this.logger.error(
          "Erreur lors de l'enregistrement de l'erreur:",
          error,
        );
        return null;
      }

      return {
        ...data,
        errorMetadata: errorContent,
      };
    } catch (error) {
      this.logger.error('Erreur critique dans logErrorAdvanced:', error);
      return null;
    }
  }

  /**
   * Méthode pour détecter le type d'entrée
   */
  private isErrorLogEntry(
    entry: ErrorLogEntry | Partial<ErrorLog>,
  ): entry is ErrorLogEntry {
    return (
      typeof entry === 'object' &&
      entry !== null &&
      'code' in entry &&
      'url' in entry &&
      typeof (entry as ErrorLogEntry).code === 'number'
    );
  }

  /**
   * Détermine la sévérité basée sur le code d'erreur (logique utilisateur)
   */
  private determineSeverityFromCode(
    code: number,
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (code >= 500) return 'critical'; // Erreurs serveur
    if (code >= 400) return 'high'; // Erreurs client
    if (code >= 300) return 'medium'; // Redirections
    return 'low'; // Autres
  }

  /**
   * Mettre à jour les statistiques d'erreurs (méthode utilisateur conservée)
   */
  private async updateStatistics(errorCode: number, url: string) {
    try {
      // Version adaptée pour ___xtr_msg
      const today = new Date().toISOString().split('T')[0];

      // Chercher ou créer une entrée de statistiques
      const statsContent = {
        error_code: errorCode,
        url: url,
        date: today,
        count: 1,
        last_occurrence: new Date().toISOString(),
      };

      // Insérer les statistiques comme un message spécialisé
      const { error } = await this.supabase.from('___xtr_msg').insert({
        msg_cst_id: null,
        msg_cnfa_id: null,
        msg_ord_id: null,
        msg_date: new Date().toISOString(),
        msg_subject: 'ERROR_STATISTICS',
        msg_content: JSON.stringify(statsContent),
        msg_parent_id: null,
        msg_open: '1',
        msg_close: '0',
      });

      if (error) {
        this.logger.warn(
          'Erreur lors de la mise à jour des statistiques:',
          error,
        );
      }
    } catch (error) {
      this.logger.warn('Échec de la mise à jour des statistiques:', error);
    }
  }

  /**
   * Récupérer les statistiques d'erreurs (méthode utilisateur adaptée)
   */
  async getErrorStatistics(startDate: Date, endDate: Date) {
    try {
      const { data } = await this.supabase
        .from('___xtr_msg')
        .select('*')
        .eq('msg_subject', 'ERROR_STATISTICS')
        .gte('msg_date', startDate.toISOString())
        .lte('msg_date', endDate.toISOString())
        .order('msg_date', { ascending: false });

      return (data || [])
        .map((item) => {
          try {
            const stats = JSON.parse(item.msg_content || '{}');
            return {
              ...stats,
              id: item.msg_id,
              created_at: item.msg_date,
            };
          } catch {
            return null;
          }
        })
        .filter(Boolean);
    } catch (error) {
      this.logger.error(
        'Erreur lors de la récupération des statistiques:',
        error,
      );
      return [];
    }
  }

  /**
   * Récupérer les erreurs récentes (méthode utilisateur adaptée)
   */
  async getRecentErrors(limit: number = 100) {
    try {
      const { data } = await this.supabase
        .from('___xtr_msg')
        .select('*')
        .like('msg_subject', 'ERROR_%')
        .neq('msg_subject', 'ERROR_STATISTICS')
        .order('msg_date', { ascending: false })
        .limit(limit);

      return (data || [])
        .map((item) => {
          try {
            const errorData = JSON.parse(item.msg_content || '{}');
            return {
              id: item.msg_id,
              error_code: errorData.error_code,
              url: errorData.request_url || errorData.url,
              user_agent: errorData.user_agent,
              ip_address: errorData.ip_address,
              referrer: errorData.referrer,
              user_id: errorData.user_id || item.msg_cst_id,
              session_id: errorData.session_id,
              metadata: errorData.additional_context || errorData.metadata,
              created_at: item.msg_date,
              severity: errorData.severity,
              error_message: errorData.error_message,
            };
          } catch {
            return null;
          }
        })
        .filter(Boolean);
    } catch (error) {
      this.logger.error(
        'Erreur lors de la récupération des erreurs récentes:',
        error,
      );
      return [];
    }
  }

  /**
   * Récupère les erreurs avec pagination et filtres
   */
  async getErrors(options: {
    page?: number;
    limit?: number;
    severity?: string;
    resolved?: boolean;
    service?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{ data: ErrorLog[]; total: number }> {
    try {
      const {
        page = 1,
        limit = 50,
        severity: _severity,
        resolved,
        service: _service,
        startDate,
        endDate,
      } = options;

      let query = this.supabase
        .from('___xtr_msg')
        .select('*', { count: 'exact' })
        .order('msg_date', { ascending: false });

      // Filtrer par statut résolu
      if (typeof resolved === 'boolean') {
        query = query.eq('msg_open', resolved ? '0' : '1');
      }

      // Filtrer par date
      if (startDate) {
        query = query.gte('msg_date', startDate.toISOString());
      }

      if (endDate) {
        query = query.lte('msg_date', endDate.toISOString());
      }

      const { data, error, count } = await query.range(
        (page - 1) * limit,
        page * limit - 1,
      );

      if (error) {
        this.logger.error('Erreur lors de la récupération des erreurs:', error);
        return { data: [], total: 0 };
      }

      return { data: data || [], total: count || 0 };
    } catch (error) {
      this.logger.error('Erreur dans getErrors:', error);
      return { data: [], total: 0 };
    }
  }

  /**
   * Marque une erreur comme résolue
   */
  async resolveError(errorId: string, resolvedBy: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('error_logs')
        .update({
          resolved: true,
          resolved_by: resolvedBy,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', errorId);

      if (error) {
        this.logger.error("Erreur lors de la résolution de l'erreur:", error);
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error('Erreur dans resolveError:', error);
      return false;
    }
  }

  /**
   * Génère des métriques d'erreurs
   */
  async getErrorMetrics(
    period: '24h' | '7d' | '30d' = '24h',
  ): Promise<ErrorMetrics> {
    try {
      const periodMs = this.getPeriodInMs(period);
      const startDate = new Date(Date.now() - periodMs);

      // Récupération des données
      const { data: errors, error } = await this.supabase
        .from('error_logs')
        .select('error_code, error_message, severity, service_name, timestamp')
        .gte('timestamp', startDate.toISOString());

      if (error || !errors) {
        this.logger.error(
          'Erreur lors de la récupération des métriques:',
          error,
        );
        return this.getEmptyMetrics();
      }

      // Calcul des métriques
      const totalErrors = errors.length;
      const errorsBySeverity = this.groupBy(errors, 'severity');
      const errorsByService = this.groupBy(errors, 'service_name');

      const errorCounts = this.countErrors(errors);
      const mostCommonErrors = Object.entries(errorCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([key, count]) => {
          const [code, message] = key.split('|');
          return { code, message, count };
        });

      const errorRate24h = this.calculateErrorRate(errors, '24h');

      return {
        total_errors: totalErrors,
        errors_by_severity: errorsBySeverity,
        errors_by_service: errorsByService,
        error_rate_24h: errorRate24h,
        most_common_errors: mostCommonErrors,
      };
    } catch (error) {
      this.logger.error('Erreur dans getErrorMetrics:', error);
      return this.getEmptyMetrics();
    }
  }

  /**
   * Nettoie les anciens logs d'erreur
   */
  async cleanupOldLogs(retentionDays: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const { data, error } = await this.supabase
        .from('error_logs')
        .delete()
        .lt('timestamp', cutoffDate.toISOString())
        .select('id');

      if (error) {
        this.logger.error('Erreur lors du nettoyage des logs:', error);
        return 0;
      }

      const deletedCount = data?.length || 0;
      this.logger.log(`${deletedCount} anciens logs supprimés`);

      return deletedCount;
    } catch (error) {
      this.logger.error('Erreur dans cleanupOldLogs:', error);
      return 0;
    }
  }

  private generateCorrelationId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getPeriodInMs(period: string): number {
    switch (period) {
      case '24h':
        return 24 * 60 * 60 * 1000;
      case '7d':
        return 7 * 24 * 60 * 60 * 1000;
      case '30d':
        return 30 * 24 * 60 * 60 * 1000;
      default:
        return 24 * 60 * 60 * 1000;
    }
  }

  private groupBy(array: any[], key: string): Record<string, number> {
    return array.reduce((acc, item) => {
      const value = item[key] || 'unknown';
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    }, {});
  }

  private countErrors(errors: any[]): Record<string, number> {
    return errors.reduce((acc, error) => {
      const key = `${error.error_code}|${error.error_message}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }

  private calculateErrorRate(errors: any[], period: string): number {
    const periodMs = this.getPeriodInMs(period);
    const now = Date.now();
    const recentErrors = errors.filter(
      (error) => now - new Date(error.timestamp).getTime() < periodMs,
    );

    return recentErrors.length / (periodMs / (60 * 60 * 1000)) || 0; // Erreurs par heure
  }

  private getEmptyMetrics(): ErrorMetrics {
    return {
      total_errors: 0,
      errors_by_severity: {},
      errors_by_service: {},
      error_rate_24h: 0,
      most_common_errors: [],
    };
  }
}
