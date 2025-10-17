import { Injectable, Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { SupabaseIndexationService } from '../../search/services/supabase-indexation.service';
import { BlogCacheService } from './blog-cache.service';
import {
  BlogArticle,
  BlogSection,
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
  private readonly SUPABASE_URL =
    process.env.SUPABASE_URL || 'https://cxpojprgwgubzjyqzmoq.supabase.co';
  private readonly CDN_BASE_URL = `${this.SUPABASE_URL}/storage/v1/object/public/uploads`;

  constructor(
    private readonly supabaseService: SupabaseIndexationService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly blogCacheService: BlogCacheService,
  ) {}

  /**
   * 🖼️ Construire l'URL CDN complète pour une image
   */
  private buildImageUrl(
    filename: string | null,
    folder: string,
    marqueAlias?: string,
  ): string | null {
    // 🔍 DEBUG avec LOG (pas debug)
    this.logger.log(
      `   🖼️  buildImageUrl() appelé: filename="${filename}", folder="${folder}", marque="${marqueAlias || 'N/A'}"`,
    );

    if (!filename) {
      this.logger.log(`   🖼️  → Retourne NULL (filename vide)`);
      return null;
    }

    if (filename.startsWith('http://') || filename.startsWith('https://')) {
      this.logger.log(`   🖼️  → Retourne tel quel (déjà URL): ${filename}`);
      return filename;
    }

    // Si marqueAlias fourni, utiliser structure marques-modeles/{marque}/{modele}.webp
    const url = marqueAlias
      ? `${this.CDN_BASE_URL}/constructeurs-automobiles/marques-modeles/${marqueAlias}/${filename}`
      : `${this.CDN_BASE_URL}/${folder}/${filename}`;

    this.logger.log(`   🖼️  → URL construite: ${url}`);
    return url;
  }

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
   * 📝 Créer un nouvel article - VERSION AMÉLIORÉE
   */
  async createArticle(
    article: Partial<BlogArticle>,
    _authorId: string,
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
        // authorId n'existe pas sur BlogArticle
        readingTime,
        content: cleanedContent,
        // status n'existe pas non plus - utilisé en interne seulement
        publishedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
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
    options?: {
      type?: 'all' | 'advice' | 'guide' | 'constructeur' | 'glossaire';
      limit?: number;
      offset?: number;
    },
  ): Promise<{ articles: BlogArticle[]; total: number }> {
    try {
      const limit = options?.limit || 20;
      const offset = options?.offset || 0;

      this.logger.log(`🔍 Recherche "${query}"`);

      // Recherche dans les conseils (titre, contenu, résumé)
      const { data, count } = await this.supabaseService.client
        .from('__blog_advice')
        .select('*', { count: 'exact' })
        .or(
          `ba_title.ilike.%${query}%,ba_content.ilike.%${query}%,ba_resume.ilike.%${query}%`,
        )
        .range(offset, offset + limit - 1);

      const articles =
        data?.map((item) => this.transformAdviceToArticle(item)) || [];

      this.logger.log(
        `🔍 Recherche "${query}": ${articles.length} résultats trouvés sur ${count || 0} total`,
      );

      return {
        articles,
        total: count || 0,
      };
    } catch (error) {
      this.logger.error(
        `❌ Erreur recherche blog: ${(error as Error).message}`,
      );
      return { articles: [], total: 0 };
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
      // Ajouter le pg_alias et pg_id qu'on connaît déjà depuis la gamme
      article.pg_alias = pg_alias;
      article.pg_id = gammeData.pg_id;

      // Ajouter l'image featured basée sur le pg_alias
      article.featuredImage = pg_alias
        ? this.buildImageUrl(
            `${pg_alias}.webp`,
            'articles/gammes-produits/catalogue',
          )
        : null;

      // Charger les articles croisés (related articles)
      article.relatedArticles = await this.getRelatedArticles(data.ba_id);

      // Charger les véhicules compatibles avec cette gamme de pièce
      // Limite: 1000 véhicules (quasi illimité)
      article.compatibleVehicles = await this.getCompatibleVehicles(
        gammeData.pg_id,
        1000,
        pg_alias,
      );

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
        this.logger.log(
          `   ℹ️  Aucun article croisé trouvé pour BA_ID: ${ba_id}`,
        );
        return [];
      }

      // Récupérer les IDs des articles croisés
      const crossIds = crossData.map((c) => c.bac_ba_id_cross);
      this.logger.log(
        `   ✅ ${crossIds.length} articles croisés trouvés (IDs: ${crossIds.join(', ')})`,
      );

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
      this.logger.log(
        `   ✅ Articles croisés enrichis: ${enriched.map((a) => a.pg_alias || a.slug).join(', ')}`,
      );
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
   * Version simplifiée : requête directe sans multiples étapes
   * @param pg_id - ID de la pièce générique
   * @param limit - Nombre max de véhicules (défaut: 1000 = quasi illimité)
   * @param pg_alias - Alias de la gamme pour construire l'URL
   */
  async getCompatibleVehicles(
    pg_id: number,
    limit = 1000,
    pg_alias = '',
  ): Promise<any[]> {
    try {
      this.logger.log(
        `🚗 Chargement véhicules compatibles pour PG_ID: ${pg_id}`,
      );

      // Étape 1 : Récupérer les TYPE_ID compatibles depuis __cross_gamme_car_new
      // Niveau 1 = Véhicules les plus populaires (ventes les plus importantes)
      // On essaie niveau 1 d'abord, puis niveaux 2, 3, 4 si nécessaire
      //
      // 🎯 TRI PAR POPULARITÉ DANS CHAQUE NIVEAU :
      // - order('cgc_id', DESC) = Les associations les plus récentes/populaires en premier
      // - Les cgc_id élevés = Véhicules qui achètent LE PLUS cette pièce
      // - Exemple: FIAT PUNTO, VW GOLF (grand public) avant AUDI A6, BMW (premium)
      let crossData = null;
      let crossError = null;

      for (const level of [1, 2, 3, 4]) {
        const result = await this.supabaseService.client
          .from('__cross_gamme_car_new')
          .select('cgc_type_id, cgc_level')
          .eq('cgc_pg_id', pg_id)
          .eq('cgc_level', level)
          .order('cgc_id', { ascending: true }) // 🔥 TEST: ID ASC = Plus anciens/premiers ajoutés
          .limit(limit);

        if (result.data && result.data.length > 0) {
          crossData = result.data;
          crossError = result.error;
          this.logger.log(
            `   ℹ️  Utilisation niveau ${level} (${result.data.length} véhicules trouvés)`,
          );
          break;
        }
      }

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

      // ⚠️  IMPORTANT: cgc_type_id est TEXT, mais type_id est INTEGER
      const typeIds = crossData
        .map((item) => parseInt(item.cgc_type_id, 10))
        .filter((id) => !isNaN(id));
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

      this.logger.log(
        `   ✅ ${typesData.length} types chargés depuis auto_type`,
      );

      // Étape 3 : Charger les modèles (AUTO_MODELE)
      const modeleIds = [
        ...new Set(typesData.map((t) => t.type_modele_id).filter((id) => id)),
      ];
      this.logger.log(
        `   📋 ${modeleIds.length} MODELE_ID uniques: ${modeleIds.slice(0, 5).join(', ')}...`,
      );

      const { data: modelesData, error: modelesError } =
        await this.supabaseService.client
          .from('auto_modele')
          .select('*')
          .in('modele_id', modeleIds)
          .eq('modele_display', 1);

      if (modelesError) {
        this.logger.error(`   ❌ Erreur auto_modele:`, modelesError);
        return [];
      }

      this.logger.log(
        `   ✅ ${modelesData?.length || 0} modèles chargés depuis auto_modele`,
      );

      // 🔍 DEBUG: Afficher les modele_ids réellement chargés
      const loadedModeleIds =
        modelesData?.map((m) => m.modele_id).slice(0, 5) || [];
      this.logger.log(
        `   🔍 Modèles chargés (IDs réels): ${loadedModeleIds.join(', ')}...`,
      );
      this.logger.log(
        `   🔍 Modèles recherchés (type_modele_id): ${modeleIds.slice(0, 5).join(', ')}...`,
      );

      if (!modelesData || modelesData.length === 0) {
        this.logger.warn(`   ⚠️  Aucun modèle trouvé - arrêt assemblage`);
        return [];
      }

      // Étape 4 : Charger les marques (AUTO_MARQUE)
      const marqueIds = [
        ...new Set(
          modelesData.map((m) => m.modele_marque_id).filter((id) => id),
        ),
      ];
      this.logger.log(
        `   📋 ${marqueIds.length} MARQUE_ID uniques: ${marqueIds.slice(0, 5).join(', ')}...`,
      );
      const { data: marquesData, error: marquesError } =
        await this.supabaseService.client
          .from('auto_marque')
          .select('*')
          .in('marque_id', marqueIds)
          .eq('marque_display', 1);

      if (marquesError) {
        this.logger.error(`   ❌ Erreur auto_marque:`, marquesError);
        return [];
      }

      this.logger.log(
        `   ✅ ${marquesData?.length || 0} marques chargées depuis auto_marque`,
      );

      if (!marquesData || marquesData.length === 0) {
        this.logger.warn(`   ⚠️  Aucune marque trouvée - arrêt assemblage`);
        return [];
      }

      // Créer des maps pour accès rapide
      const modelesMap = new Map(modelesData?.map((m) => [m.modele_id, m]));
      const marquesMap = new Map(marquesData?.map((m) => [m.marque_id, m]));

      this.logger.log(
        `   🗺️  Maps créées: ${modelesMap.size} modèles, ${marquesMap.size} marques`,
      );

      // 🔍 DEBUG: Vérifier les types de données
      const firstType = typesData[0];
      const firstModele = modelesData?.[0];
      this.logger.log(
        `   🔍 Type de type_modele_id: ${typeof firstType?.type_modele_id} (valeur: ${firstType?.type_modele_id})`,
      );
      this.logger.log(
        `   🔍 Type de modele_id: ${typeof firstModele?.modele_id} (valeur: ${firstModele?.modele_id})`,
      );

      // Étape 5 : Assembler les données
      let skipped = 0;
      const vehicles = typesData
        .map((type) => {
          // ⚠️  IMPORTANT: Convertir type_modele_id (string) en number pour lookup
          const modeleId =
            typeof type.type_modele_id === 'string'
              ? parseInt(type.type_modele_id, 10)
              : type.type_modele_id;

          const modele = modelesMap.get(modeleId);
          const marque = modele
            ? marquesMap.get(modele.modele_marque_id)
            : null;

          if (!modele || !marque) {
            skipped++;
            if (skipped <= 3) {
              this.logger.warn(
                `   ⚠️  Type ${type.type_id} skipped: modele=${!!modele}, marque=${!!marque}, modeleId=${modeleId}`,
              );
            }
            return null;
          }

          // Période de production
          let period = '';
          if (type.type_year_to) {
            period = `${type.type_month_from}/${type.type_year_from} - ${type.type_month_to}/${type.type_year_to}`;
          } else {
            period = `depuis ${type.type_month_from}/${type.type_year_from}`;
          }

          // 🔍 DEBUG: Logger les valeurs brutes de la DB (premier véhicule seulement)
          if (!modele._logged) {
            this.logger.debug(
              `   🖼️  DB RAW - ${marque.marque_name}: marque_logo="${marque.marque_logo}", modele_pic="${modele.modele_pic}"`,
            );
            modele._logged = true;
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
            // 🖼️ URL CDN complète pour l'image du modèle (structure: marques-modeles/{marque}/{fichier})
            // On utilise modele_pic de la DB qui contient le vrai nom de fichier
            modele_pic: this.buildImageUrl(
              modele.modele_pic,
              'unused',
              marque.marque_alias,
            ),
            marque_id: marque.marque_id,
            marque_alias: marque.marque_alias,
            marque_name: marque.marque_name,
            // 🖼️ URL CDN complète pour le logo de la marque
            marque_logo: this.buildImageUrl(
              marque.marque_logo,
              'constructeurs-automobiles/marques-logos',
            ),
            // URL vers la gamme du véhicule (avec pg_alias si disponible)
            catalog_url: pg_alias
              ? `/pieces/${pg_alias}-${pg_id}/${marque.marque_alias}-${marque.marque_id}/${modele.modele_alias}-${modele.modele_id}/${type.type_alias}-${type.type_id}.html`
              : `/constructeurs/${marque.marque_alias}-${marque.marque_id}/${modele.modele_alias}-${modele.modele_id}/${type.type_alias}-${type.type_id}.html`,
          };
        })
        .filter((v) => v !== null);

      this.logger.log(
        `   ✅ ${vehicles.length} véhicules compatibles assemblés`,
      );
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
        success: true,
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

      const articles =
        data?.map((item) => this.transformAdviceToArticle(item)) || [];
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
    // Charger d'abord les H2
    const { data: h2Sections } = await this.supabaseService.client
      .from('__blog_advice_h2')
      .select('*')
      .eq('ba2_ba_id', advice.ba_id)
      .order('ba2_id');

    // Récupérer les IDs des H2 pour charger leurs H3
    const h2Ids = h2Sections?.map((h2: any) => h2.ba2_id) || [];

    // Charger les H3 qui appartiennent à ces H2
    let h3Sections: any[] = [];
    if (h2Ids.length > 0) {
      const { data: h3Data } = await this.supabaseService.client
        .from('__blog_advice_h3')
        .select('*')
        .in('ba3_ba2_id', h2Ids)
        .order('ba3_id');
      h3Sections = h3Data || [];
    }

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
      // categorySlug et vehicles ne sont pas dans BlogArticle
      featuredImage: advice.pg_alias
        ? this.buildImageUrl(
            `${advice.pg_alias}.webp`,
            'articles/gammes-produits/catalogue',
          )
        : null,
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
      featuredImage: null, // pg_alias pas disponible ici, sera enrichi après
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
      featuredImage: null, // Les guides n'ont pas de gamme, pas d'image featured
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
    _excludeId?: number,
  ): Promise<string> {
    // Slugify simple: minuscules, espaces → tirets, remove accents
    const slug = BlogCacheService.decodeHtmlEntities(title)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
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
  private async enrichWithPgAlias(
    articles: BlogArticle[],
  ): Promise<BlogArticle[]> {
    if (!articles || articles.length === 0) return articles;

    try {
      // Récupérer tous les ba_pg_id uniques
      const pgIds = [
        ...new Set(
          articles.map((a) => (a as any).ba_pg_id).filter((id) => id != null),
        ),
      ];

      if (pgIds.length === 0) return articles;

      // Charger tous les pg_alias en une seule requête
      const { data: gammes } = await this.supabaseService.client
        .from('pieces_gamme')
        .select('pg_id, pg_alias')
        .in('pg_id', pgIds);

      // Créer un map pour accès rapide
      const pgAliasMap = new Map();
      gammes?.forEach((g) => pgAliasMap.set(g.pg_id, g.pg_alias));

      // Enrichir chaque article
      return articles.map((article) => {
        const ba_pg_id = (article as any).ba_pg_id;
        const pg_id = ba_pg_id ? parseInt(ba_pg_id, 10) : null;

        return {
          ...article,
          pg_id: pg_id, // Convertir ba_pg_id (string) en pg_id (number) pour l'interface
          pg_alias: pgAliasMap.get(ba_pg_id) || null,
          ba_pg_id: ba_pg_id, // Garder aussi ba_pg_id pour le frontend
        };
      });
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

  /**
   * 👀 Incrémenter les vues d'un article
   * POST /api/blog/article/:slug/increment-views
   */
  async incrementArticleViews(
    slug: string,
  ): Promise<{ success: boolean; views: number }> {
    try {
      this.logger.log(`👀 Incrémentation vues pour: ${slug}`);

      // 1. Trouver l'article pour identifier sa table et son ID
      const article = await this.getArticleBySlug(slug);

      if (!article) {
        throw new Error(`Article non trouvé: ${slug}`);
      }

      const { legacy_table, legacy_id } = article;

      if (!legacy_table || !legacy_id) {
        throw new Error(`Article sans legacy_table/legacy_id: ${slug}`);
      }

      // 2. Déterminer le champ de compteur selon la table
      let viewField = '';
      let idField = '';

      switch (legacy_table) {
        case '__blog_advice':
          viewField = 'ba_visit';
          idField = 'ba_id';
          break;
        case '__blog_guide':
          viewField = 'bg_visit';
          idField = 'bg_id';
          break;
        case '__blog_constructeur':
          viewField = 'bc_visit';
          idField = 'bc_id';
          break;
        case '__blog_glossaire':
          viewField = 'bgl_visit';
          idField = 'bgl_id';
          break;
        default:
          throw new Error(`Table non supportée: ${legacy_table}`);
      }

      // 3. Incrémenter avec UPDATE classique (RPC optionnelle pour plus tard)
      this.logger.log(
        `📊 Incrémentation de ${viewField} pour ${idField}=${legacy_id}`,
      );

      // Récupérer la valeur actuelle
      const { data: currentData } = await this.supabaseService.client
        .from(legacy_table)
        .select(viewField)
        .eq(idField, legacy_id)
        .single();

      const currentViews = parseInt(
        String((currentData as any)?.[viewField] || '0'),
        10,
      );
      const newViews = currentViews + 1;

      // Mettre à jour
      const { error: updateError } = await this.supabaseService.client
        .from(legacy_table)
        .update({ [viewField]: newViews })
        .eq(idField, legacy_id);

      if (updateError) {
        throw updateError;
      }

      this.logger.log(`✅ Vues incrémentées: ${currentViews} → ${newViews}`);
      return { success: true, views: newViews };
    } catch (error) {
      this.logger.error(
        `❌ Erreur incrémentation vues: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  /**
   * ⬅️➡️ Récupérer les articles adjacents (précédent/suivant)
   * Utilisé pour la navigation entre articles
   */
  async getAdjacentArticles(
    slug: string,
  ): Promise<{ previous: BlogArticle | null; next: BlogArticle | null }> {
    try {
      this.logger.log(`⬅️➡️ Recherche articles adjacents pour: ${slug}`);

      // 1. Récupérer l'article actuel
      const currentArticle = await this.getArticleBySlug(slug);

      if (!currentArticle) {
        return { previous: null, next: null };
      }

      const { legacy_table } = currentArticle;

      // 2. Déterminer les champs selon la table
      let dateField = '';
      let pgIdField: string | null = '';

      switch (legacy_table) {
        case '__blog_advice':
          dateField = 'ba_create';
          pgIdField = 'ba_pg_id';
          break;
        case '__blog_guide':
          dateField = 'bg_create';
          pgIdField = null; // Les guides n'ont pas de gamme
          break;
        default:
          // Constructeurs et glossaire n'ont pas d'adjacents logiques
          return { previous: null, next: null };
      }

      // 3. Construire la requête de base
      let baseQuery = this.supabaseService.client
        .from(legacy_table)
        .select('*');

      // Filtrer par gamme si disponible (pour advice)
      if (pgIdField && (currentArticle as any).ba_pg_id) {
        baseQuery = baseQuery.eq(pgIdField, (currentArticle as any).ba_pg_id);
      }

      // 4. Article précédent (date < current, ORDER BY date DESC, LIMIT 1)
      const { data: previousData } = await baseQuery
        .lt(
          dateField,
          (currentArticle as any)[
            dateField.replace('ba_', '').replace('bg_', '')
          ] || currentArticle.publishedAt,
        )
        .order(dateField, { ascending: false })
        .limit(1)
        .single();

      // 5. Article suivant (date > current, ORDER BY date ASC, LIMIT 1)
      baseQuery = this.supabaseService.client.from(legacy_table).select('*');
      if (pgIdField && (currentArticle as any).ba_pg_id) {
        baseQuery = baseQuery.eq(pgIdField, (currentArticle as any).ba_pg_id);
      }

      const { data: nextData } = await baseQuery
        .gt(
          dateField,
          (currentArticle as any)[
            dateField.replace('ba_', '').replace('bg_', '')
          ] || currentArticle.publishedAt,
        )
        .order(dateField, { ascending: true })
        .limit(1)
        .single();

      // 6. Transformer en BlogArticle
      const previous = previousData
        ? legacy_table === '__blog_advice'
          ? this.transformAdviceToArticle(previousData)
          : this.transformGuideToArticle(previousData)
        : null;

      const next = nextData
        ? legacy_table === '__blog_advice'
          ? this.transformAdviceToArticle(nextData)
          : this.transformGuideToArticle(nextData)
        : null;

      this.logger.log(
        `✅ Articles adjacents: previous=${previous?.slug || 'none'}, next=${next?.slug || 'none'}`,
      );

      return { previous, next };
    } catch (error) {
      this.logger.error(
        `❌ Erreur articles adjacents: ${(error as Error).message}`,
      );
      return { previous: null, next: null };
    }
  }

  /**
   * 🔤 Récupérer les switches SEO item pour une gamme
   * @param pg_id ID de la gamme
   * @returns Array de switches avec alias et contenu
   */
  async getSeoItemSwitches(pg_id: number): Promise<any[]> {
    try {
      this.logger.log(`🔤 Récupération switches SEO pour pg_id=${pg_id}`);

      const { data, error } = await this.supabaseService.client
        .from('__seo_item_switch')
        .select('*')
        .eq('sis_pg_id', pg_id.toString())
        .order('sis_alias', { ascending: true });

      if (error) {
        this.logger.error(`❌ Erreur Supabase: ${error.message}`);
        return [];
      }

      if (!data || data.length === 0) {
        this.logger.warn(`⚠️  Aucun switch trouvé pour pg_id=${pg_id}`);
        return [];
      }

      this.logger.log(`✅ ${data.length} switches récupérés`);
      return data;
    } catch (error) {
      this.logger.error(
        `❌ Erreur getSeoItemSwitches: ${(error as Error).message}`,
      );
      return [];
    }
  }

  /**
   * 📋 Récupérer les conseils de remplacement pour une gamme
   * @param pg_id ID de la gamme
   * @returns Array de conseils avec titre et contenu
   */
  async getGammeConseil(
    pg_id: number,
  ): Promise<Array<{ title: string; content: string }>> {
    try {
      this.logger.log(
        `📋 Récupération conseils de remplacement pour pg_id=${pg_id}`,
      );

      const { data, error } = await this.supabaseService.client
        .from('__seo_gamme_conseil')
        .select('*')
        .eq('sgc_pg_id', pg_id.toString())
        .order('sgc_id', { ascending: true });

      if (error) {
        this.logger.error(`❌ Erreur Supabase: ${error.message}`);
        return [];
      }

      if (!data || data.length === 0) {
        this.logger.warn(`⚠️  Aucun conseil trouvé pour pg_id=${pg_id}`);
        return [];
      }

      this.logger.log(
        `✅ ${data.length} conseils récupérés: ${data.map((c) => c.sgc_title).join(', ')}`,
      );

      return data.map((item) => ({
        title: item.sgc_title || '',
        content: item.sgc_content || '',
      }));
    } catch (error) {
      this.logger.error(
        `❌ Erreur getGammeConseil: ${(error as Error).message}`,
      );
      return [];
    }
  }

  /**
   * 🔍 DEBUG - Vérifier les sections h2/h3 d'un article
   */
  async debugArticleSections(ba_id: number) {
    try {
      this.logger.log(`🔍 Debug sections pour ba_id=${ba_id}`);

      // Charger les H2
      const { data: h2Data } = await this.supabaseService.client
        .from('__blog_advice_h2')
        .select('*')
        .eq('ba2_ba_id', ba_id)
        .order('ba2_id');

      // Récupérer les IDs des H2
      const h2Ids = h2Data?.map((h2) => h2.ba2_id) || [];

      // Charger les H3 qui appartiennent à ces H2
      let h3Data: any[] = [];
      if (h2Ids.length > 0) {
        const { data } = await this.supabaseService.client
          .from('__blog_advice_h3')
          .select('*')
          .in('ba3_ba2_id', h2Ids)
          .order('ba3_id');
        h3Data = data || [];
      }

      return {
        ba_id,
        h2_count: h2Data?.length || 0,
        h3_count: h3Data.length,
        h2_sections: h2Data?.map((h2) => ({
          id: h2.ba2_id,
          title: h2.ba2_h2,
        })),
        h3_sections: h3Data.map((h3) => ({
          id: h3.ba3_id,
          ba2_id: h3.ba3_ba2_id,
          title: h3.ba3_h3,
        })),
      };
    } catch (error) {
      this.logger.error(`❌ Erreur debug: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * 🔍 DEBUG - Trouver les articles qui ont des H3
   */
  async findArticlesWithH3() {
    try {
      this.logger.log(`🔍 Recherche des articles avec H3`);

      // Récupérer quelques H3
      const { data: h3Samples } = await this.supabaseService.client
        .from('__blog_advice_h3')
        .select('ba3_ba2_id, ba3_h3')
        .limit(10);

      if (!h3Samples || h3Samples.length === 0) {
        return {
          message: 'Aucun H3 trouvé dans la base',
          count: 0,
        };
      }

      // Récupérer les ba2_id uniques
      const ba2Ids = [...new Set(h3Samples.map((h3) => h3.ba3_ba2_id))];

      // Récupérer les H2 correspondants pour avoir les ba_id
      const { data: h2Data } = await this.supabaseService.client
        .from('__blog_advice_h2')
        .select('ba2_id, ba2_ba_id, ba2_h2')
        .in('ba2_id', ba2Ids);

      return {
        message: `${h3Samples.length} H3 trouvés`,
        h3_samples: h3Samples,
        h2_parents: h2Data,
        articles_with_h3: [...new Set(h2Data?.map((h2) => h2.ba2_ba_id) || [])],
      };
    } catch (error) {
      this.logger.error(
        `❌ Erreur findArticlesWithH3: ${(error as Error).message}`,
      );
      throw error;
    }
  }
}
