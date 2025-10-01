import { Injectable, Logger, Inject, NotFoundException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { SupabaseIndexationService } from '../../search/services/supabase-indexation.service';
import { BlogCacheService } from './blog-cache.service';
import {
  BlogArticle,
  BlogSection,
  BlogSearchResult,
  BlogDashboard,
} from '../interfaces/blog.interfaces';

/**
 * 📰 BlogService - Service principal AMÉLIORÉ pour la gestion du contenu blog
 *
 * 🎯 FONCTIONNALITÉS AMÉLIORÉES :
 * - Cache intelligent avec stratégie 3-niveaux (hot/warm/cold)
 * - Décodage HTML automatique des entités
 * - Recherche unifiée avec Meilisearch
 * - Agrégation de données multi-tables optimisée
 * - Gestion des articles legacy + modernes
 * - SEO et méta-données intégrés
 * - Temps de lecture automatique
 * - Gestion des vues et popularité
 */
@Injectable()
export class BlogService {
  private readonly logger = new Logger(BlogService.name);

  constructor(
    private readonly supabaseService: SupabaseIndexationService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly blogCacheService: BlogCacheService,
  ) {}

  /**
   * 🏠 Page d'accueil du blog (remplace blog.index.php) - VERSION AMÉLIORÉE
   */
  async getHomepageContent(): Promise<BlogDashboard> {
    const cacheKey = 'homepage';

    // Essayer le cache d'abord
    const cached = await this.blogCacheService.get<BlogDashboard>(
      cacheKey,
      10000,
    ); // Cache chaud
    if (cached) return cached;

    this.logger.log('🏠 Génération du contenu homepage');

    try {
      const [featured, recent, popular, categories, stats] = await Promise.all([
        this.getFeaturedArticles(3),
        this.getRecentArticles(6),
        this.getPopularArticles(5),
        this.getCategories(),
        this.getBlogStats(),
      ]);

      const result: BlogDashboard = {
        featured,
        recent,
        popular,
        categories,
        stats,
        lastUpdated: new Date().toISOString(),
        success: true,
      };

      // Cache avec stratégie chaud (articles populaires)
      await this.blogCacheService.set(cacheKey, result, 10000);

      return result;
    } catch (error) {
      this.logger.error('Erreur homepage:', error);
      throw error;
    }
  }

  /**
   * � Recherche unifiée dans tout le contenu blog
   */
  /**
   * 🔍 Recherche unifiée dans tout le contenu blog
   */
  async searchBlog(
    query: string,
    type: 'all' | 'advice' | 'guide' | 'constructeur' | 'glossaire' = 'all',
    page: number = 1,
    limit: number = 20,
  ): Promise<BlogSearchResult> {
    try {
      this.logger.log(`🔍 Recherche "${query}"`);

      // Recherche simple dans les conseils pour le moment
      const { data } = await this.supabaseService.client
        .from('__blog_advice')
        .select('*')
        .ilike('ba_title', `%${query}%`)
        .range((page - 1) * limit, page * limit - 1);

      const results =
        data?.map((item) => this.transformAdviceToArticle(item)) || [];

      this.logger.log(`🔍 Recherche "${query}": ${results.length} résultats`);

      return {
        query,
        type,
        results,
        total: results.length,
        page,
        limit,
      };
    } catch (error) {
      this.logger.error(
        `❌ Erreur recherche blog: ${(error as Error).message}`,
      );
      return { query, type, results: [], total: 0, page, limit };
    }
  }

  /**
   * 📝 Créer un nouvel article - VERSION AMÉLIORÉE
   */
  async createArticle(
    article: Partial<BlogArticle>,
    authorId: string,
  ): Promise<BlogArticle> {
    try {
      // Générer un slug unique
      const slug = await this.generateUniqueSlug(article.title || '');

      // Calculer le temps de lecture
      const readingTime = this.calculateReadingTime(article.content);

      // Nettoyer et décoder le contenu HTML
      const cleanedContent = this.cleanAndDecodeContent(article.content);

      const newArticle: Partial<BlogArticle> = {
        ...article,
        slug,
        authorId,
        readingTime,
        content: cleanedContent,
        status: article.status || 'draft',
        publishedAt: article.status === 'published' ? new Date() : undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Insérer dans les tables modernes
      const { data, error } = await this.supabaseService.client
        .from('blog_articles')
        .insert(newArticle)
        .select()
        .single();

      if (error) throw error;

      // Invalider les caches
      await this.invalidateRelatedCaches(['homepage', 'recent', 'categories']);

      this.logger.log(`✅ Article créé: ${slug}`);
      return data;
    } catch (error) {
      this.logger.error('Erreur createArticle:', error);
      throw error;
    }
  }

  /**
   * ✏️ Mettre à jour un article - VERSION AMÉLIORÉE
   */
  async updateArticle(
    id: number,
    updates: Partial<BlogArticle>,
  ): Promise<BlogArticle> {
    try {
      const updateData: any = { ...updates };

      // Si le titre change, régénérer le slug
      if (updates.title) {
        updateData.slug = await this.generateUniqueSlug(updates.title, id);
      }

      // Recalculer le temps de lecture si le contenu change
      if (updates.content) {
        updateData.readingTime = this.calculateReadingTime(updates.content);
        updateData.content = this.cleanAndDecodeContent(updates.content);
      }

      updateData.updatedAt = new Date();

      const { data, error } = await this.supabaseService.client
        .from('blog_articles')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Invalider les caches liés
      await this.invalidateRelatedCaches([
        'homepage',
        'recent',
        `article:${data.slug}`,
        `article:${updates.slug}`,
      ]);

      this.logger.log(`✅ Article mis à jour: ${data.slug}`);
      return data;
    } catch (error) {
      this.logger.error('Erreur updateArticle:', error);
      throw error;
    }
  }

  /**
   * 🔍 Recherche unifiée dans tout le contenu blog
   */
  async searchBlog(
    query: string,
    type: 'all' | 'advice' | 'guide' | 'constructeur' | 'glossaire' = 'all',
    page: number = 1,
    limit: number = 20,
  ): Promise<BlogSearchResult> {
    try {
      this.logger.log(`🔍 Recherche "${query}"`);

      // Recherche simple dans les conseils pour le moment
      const { data } = await this.supabaseService.client
        .from('__blog_advice')
        .select('*')
        .ilike('ba_title', `%${query}%`)
        .range((page - 1) * limit, page * limit - 1);

      const results =
        data?.map((item) => this.transformAdviceToArticle(item)) || [];

      this.logger.log(`🔍 Recherche "${query}": ${results.length} résultats`);

      return {
        query,
        type,
        results,
        total: results.length,
        page,
        limit,
      };
    } catch (error) {
      this.logger.error(
        `❌ Erreur recherche blog: ${(error as Error).message}`,
      );
      return { query, type, results: [], total: 0, page, limit };
    }
  }

  /**
   * � Récupération d'un article par gamme (pieces_gamme alias) - Legacy URL support
   * Exemple: alternateur → trouve l'article lié à cette gamme
   */
  async getArticleByGamme(pg_alias: string): Promise<BlogArticle | null> {
    try {
      this.logger.log(`🔄 Recherche article par gamme: ${pg_alias}`);

      // 1. Trouver le pg_id depuis pieces_gamme
      const { data: gammeData } = await this.supabaseService.client
        .from('pieces_gamme')
        .select('pg_id, pg_name')
        .eq('pg_alias', pg_alias)
        .single();

      if (!gammeData) {
        this.logger.warn(`⚠️ Gamme non trouvée: ${pg_alias}`);
        return null;
      }

      this.logger.log(
        `✅ Gamme trouvée: ${gammeData.pg_name} (ID: ${gammeData.pg_id})`,
      );

      // 2. Trouver l'article le plus récent pour cette gamme
      const { data, error } = await this.supabaseService.client
        .from('__blog_advice')
        .select('*')
        .eq('ba_pg_id', gammeData.pg_id)
        .order('ba_update', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        this.logger.warn(
          `⚠️ Aucun article trouvé pour la gamme ID: ${gammeData.pg_id}`,
        );
        return null;
      }

      this.logger.log(
        `✅ Article trouvé: ${data.ba_h1} (slug: ${data.ba_alias})`,
      );
      const article = await this.transformAdviceToArticleWithSections(data);
      // Ajouter le pg_alias qu'on connaît déjà depuis le paramètre
      article.pg_alias = pg_alias;
      
      // Charger les articles croisés (related articles)
      article.relatedArticles = await this.getRelatedArticles(data.ba_id);
      
      // Charger les véhicules compatibles avec cette gamme de pièce
      article.compatibleVehicles = await this.getCompatibleVehicles(gammeData.pg_id, 12);
      
      return article;
    } catch (error) {
      this.logger.error(
        `❌ Erreur recherche article par gamme ${pg_alias}: ${(error as Error).message}`,
      );
      return null;
    }
  }

  /**
   * 📰 Charger les articles croisés (sidebar "On vous propose")
   */
  async getRelatedArticles(ba_id: number): Promise<BlogArticle[]> {
    try {
      this.logger.log(`📰 Chargement articles croisés pour BA_ID: ${ba_id}`);

      const { data: crossData } = await this.supabaseService.client
        .from('__blog_advice_cross')
        .select('bac_ba_id_cross')
        .eq('bac_ba_id', ba_id);

      if (!crossData || crossData.length === 0) {
        this.logger.log(`   ℹ️  Aucun article croisé trouvé pour BA_ID: ${ba_id}`);
        return [];
      }

      // Récupérer les IDs des articles croisés
      const crossIds = crossData.map((c) => c.bac_ba_id_cross);
      this.logger.log(`   ✅ ${crossIds.length} articles croisés trouvés (IDs: ${crossIds.join(', ')})`);

      // Charger les articles complets
      const { data: articles } = await this.supabaseService.client
        .from('__blog_advice')
        .select('*')
        .in('ba_id', crossIds)
        .order('ba_update', { ascending: false });

      if (!articles) return [];

      // Transformer et enrichir avec pg_alias
      const transformed = articles.map((item) =>
        this.transformAdviceToArticle(item),
      );
      const enriched = await this.enrichWithPgAlias(transformed);
      this.logger.log(`   ✅ Articles croisés enrichis: ${enriched.map(a => a.pg_alias || a.slug).join(', ')}`);
      return enriched;
    } catch (error) {
      this.logger.error(
        `❌ Erreur articles croisés pour BA_ID ${ba_id}: ${(error as Error).message}`,
      );
      return [];
    }
  }

  /**
   * 🚗 Charger les véhicules compatibles avec une gamme de pièce
   * Utilise REST API (pas de foreign keys nécessaires)
   */
  async getCompatibleVehicles(pg_id: number, limit = 12): Promise<any[]> {
    try {
      this.logger.log(`🚗 Chargement véhicules compatibles pour PG_ID: ${pg_id}`);

      // Étape 1 : Récupérer les TYPE_ID compatibles depuis __cross_gamme_car_new
      const { data: crossData, error: crossError } =
        await this.supabaseService.client
          .from('__cross_gamme_car_new')
          .select('cgc_type_id')
          .eq('cgc_pg_id', pg_id)
          .eq('cgc_level', 2)
          .limit(limit);

      if (crossError) {
        this.logger.error(`   ❌ Erreur Supabase cross_gamme_car:`, crossError);
        return [];
      }

      if (!crossData || crossData.length === 0) {
        this.logger.log(
          `   ℹ️  Aucun véhicule compatible trouvé pour PG_ID: ${pg_id}`,
        );
        return [];
      }

      const typeIds = crossData.map((item) => item.cgc_type_id);
      this.logger.log(
        `   📋 ${typeIds.length} TYPE_ID trouvés: ${typeIds.slice(0, 5).join(', ')}...`,
      );

      // Étape 2 : Charger les données des véhicules (AUTO_TYPE)
      const { data: typesData, error: typesError } =
        await this.supabaseService.client
          .from('auto_type')
          .select('*')
          .in('type_id', typeIds)
          .eq('type_display', 1)
          .limit(limit);

      if (typesError) {
        this.logger.error(`   ❌ Erreur auto_type:`, typesError);
        return [];
      }

      if (!typesData || typesData.length === 0) {
        this.logger.warn(
          `   ⚠️  Aucun type trouvé dans auto_type pour ${typeIds.length} IDs`,
        );
        return [];
      }

      this.logger.log(`   ✅ ${typesData.length} types chargés depuis auto_type`);

      // Étape 3 : Charger les modèles (AUTO_MODELE)
      const modeleIds = [
        ...new Set(typesData.map((t) => t.type_modele_id).filter((id) => id)),
      ];
      const { data: modelesData } = await this.supabaseService.client
        .from('auto_modele')
        .select('*')
        .in('modele_id', modeleIds)
        .eq('modele_display', 1);

      // Étape 4 : Charger les marques (AUTO_MARQUE)
      const marqueIds = [
        ...new Set(
          modelesData?.map((m) => m.modele_marque_id).filter((id) => id) || [],
        ),
      ];
      const { data: marquesData } = await this.supabaseService.client
        .from('auto_marque')
        .select('*')
        .in('marque_id', marqueIds)
        .eq('marque_display', 1);

      // Créer des maps pour accès rapide
      const modelesMap = new Map(modelesData?.map((m) => [m.modele_id, m]));
      const marquesMap = new Map(marquesData?.map((m) => [m.marque_id, m]));

      // Étape 5 : Assembler les données
      const vehicles = typesData
        .map((type) => {
          const modele = modelesMap.get(type.type_modele_id);
          const marque = modele ? marquesMap.get(modele.modele_marque_id) : null;

          if (!modele || !marque) return null;

          // Période de production
          let period = '';
          if (type.type_year_to) {
            period = `${type.type_month_from}/${type.type_year_from} - ${type.type_month_to}/${type.type_year_to}`;
          } else {
            period = `depuis ${type.type_month_from}/${type.type_year_from}`;
          }

          return {
            type_id: type.type_id,
            type_alias: type.type_alias,
            type_name: type.type_name,
            type_power: type.type_power_ps,
            type_fuel: type.type_fuel,
            type_body: type.type_body,
            period,
            modele_id: modele.modele_id,
            modele_alias: modele.modele_alias,
            modele_name: modele.modele_name,
            modele_pic: modele.modele_pic,
            marque_id: marque.marque_id,
            marque_alias: marque.marque_alias,
            marque_name: marque.marque_name,
            marque_logo: marque.marque_logo,
            // URL vers la page catalogue
            catalog_url: `/constructeurs/${marque.marque_alias}-${marque.marque_id}/${modele.modele_alias}-${modele.modele_id}/${type.type_alias}-${type.type_id}.html`,
          };
        })
        .filter((v) => v !== null);

      this.logger.log(`   ✅ ${vehicles.length} véhicules compatibles assemblés`);
      return vehicles;
    } catch (error) {
      this.logger.error(
        `❌ Erreur véhicules compatibles PG_ID ${pg_id}:`,
        error,
      );
      return [];
    }
  }

  /**
   * 📄 Récupération d'un article par slug
   */
  async getArticleBySlug(slug: string): Promise<BlogArticle | null> {
    try {
      // Chercher dans toutes les tables via supabase
      const { data, error } = await this.supabaseService.client
        .from('__blog_advice')
        .select('*')
        .eq('ba_alias', slug)
        .single();

      if (error || !data) {
        // Essayer dans les guides
        const { data: guideData } = await this.supabaseService.client
          .from('__blog_guide')
          .select('*')
          .eq('bg_alias', slug)
          .single();

        if (guideData) {
          return this.transformGuideToArticle(guideData);
        }

        return null;
      }

      return await this.transformAdviceToArticleWithSections(data);
    } catch (error) {
      this.logger.error(
        `❌ Erreur récupération article ${slug}: ${(error as Error).message}`,
      );
      return null;
    }
  }

  /**
   * � Récupérer un article par son ID
   */
  async getArticleById(id: number): Promise<BlogArticle | null> {
    try {
      this.logger.log(`🔍 Récupération article ID: ${id}`);

      // Chercher d'abord dans la table moderne
      const { data: modernArticle } = await this.supabaseService.client
        .from('blog_articles')
        .select('*')
        .eq('id', id)
        .single();

      if (modernArticle) {
        return modernArticle;
      }

      // Chercher dans les tables legacy
      const { data: adviceData } = await this.supabaseService.client
        .from('__blog_advice')
        .select('*')
        .eq('ba_id', id)
        .single();

      if (adviceData) {
        return this.transformAdviceToArticle(adviceData);
      }

      // Chercher dans les guides
      const { data: guideData } = await this.supabaseService.client
        .from('__blog_guide')
        .select('*')
        .eq('bg_id', id)
        .single();

      if (guideData) {
        return this.transformGuideToArticle(guideData);
      }

      return null;
    } catch (error) {
      this.logger.error(
        `❌ Erreur récupération article ID ${id}: ${(error as Error).message}`,
      );
      return null;
    }
  }

  /**
   * 📋 Récupérer les articles pour l'administration
   */
  async getArticlesForAdmin(options: {
    page: number;
    limit: number;
    status?: string;
    search?: string;
  }): Promise<{
    articles: BlogArticle[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    try {
      this.logger.log(
        `📋 Récupération articles admin - Page: ${options.page}, Limite: ${options.limit}`,
      );

      const offset = (options.page - 1) * options.limit;

      // Construction de la requête de base
      let query = this.supabaseService.client
        .from('__blog_advice')
        .select('*', { count: 'exact' });

      // Filtre par statut si spécifié
      if (options.status) {
        query = query.eq('ba_status', options.status);
      }

      // Filtre par recherche si spécifié
      if (options.search) {
        query = query.or(
          `ba_title.ilike.%${options.search}%,ba_content.ilike.%${options.search}%`,
        );
      }

      // Pagination et tri
      query = query
        .order('ba_date', { ascending: false })
        .range(offset, offset + options.limit - 1);

      const { data, error, count } = await query;

      if (error) {
        throw error;
      }

      const articles = data
        ? data.map((advice) => this.transformAdviceToArticle(advice))
        : [];
      const total = count || 0;
      const totalPages = Math.ceil(total / options.limit);

      return {
        articles,
        total,
        page: options.page,
        totalPages,
      };
    } catch (error) {
      this.logger.error(
        `❌ Erreur récupération articles admin: ${(error as Error).message}`,
      );
      return {
        articles: [],
        total: 0,
        page: options.page,
        totalPages: 0,
      };
    }
  }

  /**
   * �📊 Dashboard avec statistiques complètes
   */
  async getBlogStats(): Promise<BlogDashboard> {
    try {
      const cacheKey = 'blog:dashboard';
      const cached = await this.cacheManager.get<BlogDashboard>(cacheKey);
      if (cached) return cached;

      // Statistiques des conseils
      const { data: adviceStats } = await this.supabaseService.client
        .from('__blog_advice')
        .select('ba_visit, ba_create, ba_update');

      // Statistiques des guides
      const { data: guideStats } = await this.supabaseService.client
        .from('__blog_guide')
        .select('bg_visit, bg_create, bg_update');

      const totalAdvice = adviceStats?.length || 0;
      const totalGuides = guideStats?.length || 0;
      const totalArticles = totalAdvice + totalGuides;

      const adviceViews =
        adviceStats?.reduce(
          (sum, item) => sum + (parseInt(item.ba_visit) || 0),
          0,
        ) || 0;
      const guideViews =
        guideStats?.reduce(
          (sum, item) => sum + (parseInt(item.bg_visit) || 0),
          0,
        ) || 0;
      const totalViews = adviceViews + guideViews;

      const dashboard: BlogDashboard = {
        overview: {
          totalArticles,
          totalViews,
          totalAdvice,
          totalGuides,
        },
        byType: {
          advice: {
            total: totalAdvice,
            views: adviceViews,
            avgViews:
              totalAdvice > 0 ? Math.round(adviceViews / totalAdvice) : 0,
          },
          guide: {
            total: totalGuides,
            views: guideViews,
            avgViews:
              totalGuides > 0 ? Math.round(guideViews / totalGuides) : 0,
          },
          constructeur: { total: 0, views: 0, avgViews: 0 },
          glossaire: { total: 0, views: 0, avgViews: 0 },
        },
        popular: await this.getPopularArticles(5),
        lastUpdated: new Date().toISOString(),
      };

      await this.cacheManager.set(cacheKey, dashboard, 3600 * 1000); // 1h TTL
      return dashboard;
    } catch (error) {
      this.logger.error(
        `❌ Erreur statistiques blog: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  /**
   * 📊 Statistiques simplifiées pour le contrôleur dashboard
   */
  async getSimpleBlogStats(): Promise<{
    totalArticles: number;
    totalViews: number;
    totalAdvice: number;
    totalGuides: number;
  }> {
    try {
      const dashboard = await this.getBlogStats();
      return {
        totalArticles: dashboard.overview?.totalArticles || 0,
        totalViews: dashboard.overview?.totalViews || 0,
        totalAdvice: dashboard.overview?.totalAdvice || 0,
        totalGuides: dashboard.overview?.totalGuides || 0,
      };
    } catch (error) {
      this.logger.error(`❌ Erreur stats simples: ${(error as Error).message}`);
      return {
        totalArticles: 0,
        totalViews: 0,
        totalAdvice: 0,
        totalGuides: 0,
      };
    }
  }

  /**
   * 🔥 Articles populaires
   */
  async getPopularArticles(limit: number = 10): Promise<BlogArticle[]> {
    try {
      const { data } = await this.supabaseService.client
        .from('__blog_advice')
        .select('*')
        .order('ba_visit', { ascending: false })
        .limit(limit);

      const articles = data?.map((item) => this.transformAdviceToArticle(item)) || [];
      return await this.enrichWithPgAlias(articles);
    } catch (error) {
      this.logger.error(
        `❌ Erreur articles populaires: ${(error as Error).message}`,
      );
      return [];
    }
  }

  /**
   * 🔄 Transformation advice → BlogArticle AVEC sections H2/H3 depuis tables séparées
   */
  private async transformAdviceToArticleWithSections(
    advice: any,
  ): Promise<BlogArticle> {
    // Charger les sections H2 et H3 en parallèle
    const [{ data: h2Sections }, { data: h3Sections }] = await Promise.all([
      this.supabaseService.client
        .from('__blog_advice_h2')
        .select('*')
        .eq('ba2_ba_id', advice.ba_id)
        .order('ba2_id'),
      this.supabaseService.client
        .from('__blog_advice_h3')
        .select('*')
        .eq('ba3_ba_id', advice.ba_id)
        .order('ba3_id'),
    ]);

    // Construire les sections avec structure hiérarchique
    const sections: BlogSection[] = [];
    
    // Traiter chaque H2
    h2Sections?.forEach((h2: any) => {
      sections.push({
        level: 2,
        title: BlogCacheService.decodeHtmlEntities(h2.ba2_h2 || ''),
        content: BlogCacheService.decodeHtmlEntities(h2.ba2_content || ''),
        anchor: this.generateAnchor(h2.ba2_h2),
        cta_anchor: h2.ba2_cta_anchor || null,
        cta_link: h2.ba2_cta_link || null,
        wall: h2.ba2_wall || null,
      });
      
      // Ajouter les H3 qui appartiennent à ce H2
      h3Sections?.forEach((h3: any) => {
        if (h3.ba3_ba2_id === h2.ba2_id) {
          sections.push({
            level: 3,
            title: BlogCacheService.decodeHtmlEntities(h3.ba3_h3 || ''),
            content: BlogCacheService.decodeHtmlEntities(h3.ba3_content || ''),
            anchor: this.generateAnchor(h3.ba3_h3),
            cta_anchor: h3.ba3_cta_anchor || null,
            cta_link: h3.ba3_cta_link || null,
            wall: h3.ba3_wall || null,
          });
        }
      });
    });

    return {
      id: `advice_${advice.ba_id}`,
      type: 'advice',
      title: BlogCacheService.decodeHtmlEntities(advice.ba_title || ''),
      slug: advice.ba_alias,
      pg_alias: null, // Sera enrichi par enrichWithPgAlias() si besoin
      excerpt: BlogCacheService.decodeHtmlEntities(
        advice.ba_preview || advice.ba_descrip || '',
      ),
      content: BlogCacheService.decodeHtmlEntities(advice.ba_content || ''),
      h1: BlogCacheService.decodeHtmlEntities(advice.ba_h1 || ''),
      h2: BlogCacheService.decodeHtmlEntities(advice.ba_h2 || ''),
      keywords: advice.ba_keywords ? advice.ba_keywords.split(', ') : [],
      tags: advice.ba_keywords ? advice.ba_keywords.split(', ') : [],
      publishedAt: advice.ba_create,
      updatedAt: advice.ba_update,
      viewsCount: parseInt(advice.ba_visit) || 0,
      sections, // Sections chargées depuis les tables
      legacy_id: advice.ba_id,
      legacy_table: '__blog_advice',
      cta_anchor: advice.ba_cta_anchor || null,
      cta_link: advice.ba_cta_link || null,
      seo_data: {
        meta_title: BlogCacheService.decodeHtmlEntities(advice.ba_title || ''),
        meta_description: BlogCacheService.decodeHtmlEntities(
          advice.ba_descrip || '',
        ),
      },
    };
  }

  private transformAdviceToArticle(advice: any): BlogArticle {
    const article: any = {
      id: `advice_${advice.ba_id}`,
      type: 'advice',
      title: BlogCacheService.decodeHtmlEntities(advice.ba_title || ''),
      slug: advice.ba_alias,
      pg_alias: null, // Sera enrichi par enrichWithPgAlias()
      excerpt: BlogCacheService.decodeHtmlEntities(
        advice.ba_preview || advice.ba_descrip || '',
      ),
      content: BlogCacheService.decodeHtmlEntities(advice.ba_content || ''),
      h1: BlogCacheService.decodeHtmlEntities(advice.ba_h1 || ''),
      h2: BlogCacheService.decodeHtmlEntities(advice.ba_h2 || ''),
      keywords: advice.ba_keywords ? advice.ba_keywords.split(', ') : [],
      tags: advice.ba_keywords ? advice.ba_keywords.split(', ') : [],
      publishedAt: advice.ba_create,
      updatedAt: advice.ba_update,
      viewsCount: parseInt(advice.ba_visit) || 0,
      sections: [], // Pas de sections pour les listes
      legacy_id: advice.ba_id,
      legacy_table: '__blog_advice',
      seo_data: {
        meta_title: BlogCacheService.decodeHtmlEntities(advice.ba_title || ''),
        meta_description: BlogCacheService.decodeHtmlEntities(
          advice.ba_descrip || '',
        ),
      },
      ba_pg_id: advice.ba_pg_id, // Garder temporairement pour enrichWithPgAlias()
    };
    
    return article;
  }

  /**
   * 🔄 Transformation guide → BlogArticle
   */
  private transformGuideToArticle(guide: any): BlogArticle {
    return {
      id: `guide_${guide.bg_id}`,
      type: 'guide',
      title: BlogCacheService.decodeHtmlEntities(guide.bg_title || ''),
      slug: guide.bg_alias,
      excerpt: BlogCacheService.decodeHtmlEntities(
        guide.bg_preview || guide.bg_descrip || '',
      ),
      content: BlogCacheService.decodeHtmlEntities(guide.bg_content || ''),
      h1: BlogCacheService.decodeHtmlEntities(guide.bg_h1 || ''),
      h2: BlogCacheService.decodeHtmlEntities(guide.bg_h2 || ''),
      keywords: guide.bg_keywords ? guide.bg_keywords.split(', ') : [],
      tags: guide.bg_keywords ? guide.bg_keywords.split(', ') : [],
      publishedAt: guide.bg_create,
      updatedAt: guide.bg_update,
      viewsCount: parseInt(guide.bg_visit) || 0,
      sections: [],
      legacy_id: guide.bg_id,
      legacy_table: '__blog_guide',
      seo_data: {
        meta_title: BlogCacheService.decodeHtmlEntities(
          guide.bg_meta_title || '',
        ),
        meta_description: BlogCacheService.decodeHtmlEntities(
          guide.bg_meta_description || '',
        ),
        keywords: guide.bg_keywords ? guide.bg_keywords.split(', ') : [],
      },
    };
  }

  /**
   * 📝 Extraction des sections depuis le contenu
   */
  private extractSectionsFromContent(data: any): BlogSection[] {
    const sections: BlogSection[] = [];

    // Section H2
    if (data.ba2_h2 && data.ba2_content) {
      sections.push({
        level: 2,
        title: BlogCacheService.decodeHtmlEntities(data.ba2_h2),
        content: BlogCacheService.decodeHtmlEntities(data.ba2_content),
        anchor: this.generateAnchor(data.ba2_h2),
      });
    }

    // Section H3
    if (data.ba3_h3 && data.ba3_content) {
      sections.push({
        level: 3,
        title: BlogCacheService.decodeHtmlEntities(data.ba3_h3),
        content: BlogCacheService.decodeHtmlEntities(data.ba3_content),
        anchor: this.generateAnchor(data.ba3_h3),
      });
    }

    return sections;
  }

  /**
   * 🔗 Génération d'ancre pour navigation
   */
  private generateAnchor(title: string): string {
    return title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  // === MÉTHODES AMÉLIORÉES AJOUTÉES ===

  /**
   * 🏠 Articles en vedette (Featured) - AMÉLIORÉ avec cache
   */
  private async getFeaturedArticles(limit: number = 3): Promise<BlogArticle[]> {
    const cacheKey = `featured:${limit}`;
    const cached = await this.blogCacheService.get<BlogArticle[]>(
      cacheKey,
      5000,
    );
    if (cached) return cached;

    try {
      const { data } = await this.supabaseService.client
        .from('__blog_advice')
        .select('*')
        .order('ba_views', { ascending: false })
        .limit(limit);

      const articles =
        data?.map((item) => this.transformAdviceToArticle(item)) || [];
      await this.blogCacheService.set(cacheKey, articles, 5000);
      return articles;
    } catch (error) {
      this.logger.error('Erreur getFeaturedArticles:', error);
      return [];
    }
  }

  /**
   * 📰 Articles récents - AMÉLIORÉ
   */
  private async getRecentArticles(limit: number = 6): Promise<BlogArticle[]> {
    const cacheKey = `recent:${limit}`;
    const cached = await this.blogCacheService.get<BlogArticle[]>(
      cacheKey,
      1000,
    );
    if (cached) return cached;

    try {
      const { data } = await this.supabaseService.client
        .from('__blog_advice')
        .select('*')
        .order('ba_date_add', { ascending: false })
        .limit(limit);

      const articles =
        data?.map((item) => this.transformAdviceToArticle(item)) || [];
      const enriched = await this.enrichWithPgAlias(articles);
      await this.blogCacheService.set(cacheKey, enriched, 1000);
      return enriched;
    } catch (error) {
      this.logger.error('Erreur getRecentArticles:', error);
      return [];
    }
  }

  /**
   * 📁 Catégories - AMÉLIORÉ
   */
  private async getCategories(): Promise<any[]> {
    const cacheKey = 'categories';
    const cached = await this.blogCacheService.get<any[]>(cacheKey, 5000);
    if (cached) return cached;

    try {
      const categories = [
        {
          id: 1,
          name: 'Conseils',
          slug: 'advice',
          description: "Conseils pratiques pour l'entretien automobile",
          articlesCount: await this.getTypeCount('__blog_advice'),
        },
        {
          id: 2,
          name: 'Guides',
          slug: 'guide',
          description: 'Guides détaillés de réparation et maintenance',
          articlesCount: await this.getTypeCount('__blog_guide'),
        },
      ];

      await this.blogCacheService.set(cacheKey, categories, 5000);
      return categories;
    } catch (error) {
      this.logger.error('Erreur getCategories:', error);
      return [];
    }
  }

  /**
   * ⏱️ Calculer le temps de lecture
   */
  private calculateReadingTime(content: any): number {
    if (!content) return 1;

    const text =
      typeof content === 'string' ? content : JSON.stringify(content);
    const cleanText = BlogCacheService.decodeHtmlEntities(text).replace(
      /<[^>]*>/g,
      '',
    );
    const wordsPerMinute = 200;
    const words = cleanText
      .split(/\s+/)
      .filter((word: string) => word.length > 0).length;
    return Math.max(1, Math.ceil(words / wordsPerMinute));
  }

  /**
   * 🧹 Nettoyer et décoder le contenu
   */
  private cleanAndDecodeContent(content: any): string {
    if (!content) return '';

    const text =
      typeof content === 'string' ? content : JSON.stringify(content);
    return BlogCacheService.decodeHtmlEntities(text);
  }

  /**
   * 🔗 Générer un slug unique - VERSION AMÉLIORÉE
   */
  private async generateUniqueSlug(
    title: string,
    excludeId?: number,
  ): Promise<string> {
    const slug = this.slugifyTitle(BlogCacheService.decodeHtmlEntities(title));
    let counter = 0;
    let uniqueSlug = slug;

    while (true) {
      const existsInAdvice = await this.checkSlugExists(
        '__blog_advice',
        'ba_alias',
        uniqueSlug,
      );
      const existsInGuide = await this.checkSlugExists(
        '__blog_guide',
        'bg_alias',
        uniqueSlug,
      );

      if (!existsInAdvice && !existsInGuide) {
        return uniqueSlug;
      }

      counter++;
      uniqueSlug = `${slug}-${counter}`;
    }
  }

  /**
   * 👁️ Incrémenter le compteur de vues
   */
  private async incrementViewCount(slug: string, type: string): Promise<void> {
    try {
      if (type === 'advice') {
        await this.supabaseService.client.rpc('increment_views', {
          table_name: '__blog_advice',
          slug_column: 'ba_alias',
          views_column: 'ba_views',
          slug_value: slug,
        });
      }
    } catch (error) {
      this.logger.warn('Erreur incrementViewCount:', error);
    }
  }

  /**
   * � Enrichir les articles avec pg_alias depuis pieces_gamme
   */
  private async enrichWithPgAlias(articles: BlogArticle[]): Promise<BlogArticle[]> {
    if (!articles || articles.length === 0) return articles;

    try {
      // Récupérer tous les ba_pg_id uniques
      const pgIds = [...new Set(
        articles
          .map(a => (a as any).ba_pg_id)
          .filter(id => id != null)
      )];

      if (pgIds.length === 0) return articles;

      // Charger tous les pg_alias en une seule requête
      const { data: gammes } = await this.supabaseService.client
        .from('pieces_gamme')
        .select('pg_id, pg_alias')
        .in('pg_id', pgIds);

      // Créer un map pour accès rapide
      const pgAliasMap = new Map();
      gammes?.forEach(g => pgAliasMap.set(g.pg_id, g.pg_alias));

      // Enrichir chaque article
      return articles.map(article => ({
        ...article,
        pg_alias: pgAliasMap.get((article as any).ba_pg_id) || null,
      }));
    } catch (error) {
      this.logger.warn('Erreur enrichWithPgAlias:', error);
      return articles;
    }
  }

  /**
   * �🗑️ Invalider les caches liés
   */
  private async invalidateRelatedCaches(keys: string[]): Promise<void> {
    for (const key of keys) {
      await this.blogCacheService.del(key);
    }
  }

  /**
   * ✅ Vérifier si un slug existe
   */
  private async checkSlugExists(
    tableName: string,
    columnName: string,
    slug: string,
  ): Promise<boolean> {
    const { data } = await this.supabaseService.client
      .from(tableName)
      .select('id')
      .eq(columnName, slug)
      .maybeSingle();

    return !!data;
  }

  /**
   * 📊 Compter les articles par type
   */
  private async getTypeCount(tableName: string): Promise<number> {
    const { count } = await this.supabaseService.client
      .from(tableName)
      .select('*', { count: 'exact', head: true });

    return count || 0;
  }

  /**
   * 🔄 Récupérer article depuis tables legacy
   */
  private async getArticleFromLegacyTables(
    slug: string,
  ): Promise<BlogArticle | null> {
    try {
      const { data: adviceData } = await this.supabaseService.client
        .from('__blog_advice')
        .select('*')
        .eq('ba_alias', slug)
        .single();

      if (adviceData) {
        return this.transformAdviceToArticle(adviceData);
      }

      const { data: guideData } = await this.supabaseService.client
        .from('__blog_guide')
        .select('*')
        .eq('bg_alias', slug)
        .single();

      if (guideData) {
        return this.transformGuideToArticle(guideData);
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * 🆕 Récupérer article depuis tables modernes (placeholder)
   */
  private async getArticleFromModernTables(
    slug: string,
  ): Promise<BlogArticle | null> {
    // Pour l'instant retourne null, à implémenter quand les tables modernes seront créées
    return null;
  }
}
