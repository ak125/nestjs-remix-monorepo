import { Controller, Post, Get, Logger } from '@nestjs/common';
import { IndexationService } from '../services/indexation.service';
import { SupabaseIndexationService } from '../services/supabase-indexation.service';
import { DatabaseAnalysisService } from '../services/database-analysis.service';
import { VehicleNamingService } from '../services/vehicle-naming.service';
import { MeilisearchService } from '../services/meilisearch.service';

@Controller('api/admin')
export class IndexationController {
  private readonly logger = new Logger(IndexationController.name);

  constructor(
    private readonly indexationService: IndexationService,
    private readonly supabaseIndexationService: SupabaseIndexationService,
    private readonly databaseAnalysisService: DatabaseAnalysisService,
    private readonly vehicleNamingService: VehicleNamingService,
    private readonly meilisearchService: MeilisearchService,
  ) {}

  /**
   * 🚗 Indexer les véhicules de test
   */
  @Post('index-vehicles')
  async indexVehicles() {
    this.logger.log('🚗 Démarrage indexation véhicules...');

    try {
      const result = await this.indexationService.indexVehicles();

      return {
        success: result.success,
        message: result.message,
        data: {
          count: result.count,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Erreur indexation véhicules:', error);
      return {
        success: false,
        message: "Erreur lors de l'indexation des véhicules",
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 🛍️ Indexer les produits de test
   */
  @Post('index-products')
  async indexProducts() {
    this.logger.log('🛍️ Démarrage indexation produits...');

    try {
      const result = await this.indexationService.indexProducts();

      return {
        success: result.success,
        message: result.message,
        data: {
          count: result.count,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Erreur indexation produits:', error);
      return {
        success: false,
        message: "Erreur lors de l'indexation des produits",
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 📊 Statut de l'indexation
   */
  @Get('status')
  async getStatus() {
    this.logger.log('📊 Récupération du statut...');

    try {
      const status = await this.indexationService.getIndexationStatus();

      return {
        success: true,
        data: status,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Erreur récupération statut:', error);
      return {
        success: false,
        message: 'Erreur lors de la récupération du statut',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * � ANALYSE COMPLÈTE DE LA BASE DE DONNÉES
   */

  /**
   * 🔍 Analyser la structure véhicule
   */
  @Get('analyze-vehicle-structure')
  async analyzeVehicleStructure() {
    try {
      this.logger.log('🔍 Analyse structure véhicule...');

      const result =
        await this.databaseAnalysisService.analyzeVehicleStructure();

      return {
        success: result.success,
        data: result.analysis,
        recommendations: result.recommendations,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Erreur analyse structure:', error);
      return {
        success: false,
        message: `Erreur analyse: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 🧪 Tester la requête optimale
   */
  @Get('test-optimal-query')
  async testOptimalQuery() {
    try {
      this.logger.log('🧪 Test requête optimale...');

      const result = await this.databaseAnalysisService.testOptimalQuery();

      return {
        success: result.success,
        data: result,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Erreur test requête:', error);
      return {
        success: false,
        message: `Erreur test: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 🔧 Analyser la structure des pièces
   */
  @Get('analyze-pieces-structure')
  async analyzePiecesStructure() {
    try {
      this.logger.log('🔧 Analyse structure pièces...');

      const result =
        await this.databaseAnalysisService.analyzePiecesStructure();

      return {
        success: result.success,
        data: result.analysis,
        recommendations: result.recommendations,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Erreur analyse pièces:', error);
      return {
        success: false,
        message: `Erreur analyse: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 📊 Rapport complet d'analyse
   */
  @Get('full-database-analysis')
  async fullDatabaseAnalysis() {
    try {
      this.logger.log('📊 Analyse complète de la base...');

      const [vehicleAnalysis, piecesAnalysis, optimalTest] = await Promise.all([
        this.databaseAnalysisService.analyzeVehicleStructure(),
        this.databaseAnalysisService.analyzePiecesStructure(),
        this.databaseAnalysisService.testOptimalQuery(),
      ]);

      return {
        success: true,
        data: {
          vehicles: vehicleAnalysis,
          pieces: piecesAnalysis,
          optimalQuery: optimalTest,
        },
        summary: {
          vehicleRelationsWorking:
            vehicleAnalysis.analysis?.relations?.filter(
              (r) => r.status === 'SUCCESS',
            ).length || 0,
          totalTables: Object.keys(vehicleAnalysis.analysis?.structure || {})
            .length,
          optimalQueryStatus: optimalTest.success ? 'SUCCESS' : 'FAILED',
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Erreur analyse complète:', error);
      return {
        success: false,
        message: `Erreur analyse complète: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
        timestamp: new Date().toISOString(),
      };
    }
  }
  @Post('clear-all')
  async clearAll() {
    this.logger.log('🗑️ Suppression de tous les index...');

    try {
      const result = await this.indexationService.clearAllIndexes();

      return {
        success: result.success,
        message: result.message,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Erreur suppression index:', error);
      return {
        success: false,
        message: 'Erreur lors de la suppression des index',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 🚗 NOUVELLES ROUTES - DONNÉES RÉELLES
   */

  /**
   * 🧪 Test récupération données Supabase avec relations
   */
  @Get('test-supabase-relations')
  async testSupabaseRelations() {
    this.logger.log('🧪 Test récupération données Supabase avec relations...');

    try {
      const result =
        await this.supabaseIndexationService.getAllVehiclesFromSupabase(3, 0);

      return {
        success: true,
        message: `Récupéré ${result.data?.length || 0} véhicules avec relations`,
        data: result,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Erreur test Supabase relations:', error);
      return {
        success: false,
        message: `Erreur test relations: ${error.message}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 🚗 Indexer véhicules RÉELS depuis Supabase
   */
  @Post('index-real-vehicles')
  async indexRealVehicles() {
    this.logger.log('🚗 Démarrage indexation véhicules RÉELS...');

    try {
      const result = await this.indexationService.indexRealVehicles();

      return {
        success: result.success,
        message: result.message,
        data: {
          count: result.count,
          type: 'real-vehicles',
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Erreur indexation véhicules réels:', error);
      return {
        success: false,
        message: "Erreur lors de l'indexation des véhicules réels",
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 🔧 Indexer produits RÉELS depuis Supabase
   */
  @Post('index-real-products')
  async indexRealProducts() {
    this.logger.log('🔧 Démarrage indexation produits RÉELS...');

    try {
      const result = await this.indexationService.indexRealProducts();

      return {
        success: result.success,
        message: result.message,
        data: {
          count: result.count,
          type: 'real-products',
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Erreur indexation produits réels:', error);
      return {
        success: false,
        message: "Erreur lors de l'indexation des produits réels",
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 📊 Indexer TOUTES les données réelles
   */
  @Post('index-all-real')
  async indexAllRealData() {
    this.logger.log('📊 Démarrage indexation COMPLÈTE des données réelles...');

    try {
      const result = await this.indexationService.indexAllRealData();

      return {
        success: result.success,
        message: result.message,
        data: {
          vehicles: result.vehicles,
          products: result.products,
          total: result.vehicles + result.products,
          type: 'complete-real-data',
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Erreur indexation complète:', error);
      return {
        success: false,
        message: "Erreur lors de l'indexation complète des données réelles",
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 🧪 Tester la connexion Supabase
   */
  @Get('test-supabase')
  async testSupabase() {
    this.logger.log('🧪 Test connexion Supabase...');

    try {
      const result = await this.indexationService.testSupabaseConnection();

      return {
        success: result.success,
        message: result.message,
        data: result.data,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Erreur test Supabase:', error);
      return {
        success: false,
        message: 'Erreur lors du test de connexion Supabase',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 🚗 TEST CONSTRUCTION NOMS VÉHICULES COMPLETS
   */
  @Get('test-vehicle-names')
  async testVehicleNames() {
    try {
      this.logger.log('🧪 Test construction noms véhicules...');

      const result = await this.vehicleNamingService.testVehicleNaming();

      return {
        success: result.success,
        message: result.success ? `✅ ${result.message}` : `❌ ${result.error}`,
        data: result,
      };
    } catch (error) {
      this.logger.error('❌ Erreur test noms véhicules:', error);
      return {
        success: false,
        message: `Erreur test noms: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
      };
    }
  }

  /**
   * 🧪 TEST ANALYSE TABLE PIECES
   */
  @Get('test-pieces')
  async testPieces() {
    this.logger.log('🧪 Test analyse table pieces...');

    try {
      // Analyse directe de la table pieces
      const client = this.supabaseIndexationService.getClient();

      // 1. Compter les pièces
      const { count: totalCount } = await client
        .from('pieces')
        .select('*', { count: 'exact', head: true });

      // 2. Échantillon de pièces avec toutes les colonnes
      const { data: samplePieces } = await client
        .from('pieces')
        .select('*')
        .limit(10);

      // 3. Analyse des noms de pièces uniques
      const { data: uniqueNames } = await client
        .from('pieces')
        .select('piece_name')
        .not('piece_name', 'is', null)
        .not('piece_name', 'eq', '')
        .limit(100);

      // 4. Rechercher spécifiquement les filtres à air
      const { data: filtresAir } = await client
        .from('pieces')
        .select('piece_name, piece_ref, piece_des, piece_display')
        .or(
          'piece_name.ilike.%filtre%air%,piece_name.ilike.%air%filtre%,piece_fil_name.ilike.%filtre%air%,piece_fil_name.ilike.%air%filtre%',
        )
        .limit(20);

      // 5. Rechercher tous types de filtres
      const { data: tousLesFilteres } = await client
        .from('pieces')
        .select('piece_name, piece_ref, piece_des, piece_display')
        .ilike('piece_name', '%filtre%')
        .limit(50);

      this.logger.log(`📊 Total pièces: ${totalCount}`);
      this.logger.log(`🔍 Échantillon: ${samplePieces?.length} pièces`);
      this.logger.log(`🏷️ Noms uniques: ${uniqueNames?.length} noms`);
      this.logger.log(
        `🔧 Filtres à air trouvés: ${filtresAir?.length} filtres`,
      );
      this.logger.log(
        `🔧 Tous filtres trouvés: ${tousLesFilteres?.length} filtres`,
      );

      return {
        success: true,
        data: {
          totalCount,
          samplePieces: samplePieces?.slice(0, 5), // Limiter pour la réponse
          uniqueNames: uniqueNames?.map((p) => p.piece_name).slice(0, 20),
          filtresAir: filtresAir,
          tousLesFilteres: tousLesFilteres,
          analysis: {
            hasFilters:
              (filtresAir?.length || 0) > 0 ||
              (tousLesFilteres?.length || 0) > 0,
            totalTypes: uniqueNames?.length || 0,
          },
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Erreur test pieces:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 📰 NOUVELLES FONCTIONNALITÉS - ANALYSE ET INDEXATION BLOG
   */

  /**
   * 📊 Analyser les tables de blog existantes
   */
  @Get('analyze-blog-structure')
  async analyzeBlogStructure() {
    this.logger.log('📊 Analyse structure tables blog...');

    try {
      const client = this.supabaseIndexationService.getClient();

      // Vérifier l'existence et analyser chaque table de blog
      const blogTables = [
        'blog_articles',
        'blog_advice',
        'blog_guides',
        'blog_constructeurs',
        'blog_sections',
        'blog_glossary',
        'blog_categories',
        'blog_comments',
        'blog_article_products',
      ];

      const tableAnalysis = {};

      for (const tableName of blogTables) {
        try {
          // Compter les enregistrements
          const { count } = await client
            .from(tableName)
            .select('*', { count: 'exact', head: true });

          // Échantillon de données pour structure
          const { data: sample } = await client
            .from(tableName)
            .select('*')
            .limit(3);

          tableAnalysis[tableName] = {
            exists: true,
            count: count || 0,
            structure: sample?.[0] ? Object.keys(sample[0]) : [],
            sample: sample?.slice(0, 2),
            status: count > 0 ? 'POPULATED' : 'EMPTY',
          };

          this.logger.log(`✅ ${tableName}: ${count || 0} enregistrements`);
        } catch (error) {
          tableAnalysis[tableName] = {
            exists: false,
            error: error.message,
            status: 'MISSING',
          };
          this.logger.warn(`⚠️ ${tableName}: Table manquante ou inaccessible`);
        }
      }

      // Analyse des relations avec les tables existantes
      const relationsAnalysis = await this.analyzeBlogRelations(client);

      return {
        success: true,
        data: {
          tables: tableAnalysis,
          relations: relationsAnalysis,
          summary: {
            existingTables: Object.values(tableAnalysis).filter((t) => t.exists)
              .length,
            totalTables: blogTables.length,
            populatedTables: Object.values(tableAnalysis).filter(
              (t) => t.status === 'POPULATED',
            ).length,
            missingTables: Object.values(tableAnalysis).filter(
              (t) => t.status === 'MISSING',
            ).length,
          },
        },
        recommendations: this.generateBlogRecommendations(tableAnalysis),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Erreur analyse blog:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 📝 Analyser le contenu blog existant
   */
  @Get('analyze-blog-content')
  async analyzeBlogContent() {
    this.logger.log('📝 Analyse contenu blog existant...');

    try {
      const client = this.supabaseIndexationService.getClient();

      // Articles par type
      const { data: articlesByType } = await client
        .from('blog_articles')
        .select('type, status')
        .neq('status', 'archived');

      // Articles récents
      const { data: recentArticles } = await client
        .from('blog_articles')
        .select('title, slug, type, published_at, views_count')
        .eq('status', 'published')
        .order('published_at', { ascending: false })
        .limit(10);

      // Glossaire le plus utilisé
      const { data: popularGlossary } = await client
        .from('blog_glossary')
        .select('word, category, related_articles')
        .order('word')
        .limit(20);

      // Catégories actives
      const { data: activeCategories } = await client
        .from('blog_categories')
        .select('name, slug, description, is_active')
        .eq('is_active', true)
        .order('position');

      const analysis = {
        articleStats: this.analyzeArticleStats(articlesByType),
        recentContent: recentArticles || [],
        glossaryTerms: popularGlossary || [],
        categories: activeCategories || [],
        contentHealth: this.assessContentHealth(articlesByType, recentArticles),
      };

      return {
        success: true,
        data: analysis,
        insights: this.generateContentInsights(analysis),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Erreur analyse contenu blog:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 🚀 Indexer le contenu blog dans Meilisearch
   */
  @Post('index-blog-content')
  async indexBlogContent() {
    this.logger.log('🚀 Indexation contenu blog dans Meilisearch...');

    try {
      const client = this.supabaseIndexationService.getClient();

      // Récupérer tous les articles publiés avec leurs relations
      const { data: articles } = await client
        .from('blog_articles')
        .select(
          `
          *,
          blog_categories(name, slug, description),
          blog_sections(title, content, level, position),
          blog_advice(difficulty_level, estimated_time, tools_required),
          blog_guides(guide_type, difficulty, duration),
          blog_constructeurs(technical_specs, brand_id, model_id)
        `,
        )
        .eq('status', 'published')
        .order('published_at', { ascending: false });

      if (!articles || articles.length === 0) {
        return {
          success: false,
          message: 'Aucun article publié trouvé',
          timestamp: new Date().toISOString(),
        };
      }

      // Transformation des articles pour Meilisearch
      const transformedArticles = articles.map((article) =>
        this.transformArticleForSearch(article),
      );

      // Indexation dans Meilisearch
      const indexResult =
        await this.indexationService.indexBlogArticles(transformedArticles);

      return {
        success: indexResult.success,
        message: indexResult.message,
        data: {
          indexed: transformedArticles.length,
          articles: indexResult.indexed || 0,
          type: 'blog-content',
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Erreur indexation blog:', error);
      return {
        success: false,
        message: "Erreur lors de l'indexation du contenu blog",
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 🔗 Analyser les relations produits-articles
   */
  @Get('analyze-product-article-relations')
  async analyzeProductArticleRelations() {
    this.logger.log('🔗 Analyse relations produits-articles...');

    try {
      const client = this.supabaseIndexationService.getClient();

      // Relations existantes
      const { data: existingRelations } = await client
        .from('blog_article_products')
        .select(
          `
          *,
          blog_articles(title, type, slug),
          pieces(piece_name, piece_ref)
        `,
        )
        .limit(50);

      // Articles sans produits liés
      const { data: articlesWithoutProducts } = await client
        .from('blog_articles')
        .select('id, title, type')
        .eq('status', 'published')
        .not(
          'id',
          'in',
          `(${existingRelations?.map((r) => r.article_id).join(',') || '0'})`,
        )
        .limit(20);

      // Statistiques par type d'article
      const relationStats = this.calculateRelationStats(existingRelations);

      return {
        success: true,
        data: {
          existingRelations: existingRelations || [],
          articlesWithoutProducts: articlesWithoutProducts || [],
          stats: relationStats,
          recommendations: this.generateRelationRecommendations(relationStats),
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Erreur analyse relations:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 📋 Analyser les tables de blog EXISTANTES avec préfixe __blog_
   */
  @Get('analyze-existing-blog-tables')
  async analyzeExistingBlogTables() {
    this.logger.log(
      '📋 Analyse des tables blog existantes avec préfixe __blog_...',
    );

    try {
      const client = this.supabaseIndexationService.getClient();

      // Tables de blog existantes à analyser selon le schéma fourni
      const existingBlogTables = [
        '__blog_advice',
        '__blog_advice_cross',
        '__blog_advice_h2',
        '__blog_advice_h3',
        '__blog_advice_old',
        '__blog_guide',
        '__blog_guide_h2',
        '__blog_guide_h3',
        '__blog_meta_tags_ariane',
        '__blog_seo_marque',
        '__sitemap_blog',
      ];

      const tableAnalysis = {};
      let totalRecords = 0;

      for (const tableName of existingBlogTables) {
        try {
          // Compter les enregistrements
          const { count } = await client
            .from(tableName)
            .select('*', { count: 'exact', head: true });

          // Échantillon de données pour structure
          const { data: sample } = await client
            .from(tableName)
            .select('*')
            .limit(3);

          // Analyser la structure des colonnes
          const structure = sample?.[0] ? Object.keys(sample[0]) : [];

          tableAnalysis[tableName] = {
            exists: true,
            count: count || 0,
            estimatedRows: this.getEstimatedRows(tableName),
            structure: structure,
            sample: sample?.slice(0, 2),
            status: count > 0 ? 'POPULATED' : 'EMPTY',
            category: this.categorizeTable(tableName),
          };

          totalRecords += count || 0;
          this.logger.log(
            `✅ ${tableName}: ${count || 0} enregistrements (${structure.length} colonnes)`,
          );
        } catch (error) {
          tableAnalysis[tableName] = {
            exists: false,
            error: error.message,
            status: 'ERROR',
            category: 'unknown',
          };
          this.logger.warn(
            `⚠️ ${tableName}: Erreur d'accès - ${error.message}`,
          );
        }
      }

      // Analyse des contenus par catégorie
      const contentAnalysis = await this.analyzeExistingContent(
        client,
        tableAnalysis,
      );

      return {
        success: true,
        data: {
          tables: tableAnalysis,
          contentAnalysis,
          summary: {
            totalTables: existingBlogTables.length,
            accessibleTables: Object.values(tableAnalysis).filter(
              (t: any) => t.exists,
            ).length,
            populatedTables: Object.values(tableAnalysis).filter(
              (t: any) => t.status === 'POPULATED',
            ).length,
            totalRecords: totalRecords,
            categories: this.groupTablesByCategory(tableAnalysis),
          },
        },
        migration: {
          recommendations: this.generateMigrationRecommendations(tableAnalysis),
          integrationPlan: this.createIntegrationPlan(tableAnalysis),
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Erreur analyse tables existantes:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 🔄 Migrer le contenu des tables __blog_ vers les nouvelles tables
   */
  @Post('migrate-blog-content')
  async migrateBlogContent() {
    this.logger.log('🔄 Migration du contenu blog existant...');

    try {
      const client = this.supabaseIndexationService.getClient();
      const results = {};

      // 1. Migrer __blog_advice vers blog_articles (type: advice)
      const adviceResult = await this.migrateAdviceContent(client);
      results['advice_articles'] = adviceResult;

      // 2. Migrer __blog_guide vers blog_articles (type: guide)
      const guideResult = await this.migrateGuideContent(client);
      results['guide_articles'] = guideResult;

      // 3. Migrer les sections H2/H3 vers blog_sections
      const sectionsResult = await this.migrateSections(client);
      results['sections'] = sectionsResult;

      // 4. Migrer les méta-tags vers les données SEO
      const seoResult = await this.migrateSeoData(client);
      results['seo_data'] = seoResult;

      // 5. Migrer le sitemap
      const sitemapResult = await this.migrateSitemapData(client);
      results['sitemap'] = sitemapResult;

      const totalMigrated = Object.values(results).reduce(
        (sum: number, result: any) => sum + (result.migrated || 0),
        0,
      );

      return {
        success: true,
        message: `Migration réussie: ${totalMigrated} éléments migrés`,
        data: results,
        summary: {
          totalMigrated,
          adviceArticles: adviceResult.migrated || 0,
          guideArticles: guideResult.migrated || 0,
          sections: sectionsResult.migrated || 0,
          seoEntries: seoResult.migrated || 0,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Erreur migration blog:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * ✅ Vérifier les articles migrés
   */
  @Get('test-migrated-articles')
  async testMigratedArticles() {
    this.logger.log('✅ Test des articles migrés...');

    try {
      const client = this.supabaseIndexationService.getClient();

      // Compter les articles migrés
      const { count: totalArticles } = await client
        .from('blog_articles')
        .select('*', { count: 'exact', head: true });

      // Échantillon d'articles migrés
      const { data: sampleArticles } = await client
        .from('blog_articles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      // Articles par type
      const { data: articlesByType } = await client
        .from('blog_articles')
        .select('type')
        .not('type', 'is', null);

      const typeStats = {};
      articlesByType?.forEach((article) => {
        typeStats[article.type] = (typeStats[article.type] || 0) + 1;
      });

      // Articles avec legacy_id (migrés)
      const { count: migratedCount } = await client
        .from('blog_articles')
        .select('*', { count: 'exact', head: true })
        .not('legacy_id', 'is', null);

      return {
        success: true,
        data: {
          totalArticles: totalArticles || 0,
          migratedArticles: migratedCount || 0,
          typeStats,
          sampleArticles:
            sampleArticles?.map((article) => ({
              id: article.id,
              title: article.title,
              type: article.type,
              slug: article.slug,
              status: article.status,
              legacy_id: article.legacy_id,
              created_at: article.created_at,
            })) || [],
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Erreur test articles migrés:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 🔄 Migration DIRECTE d'un conseil depuis les tables existantes
   */
  @Post('migrate-single-advice')
  async migrateSingleAdvice() {
    this.logger.log("🔄 Migration directe d'un conseil...");

    try {
      const client = this.supabaseIndexationService.getClient();

      // Récupérer le premier conseil de la table __blog_advice
      const { data: advice } = await client
        .from('__blog_advice')
        .select('*')
        .limit(1)
        .single();

      if (!advice) {
        return {
          success: false,
          message: 'Aucun conseil trouvé dans __blog_advice',
          timestamp: new Date().toISOString(),
        };
      }

      this.logger.log(`🔍 Conseil trouvé: ${advice.ba_title}`);

      // Créer l'article dans blog_articles
      const newArticle = {
        slug: advice.ba_alias || `conseil-${advice.ba_id}`,
        type: 'advice',
        title: advice.ba_title,
        excerpt: advice.ba_preview || advice.ba_descrip,
        content: {
          introduction: advice.ba_preview,
          main_content: advice.ba_content,
          h1: advice.ba_h1,
          h2: advice.ba_h2,
        },
        tags: advice.ba_keywords ? advice.ba_keywords.split(', ') : [],
        status: 'published',
        reading_time: 5,
        views_count: parseInt(advice.ba_visit) || 0,
        published_at: advice.ba_create,
        updated_at: advice.ba_update,
        seo_data: {
          meta_title: advice.ba_title,
          meta_description: advice.ba_descrip,
          keywords: advice.ba_keywords ? advice.ba_keywords.split(', ') : [],
          h1: advice.ba_h1,
        },
        legacy_id: parseInt(advice.ba_id),
      };

      const { data: insertedArticle, error: insertError } = await client
        .from('blog_articles')
        .insert(newArticle)
        .select()
        .single();

      if (insertError) {
        this.logger.error('❌ Erreur insertion article:', insertError);
        return {
          success: false,
          error: `Erreur insertion: ${insertError.message}`,
          timestamp: new Date().toISOString(),
        };
      }

      this.logger.log(`✅ Article créé avec ID: ${insertedArticle.id}`);

      return {
        success: true,
        message: 'Conseil migré avec succès',
        data: {
          original: {
            id: advice.ba_id,
            title: advice.ba_title,
            alias: advice.ba_alias,
          },
          migrated: {
            id: insertedArticle.id,
            title: insertedArticle.title,
            slug: insertedArticle.slug,
            type: insertedArticle.type,
            status: insertedArticle.status,
          },
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Erreur migration conseil direct:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 🔍 Lister TOUTES les tables de la base de données
   */
  @Get('list-all-database-tables')
  async listAllDatabaseTables() {
    this.logger.log('🔍 Listage de toutes les tables de la base...');

    try {
      const client = this.supabaseIndexationService.getClient();

      // Requête pour lister toutes les tables de la base
      const { data: tables } = await client.rpc('get_all_tables_info');

      if (!tables) {
        // Si la fonction n'existe pas, utilisons une requête SQL directe via une table système
        const { data: systemTables } = await client
          .from('information_schema.tables')
          .select('table_name, table_type, table_schema')
          .eq('table_schema', 'public')
          .order('table_name');

        return {
          success: true,
          data: {
            tables: systemTables || [],
            total: systemTables?.length || 0,
            blogTables:
              systemTables?.filter(
                (t) =>
                  t.table_name.includes('blog') ||
                  t.table_name.startsWith('__blog'),
              ) || [],
          },
          timestamp: new Date().toISOString(),
        };
      }

      return {
        success: true,
        data: {
          tables: tables,
          total: tables.length,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Erreur listage tables:', error);

      // Fallback: tenter avec une approche différente
      try {
        const client = this.supabaseIndexationService.getClient();

        // Test d'accès aux tables que nous savons exister
        const knownTables = [
          '__blog_advice',
          '__blog_guide',
          '__blog_advice_h2',
          'pieces',
          'vehicules',
          'marques',
        ];

        const tableInfo = {};

        for (const tableName of knownTables) {
          try {
            const { count } = await client
              .from(tableName)
              .select('*', { count: 'exact', head: true });

            tableInfo[tableName] = { exists: true, count: count || 0 };
          } catch (err) {
            tableInfo[tableName] = { exists: false, error: err.message };
          }
        }

        return {
          success: true,
          message: "Listage partiel via test d'accès",
          data: {
            knownTables: tableInfo,
            fallbackMethod: true,
          },
          timestamp: new Date().toISOString(),
        };
      } catch (fallbackError) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Erreur inconnue',
          fallbackError:
            fallbackError instanceof Error
              ? fallbackError.message
              : 'Erreur fallback inconnue',
          timestamp: new Date().toISOString(),
        };
      }
    }
  }

  /**
   * 📰 INDEX directement depuis les tables __blog_ existantes
   */
  @Post('index-existing-blog-content')
  async indexExistingBlogContent() {
    this.logger.log('📰 Indexation directe du contenu blog existant...');

    try {
      const client = this.supabaseIndexationService.getClient();

      // Récupérer TOUS les conseils depuis __blog_advice
      const { data: adviceData } = await client
        .from('__blog_advice')
        .select('*')
        .limit(100); // Limitons pour le test

      const transformedArticles = [];

      if (adviceData && adviceData.length > 0) {
        this.logger.log(`🔍 ${adviceData.length} conseils trouvés`);

        for (const advice of adviceData) {
          // Récupérer les sections H2 et H3 associées
          const { data: h2Sections } = await client
            .from('__blog_advice_h2')
            .select('*')
            .eq('ba2_ba_id', advice.ba_id);

          const { data: h3Sections } = await client
            .from('__blog_advice_h3')
            .select('*')
            .eq('ba3_ba_id', advice.ba_id);

          // Transformer pour Meilisearch
          const transformedArticle = {
            id: `advice_${advice.ba_id}`,
            type: 'blog_article',
            articleType: 'advice',
            title: advice.ba_title,
            slug: advice.ba_alias,
            content: advice.ba_content,
            excerpt: advice.ba_preview || advice.ba_descrip,
            h1: advice.ba_h1,
            h2: advice.ba_h2,
            keywords: advice.ba_keywords ? advice.ba_keywords.split(', ') : [],
            tags: advice.ba_keywords ? advice.ba_keywords.split(', ') : [],
            publishedAt: advice.ba_create,
            updatedAt: advice.ba_update,
            viewsCount: parseInt(advice.ba_visit) || 0,
            sections: [
              ...(h2Sections?.map((s) => ({
                level: 2,
                title: s.ba2_h2,
                content: s.ba2_content,
                anchor: s.ba2_h2?.toLowerCase().replace(/\s+/g, '-'),
              })) || []),
              ...(h3Sections?.map((s) => ({
                level: 3,
                title: s.ba3_h3,
                content: s.ba3_content,
                anchor: s.ba3_h3?.toLowerCase().replace(/\s+/g, '-'),
              })) || []),
            ],
            searchTerms: [
              advice.ba_title,
              advice.ba_descrip || '',
              advice.ba_keywords || '',
              ...(h2Sections?.map((s) => s.ba2_h2).filter(Boolean) || []),
              ...(h3Sections?.map((s) => s.ba3_h3).filter(Boolean) || []),
            ].filter(Boolean),
            legacy_id: advice.ba_id,
            legacy_table: '__blog_advice',
          };

          transformedArticles.push(transformedArticle);
        }
      }

      // Récupérer les guides depuis __blog_guide
      const { data: guideData } = await client.from('__blog_guide').select('*');

      if (guideData && guideData.length > 0) {
        this.logger.log(`📚 ${guideData.length} guides trouvés`);

        for (const guide of guideData) {
          const { data: h2Sections } = await client
            .from('__blog_guide_h2')
            .select('*')
            .eq('bg2_bg_id', guide.bg_id);

          const { data: h3Sections } = await client
            .from('__blog_guide_h3')
            .select('*')
            .eq('bg3_bg_id', guide.bg_id);

          const transformedGuide = {
            id: `guide_${guide.bg_id}`,
            type: 'blog_article',
            articleType: 'guide',
            title: guide.bg_title,
            slug: guide.bg_alias,
            content: guide.bg_content,
            excerpt: guide.bg_preview || guide.bg_descrip,
            h1: guide.bg_h1,
            h2: guide.bg_h2,
            keywords: guide.bg_keywords ? guide.bg_keywords.split(', ') : [],
            tags: guide.bg_keywords ? guide.bg_keywords.split(', ') : [],
            publishedAt: guide.bg_create,
            updatedAt: guide.bg_update,
            viewsCount: parseInt(guide.bg_visit) || 0,
            sections: [
              ...(h2Sections?.map((s) => ({
                level: 2,
                title: s.bg2_h2,
                content: s.bg2_content,
              })) || []),
              ...(h3Sections?.map((s) => ({
                level: 3,
                title: s.bg3_h3,
                content: s.bg3_content,
              })) || []),
            ],
            searchTerms: [
              guide.bg_title,
              guide.bg_descrip || '',
              guide.bg_keywords || '',
              ...(h2Sections?.map((s) => s.bg2_h2).filter(Boolean) || []),
              ...(h3Sections?.map((s) => s.bg3_h3).filter(Boolean) || []),
            ].filter(Boolean),
            legacy_id: guide.bg_id,
            legacy_table: '__blog_guide',
          };

          transformedArticles.push(transformedGuide);
        }
      }

      if (transformedArticles.length === 0) {
        return {
          success: false,
          message: 'Aucun contenu blog trouvé dans les tables existantes',
          timestamp: new Date().toISOString(),
        };
      }

      this.logger.log(
        `🚀 Indexation de ${transformedArticles.length} articles dans Meilisearch...`,
      );

      // Indexer dans Meilisearch
      const indexResult =
        await this.indexationService.indexBlogArticles(transformedArticles);

      return {
        success: indexResult.success,
        message: indexResult.success
          ? `${transformedArticles.length} articles blog indexés avec succès`
          : `Erreur indexation: ${indexResult.message}`,
        data: {
          indexed: transformedArticles.length,
          advice: adviceData?.length || 0,
          guides: guideData?.length || 0,
          totalSections: transformedArticles.reduce(
            (sum, article) => sum + (article.sections?.length || 0),
            0,
          ),
          type: 'existing-blog-content',
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Erreur indexation blog existant:', error);
      return {
        success: false,
        message: "Erreur lors de l'indexation du contenu blog existant",
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 🏗️ Créer l'index blog_articles dans Meilisearch
   */
  @Post('create-blog-index')
  async createBlogIndex() {
    this.logger.log("🏗️ Création de l'index blog_articles...");

    try {
      const meilisearchClient = this.meilisearchService.getClient();

      // Créer l'index blog_articles
      const task = await meilisearchClient.createIndex('blog_articles', {
        primaryKey: 'id',
      });
      this.logger.log(`📝 Tâche de création d'index lancée: ${task.taskUid}`);

      // Attendre un peu puis configurer l'index
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const blogIndex = await meilisearchClient.getIndex('blog_articles');

      await blogIndex.updateSettings({
        searchableAttributes: [
          'title',
          'excerpt',
          'content',
          'h1',
          'h2',
          'tags',
          'keywords',
          'searchTerms',
          'sections.title',
          'sections.content',
        ],
        filterableAttributes: [
          'articleType',
          'type',
          'legacy_table',
          'publishedAt',
          'tags',
          'keywords',
        ],
        sortableAttributes: [
          'publishedAt',
          'updatedAt',
          'viewsCount',
          'legacy_id',
        ],
        displayedAttributes: [
          'id',
          'title',
          'slug',
          'excerpt',
          'articleType',
          'type',
          'tags',
          'keywords',
          'publishedAt',
          'viewsCount',
          'sections',
          'legacy_id',
          'legacy_table',
        ],
        rankingRules: [
          'words',
          'typo',
          'proximity',
          'attribute',
          'sort',
          'exactness',
        ],
      });

      this.logger.log('✅ Index blog_articles créé et configuré');

      return {
        success: true,
        message: 'Index blog_articles créé et configuré avec succès',
        data: {
          indexName: 'blog_articles',
          primaryKey: 'id',
          configured: true,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Erreur création index blog:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 🌱 Peupler les tables de blog avec des données d'exemple
   */
  @Post('seed-blog-data')
  async seedBlogData() {
    this.logger.log(
      "🌱 Peuplement des tables blog avec des données d'exemple...",
    );

    try {
      const client = this.supabaseIndexationService.getClient();

      // 1. Créer des catégories de blog
      const categories = [
        {
          name: 'Entretien Automobile',
          slug: 'entretien-automobile',
          description: "Conseils et guides pour l'entretien de votre véhicule",
          icon: 'wrench',
          color: '#3B82F6',
          position: 1,
        },
        {
          name: 'Pièces Détachées',
          slug: 'pieces-detachees',
          description: 'Tout savoir sur les pièces détachées automobiles',
          icon: 'cog',
          color: '#10B981',
          position: 2,
        },
        {
          name: 'Constructeurs',
          slug: 'constructeurs',
          description: 'Histoire et innovations des marques automobiles',
          icon: 'car',
          color: '#F59E0B',
          position: 3,
        },
      ];

      const { data: insertedCategories } = await client
        .from('blog_categories')
        .insert(categories)
        .select();

      this.logger.log(
        `✅ ${insertedCategories?.length || 0} catégories créées`,
      );

      // 2. Créer des articles de blog
      const articles = [
        {
          slug: 'comment-changer-filtre-a-air',
          type: 'advice',
          title: 'Comment changer un filtre à air : guide complet',
          excerpt:
            'Apprenez à remplacer facilement le filtre à air de votre véhicule avec ce guide détaillé.',
          content: {
            introduction:
              'Le filtre à air est un élément essentiel de votre moteur...',
            steps: [
              'Localiser le boîtier du filtre à air',
              'Démonter le couvercle',
              "Retirer l'ancien filtre",
              'Installer le nouveau filtre',
              'Remonter le couvercle',
            ],
          },
          category_id: insertedCategories?.find(
            (c) => c.slug === 'entretien-automobile',
          )?.id,
          tags: ['filtre à air', 'entretien', 'moteur', 'diy'],
          status: 'published',
          reading_time: 8,
          views_count: 150,
          published_at: new Date().toISOString(),
          seo_data: {
            meta_title: 'Comment changer un filtre à air - Guide complet',
            meta_description:
              "Guide étape par étape pour remplacer le filtre à air de votre voiture. Économisez de l'argent en le faisant vous-même !",
            keywords: ['filtre à air', 'changement', 'entretien automobile'],
          },
        },
        {
          slug: 'guide-achat-pieces-detachees',
          type: 'guide',
          title: "Guide d'achat : bien choisir ses pièces détachées",
          excerpt:
            'Tous nos conseils pour acheter les bonnes pièces détachées au meilleur prix.',
          content: {
            introduction: 'Choisir les bonnes pièces détachées est crucial...',
            sections: [
              'Identifier les références exactes',
              'Comprendre les marques équipementiers',
              'Éviter les contrefaçons',
            ],
          },
          category_id: insertedCategories?.find(
            (c) => c.slug === 'pieces-detachees',
          )?.id,
          tags: ['achat', 'pièces détachées', 'conseils', 'équipementiers'],
          status: 'published',
          reading_time: 12,
          views_count: 89,
          published_at: new Date(Date.now() - 86400000).toISOString(),
          seo_data: {
            meta_title: "Guide d'achat pièces détachées automobile",
            meta_description:
              "Conseils d'expert pour bien choisir vos pièces auto. Marques, qualité, prix : tout ce qu'il faut savoir.",
            keywords: ['pièces détachées', 'achat', 'guide', 'automobile'],
          },
        },
        {
          slug: 'histoire-renault-innovations',
          type: 'constructeur',
          title: "Renault : 125 ans d'innovation automobile",
          excerpt:
            "Retour sur l'histoire et les principales innovations de la marque au losange.",
          content: {
            introduction:
              "Depuis 1898, Renault façonne l'industrie automobile...",
            periods: [
              'Les débuts avec Louis Renault',
              "L'ère industrielle",
              "L'innovation électrique",
            ],
          },
          category_id: insertedCategories?.find(
            (c) => c.slug === 'constructeurs',
          )?.id,
          tags: ['renault', 'histoire', 'innovation', 'constructeur'],
          status: 'published',
          reading_time: 15,
          views_count: 234,
          published_at: new Date(Date.now() - 172800000).toISOString(),
          seo_data: {
            meta_title: "Histoire de Renault : 125 ans d'innovation",
            meta_description:
              "Découvrez l'histoire passionnante de Renault, de ses débuts en 1898 jusqu'aux véhicules électriques d'aujourd'hui.",
            keywords: [
              'renault',
              'histoire automobile',
              'innovation',
              'constructeur français',
            ],
          },
        },
      ];

      const { data: insertedArticles } = await client
        .from('blog_articles')
        .insert(articles)
        .select();

      this.logger.log(`✅ ${insertedArticles?.length || 0} articles créés`);

      // 3. Créer des entrées spécialisées pour les articles
      if (insertedArticles && insertedArticles.length > 0) {
        // Article de conseil (advice)
        const adviceArticle = insertedArticles.find((a) => a.type === 'advice');
        if (adviceArticle) {
          await client.from('blog_advice').insert({
            article_id: adviceArticle.id,
            difficulty_level: 'facile',
            tools_required: ['Tournevis', 'Gants de protection'],
            estimated_time: 30,
            steps: [
              'Ouvrir le capot du véhicule',
              'Localiser le boîtier du filtre à air',
              'Déclipser le couvercle',
              "Retirer l'ancien filtre",
              'Nettoyer le boîtier si nécessaire',
              'Installer le nouveau filtre',
              'Remettre le couvercle en place',
            ],
            tips: [
              "Vérifiez la direction du flux d'air indiquée sur le filtre",
              'Profitez-en pour nettoyer le boîtier',
            ],
            warnings: ['Ne jamais faire tourner le moteur sans filtre à air'],
          });
        }

        // Article guide
        const guideArticle = insertedArticles.find((a) => a.type === 'guide');
        if (guideArticle) {
          await client.from('blog_guides').insert({
            article_id: guideArticle.id,
            guide_type: 'achat',
            difficulty: 'moyen',
            duration: 60,
            prerequisites: ['Connaître les références de son véhicule'],
            materials: ["Carnet d'entretien", 'Références constructeur'],
            steps: [
              'Identifier les références exactes de la pièce',
              'Comparer les marques disponibles',
              'Vérifier la compatibilité',
              'Évaluer le rapport qualité-prix',
            ],
            faqs: [
              {
                question: "Peut-on acheter des pièces d'occasion ?",
                answer:
                  "Pour certaines pièces non critiques, c'est possible mais vérifiez leur état.",
              },
            ],
          });
        }
      }

      // 4. Créer des termes de glossaire
      const glossaryTerms = [
        {
          word: 'Filtre à air',
          definition:
            "Élément filtrant qui protège le moteur en retenant les impuretés de l'air d'admission.",
          category: 'Filtration',
          synonyms: ["Filtre d'admission", 'Élément filtrant'],
          related_articles: insertedArticles?.map((a) => a.id) || [],
        },
        {
          word: 'Équipementier',
          definition:
            'Entreprise qui fabrique des pièces automobiles pour les constructeurs ou le marché de la rechange.',
          category: 'Industrie',
          synonyms: ['Fournisseur', 'Fabricant'],
          see_also: ['OEM', 'Aftermarket'],
        },
        {
          word: 'OEM',
          definition:
            "Original Equipment Manufacturer - Pièce d'origine constructeur ou de même qualité.",
          category: 'Qualité',
          synonyms: ['Origine', 'Première monte'],
        },
      ];

      const { data: insertedTerms } = await client
        .from('blog_glossary')
        .insert(glossaryTerms)
        .select();

      this.logger.log(
        `✅ ${insertedTerms?.length || 0} termes de glossaire créés`,
      );

      // 5. Créer des sections pour les articles
      if (insertedArticles) {
        const sections = [];
        insertedArticles.forEach((article) => {
          sections.push(
            {
              article_id: article.id,
              level: 2,
              title: 'Introduction',
              content: "Section d'introduction détaillée...",
              position: 1,
              anchor_id: 'introduction',
            },
            {
              article_id: article.id,
              level: 2,
              title: 'Étapes détaillées',
              content: 'Description complète des étapes...',
              position: 2,
              anchor_id: 'etapes',
            },
            {
              article_id: article.id,
              level: 3,
              title: 'Conseils pratiques',
              content: 'Astuces et recommandations...',
              position: 3,
              anchor_id: 'conseils',
            },
          );
        });

        const { data: insertedSections } = await client
          .from('blog_sections')
          .insert(sections)
          .select();

        this.logger.log(`✅ ${insertedSections?.length || 0} sections créées`);
      }

      return {
        success: true,
        message: 'Données de blog créées avec succès',
        data: {
          categories: insertedCategories?.length || 0,
          articles: insertedArticles?.length || 0,
          glossaryTerms: insertedTerms?.length || 0,
          sections: '9 sections créées',
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Erreur création données blog:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * MÉTHODES PRIVÉES D'ANALYSE
   */
  private async analyzeBlogRelations(client: any) {
    const relations = [];

    try {
      // Vérifier relation articles -> catégories
      const { data: articlesWithCategories } = await client
        .from('blog_articles')
        .select('id, category_id, blog_categories(name)')
        .not('category_id', 'is', null)
        .limit(5);

      relations.push({
        table: 'blog_articles -> blog_categories',
        working: articlesWithCategories?.length > 0,
        count: articlesWithCategories?.length || 0,
      });

      // Vérifier relation articles -> produits
      const { data: articleProducts } = await client
        .from('blog_article_products')
        .select('article_id, product_id')
        .limit(5);

      relations.push({
        table: 'blog_articles -> pieces',
        working: articleProducts?.length > 0,
        count: articleProducts?.length || 0,
      });
    } catch (error) {
      this.logger.warn('⚠️ Erreur vérification relations blog:', error);
    }

    return relations;
  }

  private generateBlogRecommendations(tableAnalysis: any) {
    const recommendations = [];

    Object.entries(tableAnalysis).forEach(
      ([tableName, analysis]: [string, any]) => {
        if (!analysis.exists) {
          recommendations.push({
            type: 'MISSING_TABLE',
            table: tableName,
            priority: 'HIGH',
            action: `Créer la table ${tableName} selon le schéma fourni`,
          });
        } else if (analysis.status === 'EMPTY') {
          recommendations.push({
            type: 'EMPTY_TABLE',
            table: tableName,
            priority: 'MEDIUM',
            action: `Peupler la table ${tableName} avec du contenu initial`,
          });
        }
      },
    );

    return recommendations;
  }

  private analyzeArticleStats(articles: any[]) {
    const stats = {
      total: articles?.length || 0,
      byType: {},
      byStatus: {},
    };

    articles?.forEach((article) => {
      stats.byType[article.type] = (stats.byType[article.type] || 0) + 1;
      stats.byStatus[article.status] =
        (stats.byStatus[article.status] || 0) + 1;
    });

    return stats;
  }

  private assessContentHealth(articles: any[], recentArticles: any[]) {
    return {
      totalArticles: articles?.length || 0,
      publishedArticles:
        articles?.filter((a) => a.status === 'published').length || 0,
      draftArticles: articles?.filter((a) => a.status === 'draft').length || 0,
      recentActivity: recentArticles?.length || 0,
      healthScore: this.calculateHealthScore(articles, recentArticles),
    };
  }

  private calculateHealthScore(articles: any[], recentArticles: any[]): number {
    const published =
      articles?.filter((a) => a.status === 'published').length || 0;
    const total = articles?.length || 1;
    const recent = recentArticles?.length || 0;

    return Math.round((published / total) * 70 + (recent / 10) * 30);
  }

  private generateContentInsights(analysis: any) {
    const insights = [];

    if (analysis.contentHealth.healthScore < 50) {
      insights.push({
        type: 'WARNING',
        message:
          "Score de santé du contenu faible - considérer publier plus d'articles",
      });
    }

    if (
      analysis.articleStats.byType.advice > analysis.articleStats.byType.guide
    ) {
      insights.push({
        type: 'INFO',
        message: 'Plus de conseils que de guides - équilibrer le contenu',
      });
    }

    return insights;
  }

  private transformArticleForSearch(article: any) {
    return {
      id: `blog_${article.id}`,
      type: 'blog_article',
      title: article.title,
      content: article.content,
      excerpt: article.excerpt,
      slug: article.slug,
      articleType: article.type,
      tags: article.tags || [],
      category: article.blog_categories?.name,
      publishedAt: article.published_at,
      readingTime: article.reading_time,
      viewsCount: article.views_count,
      sections:
        article.blog_sections?.map((s) => ({
          title: s.title,
          content: s.content,
          level: s.level,
        })) || [],
      searchTerms: this.generateSearchTerms(article),
    };
  }

  private generateSearchTerms(article: any): string[] {
    const terms = [article.title, article.excerpt || ''];

    if (article.tags) {
      terms.push(...article.tags);
    }

    if (article.blog_categories?.name) {
      terms.push(article.blog_categories.name);
    }

    return terms.filter(Boolean);
  }

  private calculateRelationStats(relations: any[]) {
    return {
      total: relations?.length || 0,
      byArticleType: {},
      averageRelevance:
        relations?.reduce((sum, r) => sum + (r.relevance_score || 1), 0) /
        (relations?.length || 1),
    };
  }

  private generateRelationRecommendations(stats: any) {
    const recommendations = [];

    if (stats.total < 10) {
      recommendations.push({
        type: 'LOW_RELATIONS',
        message: 'Peu de relations produits-articles - enrichir le contenu',
      });
    }

    return recommendations;
  }

  // NOUVELLES MÉTHODES POUR LES TABLES EXISTANTES

  private getEstimatedRows(tableName: string): number {
    const estimates: Record<string, number> = {
      __blog_advice: 85,
      __blog_advice_cross: 321,
      __blog_advice_h2: 451,
      __blog_advice_h3: 200,
      __blog_advice_old: 0,
      __blog_guide: 1,
      __blog_guide_h2: 6,
      __blog_guide_h3: 2,
      __blog_meta_tags_ariane: 5,
      __blog_seo_marque: 1,
      __sitemap_blog: 109,
    };
    return estimates[tableName] || 0;
  }

  private categorizeTable(tableName: string): string {
    if (tableName.includes('advice')) return 'conseils';
    if (tableName.includes('guide')) return 'guides';
    if (tableName.includes('seo') || tableName.includes('meta')) return 'seo';
    if (tableName.includes('sitemap')) return 'navigation';
    if (tableName.includes('h2') || tableName.includes('h3')) return 'sections';
    return 'autres';
  }

  private async analyzeExistingContent(
    client: any,
    tableAnalysis: Record<string, any>,
  ) {
    const contentStats = {
      totalAdviceArticles: 0,
      totalGuideArticles: 0,
      totalSections: 0,
      totalSeoEntries: 0,
      categories: {},
    };

    try {
      // Analyser les conseils
      const adviceTable = tableAnalysis['__blog_advice'];
      if (adviceTable?.exists) {
        contentStats.totalAdviceArticles = adviceTable.count || 0;
      }

      // Analyser les guides
      const guideTable = tableAnalysis['__blog_guide'];
      if (guideTable?.exists) {
        contentStats.totalGuideArticles = guideTable.count || 0;
      }

      // Analyser les sections H2/H3
      contentStats.totalSections =
        (tableAnalysis['__blog_advice_h2']?.count || 0) +
        (tableAnalysis['__blog_advice_h3']?.count || 0) +
        (tableAnalysis['__blog_guide_h2']?.count || 0) +
        (tableAnalysis['__blog_guide_h3']?.count || 0);

      // Analyser les données SEO
      contentStats.totalSeoEntries =
        (tableAnalysis['__blog_meta_tags_ariane']?.count || 0) +
        (tableAnalysis['__blog_seo_marque']?.count || 0);
    } catch (error) {
      this.logger.warn('⚠️ Erreur analyse contenu existant:', error);
    }

    return contentStats;
  }

  private groupTablesByCategory(tableAnalysis: Record<string, any>) {
    const categories: Record<string, string[]> = {};

    Object.entries(tableAnalysis).forEach(
      ([tableName, analysis]: [string, any]) => {
        if (analysis.exists) {
          const category = analysis.category || 'autres';
          if (!categories[category]) {
            categories[category] = [];
          }
          categories[category].push(tableName);
        }
      },
    );

    return categories;
  }

  private generateMigrationRecommendations(tableAnalysis: Record<string, any>) {
    const recommendations = [];

    const populatedTables = Object.entries(tableAnalysis).filter(
      ([, analysis]: [string, any]) => analysis.status === 'POPULATED',
    );

    if (populatedTables.length > 0) {
      recommendations.push({
        type: 'MIGRATION_READY',
        priority: 'HIGH',
        action: `${populatedTables.length} tables contiennent des données et peuvent être migrées`,
        tables: populatedTables.map(([name]) => name),
      });
    }

    // Recommandations spécifiques par type de contenu
    if (tableAnalysis['__blog_advice']?.count > 0) {
      recommendations.push({
        type: 'ADVICE_MIGRATION',
        priority: 'HIGH',
        action: `Migrer ${tableAnalysis['__blog_advice'].count} conseils vers blog_articles`,
      });
    }

    if (tableAnalysis['__blog_guide']?.count > 0) {
      recommendations.push({
        type: 'GUIDE_MIGRATION',
        priority: 'HIGH',
        action: `Migrer ${tableAnalysis['__blog_guide'].count} guides vers blog_articles`,
      });
    }

    return recommendations;
  }

  private createIntegrationPlan(tableAnalysis: Record<string, any>) {
    const plan = {
      phase1: {
        name: 'Migration du contenu principal',
        tasks: [],
      },
      phase2: {
        name: 'Migration des sections et métadonnées',
        tasks: [],
      },
      phase3: {
        name: 'Optimisation et indexation',
        tasks: [],
      },
    };

    // Phase 1: Contenu principal
    if (tableAnalysis['__blog_advice']?.count > 0) {
      plan.phase1.tasks.push(
        `Migrer ${tableAnalysis['__blog_advice'].count} conseils`,
      );
    }
    if (tableAnalysis['__blog_guide']?.count > 0) {
      plan.phase1.tasks.push(
        `Migrer ${tableAnalysis['__blog_guide'].count} guides`,
      );
    }

    // Phase 2: Sections et métadonnées
    const totalSections =
      (tableAnalysis['__blog_advice_h2']?.count || 0) +
      (tableAnalysis['__blog_advice_h3']?.count || 0) +
      (tableAnalysis['__blog_guide_h2']?.count || 0) +
      (tableAnalysis['__blog_guide_h3']?.count || 0);

    if (totalSections > 0) {
      plan.phase2.tasks.push(`Migrer ${totalSections} sections H2/H3`);
    }

    if (tableAnalysis['__blog_meta_tags_ariane']?.count > 0) {
      plan.phase2.tasks.push(
        `Migrer ${tableAnalysis['__blog_meta_tags_ariane'].count} méta-tags`,
      );
    }

    // Phase 3: Optimisation
    plan.phase3.tasks.push('Indexer le contenu dans Meilisearch');
    plan.phase3.tasks.push('Créer les relations produits-articles');
    plan.phase3.tasks.push('Optimiser le référencement');

    return plan;
  }

  private async migrateAdviceContent(client: any) {
    try {
      const { data: adviceData } = await client
        .from('__blog_advice')
        .select('*')
        .limit(100);

      let migrated = 0;

      if (adviceData && adviceData.length > 0) {
        for (const advice of adviceData) {
          try {
            await client.from('blog_articles').insert({
              slug: advice.url_rewrite || `conseil-${advice.id}`,
              type: 'advice',
              title: advice.title || advice.name,
              excerpt: advice.description || advice.short_description,
              content: advice.content || advice.description,
              tags: advice.tags ? advice.tags.split(',') : [],
              status: advice.active ? 'published' : 'draft',
              reading_time: 5,
              published_at: advice.date_add || new Date().toISOString(),
              seo_data: {
                meta_title: advice.meta_title,
                meta_description: advice.meta_description,
                keywords: advice.meta_keywords
                  ? advice.meta_keywords.split(',')
                  : [],
              },
              legacy_id: advice.id,
            });
            migrated++;
          } catch (error) {
            this.logger.warn(
              `⚠️ Erreur migration conseil ${advice.id}:`,
              error,
            );
          }
        }
      }

      return { migrated, total: adviceData?.length || 0 };
    } catch (error) {
      this.logger.error('❌ Erreur migration conseils:', error);
      return { migrated: 0, total: 0, error: error.message };
    }
  }

  private async migrateGuideContent(client: any) {
    try {
      const { data: guideData } = await client
        .from('__blog_guide')
        .select('*')
        .limit(100);

      let migrated = 0;

      if (guideData && guideData.length > 0) {
        for (const guide of guideData) {
          try {
            await client.from('blog_articles').insert({
              slug: guide.url_rewrite || `guide-${guide.id}`,
              type: 'guide',
              title: guide.title || guide.name,
              excerpt: guide.description || guide.short_description,
              content: guide.content || guide.description,
              tags: guide.tags ? guide.tags.split(',') : [],
              status: guide.active ? 'published' : 'draft',
              reading_time: 10,
              published_at: guide.date_add || new Date().toISOString(),
              seo_data: {
                meta_title: guide.meta_title,
                meta_description: guide.meta_description,
                keywords: guide.meta_keywords
                  ? guide.meta_keywords.split(',')
                  : [],
              },
              legacy_id: guide.id,
            });
            migrated++;
          } catch (error) {
            this.logger.warn(`⚠️ Erreur migration guide ${guide.id}:`, error);
          }
        }
      }

      return { migrated, total: guideData?.length || 0 };
    } catch (error) {
      this.logger.error('❌ Erreur migration guides:', error);
      return { migrated: 0, total: 0, error: error.message };
    }
  }

  private async migrateSections(client: any) {
    try {
      let migrated = 0;

      // Migrer sections H2 des conseils
      const { data: adviceH2 } = await client
        .from('__blog_advice_h2')
        .select('*')
        .limit(500);

      if (adviceH2) {
        for (const section of adviceH2) {
          try {
            // Trouver l'article correspondant
            const { data: article } = await client
              .from('blog_articles')
              .select('id')
              .eq('legacy_id', section.id_advice)
              .eq('type', 'advice')
              .single();

            if (article) {
              await client.from('blog_sections').insert({
                article_id: article.id,
                level: 2,
                title: section.title,
                content: section.content,
                position: section.position || 1,
                anchor_id: section.title?.toLowerCase().replace(/\s+/g, '-'),
              });
              migrated++;
            }
          } catch (error) {
            this.logger.warn(
              `⚠️ Erreur migration section H2 ${section.id}:`,
              error,
            );
          }
        }
      }

      // Migrer sections H3 des conseils
      const { data: adviceH3 } = await client
        .from('__blog_advice_h3')
        .select('*')
        .limit(500);

      if (adviceH3) {
        for (const section of adviceH3) {
          try {
            const { data: article } = await client
              .from('blog_articles')
              .select('id')
              .eq('legacy_id', section.id_advice)
              .eq('type', 'advice')
              .single();

            if (article) {
              await client.from('blog_sections').insert({
                article_id: article.id,
                level: 3,
                title: section.title,
                content: section.content,
                position: section.position || 1,
                anchor_id: section.title?.toLowerCase().replace(/\s+/g, '-'),
              });
              migrated++;
            }
          } catch (error) {
            this.logger.warn(
              `⚠️ Erreur migration section H3 ${section.id}:`,
              error,
            );
          }
        }
      }

      return { migrated };
    } catch (error) {
      this.logger.error('❌ Erreur migration sections:', error);
      return { migrated: 0, error: error.message };
    }
  }

  private async migrateSeoData(client: any) {
    try {
      let migrated = 0;

      // Migrer les méta-tags ariane
      const { data: metaTags } = await client
        .from('__blog_meta_tags_ariane')
        .select('*');

      if (metaTags) {
        for (const meta of metaTags) {
          try {
            // Mettre à jour les articles correspondants avec les données SEO
            await client
              .from('blog_articles')
              .update({
                seo_data: {
                  ...meta,
                  breadcrumb: meta.ariane,
                },
              })
              .eq('slug', meta.url_rewrite);
            migrated++;
          } catch (error) {
            this.logger.warn(`⚠️ Erreur migration méta ${meta.id}:`, error);
          }
        }
      }

      return { migrated };
    } catch (error) {
      this.logger.error('❌ Erreur migration SEO:', error);
      return { migrated: 0, error: error.message };
    }
  }

  private async migrateSitemapData(client: any) {
    try {
      const { data: sitemapData } = await client
        .from('__sitemap_blog')
        .select('*');

      // Pour l'instant, on stocke juste les données pour référence
      return {
        migrated: 0,
        sitemap_entries: sitemapData?.length || 0,
        note: 'Sitemap data analyzed but not migrated to specific table yet',
      };
    } catch (error) {
      this.logger.error('❌ Erreur migration sitemap:', error);
      return { migrated: 0, error: error.message };
    }
  }
}
