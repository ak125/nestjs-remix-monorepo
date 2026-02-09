import { Injectable, Logger } from '@nestjs/common';
import { TABLES } from '@repo/database-types';
import { SupabaseIndexationService } from '../../search/services/supabase-indexation.service';
import { BlogArticle } from '../interfaces/blog.interfaces';
import { AdviceTransformService } from './advice-transform.service';
import { AdviceFilters } from './advice.service';
// Image URL utility
import { buildGammeImageUrl } from '../../catalog/utils/image-urls.utils';

/**
 * Service responsible for enriching advice articles with gamme data
 * and providing stats/search capabilities.
 *
 * Extracted from AdviceService to reduce complexity.
 */
@Injectable()
export class AdviceEnrichmentService {
  private readonly logger = new Logger(AdviceEnrichmentService.name);

  constructor(
    private readonly supabaseService: SupabaseIndexationService,
    private readonly adviceTransformService: AdviceTransformService,
  ) {}

  /**
   * Enrichir les articles avec pg_alias depuis pieces_gamme.
   * Optimise avec une seule requete pour tous les articles.
   */
  async enrichArticlesWithPgAlias(
    articles: BlogArticle[],
  ): Promise<BlogArticle[]> {
    if (!articles || articles.length === 0) return articles;

    try {
      // Recuperer tous les ba_pg_id uniques et les convertir en integers
      const pgIds = [
        ...new Set(
          articles
            .map((a) => {
              const id = a.ba_pg_id;
              return id ? parseInt(id, 10) : null;
            })
            .filter((id) => id != null),
        ),
      ];

      if (pgIds.length === 0) return articles;

      // Charger tous les pg_alias ET pg_img en une seule requete
      const { data: gammes } = await this.supabaseService.client
        .from(TABLES.pieces_gamme)
        .select('pg_id, pg_alias, pg_img')
        .in('pg_id', pgIds);

      // Creer des maps avec cles integers pour acces O(1)
      // ATTENTION : pg_id revient en STRING de Supabase, on doit convertir
      const pgDataMap = new Map();
      if (gammes) {
        for (const g of gammes) {
          // Convertir pg_id string -> integer pour matcher parseInt(ba_pg_id)
          const pgIdInt =
            typeof g.pg_id === 'string' ? parseInt(g.pg_id, 10) : g.pg_id;
          pgDataMap.set(pgIdInt, { alias: g.pg_alias, img: g.pg_img });
        }
      }

      // Enrichir chaque article en une seule passe
      return articles.map((article) => {
        const ba_pg_id = article.ba_pg_id;
        if (!ba_pg_id) {
          // Pas de ba_pg_id, retourner l'article tel quel avec valeurs nulles
          return {
            ...article,
            pg_id: null,
            pg_alias: null,
            ba_pg_id: null,
            featuredImage: null,
          };
        }

        const pg_id = parseInt(ba_pg_id, 10);
        const pgData = pgDataMap.get(pg_id);

        // Construire l'URL de l'image si on a les donnees
        let featuredImage = null;
        let pg_alias = null;

        if (pgData) {
          pg_alias = pgData.alias;
          const pg_image = pgData.img;

          // pg_image prioritaire, sinon pg_alias.webp
          const imageFilename =
            pg_image || (pg_alias ? `${pg_alias}.webp` : null);
          if (imageFilename) {
            // Utilise la fonction centralisee pour construire l'URL image
            featuredImage = buildGammeImageUrl(imageFilename);
          }
        }

        return {
          ...article,
          pg_id: pg_id,
          pg_alias: pg_alias,
          ba_pg_id: ba_pg_id,
          featuredImage: featuredImage,
        };
      });
    } catch (error) {
      this.logger.warn('Erreur enrichArticlesWithPgAlias:', error);
      return articles;
    }
  }

  /**
   * Recuperer statistiques des conseils.
   */
  async getStats(): Promise<{
    total: number;
    totalViews: number;
    avgViews: number;
    topKeywords: Array<{ keyword: string; count: number }>;
    mostPopular: BlogArticle[];
    success: boolean;
  }> {
    try {
      const { data: allAdvice, error } = await this.supabaseService.client
        .from(TABLES.blog_advice)
        .select('ba_visit, ba_keywords, ba_title, ba_alias, ba_id');

      if (error) throw error;

      const total = allAdvice?.length || 0;
      const totalViews =
        allAdvice?.reduce(
          (sum: number, item) => sum + (parseInt(item.ba_visit) || 0),
          0,
        ) || 0;
      const avgViews = total > 0 ? Math.round(totalViews / total) : 0;

      const popularAdvice =
        allAdvice
          ?.sort(
            (a, b) => (parseInt(b.ba_visit) || 0) - (parseInt(a.ba_visit) || 0),
          )
          ?.slice(0, 5) || [];

      const mostPopular: BlogArticle[] = [];
      for (const advice of popularAdvice) {
        const article =
          await this.adviceTransformService.transformAdviceToArticle(advice);
        if (article) mostPopular.push(article);
      }

      return {
        total,
        totalViews,
        avgViews,
        topKeywords: [],
        mostPopular,
        success: true,
      };
    } catch (error) {
      this.logger.error(`Erreur getStats: ${(error as Error).message}`);
      return {
        total: 0,
        totalViews: 0,
        avgViews: 0,
        topKeywords: [],
        mostPopular: [],
        success: false,
      };
    }
  }

  /**
   * Alias pour getStats - compatibilite controleur.
   */
  async getAdviceStats(): Promise<{
    total: number;
    totalViews: number;
    avgViews: number;
    topKeywords: Array<{ keyword: string; count: number }>;
    mostPopular: BlogArticle[];
    success: boolean;
  }> {
    return this.getStats();
  }

  /**
   * Rechercher des conseils par mots-cles.
   * Delegates to the parent service's getAllAdvice via a callback.
   */
  async getAdviceByKeywords(
    keywords: string[],
    limit: number = 10,
    getAllAdviceFn: (params: {
      limit?: number;
      offset?: number;
      filters?: AdviceFilters;
    }) => Promise<{ articles: BlogArticle[]; total: number; success: boolean }>,
  ): Promise<BlogArticle[]> {
    try {
      const result = await getAllAdviceFn({
        limit,
        filters: { keywords },
      });
      return result.articles;
    } catch (error) {
      this.logger.error(
        `Erreur recherche par mots-cles: ${(error as Error).message}`,
      );
      return [];
    }
  }

  /**
   * Obtenir les conseils lies a une famille de produits.
   * Delegates to the parent service's getAllAdvice via a callback.
   */
  async getAdviceForProduct(
    productFamily: string,
    limit: number = 10,
    getAllAdviceFn: (params: {
      limit?: number;
      offset?: number;
      filters?: AdviceFilters;
    }) => Promise<{ articles: BlogArticle[]; total: number; success: boolean }>,
  ): Promise<BlogArticle[]> {
    try {
      const result = await getAllAdviceFn({
        limit,
        filters: { category: productFamily },
      });
      return result.articles;
    } catch (error) {
      this.logger.error(
        `Erreur recherche conseils produit: ${(error as Error).message}`,
      );
      return [];
    }
  }
}
