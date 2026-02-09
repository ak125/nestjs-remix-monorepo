/**
 * 📊 SERVICE D'ANALYTICS DES UPLOADS
 *
 * Collecte et analyse des statistiques d'upload
 * Reporting avancé et monitoring des performances
 */

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import {
  FileUploadResult,
  UploadType,
  UploadAnalytics,
} from '../dto/upload.dto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { DatabaseException, ErrorCodes } from '../../../common/exceptions';

export interface AnalyticsReport {
  period: {
    start: Date;
    end: Date;
  };
  summary: {
    totalUploads: number;
    totalSize: number;
    averageSize: number;
    successRate: number;
  };
  breakdown: {
    byType: Record<UploadType, number>;
    byMimeType: Record<string, number>;
    byExtension: Record<string, number>;
    bySize: {
      small: number; // < 1MB
      medium: number; // 1MB - 10MB
      large: number; // 10MB - 100MB
      extraLarge: number; // > 100MB
    };
  };
  performance: {
    averageUploadTime: number;
    slowestUpload: number;
    fastestUpload: number;
    peakHours: Array<{ hour: number; count: number }>;
  };
  errors: {
    total: number;
    byType: Record<string, number>;
    commonIssues: Array<{ issue: string; count: number }>;
  };
}

export interface RealTimeMetrics {
  activeUploads: number;
  queueLength: number;
  throughput: number; // MB/s
  errorRate: number; // %
  averageResponseTime: number; // ms
}

/** Typed shape for upload records from Supabase */
interface UploadRecord {
  id?: string;
  file_name?: string;
  original_name?: string;
  mime_type?: string;
  size?: number;
  upload_type?: string;
  upload_time?: number;
  success?: boolean;
  timestamp?: string;
  error_message?: string;
  user_id?: string;
}

@Injectable()
export class UploadAnalyticsService
  extends SupabaseBaseService
  implements OnModuleDestroy
{
  protected readonly logger = new Logger(UploadAnalyticsService.name);
  private readonly metricsCache = new Map<string, any>();
  private metricsInterval: ReturnType<typeof setInterval> | null = null;

  // Métriques en temps réel
  private realTimeMetrics: RealTimeMetrics = {
    activeUploads: 0,
    queueLength: 0,
    throughput: 0,
    errorRate: 0,
    averageResponseTime: 0,
  };

  constructor(
    protected configService: ConfigService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {
    super();
    this.logger.log('📊 UploadAnalyticsService initialized');
    this.initializeMetricsCollection();
  }

  /**
   * Enregistre une nouvelle analytics d'upload
   */
  async recordUpload(uploadResult: FileUploadResult): Promise<void> {
    try {
      const analytics: UploadAnalytics = {
        id: uploadResult.id,
        fileName: uploadResult.fileName,
        originalName: uploadResult.originalName,
        mimeType: uploadResult.mimeType,
        size: uploadResult.size,
        uploadType: uploadResult.metadata?.uploadType || UploadType.ATTACHMENT,
        uploadTime: uploadResult.metadata?.uploadTimeMs || 0,
        success: true,
        userId: uploadResult.metadata?.userId,
        sessionId: uploadResult.metadata?.sessionId,
        userAgent: uploadResult.metadata?.userAgent,
        ipAddress: uploadResult.metadata?.ipAddress,
        timestamp: uploadResult.uploadedAt,
      };

      // Enregistrement en base
      const { error } = await this.supabase
        .from('upload_analytics')
        .insert(analytics);

      if (error && error.code !== '42P01') {
        // Ignore si la table n'existe pas
        this.logger.warn(`Analytics recording failed: ${error.message}`);
      }

      // Mise à jour des métriques temps réel
      this.updateRealTimeMetrics(analytics);

      // Invalidation du cache
      await this.invalidateAnalyticsCache();

      this.logger.debug(`📈 Analytics recorded for ${uploadResult.fileName}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `❌ Failed to record analytics for ${uploadResult.fileName}:`,
        message,
      );
    }
  }

  /**
   * Enregistre un échec d'upload
   */
  async recordUploadFailure(
    fileName: string,
    error: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    try {
      const analytics: Partial<UploadAnalytics> = {
        id: `failed_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        fileName: fileName,
        originalName: fileName,
        uploadType: metadata?.uploadType || UploadType.ATTACHMENT,
        success: false,
        errorMessage: error,
        userId: metadata?.userId,
        sessionId: metadata?.sessionId,
        userAgent: metadata?.userAgent,
        ipAddress: metadata?.ipAddress,
        timestamp: new Date(),
      };

      const { error: insertError } = await this.supabase
        .from('upload_analytics')
        .insert(analytics);

      if (insertError && insertError.code !== '42P01') {
        this.logger.warn(
          `Analytics failure recording failed: ${insertError.message}`,
        );
      }

      // Mise à jour des métriques d'erreur
      this.realTimeMetrics.errorRate = await this.calculateErrorRate();

      this.logger.debug(`📉 Upload failure recorded: ${fileName}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `❌ Failed to record upload failure for ${fileName}:`,
        message,
      );
    }
  }

  /**
   * Génère un rapport d'analytics pour une période
   */
  async generateReport(
    startDate: Date,
    endDate: Date,
    cacheKey?: string,
  ): Promise<AnalyticsReport> {
    const cacheKeyToUse =
      cacheKey ||
      `analytics_report_${startDate.getTime()}_${endDate.getTime()}`;

    // Vérification du cache
    const cachedReport =
      await this.cacheManager.get<AnalyticsReport>(cacheKeyToUse);
    if (cachedReport) {
      this.logger.debug('📊 Returning cached analytics report');
      return cachedReport;
    }

    this.logger.log(
      `📊 Generating analytics report from ${startDate.toISOString()} to ${endDate.toISOString()}`,
    );

    try {
      // Récupération des données
      const { data: uploads, error } = await this.supabase
        .from('upload_analytics')
        .select('*')
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString())
        .order('timestamp', { ascending: false });

      if (error) {
        throw new DatabaseException({
          code: ErrorCodes.UPLOAD.ANALYTICS_FAILED,
          message: `Database query failed: ${error.message}`,
          details: error.message,
          cause: error instanceof Error ? error : new Error(String(error)),
        });
      }

      const typedUploads = (uploads ?? []) as UploadRecord[];

      const report = this.generateReportFromData(
        typedUploads,
        startDate,
        endDate,
      );

      // Cache du rapport (1 heure)
      await this.cacheManager.set(cacheKeyToUse, report, 3600000);

      this.logger.log(
        `✅ Analytics report generated with ${uploads?.length || 0} records`,
      );

      return report;
    } catch (error: unknown) {
      this.logger.error(`❌ Failed to generate analytics report:`, error);
      throw error;
    }
  }

  /**
   * Obtient les métriques temps réel
   */
  getRealTimeMetrics(): RealTimeMetrics {
    return { ...this.realTimeMetrics };
  }

  /**
   * Obtient les statistiques rapides (mise en cache)
   */
  async getQuickStats(): Promise<{
    todayUploads: number;
    totalSize: number;
    averageSize: number;
    topMimeTypes: Array<{ type: string; count: number }>;
  }> {
    const cacheKey = 'quick_stats';
    const cached = await this.cacheManager.get<any>(cacheKey);

    if (cached) {
      return cached;
    }

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data, error } = await this.supabase
        .from('upload_analytics')
        .select('size, mime_type')
        .gte('timestamp', today.toISOString())
        .eq('success', true);

      if (error) {
        throw new DatabaseException({
          code: ErrorCodes.UPLOAD.ANALYTICS_FAILED,
          message: `Quick stats query failed: ${error.message}`,
          details: error.message,
          cause: error instanceof Error ? error : new Error(String(error)),
        });
      }

      const uploads = data || [];
      const totalSize = uploads.reduce(
        (sum, upload) => sum + (upload.size || 0),
        0,
      );
      const averageSize = uploads.length > 0 ? totalSize / uploads.length : 0;

      // Top MIME types
      const mimeCount: Record<string, number> = {};
      uploads.forEach((upload) => {
        if (upload.mime_type) {
          mimeCount[upload.mime_type] = (mimeCount[upload.mime_type] || 0) + 1;
        }
      });

      const topMimeTypes = Object.entries(mimeCount)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([type, count]) => ({ type, count }));

      const stats = {
        todayUploads: uploads.length,
        totalSize,
        averageSize,
        topMimeTypes,
      };

      // Cache 5 minutes
      await this.cacheManager.set(cacheKey, stats, 300000);

      return stats;
    } catch (error: unknown) {
      this.logger.error('❌ Failed to get quick stats:', error);
      return {
        todayUploads: 0,
        totalSize: 0,
        averageSize: 0,
        topMimeTypes: [],
      };
    }
  }

  /**
   * Obtient les tendances d'usage
   */
  async getUsageTrends(days: number = 30): Promise<{
    daily: Array<{ date: string; uploads: number; size: number }>;
    growth: {
      uploadsGrowth: number; // %
      sizeGrowth: number; // %
    };
  }> {
    try {
      const endDate = new Date();
      const startDate = new Date(
        endDate.getTime() - days * 24 * 60 * 60 * 1000,
      );

      const { data, error } = await this.supabase
        .from('upload_analytics')
        .select('timestamp, size')
        .gte('timestamp', startDate.toISOString())
        .eq('success', true)
        .order('timestamp', { ascending: true });

      if (error) {
        throw new DatabaseException({
          code: ErrorCodes.UPLOAD.ANALYTICS_FAILED,
          message: `Trends query failed: ${error.message}`,
          details: error.message,
          cause: error instanceof Error ? error : new Error(String(error)),
        });
      }

      const uploads = (data ?? []) as UploadRecord[];
      const daily = this.aggregateByDay(uploads);
      const growth = this.calculateGrowthRates(daily);

      return { daily, growth };
    } catch (error: unknown) {
      this.logger.error('❌ Failed to get usage trends:', error);
      return {
        daily: [],
        growth: { uploadsGrowth: 0, sizeGrowth: 0 },
      };
    }
  }

  /**
   * Nettoie les anciennes données analytics
   */
  async cleanupOldData(retentionDays: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date(
        Date.now() - retentionDays * 24 * 60 * 60 * 1000,
      );

      const { data, error } = await this.supabase
        .from('upload_analytics')
        .delete()
        .lt('timestamp', cutoffDate.toISOString())
        .select('id');

      if (error) {
        throw new DatabaseException({
          code: ErrorCodes.UPLOAD.ANALYTICS_FAILED,
          message: `Cleanup failed: ${error.message}`,
          details: error.message,
          cause: error instanceof Error ? error : new Error(String(error)),
        });
      }

      const deletedCount = data?.length || 0;
      this.logger.log(
        `🧹 Cleaned up ${deletedCount} old analytics records (>${retentionDays} days)`,
      );

      return deletedCount;
    } catch (error: unknown) {
      this.logger.error('❌ Failed to cleanup old analytics data:', error);
      return 0;
    }
  }

  /**
   * Initialise la collecte de métriques
   */
  onModuleDestroy() {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
    this.metricsCache.clear();
    this.logger.log('UploadAnalyticsService destroyed, intervals cleared');
  }

  private initializeMetricsCollection(): void {
    // Mise à jour des métriques toutes les 30 secondes
    this.metricsInterval = setInterval(async () => {
      try {
        await this.updateAllMetrics();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn('Failed to update metrics:', message);
      }
    }, 30000);
  }

  /**
   * Met à jour toutes les métriques
   */
  private async updateAllMetrics(): Promise<void> {
    this.realTimeMetrics.errorRate = await this.calculateErrorRate();
    this.realTimeMetrics.averageResponseTime =
      await this.calculateAverageResponseTime();
  }

  /**
   * Met à jour les métriques temps réel
   */
  private updateRealTimeMetrics(analytics: UploadAnalytics): void {
    // Calcul du throughput
    if (analytics.uploadTime && analytics.size) {
      const throughput = analytics.size / (analytics.uploadTime / 1000); // bytes/sec
      this.realTimeMetrics.throughput = throughput / (1024 * 1024); // MB/s
    }
  }

  /**
   * Génère un rapport à partir des données
   */
  private generateReportFromData(
    uploads: UploadRecord[],
    startDate: Date,
    endDate: Date,
  ): AnalyticsReport {
    const successfulUploads = uploads.filter((u) => u.success);
    const failedUploads = uploads.filter((u) => !u.success);

    const summary = {
      totalUploads: uploads.length,
      totalSize: successfulUploads.reduce((sum, u) => sum + (u.size || 0), 0),
      averageSize:
        successfulUploads.length > 0
          ? successfulUploads.reduce((sum, u) => sum + (u.size || 0), 0) /
            successfulUploads.length
          : 0,
      successRate:
        uploads.length > 0
          ? (successfulUploads.length / uploads.length) * 100
          : 0,
    };

    // Breakdown par type
    const byType: Record<UploadType, number> = {} as Record<UploadType, number>;
    const byMimeType: Record<string, number> = {};
    const byExtension: Record<string, number> = {};

    successfulUploads.forEach((upload) => {
      // Par type
      const uploadType = upload.upload_type || UploadType.ATTACHMENT;
      byType[uploadType] = (byType[uploadType] || 0) + 1;

      // Par MIME type
      if (upload.mime_type) {
        byMimeType[upload.mime_type] = (byMimeType[upload.mime_type] || 0) + 1;
      }

      // Par extension
      const extension = upload.file_name?.split('.').pop()?.toLowerCase();
      if (extension) {
        byExtension[extension] = (byExtension[extension] || 0) + 1;
      }
    });

    // Breakdown par taille
    const bySize = {
      small: 0,
      medium: 0,
      large: 0,
      extraLarge: 0,
    };

    successfulUploads.forEach((upload) => {
      const size = upload.size || 0;
      if (size < 1024 * 1024) {
        bySize.small++;
      } else if (size < 10 * 1024 * 1024) {
        bySize.medium++;
      } else if (size < 100 * 1024 * 1024) {
        bySize.large++;
      } else {
        bySize.extraLarge++;
      }
    });

    // Performance
    const uploadTimes = successfulUploads
      .map((u) => u.upload_time)
      .filter((t) => t && t > 0);

    const performance = {
      averageUploadTime:
        uploadTimes.length > 0
          ? uploadTimes.reduce((sum, t) => sum + t, 0) / uploadTimes.length
          : 0,
      slowestUpload: Math.max(...uploadTimes, 0),
      fastestUpload: Math.min(...uploadTimes, 0),
      peakHours: this.calculatePeakHours(successfulUploads),
    };

    // Erreurs
    const errorTypes: Record<string, number> = {};
    failedUploads.forEach((upload) => {
      if (upload.error_message) {
        errorTypes[upload.error_message] =
          (errorTypes[upload.error_message] || 0) + 1;
      }
    });

    const errors = {
      total: failedUploads.length,
      byType: errorTypes,
      commonIssues: Object.entries(errorTypes)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([issue, count]) => ({ issue, count })),
    };

    return {
      period: { start: startDate, end: endDate },
      summary,
      breakdown: { byType, byMimeType, byExtension, bySize },
      performance,
      errors,
    };
  }

  /**
   * Calcule les heures de pointe
   */
  private calculatePeakHours(
    uploads: UploadRecord[],
  ): Array<{ hour: number; count: number }> {
    const hourCounts: Record<number, number> = {};

    uploads.forEach((upload) => {
      if (upload.timestamp) {
        const hour = new Date(upload.timestamp).getHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      }
    });

    return Object.entries(hourCounts)
      .map(([hour, count]) => ({ hour: parseInt(hour), count }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Calcule le taux d'erreur
   */
  private async calculateErrorRate(): Promise<number> {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      const { data, error } = await this.supabase
        .from('upload_analytics')
        .select('success')
        .gte('timestamp', oneHourAgo.toISOString());

      if (error || !data) return 0;

      const total = data.length;
      const failed = data.filter((d) => !d.success).length;

      return total > 0 ? (failed / total) * 100 : 0;
    } catch {
      return 0;
    }
  }

  /**
   * Calcule le temps de réponse moyen
   */
  private async calculateAverageResponseTime(): Promise<number> {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      const { data, error } = await this.supabase
        .from('upload_analytics')
        .select('upload_time')
        .gte('timestamp', oneHourAgo.toISOString())
        .eq('success', true)
        .not('upload_time', 'is', null);

      if (error || !data || data.length === 0) return 0;

      const totalTime = data.reduce((sum, d) => sum + (d.upload_time || 0), 0);
      return totalTime / data.length;
    } catch {
      return 0;
    }
  }

  /**
   * Agrège les données par jour
   */
  private aggregateByDay(
    uploads: UploadRecord[],
  ): Array<{ date: string; uploads: number; size: number }> {
    const daily: Record<string, { uploads: number; size: number }> = {};

    uploads.forEach((upload) => {
      const date = new Date(upload.timestamp).toISOString().split('T')[0];
      if (!daily[date]) {
        daily[date] = { uploads: 0, size: 0 };
      }
      daily[date].uploads++;
      daily[date].size += upload.size || 0;
    });

    return Object.entries(daily)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Calcule les taux de croissance
   */
  private calculateGrowthRates(
    daily: Array<{ uploads: number; size: number }>,
  ): {
    uploadsGrowth: number;
    sizeGrowth: number;
  } {
    if (daily.length < 2) {
      return { uploadsGrowth: 0, sizeGrowth: 0 };
    }

    const midPoint = Math.floor(daily.length / 2);
    const firstHalf = daily.slice(0, midPoint);
    const secondHalf = daily.slice(midPoint);

    const firstHalfUploads = firstHalf.reduce((sum, d) => sum + d.uploads, 0);
    const secondHalfUploads = secondHalf.reduce((sum, d) => sum + d.uploads, 0);
    const firstHalfSize = firstHalf.reduce((sum, d) => sum + d.size, 0);
    const secondHalfSize = secondHalf.reduce((sum, d) => sum + d.size, 0);

    const uploadsGrowth =
      firstHalfUploads > 0
        ? ((secondHalfUploads - firstHalfUploads) / firstHalfUploads) * 100
        : 0;
    const sizeGrowth =
      firstHalfSize > 0
        ? ((secondHalfSize - firstHalfSize) / firstHalfSize) * 100
        : 0;

    return { uploadsGrowth, sizeGrowth };
  }

  /**
   * Invalide le cache analytics
   */
  private async invalidateAnalyticsCache(): Promise<void> {
    try {
      await this.cacheManager.del('quick_stats');
      // Invalider d'autres clés de cache si nécessaire
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn('Failed to invalidate analytics cache:', message);
    }
  }
}
