/**
 * NavigationModule - Module de gestion de la navigation
 *
 * Aligné sur les meilleures pratiques du projet :
 * - Structure modulaire avec services spécialisés
 * - Cache intégré pour les performances (10 minutes TTL)
 * - Support multi-contextes (commercial, expedition, seo)
 * - Integration avec SupabaseModule existant
 * - Cohérent avec les patterns des autres modules (admin, orders, etc.)
 */

import { Module } from '@nestjs/common';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { NavigationController } from './navigation.controller';
import { NavigationService } from './navigation.service';
import { CommercialMenuService } from './services/commercial-menu.service';
import { ExpeditionMenuService } from './services/expedition-menu.service';
import { SeoMenuService } from './services/seo-menu.service';
import { DatabaseModule } from '../../database/database.module';
import { CacheModule } from '../../cache/cache.module';

@Module({
  imports: [
    DatabaseModule, // Utilise le module database existant du projet
    CacheModule, // Utilise le module cache personnalisé (cohérent avec admin.module)
    NestCacheModule.register({ ttl: 300, max: 100 }), // Cache pour CacheInterceptor
  ],
  controllers: [NavigationController],
  providers: [
    NavigationService,
    CommercialMenuService,
    ExpeditionMenuService,
    SeoMenuService,
  ],
  exports: [NavigationService], // Export pour réutilisation dans d'autres modules
})
export class NavigationModule {}
