/**
 * 🔗 MODULE SEO LINKING
 *
 * Regroupe tous les services de maillage interne SEO:
 * - InternalLinkingService: Logique centralisée des switches SEO (~106k liens)
 * - SeoLinkTrackingService: Analytics des clics sur liens internes
 * - BreadcrumbCacheService: Cache et génération des fils d'Ariane
 *
 * Ce module gère également le contrôleur SeoLinkTrackingController
 * pour les endpoints de tracking.
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

// Services de linking (import depuis seo/ pour compatibilité)
import { InternalLinkingService } from '../seo/internal-linking.service';
import { SeoLinkTrackingService } from '../seo/seo-link-tracking.service';
import { BreadcrumbCacheService } from '../seo/services/breadcrumb-cache.service';

// Contrôleur
import { SeoLinkTrackingController } from '../seo/seo-link-tracking.controller';

@Module({
  imports: [ConfigModule],

  controllers: [SeoLinkTrackingController],

  providers: [
    InternalLinkingService,
    SeoLinkTrackingService,
    BreadcrumbCacheService,
  ],

  exports: [
    InternalLinkingService,
    SeoLinkTrackingService,
    BreadcrumbCacheService,
  ],
})
export class SeoLinkingModule {}

// Re-export types for convenience
export {
  GammeCarSwitch,
  ProcessedLink,
  LinkInjectionResult,
} from '../seo/internal-linking.service';

export { LinkClickEvent } from '../seo/seo-link-tracking.service';

export { BreadcrumbItem } from '../seo/services/breadcrumb-cache.service';
