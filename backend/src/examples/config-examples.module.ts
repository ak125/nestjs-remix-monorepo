import { Module } from '@nestjs/common';
import { ConfigModule } from '../modules/config/config.module';

// Exemples d'utilisation
import { ExampleUsageService } from './enhanced-config-usage.example';
import { AnalyticsUsageExample } from './config-analytics-usage.example';
import { BreadcrumbUsageExample } from './breadcrumb-usage.example';
import { ValidationUsageExample } from './validation-usage.example';
import { EnhancedConfigExampleController } from './enhanced-config-controller.example';

@Module({
  imports: [
    // 🔧 Importer le module de configuration Enhanced
    ConfigModule.forRoot({
      environment: 'development',
      cacheTTL: 3600,
      enableValidation: true,
    }),
    
    // Ou pour la production:
    // ConfigModule.forProduction(),
    
    // Ou pour les tests:
    // ConfigModule.forTesting(),
  ],
  controllers: [
    EnhancedConfigExampleController,
  ],
  providers: [
    ExampleUsageService,
    AnalyticsUsageExample,
    BreadcrumbUsageExample,
    ValidationUsageExample,
  ],
  exports: [
    ExampleUsageService,
    AnalyticsUsageExample,
    BreadcrumbUsageExample,
    ValidationUsageExample,
  ],
})
export class ConfigExamplesModule {
  // 🚀 Ce module montre comment intégrer les services Enhanced Config
  // dans votre application
}

/**
 * 📚 GUIDE D'UTILISATION RAPIDE
 * 
 * 1. **Installation**
 *    - Importez ConfigModule dans votre app.module.ts
 *    - Choisissez le mode: forRoot(), forProduction(), forTesting()
 * 
 * 2. **Services disponibles**
 *    - EnhancedConfigService: Gestion avancée des configurations
 *    - ConfigAnalyticsService: Tracking et métriques
 *    - OptimizedBreadcrumbService: Navigation optimisée
 *    - ConfigValidationService: Validation Zod
 * 
 * 3. **Injection dans vos services**
 *    ```typescript
 *    constructor(
 *      private readonly configService: EnhancedConfigService,
 *      private readonly analyticsService: ConfigAnalyticsService,
 *    ) {}
 *    ```
 * 
 * 4. **APIs REST disponibles**
 *    - GET /api/enhanced-config - Liste des configurations
 *    - GET /api/enhanced-config/:key - Configuration spécifique
 *    - POST /api/enhanced-config - Créer une configuration
 *    - PUT /api/enhanced-config/:key - Mettre à jour
 *    - DELETE /api/enhanced-config/:key - Supprimer
 *    - GET /api/enhanced-config/analytics/metrics - Métriques
 *    - GET /api/enhanced-config/breadcrumb/:path - Breadcrumb
 * 
 * 5. **Validation automatique**
 *    - Tous les DTOs utilisent des schémas Zod
 *    - Validation des clés, valeurs, et métadonnées
 *    - Messages d'erreur français détaillés
 * 
 * 6. **Cache intelligent**
 *    - Cache Redis intégré avec TTL configurables
 *    - Invalidation automatique lors des modifications
 *    - Statistiques de cache hit rate
 * 
 * 7. **Analytics intégrés**
 *    - Tracking automatique de tous les événements
 *    - Métriques en temps réel
 *    - Données d'utilisation détaillées
 */