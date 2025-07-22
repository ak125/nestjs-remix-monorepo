import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SupabaseRestService,
  PaymentLogAction,
} from '../../../database/supabase-rest.service';

@Injectable()
export class PaymentAuditService {
  private readonly logger = new Logger(PaymentAuditService.name);

  constructor(
    private readonly supabaseService: SupabaseRestService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Enregistrer une action de paiement dans les logs
   * @param paymentId ID du paiement (peut être null pour les callbacks non associés)
   * @param action Action effectuée
   * @param data Données associées à l'action
   * @param ipAddress Adresse IP de l'origine (optionnel)
   * @param userAgent User-Agent (optionnel)
   */
  async logPaymentAction(
    paymentId: string | null,
    action: PaymentLogAction,
    data?: any,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    try {
      await this.supabaseService.createPaymentLog({
        log_pay_id: paymentId || undefined,
        log_action: action,
        log_data: data ? JSON.parse(JSON.stringify(data)) : null, // Sérialisation propre
        log_ip_address: ipAddress,
        log_user_agent: userAgent,
      });

      this.logger.debug(
        `Action loggée: ${action} pour paiement ${paymentId || 'N/A'}`,
      );
    } catch (error: any) {
      // Ne pas faire échouer la transaction principale si le log échoue
      this.logger.error(
        `Erreur lors du logging de l'action ${action}: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Récupérer l'historique des actions pour un paiement
   * @param paymentId ID du paiement
   * @returns Historique des actions
   */
  async getPaymentAuditTrail(paymentId: string) {
    try {
      return await this.supabaseService.getPaymentLogs(paymentId);
    } catch (error: any) {
      this.logger.error(
        `Erreur lors de la récupération de l'audit trail: ${error.message}`,
        error.stack,
      );
      return [];
    }
  }

  /**
   * Compter les tentatives de paiement par IP dans une période
   * @param ipAddress Adresse IP
   * @param minutes Période en minutes
   * @returns Nombre de tentatives
   */
  async countPaymentAttemptsByIP(
    ipAddress: string,
    minutes = 60,
  ): Promise<number> {
    try {
      return await this.supabaseService.countPaymentAttemptsByIP(
        ipAddress,
        minutes,
      );
    } catch (error: any) {
      this.logger.error(
        `Erreur lors du comptage des tentatives: ${error.message}`,
        error.stack,
      );
      return 0;
    }
  }

  /**
   * Détecter des patterns suspects dans les logs
   * @param paymentId ID du paiement
   * @returns Alerte de sécurité si pattern détecté
   */
  async detectSuspiciousActivity(paymentId: string): Promise<{
    isSuspicious: boolean;
    reasons: string[];
  }> {
    const reasons: string[] = [];

    try {
      const logs = await this.getPaymentAuditTrail(paymentId);

      // Vérifier les tentatives multiples de validation
      const validationAttempts = logs.filter(
        (log) => log.log_action === PaymentLogAction.SIGNATURE_VALIDATION,
      ).length;

      if (validationAttempts > 5) {
        reasons.push('Tentatives de validation excessive de signature');
      }

      // Vérifier les callbacks multiples
      const callbackAttempts = logs.filter(
        (log) => log.log_action === PaymentLogAction.CALLBACK_RECEIVED,
      ).length;

      if (callbackAttempts > 3) {
        reasons.push('Callbacks multiples reçus');
      }

      // Vérifier les changements de statut rapides
      const statusChanges = logs.filter((log) =>
        [
          PaymentLogAction.PAYMENT_SUCCESS,
          PaymentLogAction.PAYMENT_FAILED,
        ].includes(log.log_action as PaymentLogAction),
      );

      if (statusChanges.length > 2) {
        reasons.push('Changements de statut multiples');
      }

      // Log si activité suspecte détectée
      if (reasons.length > 0) {
        await this.logPaymentAction(paymentId, PaymentLogAction.BANK_RESPONSE, {
          suspicious_activity: reasons,
        });
      }

      return {
        isSuspicious: reasons.length > 0,
        reasons,
      };
    } catch (error: any) {
      this.logger.error(
        `Erreur lors de la détection d'activité suspecte: ${error.message}`,
        error.stack,
      );
      return { isSuspicious: false, reasons: [] };
    }
  }

  /**
   * Générer un rapport d'audit pour une période
   * @param startDate Date de début
   * @param endDate Date de fin
   * @returns Rapport d'audit
   */
  async generateAuditReport(startDate: Date, endDate: Date) {
    try {
      // Récupérer les statistiques de paiement pour la période
      const stats = await this.supabaseService.getPaymentStats(
        startDate.toISOString(),
        endDate.toISOString(),
      );

      return {
        period: { startDate, endDate },
        statistics: stats,
        summary: {
          totalPayments: stats?.total || 0,
          successfulPayments: stats?.successful || 0,
          failedPayments: stats?.failed || 0,
          successRate: stats?.successRate || '0.00',
          totalAmount: stats?.totalAmount || 0,
          suspiciousActivities: 0, // À implémenter avec une requête spécifique
        },
      };
    } catch (error: any) {
      this.logger.error(
        `Erreur lors de la génération du rapport d'audit: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Vérifier les limites de taux (rate limiting)
   * @param ipAddress Adresse IP
   * @param action Action à vérifier
   * @returns true si la limite est dépassée
   */
  async isRateLimitExceeded(
    ipAddress: string,
    action: PaymentLogAction,
  ): Promise<boolean> {
    try {
      const limits: Record<string, { max: number; window: number }> = {
        [PaymentLogAction.PAYMENT_INITIATED]: { max: 10, window: 60 }, // 10 tentatives par heure
        [PaymentLogAction.CALLBACK_RECEIVED]: { max: 20, window: 60 }, // 20 callbacks par heure
      };

      const limit = limits[action as string];
      if (!limit) return false;

      const attempts = await this.countPaymentAttemptsByIP(
        ipAddress,
        limit.window,
      );
      return attempts >= limit.max;
    } catch (error: any) {
      this.logger.error(
        `Erreur lors de la vérification du rate limiting: ${error.message}`,
      );
      return false;
    }
  }

  /**
   * Nettoyer les anciens logs (à exécuter périodiquement)
   * @param retentionDays Nombre de jours de rétention
   * @returns Nombre de logs supprimés (simulation)
   */
  async cleanupOldLogs(retentionDays = 365): Promise<number> {
    try {
      const cutoffDate = new Date(
        Date.now() - retentionDays * 24 * 60 * 60 * 1000,
      );

      // Note: Supabase REST API ne permet pas facilement les suppressions en masse
      // Il faudrait implémenter cela avec une fonction stored procedure
      this.logger.log(
        `Nettoyage simulé pour les logs antérieurs au ${cutoffDate.toISOString()}`,
      );

      return 0; // Retour simulé
    } catch (error: any) {
      this.logger.error(
        `Erreur lors du nettoyage des logs: ${error.message}`,
        error.stack,
      );
      return 0;
    }
  }
}
