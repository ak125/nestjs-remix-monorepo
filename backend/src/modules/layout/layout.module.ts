/**
 * LayoutModule - Module de gestion des layouts et composants d'interface
 * 
 * Architecture alignée sur les meilleures pratiques du projet :
 * - Réutilise le NavigationModule existant pour éviter la duplication
 * - Structure modulaire cohérente avec AdminModule, OrdersModule, etc.
 * - Cache intégré pour optimiser les performances
 * - Services spécialisés par domaine (Header, Footer, QuickSearch, etc.)
 * - Global module pour réutilisation dans toute l'application
 * - Integration avec DatabaseModule et CacheModule existants
 * 
 * Fonctionnalités :
 * - Gestion des headers dynamiques (admin, commercial, public)
 * - Footers contextuels avec liens et informations
 * - Quick search multi-modules (produits, commandes, utilisateurs)
 * - Social sharing pour contenus e-commerce
 * - Sections layout configurables
 * - Meta tags et SEO intégrés
 */

import { Module, Global } from '@nestjs/common';
import { LayoutController } from './controllers/layout.controller';
import { SectionController } from './controllers/section.controller';
import { LayoutTestController } from './controllers/layout-test.controller';
import { LayoutService } from './services/layout.service';
import { HeaderService } from './services/header.service';
import { HeaderUnifiedService } from './services/header-unified.service';
import { FooterService } from './services/footer.service';
import { QuickSearchService } from './services/quick-search.service';
import { SocialShareService } from './services/social-share.service';
import { MetaTagsService } from './services/meta-tags.service';
import { ThemeService } from './services/theme.service';
import { ResponsiveService } from './services/responsive.service';

// Imports des modules existants (cohérent avec les autres modules du projet)
import { CacheModule } from '../../cache/cache.module';
import { NavigationModule } from '../navigation/navigation.module';
import { SeoModule } from '../seo/seo.module';

@Global()
@Module({
  imports: [
    CacheModule, // Cache personnalisé du projet (plus performant que @nestjs/cache-manager)
    NavigationModule, // Réutilise le module navigation existant au lieu de dupliquer
    SeoModule, // Pour l'intégration SEO dans les layouts
  ],
  controllers: [LayoutController, SectionController, LayoutTestController],
  providers: [
    LayoutService,
    HeaderService,
    HeaderUnifiedService, // Service unifié pour toutes les versions
    FooterService,
    QuickSearchService,
    SocialShareService,
    MetaTagsService, // Service supplémentaire pour les meta tags
    ThemeService, // Service de gestion des thèmes
    ResponsiveService, // Service de responsive design
  ],
  exports: [
    LayoutService,
    HeaderService,
    HeaderUnifiedService, // Export du service unifié
    FooterService,
    QuickSearchService,
    SocialShareService,
    MetaTagsService,
    ThemeService,
    ResponsiveService,
  ],
})
export class LayoutModule {}
