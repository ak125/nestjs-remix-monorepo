import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';

// Controllers - API endpoints pour chaque type de contenu blog
import { BlogController } from './controllers/blog.controller';
import { AdviceController } from './controllers/advice.controller';
import { ContentController } from './controllers/content.controller';

// Services - Logique métier spécialisée pour chaque type
import { BlogService } from './services/blog.service';
import { AdviceService } from './services/advice.service';
import { GuideService } from './services/guide.service';
import { ConstructeurService } from './services/constructeur.service';
import { GlossaryService } from './services/glossary.service';
import { BlogCacheService } from './services/blog-cache.service';

// Modules externes requis
import { SearchModule } from '../search/search.module';

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
  ],
  controllers: [
    BlogController, // API générale blog et recherche
    AdviceController, // Endpoints spécifiques conseils
    ContentController, // Endpoints guides, constructeurs, glossaire
  ],
  providers: [
    // Services principaux
    BlogService,
    BlogCacheService,
    
    // Services spécialisés par type de contenu
    AdviceService,
    GuideService,
    ConstructeurService,
    GlossaryService,
  ],
  exports: [
    BlogService, // Exporté pour utilisation dans autres modules (ex: produits)
    BlogCacheService, // Cache & décodage HTML pour autres modules
    AdviceService, // Exporté pour intégration produits ↔ conseils
    GuideService, // Exporté pour intégration véhicules ↔ guides
    ConstructeurService, // Exporté pour intégration marques ↔ contenu
    GlossaryService, // Exporté pour aide contextuelle technique
  ],
})
export class BlogModule {}
