import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { EnhancedConfigService } from '../modules/config/services/enhanced-config.service';
import { ConfigAnalyticsService } from '../modules/config/services/config-analytics.service';

/**
 * 🚦 Intercepteur pour vérifier le mode maintenance
 */
@Injectable()
export class MaintenanceModeInterceptor implements NestInterceptor {
  constructor(
    private readonly configService: EnhancedConfigService,
    private readonly analyticsService: ConfigAnalyticsService,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // Vérifier le mode maintenance
    const maintenanceMode = await this.configService.get('app.maintenance_mode', false);
    
    if (maintenanceMode) {
      // Excepter certaines routes critiques
      const exemptPaths = ['/api/health', '/api/admin/maintenance'];
      if (!exemptPaths.some(path => request.url.startsWith(path))) {
        
        // Tracker l'accès bloqué
        await this.analyticsService.trackConfigEvent({
          type: 'config_access',
          category: 'maintenance',
          action: 'access_blocked',
          label: request.url,
          metadata: {
            url: request.url,
            method: request.method,
            userAgent: request.get('User-Agent'),
            ip: request.ip,
          },
        });

        throw new HttpException(
          {
            statusCode: 503,
            message: 'Application en maintenance',
            error: 'Service Unavailable',
            maintenanceMode: true,
          },
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
    }

    return next.handle().pipe(
      tap(() => {
        // Tracker les requêtes réussies
        this.trackSuccessfulRequest(request, response);
      }),
      catchError((error) => {
        // Tracker les erreurs
        this.trackErrorRequest(request, error);
        throw error;
      }),
    );
  }

  private async trackSuccessfulRequest(request: any, response: any) {
    await this.analyticsService.trackConfigEvent({
      type: 'config_access',
      category: 'api_access',
      action: 'request_success',
      label: request.url,
      metadata: {
        url: request.url,
        method: request.method,
        statusCode: response.statusCode,
        responseTime: Date.now() - request.startTime,
      },
    });
  }

  private async trackErrorRequest(request: any, error: any) {
    await this.analyticsService.trackConfigEvent({
      type: 'config_access',
      category: 'api_error',
      action: 'request_error',
      label: request.url,
      metadata: {
        url: request.url,
        method: request.method,
        error: error.message,
        statusCode: error.status || 500,
      },
    });
  }
}

/**
 * 🎚️ Intercepteur pour limiter le taux de requêtes basé sur configuration
 */
@Injectable()
export class RateLimitInterceptor implements NestInterceptor {
  private requestCounts = new Map<string, { count: number; resetTime: number }>();

  constructor(private readonly configService: EnhancedConfigService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const clientIp = request.ip;
    
    // Récupérer la limite depuis la configuration
    const rateLimit = await this.configService.get('api.rate_limit', 1000);
    const windowMs = await this.configService.get('api.rate_window', 3600000); // 1 heure

    const now = Date.now();
    const clientData = this.requestCounts.get(clientIp);

    if (!clientData || now > clientData.resetTime) {
      // Nouveau client ou fenêtre expirée
      this.requestCounts.set(clientIp, {
        count: 1,
        resetTime: now + windowMs,
      });
    } else {
      // Incrémenter le compteur
      clientData.count++;
      
      if (clientData.count > rateLimit) {
        throw new HttpException(
          {
            statusCode: 429,
            message: `Trop de requêtes. Limite: ${rateLimit} par heure`,
            error: 'Too Many Requests',
            resetTime: new Date(clientData.resetTime).toISOString(),
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    return next.handle();
  }
}

/**
 * 🎨 Intercepteur pour personnaliser les réponses basé sur configuration UI
 */
@Injectable()
export class UIConfigInterceptor implements NestInterceptor {
  constructor(private readonly configService: EnhancedConfigService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    
    // Récupérer la configuration UI
    const uiConfig = await this.configService.get('ui.theme_config', {});
    const features = await this.configService.getByCategory('features');

    return next.handle().pipe(
      tap((data) => {
        // Ajouter les configurations UI aux réponses
        if (data && typeof data === 'object') {
          data._uiConfig = {
            theme: uiConfig,
            features: features.reduce((acc, feature) => {
              acc[feature.key.replace('features.', '')] = feature.value;
              return acc;
            }, {}),
            timestamp: new Date().toISOString(),
          };
        }
      }),
    );
  }
}

/**
 * 🔐 Guard pour vérifier les permissions basées sur configuration
 */
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';

@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(private readonly configService: EnhancedConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const handler = context.getHandler();
    
    // Récupérer le nom de la feature depuis un décorateur (à implémenter)
    const featureName = Reflect.getMetadata('feature-flag', handler);
    
    if (!featureName) {
      return true; // Pas de feature flag définie
    }

    // Vérifier si la feature est activée
    const isEnabled = await this.configService.get(`features.${featureName}`, false);
    
    if (!isEnabled) {
      throw new HttpException(
        {
          statusCode: 403,
          message: `Feature '${featureName}' non disponible`,
          error: 'Feature Disabled',
          feature: featureName,
        },
        HttpStatus.FORBIDDEN,
      );
    }

    return true;
  }
}

/**
 * 🏷️ Décorateur pour marquer les features
 */
import { SetMetadata } from '@nestjs/common';

export const FeatureFlag = (feature: string) => SetMetadata('feature-flag', feature);

/**
 * 📊 Middleware pour collecter des métriques de performance
 */
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class PerformanceMetricsMiddleware implements NestMiddleware {
  constructor(
    private readonly configService: EnhancedConfigService,
    private readonly analyticsService: ConfigAnalyticsService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
    
    // Vérifier si les métriques sont activées
    const metricsEnabled = await this.configService.get('monitoring.performance_metrics', true);
    
    if (!metricsEnabled) {
      return next();
    }

    res.on('finish', async () => {
      const duration = Date.now() - startTime;
      
      // Seuil de performance configurable
      const slowThreshold = await this.configService.get('monitoring.slow_request_threshold', 1000);
      
      if (duration > slowThreshold) {
        // Tracker les requêtes lentes
        await this.analyticsService.trackConfigEvent({
          type: 'config_access',
          category: 'performance',
          action: 'slow_request',
          label: req.url,
          metadata: {
            url: req.url,
            method: req.method,
            duration,
            threshold: slowThreshold,
            statusCode: res.statusCode,
            userAgent: req.get('User-Agent'),
          },
        });
      }

      // Métriques générales
      await this.analyticsService.trackConfigEvent({
        type: 'config_access',
        category: 'performance',
        action: 'request_metrics',
        label: 'general',
        metadata: {
          url: req.url,
          method: req.method,
          duration,
          statusCode: res.statusCode,
          timestamp: new Date().toISOString(),
        },
      });
    });

    next();
  }
}