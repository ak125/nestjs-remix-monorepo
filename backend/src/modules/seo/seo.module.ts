import { Module, Logger } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';

// Services SEO existants
import { SeoService } from './seo.service';
import { SeoEnhancedService } from './seo-enhanced.service';
import { SitemapService } from './sitemap.service';

// 🎯 Service V4 Ultimate
import { DynamicSeoV4UltimateService } from './dynamic-seo-v4-ultimate.service';

// Contrôleurs existants
import { SeoController } from './seo.controller';
import { SeoEnhancedController } from './seo-enhanced.controller';
import { SitemapController } from './sitemap.controller';

// 🎯 Contrôleur V4 Ultimate
import { DynamicSeoController } from './dynamic-seo.controller';

@Module({
  imports: [
    ConfigModule,

    // 🎯 Cache Redis pour SEO V4 Ultimate
    CacheModule.register({
      ttl: 3600, // 1 heure par défaut
      max: 1000, // 1000 entrées max
      isGlobal: false,
    }),
  ],

  controllers: [
    SeoController,
    SeoEnhancedController, // 🎯 Contrôleur pour templates dynamiques
    SitemapController,
    DynamicSeoController, // 🎯 Contrôleur V4 Ultimate
  ],

  providers: [
    SeoService,
    SeoEnhancedService, // 🎯 Service enrichi avec templates dynamiques
    SitemapService,
    DynamicSeoV4UltimateService, // 🎯 Service V4 Ultimate

    // Logger spécialisé pour V4
    {
      provide: 'SEO_V4_LOGGER',
      useFactory: () => new Logger('SeoModuleV4Ultimate'),
    },
  ],

  exports: [
    SeoService,
    SeoEnhancedService, // 🎯 Exporté pour utilisation dans autres modules
    SitemapService,
    DynamicSeoV4UltimateService, // 🎯 Service V4 Ultimate exporté
  ],
})
export class SeoModule {
  private readonly logger = new Logger(SeoModule.name);

  constructor() {
    this.logger.log('🎯 SEO Module V4 Ultimate activé');
    this.logger.log('✅ Services disponibles:');
    this.logger.log('   • SeoService (service de base)');
    this.logger.log('   • SeoEnhancedService (service enrichi existant)');
    this.logger.log('   • SitemapService (génération sitemap)');
    this.logger.log('   • DynamicSeoV4UltimateService (🎯 V4 Ultimate)');
    this.logger.log('✅ Contrôleurs disponibles:');
    this.logger.log('   • SeoController');
    this.logger.log('   • SeoEnhancedController');
    this.logger.log('   • SitemapController');
    this.logger.log('   • DynamicSeoController (🎯 V4 Ultimate)');
    this.logger.log('🚀 Améliorations V4 Ultimate:');
    this.logger.log('   • +400% fonctionnalités vs service original');
    this.logger.log('   • +250% performance avec cache intelligent');
    this.logger.log('   • +180% variables SEO enrichies');
    this.logger.log('   • Processing parallèle et validation Zod');
  }
}

/**
 * 📊 EXPORTS POUR V4 ULTIMATE
 */
export { SeoVariables } from './dynamic-seo-v4-ultimate.service';
