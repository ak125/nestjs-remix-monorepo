import { TABLES } from '@repo/database-types';
import { Injectable, Logger } from '@nestjs/common';
import { SupabaseIndexationService } from '../../search/services/supabase-indexation.service';
import { BlogArticleTransformService } from './blog-article-transform.service';
import { BlogCacheService } from './blog-cache.service';
import { BlogArticle } from '../interfaces/blog.interfaces';
import {
  DomainNotFoundException,
  DomainValidationException,
  ErrorCodes,
} from '../../../common/exceptions';

/**
 * 📦 BlogArticleDataService - Accès aux données articles
 *
 * Responsabilité unique : CRUD et requêtes Supabase pour les articles
 * - Récupération par ID, slug, gamme
 * - Création et mise à jour d'articles
 * - Chargement des sections H2/H3
 * - Incrémentation des vues
 * - Pagination et recherche admin
 *
 * Extrait de BlogService pour réduire la complexité (SRP)
 */
@Injectable()
export class BlogArticleDataService {
  private readonly logger = new Logger(BlogArticleDataService.name);

  constructor(
    private readonly supabaseService: SupabaseIndexationService,
    private readonly transformService: BlogArticleTransformService,
    private readonly blogCacheService: BlogCacheService,
  ) {}

  /**
   * 📄 Récupération d'un article par slug (version robuste)
   * Gère les URLs avec espaces ET tirets automatiquement
   */
  async getArticleBySlug(slug: string): Promise<BlogArticle | null> {
    try {
      // Générer les variantes de slug à essayer
      const slugVariants = this.transformService.generateSlugVariants(slug);

      // Essayer chaque variante dans les tables advice et guide
      for (const variant of slugVariants) {
        // Chercher dans blog_advice
        const { data: adviceData } = await this.supabaseService.client
          .from(TABLES.blog_advice)
          .select('*')
          .eq('ba_alias', variant)
          .single();

        if (adviceData) {
          this.logger.debug(`✅ Article trouvé avec alias: "${variant}"`);
          return await this.loadArticleWithSections(adviceData);
        }

        // Chercher dans blog_guide
        const { data: guideData } = await this.supabaseService.client
          .from(TABLES.blog_guide)
          .select('*')
          .eq('bg_alias', variant)
          .single();

        if (guideData) {
          this.logger.debug(`✅ Guide trouvé avec alias: "${variant}"`);
          return this.transformService.transformGuideToArticle(guideData);
        }
      }

      this.logger.debug(
        `❌ Aucun article trouvé pour: "${slug}" (variantes testées: ${slugVariants.join(', ')})`,
      );
      return null;
    } catch (error) {
      this.logger.error(
        `❌ Erreur récupération article ${slug}: ${(error as Error).message}`,
      );
      return null;
    }
  }

  /**
   * 📦 Récupérer un article par son ID
   */
  async getArticleById(id: number): Promise<BlogArticle | null> {
    try {
      this.logger.log(`🔍 Récupération article ID: ${id}`);

      // Chercher d'abord dans la table moderne
      const { data: modernArticle } = await this.supabaseService.client
        .from(TABLES.blog_advice)
        .select('*')
        .eq('id', id)
        .single();

      if (modernArticle) {
        return modernArticle;
      }

      // Chercher dans les tables legacy
      const { data: adviceData } = await this.supabaseService.client
        .from(TABLES.blog_advice)
        .select('*')
        .eq('ba_id', id)
        .single();

      if (adviceData) {
        return this.transformService.transformAdviceToArticle(adviceData);
      }

      // Chercher dans les guides
      const { data: guideData } = await this.supabaseService.client
        .from(TABLES.blog_guide)
        .select('*')
        .eq('bg_id', id)
        .single();

      if (guideData) {
        return this.transformService.transformGuideToArticle(guideData);
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
   * 🔄 Récupération d'un article par gamme (pieces_gamme alias)
   * Exemple: alternateur → trouve l'article lié à cette gamme
   */
  async getArticleByGamme(pg_alias: string): Promise<{
    article: BlogArticle | null;
    gammeData: { pg_id: number; pg_name: string } | null;
  }> {
    try {
      this.logger.log(`🔄 Recherche article par gamme: ${pg_alias}`);

      // 1. Trouver le pg_id depuis pieces_gamme
      const { data: gammeData } = await this.supabaseService.client
        .from(TABLES.pieces_gamme)
        .select('pg_id, pg_name')
        .eq('pg_alias', pg_alias)
        .single();

      if (!gammeData) {
        this.logger.warn(`⚠️ Gamme non trouvée: ${pg_alias}`);
        return { article: null, gammeData: null };
      }

      this.logger.log(
        `✅ Gamme trouvée: ${gammeData.pg_name} (ID: ${gammeData.pg_id})`,
      );

      // 2. Trouver l'article le plus récent pour cette gamme
      const { data, error } = await this.supabaseService.client
        .from(TABLES.blog_advice)
        .select('*')
        .eq('ba_pg_id', gammeData.pg_id)
        .order('ba_update', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        this.logger.warn(
          `⚠️ Aucun article trouvé pour la gamme ID: ${gammeData.pg_id}`,
        );
        return { article: null, gammeData };
      }

      this.logger.log(
        `✅ Article trouvé: ${data.ba_h1} (slug: ${data.ba_alias})`,
      );

      const article = await this.loadArticleWithSections(data);
      article.pg_alias = pg_alias;
      article.pg_id = gammeData.pg_id;

      // Ajouter l'image featured basée sur le pg_alias
      article.featuredImage = this.transformService.buildImageUrl(
        `${pg_alias}.webp`,
        'articles/gammes-produits/catalogue',
      );

      return { article, gammeData };
    } catch (error) {
      this.logger.error(
        `❌ Erreur recherche article par gamme ${pg_alias}: ${(error as Error).message}`,
      );
      return { article: null, gammeData: null };
    }
  }

  /**
   * 📝 Créer un nouvel article
   */
  async createArticle(article: Partial<BlogArticle>): Promise<BlogArticle> {
    try {
      // Générer un slug unique
      const slug = await this.generateUniqueSlug(article.title || '');

      // Calculer le temps de lecture
      const readingTime = this.transformService.calculateReadingTime(
        article.content,
      );

      // Nettoyer et décoder le contenu HTML
      const cleanedContent = this.transformService.cleanAndDecodeContent(
        article.content,
      );

      const newArticle: Partial<BlogArticle> = {
        ...article,
        slug,
        readingTime,
        content: cleanedContent,
        publishedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Insérer dans les tables modernes
      const { data, error } = await this.supabaseService.client
        .from(TABLES.blog_advice)
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
   * ✏️ Mettre à jour un article
   */
  async updateArticle(
    id: number,
    updates: Partial<BlogArticle>,
  ): Promise<BlogArticle> {
    try {
      const updateData: any = { ...updates };

      // Si le titre change, régénérer le slug
      if (updates.title) {
        updateData.slug = await this.generateUniqueSlug(updates.title);
      }

      // Recalculer le temps de lecture si le contenu change
      if (updates.content) {
        updateData.readingTime = this.transformService.calculateReadingTime(
          updates.content,
        );
        updateData.content = this.transformService.cleanAndDecodeContent(
          updates.content,
        );
      }

      updateData.updatedAt = new Date();

      const { data, error } = await this.supabaseService.client
        .from(TABLES.blog_advice)
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
        .from(TABLES.blog_advice)
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
        ? data.map((advice) =>
            this.transformService.transformAdviceToArticle(advice),
          )
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
   * 👀 Incrémenter les vues d'un article
   */
  async incrementArticleViews(
    slug: string,
  ): Promise<{ success: boolean; views: number }> {
    try {
      this.logger.log(`👀 Incrémentation vues pour: ${slug}`);

      // 1. Trouver l'article pour identifier sa table et son ID
      const article = await this.getArticleBySlug(slug);

      if (!article) {
        throw new DomainNotFoundException({
          code: ErrorCodes.BLOG.ARTICLE_NOT_FOUND,
          message: `Article non trouvé: ${slug}`,
        });
      }

      const { legacy_table, legacy_id } = article;

      if (!legacy_table || !legacy_id) {
        throw new DomainNotFoundException({
          code: ErrorCodes.BLOG.ARTICLE_NOT_FOUND,
          message: `Article sans legacy_table/legacy_id: ${slug}`,
        });
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
          idField = 'bsm_id';
          break;
        case '__blog_glossaire':
          viewField = 'ba_visit';
          idField = 'ba_id';
          break;
        default:
          throw new DomainValidationException({
            code: ErrorCodes.BLOG.UNSUPPORTED_TABLE,
            message: `Table non supportée: ${legacy_table}`,
          });
      }

      // 3. Incrémenter avec UPDATE classique
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
        .from(TABLES.blog_advice)
        .select('*', { count: 'exact' })
        .or(
          `ba_title.ilike.%${query}%,ba_content.ilike.%${query}%,ba_resume.ilike.%${query}%`,
        )
        .range(offset, offset + limit - 1);

      const articles =
        data?.map((item) =>
          this.transformService.transformAdviceToArticle(item),
        ) || [];

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
   * 📰 Charger les articles croisés (sidebar "On vous propose")
   */
  async getRelatedArticles(ba_id: number): Promise<BlogArticle[]> {
    try {
      this.logger.log(`📰 Chargement articles croisés pour BA_ID: ${ba_id}`);

      const { data: crossData } = await this.supabaseService.client
        .from(TABLES.blog_advice_cross)
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
        .from(TABLES.blog_advice)
        .select('*')
        .in('ba_id', crossIds)
        .order('ba_update', { ascending: false });

      if (!articles) return [];

      // Transformer et enrichir avec pg_alias
      const transformed = articles.map((item) =>
        this.transformService.transformAdviceToArticle(item),
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
   * ⬅️➡️ Récupérer les articles adjacents (précédent/suivant)
   */
  async getAdjacentArticles(
    slug: string,
  ): Promise<{ previous: BlogArticle | null; next: BlogArticle | null }> {
    try {
      this.logger.log(`⬅️➡️ Recherche articles adjacents pour: ${slug}`);

      const currentArticle = await this.getArticleBySlug(slug);

      if (!currentArticle) {
        return { previous: null, next: null };
      }

      const { legacy_table } = currentArticle;

      let dateField = '';
      let pgIdField: string | null = '';

      switch (legacy_table) {
        case '__blog_advice':
          dateField = 'ba_create';
          pgIdField = 'ba_pg_id';
          break;
        case '__blog_guide':
          dateField = 'bg_create';
          pgIdField = null;
          break;
        default:
          return { previous: null, next: null };
      }

      // Article précédent
      let baseQuery = this.supabaseService.client
        .from(legacy_table)
        .select('*');

      if (pgIdField && (currentArticle as any).ba_pg_id) {
        baseQuery = baseQuery.eq(pgIdField, (currentArticle as any).ba_pg_id);
      }

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

      // Article suivant
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

      const previous = previousData
        ? legacy_table === '__blog_advice'
          ? this.transformService.transformAdviceToArticle(previousData)
          : this.transformService.transformGuideToArticle(previousData)
        : null;

      const next = nextData
        ? legacy_table === '__blog_advice'
          ? this.transformService.transformAdviceToArticle(nextData)
          : this.transformService.transformGuideToArticle(nextData)
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

  // === Méthodes privées ===

  /**
   * 📦 Charger un article avec ses sections H2/H3
   */
  private async loadArticleWithSections(advice: any): Promise<BlogArticle> {
    // Charger les H2
    const { data: h2Sections } = await this.supabaseService.client
      .from(TABLES.blog_advice_h2)
      .select('*')
      .eq('ba2_ba_id', advice.ba_id)
      .order('ba2_id');

    // Récupérer les IDs des H2 pour charger leurs H3
    const h2Ids = h2Sections?.map((h2: any) => h2.ba2_id) || [];

    // Charger les H3 qui appartiennent à ces H2
    let h3Sections: any[] = [];
    if (h2Ids.length > 0) {
      const { data: h3Data } = await this.supabaseService.client
        .from(TABLES.blog_advice_h3)
        .select('*')
        .in('ba3_ba2_id', h2Ids)
        .order('ba3_id');
      h3Sections = h3Data || [];
    }

    return this.transformService.transformAdviceToArticleWithSections(
      advice,
      h2Sections || [],
      h3Sections,
    );
  }

  /**
   * 🔗 Générer un slug unique
   */
  private async generateUniqueSlug(title: string): Promise<string> {
    const slug = this.transformService.generateSlugFromTitle(title);
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
   * 🔄 Enrichir les articles avec pg_alias depuis pieces_gamme
   */
  async enrichWithPgAlias(articles: BlogArticle[]): Promise<BlogArticle[]> {
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
        .from(TABLES.pieces_gamme)
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
          pg_id: pg_id,
          pg_alias: pgAliasMap.get(ba_pg_id) || null,
          ba_pg_id: ba_pg_id,
        };
      });
    } catch (error) {
      this.logger.warn('Erreur enrichWithPgAlias:', error);
      return articles;
    }
  }

  /**
   * 🗑️ Invalider les caches liés
   */
  private async invalidateRelatedCaches(keys: string[]): Promise<void> {
    for (const key of keys) {
      await this.blogCacheService.del(key);
    }
  }
}
