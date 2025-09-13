# Guide d'Utilisation - ErrorLogService Optimisé

## 🎯 Introduction

Ce guide montre comment utiliser le service ErrorLogService amélioré. Le service offre **100% de compatibilité** avec votre code existant tout en ajoutant des fonctionnalités avancées.

## 📋 Utilisation Standard (Code Existant)

### 1. Initialisation
```typescript
import { ErrorLogService } from './error-log.service';
import { ConfigService } from '@nestjs/config';

// Exactement comme avant
const configService = new ConfigService();
const errorLogService = new ErrorLogService(configService);
```

### 2. Enregistrement d'Erreurs (Interface Originale)
```typescript
// Code utilisateur - FONCTIONNE EXACTEMENT COMME AVANT
await errorLogService.logError({
  code: 404,
  url: '/page-not-found',
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  ipAddress: '192.168.1.100',
  referrer: 'https://example.com/previous-page',
  userId: 'user-12345',
  sessionId: 'sess-abcdef123456',
  metadata: {
    query: { search: 'test' },
    timestamp: new Date().toISOString(),
    browser: 'Chrome'
  }
});

// Erreur 500 (Erreur serveur)
await errorLogService.logError({
  code: 500,
  url: '/api/data',
  userAgent: req.headers['user-agent'],
  ipAddress: req.ip,
  userId: req.user?.id,
  metadata: {
    error_details: 'Database connection failed',
    stack_trace: error.stack
  }
});

// Erreur 403 (Accès refusé)
await errorLogService.logError({
  code: 403,
  url: '/admin/dashboard',
  userAgent: req.headers['user-agent'],
  ipAddress: req.ip,
  userId: req.user?.id,
  metadata: {
    attempted_action: 'access_admin_panel',
    user_role: 'user'
  }
});
```

### 3. Récupération des Statistiques (Méthode Originale)
```typescript
// Statistiques sur une période - FONCTIONNE COMME AVANT
const startDate = new Date('2025-09-01');
const endDate = new Date('2025-09-10');

const statistics = await errorLogService.getErrorStatistics(startDate, endDate);
console.log('Statistiques d\'erreurs:', statistics);

// Exemple de retour:
// [
//   { error_code: '404', count: 25, url: '/missing-page' },
//   { error_code: '500', count: 3, url: '/api/data' },
//   { error_code: '403', count: 8, url: '/admin/dashboard' }
// ]
```

### 4. Erreurs Récentes (Méthode Originale)
```typescript
// Récupérer les 50 erreurs les plus récentes - FONCTIONNE COMME AVANT
const recentErrors = await errorLogService.getRecentErrors(50);
console.log('Erreurs récentes:', recentErrors);

// Récupérer les 100 erreurs les plus récentes
const moreRecentErrors = await errorLogService.getRecentErrors(100);
```

## 🚀 Nouvelles Fonctionnalités Avancées

### 1. Format ErrorLog Avancé
```typescript
// Nouveau format pour fonctionnalités avancées
await errorLogService.logError({
  msg_cst_id: 'user-12345',
  msg_subject: 'ERROR_BUSINESS',
  errorMetadata: {
    error_code: 'VALIDATION_FAILED',
    error_message: 'La validation des données du formulaire a échoué',
    severity: 'high',
    correlation_id: 'req-1694345567890-abc123',
    service_name: 'user-registration',
    environment: 'production',
    stack_trace: error.stack,
    additional_context: {
      validation_errors: [
        'email: Format invalide',
        'password: Trop court (minimum 8 caractères)',
        'phone: Numéro non valide'
      ],
      form_data: {
        email: 'invalid-email',
        password: '123',
        phone: 'abc'
      },
      user_browser: 'Chrome 118.0.0.0',
      user_os: 'Windows 10'
    }
  }
});

// Erreur technique détaillée
await errorLogService.logError({
  msg_cst_id: 'system',
  msg_subject: 'ERROR_SYSTEM',
  errorMetadata: {
    error_code: 'DATABASE_CONNECTION_TIMEOUT',
    error_message: 'Connexion à la base de données expirée après 30 secondes',
    severity: 'critical',
    correlation_id: 'sys-1694345567890-xyz789',
    service_name: 'database-connector',
    environment: 'production',
    stack_trace: error.stack,
    additional_context: {
      database_host: 'db.example.com',
      connection_pool_size: 20,
      active_connections: 18,
      timeout_duration: 30000,
      retry_attempts: 3,
      last_successful_query: '2025-09-10T14:30:25Z'
    }
  }
});
```

### 2. Récupération avec Pagination et Filtres
```typescript
// Récupération avancée avec filtres
const filteredErrors = await errorLogService.getErrors({
  page: 1,
  limit: 50,
  resolved: false,  // Uniquement erreurs non résolues
  startDate: new Date('2025-09-01'),
  endDate: new Date('2025-09-10'),
  severity: 'high',  // Sévérité spécifique
  subject: 'ERROR_404'  // Type d'erreur spécifique
});

console.log('Erreurs filtrées:', filteredErrors);
```

## 💡 Exemples d'Intégration dans Middleware

### 1. Middleware Express/NestJS
```typescript
// middleware/error-logging.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ErrorLogService } from '../services/error-log.service';

@Injectable()
export class ErrorLoggingMiddleware implements NestMiddleware {
  constructor(private readonly errorLogService: ErrorLogService) {}

  use(req: Request, res: Response, next: NextFunction) {
    // Intercepter les erreurs 404
    res.on('finish', async () => {
      if (res.statusCode === 404) {
        await this.errorLogService.logError({
          code: 404,
          url: req.url,
          userAgent: req.headers['user-agent'],
          ipAddress: req.ip,
          referrer: req.headers.referer,
          userId: req.user?.id,
          sessionId: req.sessionID,
          metadata: {
            method: req.method,
            query: req.query,
            body: req.method === 'POST' ? req.body : undefined,
            timestamp: new Date().toISOString()
          }
        });
      }
    });

    next();
  }
}
```

### 2. Exception Filter Global
```typescript
// filters/global-exception.filter.ts
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Response, Request } from 'express';
import { ErrorLogService } from '../services/error-log.service';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly errorLogService: ErrorLogService) {}

  async catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = exception instanceof HttpException 
      ? exception.getStatus() 
      : HttpStatus.INTERNAL_SERVER_ERROR;

    // Log avec l'interface originale
    await this.errorLogService.logError({
      code: status,
      url: request.url,
      userAgent: request.headers['user-agent'],
      ipAddress: request.ip,
      referrer: request.headers.referer,
      userId: request.user?.id,
      sessionId: request.sessionID,
      metadata: {
        method: request.method,
        exception_type: exception.constructor.name,
        error_message: exception instanceof HttpException ? exception.message : 'Internal server error',
        stack_trace: exception instanceof Error ? exception.stack : undefined,
        timestamp: new Date().toISOString()
      }
    });

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: exception instanceof HttpException ? exception.message : 'Internal server error'
    });
  }
}
```

## 📊 Monitoring et Analytics

### 1. Récupération de Métriques
```typescript
// Service de monitoring utilisant ErrorLogService
@Injectable()
export class ErrorMonitoringService {
  constructor(private readonly errorLogService: ErrorLogService) {}

  async getDailyErrorReport(date: Date) {
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    // Utilisation méthode originale
    const statistics = await this.errorLogService.getErrorStatistics(startDate, endDate);
    const recentErrors = await this.errorLogService.getRecentErrors(100);

    return {
      date: date.toDateString(),
      total_errors: statistics.reduce((sum, stat) => sum + stat.count, 0),
      error_breakdown: statistics,
      critical_errors: recentErrors.filter(error => 
        error.msg_content.includes('"severity":"critical"')
      ),
      top_error_urls: this.getTopErrorUrls(statistics)
    };
  }

  private getTopErrorUrls(statistics: any[]) {
    return statistics
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map(stat => ({
        url: stat.url,
        error_code: stat.error_code,
        count: stat.count
      }));
  }
}
```

### 2. Alertes Automatiques
```typescript
// Service d'alertes basé sur ErrorLogService
@Injectable()
export class ErrorAlertService {
  constructor(private readonly errorLogService: ErrorLogService) {}

  async checkErrorThresholds() {
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const now = new Date();

    // Statistiques des dernières 24h
    const stats = await this.errorLogService.getErrorStatistics(last24Hours, now);
    
    // Erreurs récentes pour analyse
    const recentErrors = await this.errorLogService.getRecentErrors(200);

    // Vérifications des seuils
    const criticalErrors = stats.filter(stat => 
      stat.error_code.startsWith('5') && stat.count > 10
    );

    const frequentErrors = stats.filter(stat => stat.count > 50);

    if (criticalErrors.length > 0) {
      await this.sendCriticalAlert(criticalErrors);
    }

    if (frequentErrors.length > 0) {
      await this.sendFrequencyAlert(frequentErrors);
    }
  }

  private async sendCriticalAlert(errors: any[]) {
    console.log('🚨 ALERTE CRITIQUE - Erreurs serveur détectées:', errors);
    // Intégration Slack, email, etc.
  }

  private async sendFrequencyAlert(errors: any[]) {
    console.log('⚠️ ALERTE FRÉQUENCE - Erreurs répétitives:', errors);
    // Intégration Slack, email, etc.
  }
}
```

## 🔧 Configuration et Déploiement

### 1. Module NestJS
```typescript
// error-logging.module.ts
import { Module } from '@nestjs/common';
import { ErrorLogService } from './error-log.service';
import { ErrorMonitoringService } from './error-monitoring.service';
import { ErrorAlertService } from './error-alert.service';

@Module({
  providers: [
    ErrorLogService,
    ErrorMonitoringService,
    ErrorAlertService
  ],
  exports: [
    ErrorLogService,
    ErrorMonitoringService,
    ErrorAlertService
  ]
})
export class ErrorLoggingModule {}
```

### 2. Configuration App Module
```typescript
// app.module.ts
import { Module, MiddlewareConsumer } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ErrorLoggingModule } from './error-logging/error-logging.module';
import { ErrorLoggingMiddleware } from './middleware/error-logging.middleware';
import { GlobalExceptionFilter } from './filters/global-exception.filter';

@Module({
  imports: [
    ErrorLoggingModule,
    // ... autres modules
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    // ... autres providers
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(ErrorLoggingMiddleware)
      .forRoutes('*');
  }
}
```

## ✅ Points Clés à Retenir

### 1. **Compatibilité Totale**
- Votre code existant fonctionne **exactement comme avant**
- Aucune modification nécessaire dans votre code actuel
- Toutes les méthodes `logError`, `getErrorStatistics`, `getRecentErrors` préservées

### 2. **Migration Progressive**
- Continuez à utiliser `ErrorLogEntry` pour l'existant
- Adoptez `ErrorLog` pour les nouvelles fonctionnalités
- Les deux formats coexistent parfaitement

### 3. **Monitoring Renforcé**
- Même données, meilleure structure
- Nouvelles possibilités d'analyse et alertes
- Performance optimisée avec table `___xtr_msg`

### 4. **Évolutivité**
- Architecture prête pour dashboard avancé
- Support IA/ML pour détection d'anomalies
- Intégration facile avec outils monitoring externes

---

## 📞 Support

Le service ErrorLogService optimisé maintient **100% de compatibilité** avec votre code existant tout en offrant des fonctionnalités enterprise modernes. Votre investissement code est entièrement préservé et enrichi.
