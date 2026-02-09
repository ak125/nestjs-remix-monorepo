/**
 * LayoutModule - Module de gestion des layouts et composants d'interface
 *
 * Architecture simplifiée pour éviter les dépendances circulaires :
 * - Services essentiels uniquement
 * - Cache intégré pour optimiser les performances
 * - Global module pour réutilisation dans toute l'application
 *
 * Fonctionnalités :
 * - Gestion des headers dynamiques (admin, commercial, public)
 * - Footers contextuels avec liens et informations
 * - Quick search multi-modules (produits, commandes, utilisateurs)
 * - Social sharing pour contenus e-commerce
 * - Meta tags et SEO intégrés
 */

import { Module, Global } from '@nestjs/common';
import { LayoutController } from './controllers/layout.controller';
import { SectionController } from './controllers/section.controller';
import { LayoutService } from './services/layout.service';
import { HeaderService } from './services/header.service';
import { FooterService } from './services/footer.service';
import { QuickSearchService } from './services/quick-search.service';
import { SocialShareService } from './services/social-share.service';
import { MetaTagsService } from './services/meta-tags.service';

@Global()
@Module({
  imports: [],
  controllers: [LayoutController, SectionController],
  providers: [
    LayoutService,
    HeaderService,
    FooterService,
    QuickSearchService,
    SocialShareService,
    MetaTagsService,
  ],
  exports: [
    LayoutService,
    HeaderService,
    FooterService,
    QuickSearchService,
    SocialShareService,
    MetaTagsService,
  ],
})
export class LayoutModule {}
