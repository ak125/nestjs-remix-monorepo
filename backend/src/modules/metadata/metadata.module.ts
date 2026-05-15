/**
 * 🔍 METADATA MODULE - Module de Métadonnées Optimisé
 *
 * ✅ MISSION : "Vérifier existant et utiliser le meilleur"
 *
 * Architecture optimisée pour :
 * ✅ Services de métadonnées avancés
 * ✅ Breadcrumb intelligent (DB + génération auto)
 * ✅ Cache Redis intégré
 * ✅ Utilisation exclusive tables existantes (___meta_tags_ariane)
 * ✅ Extends SupabaseBaseService (pattern consolidé)
 * ✅ API REST complète
 * ✅ Schema.org pour SEO
 */

import { Module, Logger } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';

// Modules externes
import { DatabaseModule } from '../../database/database.module';
// PR-C — Governance gateway (OPA write authority for h1 field)
import { SeoGovernanceModule } from '../seo/governance/seo-governance.module';

// Services
import { OptimizedMetadataService } from './services/optimized-metadata.service';
import { OptimizedBreadcrumbService } from './services/optimized-breadcrumb.service';

// Controllers
import { OptimizedMetadataController } from './controllers/optimized-metadata.controller';
import { OptimizedBreadcrumbController } from './controllers/optimized-breadcrumb.controller';
import { BreadcrumbAdminController } from './controllers/breadcrumb-admin.controller';

@Module({
  imports: [
    // Cache pour performance optimale
    CacheModule.register({
      ttl: 3600, // 1 heure
      max: 1000, // Maximum 1000 entrées
    }),
    // Accès base de données
    DatabaseModule,
    // PR-C : OPA gateway for governed H1 writes
    SeoGovernanceModule,
  ],
  controllers: [
    OptimizedMetadataController,
    OptimizedBreadcrumbController,
    BreadcrumbAdminController,
  ],
  providers: [OptimizedMetadataService, OptimizedBreadcrumbService],
  exports: [
    // Exporté pour réutilisation dans d'autres modules
    OptimizedMetadataService,
    OptimizedBreadcrumbService,
  ],
})
export class MetadataModule {
  private readonly logger = new Logger(MetadataModule.name);

  constructor() {
    this.logger.log('MetadataModule initialisé - Services optimisés actifs');
  }
}
