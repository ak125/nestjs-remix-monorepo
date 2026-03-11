import { Injectable, Logger } from '@nestjs/common';
import {
  TABLES,
  BlogGuide,
  BlogGuideH2,
  BlogGuideH3,
  PiecesGamme,
} from '@repo/database-types';
import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseIndexationService } from '../../search/services/supabase-indexation.service';
import { buildGammeImageUrl } from '../../catalog/utils/image-urls.utils';

/** pg_pic "no" = pas d'image en DB. Utiliser alias.webp comme fallback. */
function gammeImage(pgPic: string | null | undefined, alias: string): string {
  const pic = pgPic && pgPic !== 'no' && !pgPic.endsWith('/no.') ? pgPic : null;
  return buildGammeImageUrl(pic || `${alias}.webp`);
}
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import { BlogArticle, BlogSection } from '../interfaces/blog.interfaces';

import { FAMILY_REGISTRY } from '@repo/database-types';

/** Normalise mf_name DB → nom court via FAMILY_REGISTRY keywords[0] */
function normalizeFamilyName(mfId: string, rawName: string): string {
  const id = Number(mfId);
  const meta = FAMILY_REGISTRY[id];
  if (meta?.keywords.length) {
    const short = meta.keywords[0];
    return short.charAt(0).toUpperCase() + short.slice(1);
  }
  return rawName;
}

export interface GuideFilters {
  type?: 'achat' | 'technique' | 'entretien' | 'réparation';
  difficulty?: 'débutant' | 'intermédiaire' | 'expert';
  minViews?: number;
}

/** Minimal shape of rows from __seo_gamme_purchase_guide */
interface PurchaseGuideRow {
  sgpg_pg_id?: number;
  sgpg_intro_title?: string | null;
  sgpg_intro_role?: string | null;
  sgpg_how_to_choose?: string | null;
  sgpg_risk_title?: string | null;
  sgpg_risk_explanation?: string | null;
  sgpg_timing_title?: string | null;
  sgpg_timing_note?: string | null;
  sgpg_timing_km?: string | null;
  sgpg_symptoms?: string[] | null;
  sgpg_anti_mistakes?: string[] | null;
  sgpg_faq?: Array<{ question: string; answer: string }> | null;
  sgpg_created_at?: string | null;
  sgpg_updated_at?: string | null;
  sgpg_h1_override?: string | null;
  [key: string]: unknown;
}

type GammePartial = Pick<
  PiecesGamme,
  'pg_id' | 'pg_alias' | 'pg_name' | 'pg_parent' | 'pg_pic'
>;

/**
 * 📖 GuideService - Service spécialisé pour les guides automobiles
 *
 * Gère spécifiquement la table __blog_guide avec logique métier
 * dédiée aux guides d'achat, techniques et de réparation.
 */
@Injectable()
export class GuideService {
  private readonly logger = new Logger(GuideService.name);

  constructor(
    private readonly supabaseService: SupabaseIndexationService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  /**
   * 📖 Récupérer tous les guides (manuels + auto purchase guides)
   */
  async getAllGuides(
    options: {
      limit?: number;
      offset?: number;
      filters?: GuideFilters;
    } = {},
  ): Promise<{ articles: BlogArticle[]; total: number }> {
    const { limit = 20, offset = 0, filters = {} } = options;
    const cacheKey = `guides_all:${limit}:${offset}:${JSON.stringify(filters)}`;

    try {
      const cached = await this.cacheManager.get<{
        articles: BlogArticle[];
        total: number;
      }>(cacheKey);
      if (cached) {
        return cached;
      }

      const client = this.supabaseService.getClient();

      // 1) Guides manuels (__blog_guide)
      let query = client
        .from(TABLES.blog_guide)
        .select('*', { count: 'exact' });

      if (filters.type) {
        query = query.ilike('bg_title', `%${filters.type}%`);
      }
      if (filters.minViews) {
        query = query.gte('bg_visit', filters.minViews.toString());
      }

      query = query.order('bg_visit', { ascending: false });

      const { data: guidesList, count: manualCount } = await query;

      const articlePromises = (guidesList || []).map((guide) =>
        this.transformGuideToArticle(client, guide),
      );
      const manualArticles = (await Promise.all(articlePromises)).filter(
        (article): article is BlogArticle => article !== null,
      );

      // Résoudre les images produit pour les guides manuels (batch)
      const manualAliasesForImages = (guidesList || [])
        .map((g: Pick<BlogGuide, 'bg_alias'>) => g.bg_alias)
        .filter(Boolean);
      if (manualAliasesForImages.length > 0) {
        const { data: manualGammes } = await client
          .from('pieces_gamme')
          .select('pg_alias, pg_pic')
          .in('pg_alias', manualAliasesForImages);
        const aliasToImage = new Map<string, string>();
        for (const g of manualGammes || []) {
          aliasToImage.set(g.pg_alias, gammeImage(g.pg_pic, g.pg_alias));
        }
        for (const article of manualArticles) {
          if (!article.featuredImage && article.slug) {
            article.featuredImage = aliasToImage.get(article.slug) || null;
          }
        }
      }

      // 2) Guides auto-générés depuis __seo_gamme_purchase_guide
      const { data: purchaseGuides } = await client
        .from('__seo_gamme_purchase_guide')
        .select(
          'sgpg_pg_id, sgpg_intro_role, sgpg_how_to_choose, sgpg_risk_explanation, sgpg_timing_note, sgpg_arg1_title, sgpg_arg2_title, sgpg_arg3_title, sgpg_arg4_title, sgpg_faq',
        )
        .not('sgpg_how_to_choose', 'is', null)
        .eq('sgpg_is_draft', false);

      // Build map pgId → purchase guide data for enrichment
      const pgDataMap = new Map<string, Record<string, unknown>>();
      const pgIds: string[] = [];
      for (const p of purchaseGuides || []) {
        const row = p as Record<string, unknown>;
        const pgId = String(row.sgpg_pg_id);
        pgIds.push(pgId);
        pgDataMap.set(pgId, row);
      }

      // Exclure les gammes qui ont déjà un guide manuel dans __blog_guide
      const manualAliases = new Set(
        (guidesList || []).map((g: Pick<BlogGuide, 'bg_alias'>) => g.bg_alias),
      );

      let autoGuides: BlogArticle[] = [];
      if (pgIds.length > 0) {
        const { data: gammes } = await client
          .from('pieces_gamme')
          .select('pg_id, pg_name, pg_alias, pg_parent, pg_pic')
          .in('pg_id', pgIds)
          .eq('pg_display', '1');

        // Resolve family names via __seo_family_gamme_car_switch → catalog_family
        const filteredGammes = (gammes || []).filter(
          (g: GammePartial) => !manualAliases.has(g.pg_alias),
        );
        const gammeIds = filteredGammes.map(
          (g: GammePartial) => g.pg_id?.toString() ?? '',
        );
        const familyMap = await this.resolveFamilyNames(client, gammeIds);

        autoGuides = filteredGammes.map((g: GammePartial) => {
          const pgRow = pgDataMap.get(g.pg_id.toString()) || {};
          // Count non-null sections for h2Count
          const sectionFields = [
            pgRow.sgpg_how_to_choose,
            pgRow.sgpg_risk_explanation,
            pgRow.sgpg_timing_note,
            pgRow.sgpg_arg1_title,
            pgRow.sgpg_arg2_title,
            pgRow.sgpg_arg3_title,
            pgRow.sgpg_arg4_title,
          ];
          const h2Count = sectionFields.filter(Boolean).length;
          const faqCount = Array.isArray(pgRow.sgpg_faq)
            ? pgRow.sgpg_faq.length
            : 0;
          // Estimate reading time from total content chars
          const allText = sectionFields.filter(Boolean).map(String).join(' ');
          const readingTime = Math.max(1, Math.ceil(allText.length / 1000));
          const excerpt = ((pgRow.sgpg_intro_role as string) || '')
            .slice(0, 200)
            .trim();

          return {
            id: `gamme_guide_${g.pg_id}`,
            type: 'guide' as const,
            title: `Comment choisir son ${(g.pg_name || '').toLowerCase()} ?`,
            slug: g.pg_alias,
            excerpt,
            content: '',
            keywords: [],
            tags: [
              familyMap.get(g.pg_id.toString()) ||
                this.guessFamilyFromName(g.pg_name),
              g.pg_name,
            ].filter(Boolean),
            featuredImage: buildGammeImageUrl(g.pg_pic || `${g.pg_alias}.webp`),
            publishedAt: new Date().toISOString(),
            viewsCount: 0,
            sections: [],
            h2Count: h2Count + (faqCount > 0 ? 1 : 0),
            readingTime,
            legacy_id: Number(g.pg_id) || 0,
            legacy_table: '__seo_gamme_purchase_guide',
            source: 'auto' as const,
          };
        });
      }

      // Combiner : manuels d'abord, puis auto (paginés)
      const allArticles = [...manualArticles, ...autoGuides];
      const total = (manualCount || 0) + autoGuides.length;
      const paginated = allArticles.slice(offset, offset + limit);

      const result = { articles: paginated, total };
      await this.cacheManager.set(cacheKey, result, 1800); // 30 min

      this.logger.log(
        `📖 Récupéré ${paginated.length} guides (${manualArticles.length} manuels + ${autoGuides.length} auto, ${total} total)`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `❌ Erreur récupération guides: ${(error as Error).message}`,
      );
      return { articles: [], total: 0 };
    }
  }

  /**
   * 🔍 Récupérer un guide par ID
   */
  async getGuideById(id: string | number): Promise<BlogArticle | null> {
    const cacheKey = `guide:${id}`;

    try {
      const cached = await this.cacheManager.get<BlogArticle>(cacheKey);
      if (cached) {
        return cached;
      }

      const client = this.supabaseService.getClient();
      const { data: guide } = await client
        .from(TABLES.blog_guide)
        .select('*')
        .eq('bg_id', id.toString())
        .single();

      if (!guide) return null;

      const article = await this.transformGuideToArticle(client, guide);
      if (article) {
        await this.cacheManager.set(cacheKey, article, 3600); // 1h
      }

      return article;
    } catch (error) {
      this.logger.error(
        `❌ Erreur récupération guide ${id}: ${(error as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Récupérer un guide par slug — fallback chain :
   * 1) __blog_guide (guides manuels éditoriaux)
   * 2) __seo_gamme_purchase_guide via pg_alias direct
   */
  async getGuideBySlug(slug: string): Promise<BlogArticle | null> {
    const cacheKey = `guide:slug:${slug}`;

    try {
      const cached = await this.cacheManager.get<BlogArticle>(cacheKey);
      if (cached) {
        return cached;
      }

      const client = this.supabaseService.getClient();

      // 1) Chercher dans __blog_guide (guides manuels)
      const { data: guide } = await client
        .from(TABLES.blog_guide)
        .select('*')
        .eq('bg_alias', slug)
        .single();

      if (guide) {
        const [article, relatedGuides] = await Promise.all([
          this.transformGuideToArticle(client, guide),
          this.getRelatedGuides(client, guide.bg_id),
        ]);

        if (article) {
          const enriched = { ...article, relatedGuides };
          await this.cacheManager.set(cacheKey, enriched, 3600);
          return enriched;
        }
        return article;
      }

      // 2) Fallback : slug = pg_alias directement → purchase guide
      const { data: gamme } = await client
        .from('pieces_gamme')
        .select('pg_id, pg_name, pg_alias, pg_parent, pg_pic')
        .eq('pg_alias', slug)
        .eq('pg_display', '1')
        .single();

      if (!gamme) return null;

      const { data: purchaseGuide } = await client
        .from('__seo_gamme_purchase_guide')
        .select('*')
        .eq('sgpg_pg_id', gamme.pg_id)
        .single();

      if (!purchaseGuide) return null;

      const article = this.transformPurchaseGuideToArticle(
        gamme,
        purchaseGuide,
      );
      await this.cacheManager.set(cacheKey, article, 3600);
      return article;
    } catch (error) {
      this.logger.error(
        `❌ Erreur récupération guide par slug ${slug}: ${(error as Error).message}`,
      );
      return null;
    }
  }

  /**
   * �🛒 Récupérer les guides d'achat
   */
  async getPurchaseGuides(): Promise<BlogArticle[]> {
    const cacheKey = 'guides_purchase';

    try {
      const cached = await this.cacheManager.get<BlogArticle[]>(cacheKey);
      if (cached) {
        return cached;
      }

      const client = this.supabaseService.getClient();

      const { data: guidesList } = await client
        .from(TABLES.blog_guide)
        .select('*')
        .or(
          [
            'bg_title.ilike.%achat%',
            'bg_title.ilike.%acheter%',
            'bg_title.ilike.%choisir%',
            'bg_keywords.ilike.%achat%',
          ].join(','),
        )
        .order('bg_visit', { ascending: false })
        .limit(10);

      if (!guidesList) return [];

      // Paralléliser les transformations pour éviter N+1
      const articlePromises = guidesList.map((guide) =>
        this.transformGuideToArticle(client, guide),
      );
      const articlesResults = await Promise.all(articlePromises);
      const articles = articlesResults.filter(
        (article): article is BlogArticle => article !== null,
      );

      await this.cacheManager.set(cacheKey, articles, 3600);
      return articles;
    } catch (error) {
      this.logger.error(
        `❌ Erreur guides d'achat: ${(error as Error).message}`,
      );
      return [];
    }
  }

  /**
   * 🔧 Récupérer les guides techniques
   */
  async getTechnicalGuides(): Promise<BlogArticle[]> {
    const cacheKey = 'guides_technical';

    try {
      const cached = await this.cacheManager.get<BlogArticle[]>(cacheKey);
      if (cached) {
        return cached;
      }

      const client = this.supabaseService.getClient();

      const { data: guidesList } = await client
        .from(TABLES.blog_guide)
        .select('*')
        .or(
          [
            'bg_title.ilike.%technique%',
            'bg_title.ilike.%fonctionnement%',
            'bg_title.ilike.%comprendre%',
            'bg_keywords.ilike.%technique%',
          ].join(','),
        )
        .order('bg_visit', { ascending: false })
        .limit(10);

      if (!guidesList) return [];

      // Paralléliser les transformations pour éviter N+1
      const articlePromises = guidesList.map((guide) =>
        this.transformGuideToArticle(client, guide),
      );
      const articlesResults = await Promise.all(articlePromises);
      const articles = articlesResults.filter(
        (article): article is BlogArticle => article !== null,
      );

      await this.cacheManager.set(cacheKey, articles, 3600);
      return articles;
    } catch (error) {
      this.logger.error(
        `❌ Erreur guides techniques: ${(error as Error).message}`,
      );
      return [];
    }
  }

  /**
   * 📊 Statistiques spécifiques aux guides
   */
  async getGuideStats(): Promise<{
    total: number;
    totalViews: number;
    avgViews: number;
    byType: Array<{ type: string; count: number }>;
    mostPopular: BlogArticle[];
  }> {
    const cacheKey = 'guides_stats';

    try {
      type GuideStats = {
        total: number;
        totalViews: number;
        avgViews: number;
        byType: Array<{ type: string; count: number }>;
        mostPopular: BlogArticle[];
      };
      const cached = await this.cacheManager.get<GuideStats>(cacheKey);
      if (cached) {
        return cached;
      }

      const client = this.supabaseService.getClient();

      // Statistiques de base
      const { data: allGuides } = await client
        .from(TABLES.blog_guide)
        .select('bg_visit, bg_title, bg_keywords');

      if (!allGuides) {
        return {
          total: 0,
          totalViews: 0,
          avgViews: 0,
          byType: [],
          mostPopular: [],
        };
      }

      const totalViews = allGuides.reduce(
        (sum, guide) => sum + (parseInt(guide.bg_visit) || 0),
        0,
      );
      const avgViews = Math.round(totalViews / allGuides.length);

      // Analyser les types de guides
      const typeCount: { [key: string]: number } = {};
      allGuides.forEach((guide) => {
        const title = guide.bg_title.toLowerCase();
        if (
          title.includes('achat') ||
          title.includes('acheter') ||
          title.includes('choisir')
        ) {
          typeCount['Achat'] = (typeCount['Achat'] || 0) + 1;
        } else if (
          title.includes('technique') ||
          title.includes('fonctionnement')
        ) {
          typeCount['Technique'] = (typeCount['Technique'] || 0) + 1;
        } else if (
          title.includes('entretien') ||
          title.includes('maintenance')
        ) {
          typeCount['Entretien'] = (typeCount['Entretien'] || 0) + 1;
        } else if (title.includes('réparation') || title.includes('réparer')) {
          typeCount['Réparation'] = (typeCount['Réparation'] || 0) + 1;
        } else {
          typeCount['Général'] = (typeCount['Général'] || 0) + 1;
        }
      });

      const byType = Object.entries(typeCount)
        .sort(([, a], [, b]) => b - a)
        .map(([type, count]) => ({ type, count }));

      // Guides les plus populaires
      const { data: popularGuides } = await client
        .from(TABLES.blog_guide)
        .select('*')
        .order('bg_visit', { ascending: false })
        .limit(5);

      const mostPopular: BlogArticle[] = [];
      if (popularGuides) {
        for (const guide of popularGuides) {
          const article = await this.transformGuideToArticle(client, guide);
          if (article) mostPopular.push(article);
        }
      }

      const stats = {
        total: allGuides.length,
        totalViews,
        avgViews,
        byType,
        mostPopular,
      };

      await this.cacheManager.set(cacheKey, stats, 3600);
      return stats;
    } catch (error) {
      this.logger.error(`❌ Erreur stats guides: ${(error as Error).message}`);
      return {
        total: 0,
        totalViews: 0,
        avgViews: 0,
        byType: [],
        mostPopular: [],
      };
    }
  }

  /**
   * 👀 Incrementer le compteur de vues d'un guide
   */
  async incrementGuideViews(id: string | number): Promise<boolean> {
    try {
      const client = this.supabaseService.getClient();

      // Récupérer les vues actuelles
      const { data: current } = await client
        .from(TABLES.blog_guide)
        .select('bg_visit')
        .eq('bg_id', id.toString())
        .single();

      if (!current) return false;

      const newViews = (parseInt(current.bg_visit) || 0) + 1;

      // Mettre à jour
      const { error } = await client
        .from(TABLES.blog_guide)
        .update({ bg_visit: newViews.toString() })
        .eq('bg_id', id.toString());

      if (error) {
        this.logger.error(`❌ Erreur mise à jour vues: ${error.message}`);
        return false;
      }

      // Invalider le cache
      await this.cacheManager.del(`guide:${id}`);
      await this.cacheManager.del('guides_stats');

      this.logger.debug(`👀 Vues mises à jour pour guide ${id}: ${newViews}`);
      return true;
    } catch (error) {
      this.logger.error(
        `❌ Erreur incrément vues: ${(error as Error).message}`,
      );
      return false;
    }
  }

  // MÉTHODES PRIVÉES

  private async transformGuideToArticle(
    client: SupabaseClient,
    guide: BlogGuide,
  ): Promise<BlogArticle> {
    // Batch H2 + H3 en 2 queries (pas N+1)
    const { data: h2Sections } = await client
      .from(TABLES.blog_guide_h2)
      .select('*')
      .eq('bg2_bg_id', guide.bg_id)
      .order('bg2_id');

    const h2Ids = (h2Sections || []).map((h: BlogGuideH2) => h.bg2_id);
    const { data: allH3Sections } =
      h2Ids.length > 0
        ? await client
            .from(TABLES.blog_guide_h3)
            .select('*')
            .in('bg3_bg2_id', h2Ids)
            .order('bg3_id')
        : { data: [] };

    // Grouper H3 par bg3_bg2_id pour acces O(1)
    const h3Map = new Map<string, BlogGuideH3[]>();
    (allH3Sections || []).forEach((h3: BlogGuideH3) => {
      const key = h3.bg3_bg2_id ?? '';
      if (!h3Map.has(key)) h3Map.set(key, []);
      h3Map.get(key)!.push(h3);
    });

    const sections: BlogSection[] = [];

    if (h2Sections && h2Sections.length > 0) {
      for (const h2 of h2Sections) {
        sections.push({
          level: 2,
          title: h2.bg2_h2,
          content: h2.bg2_content,
          anchor: h2.bg2_h2?.toLowerCase().replace(/\s+/g, '-'),
          wall: h2.bg2_wall || null,
          cta_anchor: h2.bg2_cta_anchor || null,
          cta_link: h2.bg2_cta_link || null,
        });

        const h3ForThis = h3Map.get(h2.bg2_id) || [];
        for (const h3 of h3ForThis) {
          sections.push({
            level: 3,
            title: h3.bg3_h3,
            content: h3.bg3_content,
            anchor: h3.bg3_h3?.toLowerCase().replace(/\s+/g, '-'),
            wall: h3.bg3_wall || null,
            cta_anchor: h3.bg3_cta_anchor || null,
            cta_link: h3.bg3_cta_link || null,
          });
        }
      }
    }

    // Calculer readingTime (chars totaux / 1000 ~ 1 min)
    const totalChars =
      (guide.bg_content?.length || 0) +
      sections.reduce((sum, s) => sum + (s.content?.length || 0), 0);

    return {
      id: `guide_${guide.bg_id}`,
      type: 'guide',
      title: guide.bg_title,
      slug: guide.bg_alias,
      excerpt: guide.bg_preview || guide.bg_descrip,
      content: guide.bg_content,
      h1: guide.bg_h1,
      h2: guide.bg_h2,
      keywords: guide.bg_keywords ? guide.bg_keywords.split(', ') : [],
      tags: [
        this.guessFamilyFromName(guide.bg_title),
        ...(guide.bg_keywords ? guide.bg_keywords.split(', ') : []),
      ],
      publishedAt: guide.bg_create,
      updatedAt: guide.bg_update,
      viewsCount: parseInt(guide.bg_visit) || 0,
      sections,
      h2Count: sections.filter((s) => s.level === 2).length,
      h3Count: sections.filter((s) => s.level === 3).length,
      readingTime: Math.max(1, Math.ceil(totalChars / 1000)),
      legacy_id: parseInt(guide.bg_id),
      legacy_table: '__blog_guide',
      source: 'manual',
      seo_data: {
        meta_title: guide.bg_title,
        meta_description: guide.bg_descrip,
        keywords: guide.bg_keywords ? guide.bg_keywords.split(', ') : [],
      },
    };
  }

  /**
   * Transforme un purchase guide (__seo_gamme_purchase_guide) en BlogArticle
   */
  private transformPurchaseGuideToArticle(
    gamme: GammePartial,
    pg: PurchaseGuideRow,
  ): BlogArticle {
    const sections: BlogSection[] = [];
    const pgName = (gamme.pg_name || '').toLowerCase();

    // H2: À quoi ça sert
    if (pg.sgpg_intro_role) {
      sections.push({
        level: 2,
        title: pg.sgpg_intro_title || `À quoi sert un ${pgName} ?`,
        content: pg.sgpg_intro_role,
        anchor: 'a-quoi-ca-sert',
      });
    }

    // H2: Comment choisir
    if (pg.sgpg_how_to_choose) {
      sections.push({
        level: 2,
        title: `Comment choisir son ${pgName} ?`,
        content: pg.sgpg_how_to_choose,
        anchor: 'comment-choisir',
      });
    }

    // H2: Risques
    if (pg.sgpg_risk_explanation) {
      sections.push({
        level: 2,
        title: pg.sgpg_risk_title || "Pourquoi c'est critique",
        content: pg.sgpg_risk_explanation,
        anchor: 'risques',
      });
    }

    // H2: Quand changer
    if (pg.sgpg_timing_note) {
      const timingContent = pg.sgpg_timing_km
        ? `${pg.sgpg_timing_note} (${pg.sgpg_timing_km} km)`
        : pg.sgpg_timing_note;
      sections.push({
        level: 2,
        title: pg.sgpg_timing_title || 'Quand changer',
        content: timingContent,
        anchor: 'quand-changer',
      });
    }

    // H2: Symptômes
    const symptoms: string[] = pg.sgpg_symptoms || [];
    if (symptoms.length > 0) {
      sections.push({
        level: 2,
        title: 'Symptômes à surveiller',
        content: `<ul>${symptoms.map((s: string) => `<li>${s}</li>`).join('')}</ul>`,
        anchor: 'symptomes',
      });
    }

    // H2: Erreurs à éviter
    const antiMistakes: string[] = pg.sgpg_anti_mistakes || [];
    if (antiMistakes.length > 0) {
      sections.push({
        level: 2,
        title: 'Erreurs à éviter',
        content: `<ul>${antiMistakes.map((m: string) => `<li>${m}</li>`).join('')}</ul>`,
        anchor: 'erreurs',
      });
    }

    // H2: FAQ (chaque Q/R = H3)
    const faq: Array<{ question: string; answer: string }> = pg.sgpg_faq || [];
    if (faq.length > 0) {
      sections.push({
        level: 2,
        title: 'Questions fréquentes',
        content: '',
        anchor: 'faq',
      });
      for (const item of faq) {
        sections.push({
          level: 3,
          title: item.question,
          content: item.answer,
          anchor: (item.question || '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .slice(0, 50),
        });
      }
    }

    const totalChars = sections.reduce(
      (sum, s) => sum + (s.content?.length || 0),
      0,
    );

    return {
      id: `gamme_guide_${gamme.pg_id}`,
      type: 'guide',
      title: `Comment choisir son ${pgName} ?`,
      slug: gamme.pg_alias,
      excerpt: (pg.sgpg_intro_role || '').slice(0, 200),
      content: '',
      keywords: [],
      tags: [this.guessFamilyFromName(gamme.pg_name), gamme.pg_name].filter(
        Boolean,
      ),
      featuredImage: gammeImage(gamme.pg_pic, gamme.pg_alias),
      publishedAt: pg.sgpg_created_at || new Date().toISOString(),
      updatedAt: pg.sgpg_updated_at || null,
      viewsCount: 0,
      sections,
      h2Count: sections.filter((s) => s.level === 2).length,
      h3Count: sections.filter((s) => s.level === 3).length,
      readingTime: Math.max(1, Math.ceil(totalChars / 1000)),
      legacy_id: Number(gamme.pg_id) || 0,
      legacy_table: '__seo_gamme_purchase_guide',
      source: 'auto',
      seo_data: {
        meta_title: `Comment choisir son ${pgName} ? Guide complet`,
        meta_description: (pg.sgpg_intro_role || '').slice(0, 155),
        keywords: [gamme.pg_name, gamme.pg_parent].filter(Boolean),
      },
    };
  }

  /**
   * Récupère les guides de la même famille (pour section "Guides similaires")
   * Chaîne : bg_alias → pieces_gamme → __seo_family_gamme_car_switch → siblings
   * Fallback : 4 guides récents si pas de famille trouvée
   */
  private async getRelatedGuides(
    client: SupabaseClient,
    currentGuideId: string,
  ): Promise<Record<string, unknown>[]> {
    try {
      // 1. Récupérer le bg_alias du guide courant
      const { data: currentGuide } = await client
        .from(TABLES.blog_guide)
        .select('bg_alias')
        .eq('bg_id', currentGuideId)
        .single();

      if (!currentGuide?.bg_alias) {
        return this.fallbackRelatedGuides(client, currentGuideId);
      }

      // 2. Résoudre la gamme via pieces_gamme
      const { data: gamme } = await client
        .from('pieces_gamme')
        .select('pg_id')
        .eq('pg_alias', currentGuide.bg_alias)
        .eq('pg_display', '1')
        .single();

      if (!gamme) {
        return this.fallbackRelatedGuides(client, currentGuideId);
      }

      // 3. Trouver la famille via __seo_family_gamme_car_switch
      const { data: familyLink } = await client
        .from('__seo_family_gamme_car_switch')
        .select('sfgcs_mf_id')
        .eq('sfgcs_pg_id', gamme.pg_id.toString())
        .single();

      if (!familyLink?.sfgcs_mf_id) {
        return this.fallbackRelatedGuides(client, currentGuideId);
      }

      // 4. Trouver les autres gammes de la même famille
      const { data: sameFamily } = await client
        .from('__seo_family_gamme_car_switch')
        .select('sfgcs_pg_id')
        .eq('sfgcs_mf_id', familyLink.sfgcs_mf_id)
        .neq('sfgcs_pg_id', gamme.pg_id.toString());

      if (!sameFamily || sameFamily.length === 0) {
        return this.fallbackRelatedGuides(client, currentGuideId);
      }

      // 5. Résoudre les alias des gammes sœurs
      const siblingPgIds = sameFamily.map(
        (s: { sfgcs_pg_id: string }) => s.sfgcs_pg_id,
      );
      const { data: siblingGammes } = await client
        .from('pieces_gamme')
        .select('pg_alias')
        .in('pg_id', siblingPgIds)
        .eq('pg_display', '1');

      const siblingAliases = (siblingGammes || []).map(
        (g: Pick<PiecesGamme, 'pg_alias'>) => g.pg_alias,
      );
      if (siblingAliases.length === 0) {
        return this.fallbackRelatedGuides(client, currentGuideId);
      }

      // 6. Récupérer les guides correspondants
      const { data: relatedGuides } = await client
        .from(TABLES.blog_guide)
        .select(
          'bg_id, bg_title, bg_alias, bg_preview, bg_descrip, bg_visit, bg_create',
        )
        .in('bg_alias', siblingAliases)
        .neq('bg_id', currentGuideId)
        .limit(4);

      if (!relatedGuides || relatedGuides.length === 0) {
        return this.fallbackRelatedGuides(client, currentGuideId);
      }

      return relatedGuides.map(
        (
          g: Pick<
            BlogGuide,
            | 'bg_id'
            | 'bg_title'
            | 'bg_alias'
            | 'bg_preview'
            | 'bg_descrip'
            | 'bg_visit'
            | 'bg_create'
          >,
        ) => ({
          id: `guide_${g.bg_id}`,
          title: g.bg_title,
          slug: g.bg_alias,
          excerpt: g.bg_preview || g.bg_descrip || '',
          viewsCount: parseInt(g.bg_visit) || 0,
          publishedAt: g.bg_create,
        }),
      );
    } catch (error) {
      this.logger.warn(`Erreur related guides: ${(error as Error).message}`);
      return this.fallbackRelatedGuides(client, currentGuideId);
    }
  }

  /**
   * Fallback : 4 guides récents (ancien comportement)
   */
  private async fallbackRelatedGuides(
    client: SupabaseClient,
    currentGuideId: string,
  ): Promise<Record<string, unknown>[]> {
    try {
      const { data: otherGuides } = await client
        .from(TABLES.blog_guide)
        .select(
          'bg_id, bg_title, bg_alias, bg_preview, bg_descrip, bg_visit, bg_create',
        )
        .neq('bg_id', currentGuideId)
        .limit(4);

      return (otherGuides || []).map(
        (
          g: Pick<
            BlogGuide,
            | 'bg_id'
            | 'bg_title'
            | 'bg_alias'
            | 'bg_preview'
            | 'bg_descrip'
            | 'bg_visit'
            | 'bg_create'
          >,
        ) => ({
          id: `guide_${g.bg_id}`,
          title: g.bg_title,
          slug: g.bg_alias,
          excerpt: g.bg_preview || g.bg_descrip || '',
          viewsCount: parseInt(g.bg_visit) || 0,
          publishedAt: g.bg_create,
        }),
      );
    } catch (error) {
      this.logger.warn(
        `Erreur fallback related guides: ${(error as Error).message}`,
      );
      return [];
    }
  }

  /**
   * Resolve pg_id → family name via __seo_family_gamme_car_switch + catalog_family
   */
  private async resolveFamilyNames(
    client: SupabaseClient,
    pgIds: string[],
  ): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (pgIds.length === 0) return map;

    try {
      const { data: mappings } = await client
        .from('__seo_family_gamme_car_switch')
        .select('sfgcs_pg_id, sfgcs_mf_id')
        .in('sfgcs_pg_id', pgIds);

      if (!mappings || mappings.length === 0) return map;

      const pgToMf = new Map<string, string>();
      for (const m of mappings) {
        if (!pgToMf.has(m.sfgcs_pg_id)) {
          pgToMf.set(m.sfgcs_pg_id, m.sfgcs_mf_id);
        }
      }

      const mfIds = [...new Set(pgToMf.values())];
      const { data: families } = await client
        .from('catalog_family')
        .select('mf_id, mf_name')
        .in('mf_id', mfIds);

      const mfToName = new Map<string, string>();
      for (const f of families || []) {
        mfToName.set(f.mf_id, f.mf_name);
      }

      for (const [pgId, mfId] of pgToMf) {
        const rawName = mfToName.get(mfId);
        if (rawName) {
          map.set(pgId, normalizeFamilyName(mfId, rawName));
        }
      }
    } catch (error) {
      this.logger.warn(
        `Erreur resolution familles: ${(error as Error).message}`,
      );
    }

    return map;
  }

  /**
   * Fallback: guess family from gamme name keywords
   */
  private guessFamilyFromName(name: string): string {
    const n = (name || '').toLowerCase();
    // Filtration
    if (n.includes('filtre') || n.includes('filtration')) return 'Filtration';
    // Freinage
    if (
      n.includes('frein') ||
      n.includes('abs') ||
      n.includes('plaquette') ||
      n.includes('étrier') ||
      n.includes('etrier') ||
      n.includes('tambour') ||
      n.includes('mâchoire') ||
      n.includes('machoire')
    )
      return 'Freinage';
    // Courroie et distribution
    if (
      n.includes('courroie') ||
      n.includes('distribution') ||
      n.includes('galet') ||
      n.includes('poulie')
    )
      return 'Courroie et distribution';
    // Allumage et préchauffage
    if (
      n.includes('bougie') ||
      n.includes('allumage') ||
      n.includes('préchauffage') ||
      n.includes('prechauffage')
    )
      return 'Allumage et préchauffage';
    // Direction
    if (
      n.includes('direction') ||
      n.includes('rotule') ||
      n.includes('bras de') ||
      n.includes('biellette')
    )
      return 'Direction';
    // Amortisseur et suspension
    if (
      n.includes('amortisseur') ||
      n.includes('suspension') ||
      n.includes('ressort')
    )
      return 'Amortisseur et suspension';
    // Support moteur
    if (
      n.includes('support moteur') ||
      n.includes('silent bloc') ||
      n.includes('support de boîte')
    )
      return 'Support moteur';
    // Embrayage
    if (n.includes('embrayage') || n.includes('volant moteur'))
      return 'Embrayage';
    // Transmission
    if (
      n.includes('cardan') ||
      n.includes('transmission') ||
      n.includes('soufflet')
    )
      return 'Transmission';
    // Electrique
    if (
      n.includes('alternateur') ||
      n.includes('démarreur') ||
      n.includes('demarreur') ||
      n.includes('neiman') ||
      n.includes('contacteur')
    )
      return 'Electrique';
    // Capteurs et sondes
    if (
      n.includes('capteur') ||
      n.includes('sonde') ||
      n.includes('pressostat')
    )
      return 'Capteurs et sondes';
    // Alimentation
    if (
      n.includes('débitmètre') ||
      n.includes('debitmetre') ||
      n.includes('vanne egr') ||
      n.includes('pompe à carburant') ||
      n.includes('pompe a carburant') ||
      n.includes('injecteur')
    )
      return 'Alimentation';
    // Moteur
    if (
      n.includes('joint de culasse') ||
      n.includes('culbuteur') ||
      n.includes('vilebrequin') ||
      n.includes('culasse') ||
      n.includes('vis de culasse')
    )
      return 'Moteur';
    // Refroidissement
    if (
      n.includes('pompe à eau') ||
      n.includes('pompe a eau') ||
      n.includes('radiateur') ||
      n.includes('thermostat') ||
      n.includes('refroidissement') ||
      n.includes('calorstat')
    )
      return 'Refroidissement';
    // Climatisation
    if (
      n.includes('climatisation') ||
      n.includes('compresseur clim') ||
      n.includes('pulseur') ||
      n.includes('condenseur') ||
      n.includes('évaporateur') ||
      n.includes('evaporateur')
    )
      return 'Climatisation';
    // Echappement
    if (
      n.includes('échappement') ||
      n.includes('echappement') ||
      n.includes('catalyseur') ||
      n.includes('collecteur') ||
      n.includes('fap') ||
      n.includes('particules') ||
      n.includes('lambda')
    )
      return 'Echappement';
    // Eclairage
    if (
      n.includes('feu') ||
      n.includes('éclairage') ||
      n.includes('eclairage') ||
      n.includes('phare') ||
      n.includes('clignotant')
    )
      return 'Eclairage';
    // Accessoires
    if (
      n.includes('essuie') ||
      n.includes('balai') ||
      n.includes('rétroviseur') ||
      n.includes('retroviseur') ||
      n.includes('lève-vitre') ||
      n.includes('leve-vitre') ||
      n.includes('attelage')
    )
      return 'Accessoires';
    // Turbo
    if (
      n.includes('turbo') ||
      n.includes('intercooler') ||
      n.includes('suralimentation')
    )
      return 'Turbo';
    return 'Autres';
  }
}
