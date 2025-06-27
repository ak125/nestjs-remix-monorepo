/**
 * MCP GENERATED SERVICE - RESELLER AUDIT
 * Généré automatiquement par MCP Context-7
 * Service: Audit et logging des actions revendeurs massdoc
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ResellerAuditService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService
  ) {}

  /**
   * Log d'une action revendeur pour audit complet
   */
  async logResellerAction(
    action: string, 
    resellerId: string, 
    data: any,
    request?: any
  ): Promise<void> {
    try {
      // Niveau d'audit configuré
      const auditLevel = this.configService.get<string>('AUDIT_LEVEL', 'full');
      
      if (auditLevel === 'none') {
        return; // Audit désactivé
      }

      const auditData = {
        resellerId,
        action,
        data: this.sanitizeAuditData(data, auditLevel),
        ip: request?.ip || 'unknown',
        userAgent: request?.headers?.['user-agent'] || 'unknown',
        timestamp: new Date(),
        module: 'massdoc',
        severity: this.getActionSeverity(action)
      };

      // Stockage en base
      await this.prisma.resellerAuditLog.create({
        data: auditData
      });

      // Log critique en temps réel si nécessaire
      if (auditData.severity === 'critical') {
        await this.sendCriticalAlert(auditData);
      }

    } catch (error) {
      // Log d'erreur sans faire échouer l'opération principale
      console.error('Erreur audit revendeur:', error.message);
    }
  }

  /**
   * Récupération des logs d'audit pour un revendeur
   */
  async getResellerAuditLogs(
    resellerId: string, 
    filters: {
      action?: string;
      dateFrom?: Date;
      dateTo?: Date;
      limit?: number;
      offset?: number;
    } = {}
  ) {
    const where: any = { resellerId };

    if (filters.action) {
      where.action = { contains: filters.action };
    }

    if (filters.dateFrom || filters.dateTo) {
      where.timestamp = {};
      if (filters.dateFrom) where.timestamp.gte = filters.dateFrom;
      if (filters.dateTo) where.timestamp.lte = filters.dateTo;
    }

    return this.prisma.resellerAuditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: filters.limit || 100,
      skip: filters.offset || 0
    });
  }

  /**
   * Statistiques d'utilisation massdoc pour un revendeur
   */
  async getResellerUsageStats(resellerId: string, days: number = 30) {
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);

    const stats = await this.prisma.resellerAuditLog.groupBy({
      by: ['action'],
      where: {
        resellerId,
        timestamp: { gte: dateFrom }
      },
      _count: {
        action: true
      }
    });

    return {
      period: `${days} derniers jours`,
      totalActions: stats.reduce((sum, stat) => sum + stat._count.action, 0),
      actionBreakdown: stats.map(stat => ({
        action: stat.action,
        count: stat._count.action
      })),
      generatedAt: new Date()
    };
  }

  /**
   * Détection d'activité suspecte
   */
  async detectSuspiciousActivity(resellerId: string) {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Vérifications d'activité suspecte
    const checks = await Promise.all([
      this.checkHighFrequencyActions(resellerId, oneHourAgo),
      this.checkUnusualTimeAccess(resellerId, oneHourAgo),
      this.checkMultipleIPAccess(resellerId, oneHourAgo),
      this.checkFailedActions(resellerId, oneHourAgo)
    ]);

    const suspiciousActivities = checks.filter(check => check.isSuspicious);

    if (suspiciousActivities.length > 0) {
      await this.logResellerAction(
        'security:suspicious_activity_detected',
        resellerId,
        { activities: suspiciousActivities }
      );
    }

    return {
      isSuspicious: suspiciousActivities.length > 0,
      activities: suspiciousActivities,
      riskLevel: this.calculateRiskLevel(suspiciousActivities)
    };
  }

  // Méthodes privées utilitaires

  private sanitizeAuditData(data: any, auditLevel: string): any {
    if (auditLevel === 'minimal') {
      // Ne garder que les informations essentielles
      return {
        action_type: data.action_type || 'unknown',
        resource_id: data.resourceId || data.id,
        timestamp: new Date()
      };
    }

    if (auditLevel === 'standard') {
      // Exclure les données sensibles
      const { password, token, secretKey, ...sanitized } = data;
      return sanitized;
    }

    // Full audit - tout garder
    return data;
  }

  private getActionSeverity(action: string): 'low' | 'medium' | 'high' | 'critical' {
    if (action.includes('error') || action.includes('failed')) {
      return 'high';
    }
    if (action.includes('security') || action.includes('suspicious')) {
      return 'critical';
    }
    if (action.includes('cart:validate') || action.includes('order')) {
      return 'medium';
    }
    return 'low';
  }

  private async sendCriticalAlert(auditData: any): Promise<void> {
    // Implémentation d'alerte en temps réel (email, Slack, etc.)
    console.warn('ALERTE CRITIQUE REVENDEUR:', {
      resellerId: auditData.resellerId,
      action: auditData.action,
      timestamp: auditData.timestamp
    });
  }

  private async checkHighFrequencyActions(resellerId: string, since: Date) {
    const actionCount = await this.prisma.resellerAuditLog.count({
      where: {
        resellerId,
        timestamp: { gte: since }
      }
    });

    return {
      type: 'high_frequency',
      isSuspicious: actionCount > 100, // Plus de 100 actions par heure
      details: { actionCount, threshold: 100 }
    };
  }

  private async checkUnusualTimeAccess(resellerId: string, since: Date) {
    const nightAccess = await this.prisma.resellerAuditLog.count({
      where: {
        resellerId,
        timestamp: { gte: since },
        // Accès entre 22h et 6h
        OR: [
          { timestamp: { gte: new Date(`${since.toDateString()} 22:00:00`) } },
          { timestamp: { lte: new Date(`${since.toDateString()} 06:00:00`) } }
        ]
      }
    });

    return {
      type: 'unusual_time',
      isSuspicious: nightAccess > 5,
      details: { nightAccessCount: nightAccess, threshold: 5 }
    };
  }

  private async checkMultipleIPAccess(resellerId: string, since: Date) {
    const uniqueIPs = await this.prisma.resellerAuditLog.findMany({
      where: {
        resellerId,
        timestamp: { gte: since }
      },
      select: { ip: true },
      distinct: ['ip']
    });

    return {
      type: 'multiple_ip',
      isSuspicious: uniqueIPs.length > 3,
      details: { uniqueIPCount: uniqueIPs.length, threshold: 3 }
    };
  }

  private async checkFailedActions(resellerId: string, since: Date) {
    const failedActions = await this.prisma.resellerAuditLog.count({
      where: {
        resellerId,
        timestamp: { gte: since },
        action: { contains: 'error' }
      }
    });

    return {
      type: 'failed_actions',
      isSuspicious: failedActions > 10,
      details: { failedActionCount: failedActions, threshold: 10 }
    };
  }

  private calculateRiskLevel(activities: any[]): 'low' | 'medium' | 'high' | 'critical' {
    if (activities.length === 0) return 'low';
    if (activities.length === 1) return 'medium';
    if (activities.length === 2) return 'high';
    return 'critical';
  }
}
