import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';

// Controllers - API endpoints pour chaque type de contenu blog
import { BlogController } from './controllers/blog.controller';
import { R3GuideController } from './controllers/r3-guide.controller';
import { R6GuideController } from './controllers/r6-guide.controller';
import { AdviceController } from './controllers/advice.controller';
import { AdviceHierarchyController } from './controllers/advice-hierarchy.controller';
import { ContentController } from './controllers/content.controller';

// Services - Logique métier spécialisée pour chaque type
import { BlogService } from './services/blog.service';
import { AdviceService } from './services/advice.service';
import { GuideService } from './services/guide.service';
import { ConstructeurService } from './services/constructeur.service';
import { GlossaryService } from './services/glossary.service';
import { BlogCacheService } from './services/blog-cache.service';
import { HtmlContentSanitizerService } from './services/html-content-sanitizer.service';

// Services refactorisés - Extraction SRP depuis BlogService
import { BlogArticleTransformService } from './services/blog-article-transform.service';
import { BlogArticleDataService } from './services/blog-article-data.service';
import { BlogStatisticsService } from './services/blog-statistics.service';
import { BlogSeoService } from './services/blog-seo.service';
import { BlogArticleRelationService } from './services/blog-article-relation.service';
import { ConstructeurSearchService } from './services/constructeur-search.service';
import { ConstructeurTransformService } from './services/constructeur-transform.service';
import { AdviceTransformService } from './services/advice-transform.service';
import { AdviceEnrichmentService } from './services/advice-enrichment.service';
import { R3GuideService } from './services/r3-guide.service';
import { R6GuideService } from './services/r6-guide.service';

// Modules externes requis
import { SearchModule } from '../search/search.module';
import { SeoModule } from '../seo/seo.module';

/**
 * 📰 BlogModule - Module de gestion complète du contenu blog
 *
 * 🎯 ARCHITECTURE OPTIMISÉE :
 * - API REST moderne avec 86+ articles indexés
 * - Recherche Meilisearch ultra-rapide
 * - Cache Redis intelligent avec TTL adaptatif
 * - Transformation legacy → interface moderne
 *
 * 📊 DONNÉES EXISTANTES UTILISÉES :
 * - __blog_advice (85 conseils, 3.6M+ vues cumulées)
 * - __blog_guide (1+ guides techniques)
 * - __blog_constructeur (contenu marques)
 * - __blog_glossaire (terminologie technique)
 * - __blog_advice_h2, __blog_advice_h3 (457+ sections structurées)
 * - __blog_meta_tags_ariane, __blog_seo_marque (optimisations SEO)
 * - __sitemap_blog (navigation et indexation)
 *
 * 🚀 PERFORMANCE :
 * - Cache intelligent 1h TTL + limites mémoire
 * - Recherche indexée Meilisearch
 * - Pagination optimisée
 * - Logging détaillé des opérations
 */
@Module({
  imports: [
    // Cache Redis optimisé pour contenu blog
    CacheModule.register({
      ttl: 3600, // 1 heure - contenu stable
      max: 2000, // Augmenté pour plus d'articles
      isGlobal: false, // Cache spécifique au module blog
    }),
    SearchModule, // Services Meilisearch et Supabase intégrés
    SeoModule, // 🔗 InternalLinkingService pour maillage interne
  ],
  controllers: [
    BlogController, // API générale blog et recherche
    R3GuideController, // R3_CONSEILS page engine — single endpoint /api/r3-guide/:pg_alias. @deprecated misnamed (canon = R3_CONSEILS), rename → R3ConseilsController post-2026-06-05 per ADR-044.
    R6GuideController, // R6 guide d'achat — single endpoint /api/r6-guide/:pg_alias
    AdviceController, // Endpoints spécifiques conseils
    AdviceHierarchyController, // Hiérarchie conseils par famille catalogue
    ContentController, // Endpoints guides, constructeurs, glossaire
  ],
  providers: [
    // Services principaux
    BlogService,
    BlogCacheService,
    HtmlContentSanitizerService, // Nettoyage contenu HTML

    // Services refactorisés - Extraction SRP (Single Responsibility Principle)
    BlogArticleTransformService, // Transformations et mappings
    BlogArticleDataService, // CRUD et requêtes Supabase
    BlogStatisticsService, // Métriques et agrégations
    BlogSeoService, // SEO et liens internes
    BlogArticleRelationService, // Relations et véhicules compatibles

    // Services spécialisés par type de contenu
    AdviceService,
    GuideService,
    ConstructeurService,
    GlossaryService,
    ConstructeurSearchService,
    ConstructeurTransformService,
    AdviceTransformService,
    AdviceEnrichmentService,
    R3GuideService, // R3_CONSEILS page engine orchestrator. @deprecated misnamed (canon = R3_CONSEILS), rename → R3ConseilsService post-2026-06-05 per ADR-044.
    R6GuideService, // R6 guide d'achat orchestrator
  ],
  exports: [
    BlogService, // Exporté pour utilisation dans autres modules (ex: produits)
    BlogCacheService, // Cache & décodage HTML pour autres modules
    AdviceService, // Exporté pour intégration produits ↔ conseils
    GuideService, // Exporté pour intégration véhicules ↔ guides
    ConstructeurService, // Exporté pour intégration marques ↔ contenu
    GlossaryService, // Exporté pour aide contextuelle technique
    ConstructeurSearchService,
    ConstructeurTransformService,
    AdviceTransformService,
    AdviceEnrichmentService,
  ],
})
export class BlogModule {}
