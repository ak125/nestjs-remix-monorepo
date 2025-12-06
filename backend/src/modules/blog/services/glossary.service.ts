import { Injectable, Logger } from '@nestjs/common';
import { TABLES } from '@repo/database-types';
import { SupabaseIndexationService } from '../../search/services/supabase-indexation.service';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import { BlogArticle, BlogSection } from '../interfaces/blog.interfaces';

export interface GlossaryFilters {
  letter?: string;
  category?: string;
  minViews?: number;
}

/**
 * 📚 GlossaryService - Service spécialisé pour le glossaire automobile
 *
 * Gère spécifiquement la table __blog_glossaire avec définitions
 * et termes techniques automobiles.
 */
@Injectable()
export class GlossaryService {
  private readonly logger = new Logger(GlossaryService.name);

  constructor(
    private readonly supabaseService: SupabaseIndexationService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  /**
   * 📚 Récupérer tous les termes du glossaire avec pagination
   */
  async getAllTerms(
    options: {
      limit?: number;
      offset?: number;
      filters?: GlossaryFilters;
    } = {},
  ): Promise<{ articles: BlogArticle[]; total: number }> {
    const { limit = 50, offset = 0, filters = {} } = options;
    const cacheKey = `glossary_all:${limit}:${offset}:${JSON.stringify(filters)}`;

    try {
      const cached = await this.cacheManager.get(cacheKey);
      if (cached) {
        return cached as any;
      }

      const client = this.supabaseService.getClient();
      let query = client.from(TABLES.blog_advice).select('*');

      // Appliquer les filtres
      if (filters.letter) {
        query = query.ilike('ba_title', `${filters.letter}%`);
      }

      if (filters.minViews) {
        query = query.gte('ba_visit', filters.minViews.toString());
      }

      // Pagination et tri
      query = query
        .order('ba_title', { ascending: true })
        .range(offset, offset + limit - 1);

      const { data: termsList, count } = await query;

      if (!termsList) {
        return { articles: [], total: 0 };
      }

      // Transformer chaque terme en article
      const articles: BlogArticle[] = termsList.map((term) =>
        this.transformTermToArticle(term),
      );

      const result = { articles, total: count || 0 };
      await this.cacheManager.set(cacheKey, result, 3600); // 1h

      this.logger.log(`📚 Récupéré ${articles.length} termes (${count} total)`);
      return result;
    } catch (error) {
      this.logger.error(
        `❌ Erreur récupération glossaire: ${(error as Error).message}`,
      );
      return { articles: [], total: 0 };
    }
  }

  /**
   * 🔍 Récupérer un terme par ID
   */
  async getTermById(id: string | number): Promise<BlogArticle | null> {
    const cacheKey = `glossary_term:${id}`;

    try {
      const cached = await this.cacheManager.get<BlogArticle>(cacheKey);
      if (cached) {
        return cached;
      }

      const client = this.supabaseService.getClient();
      const { data: term } = await client
        .from(TABLES.blog_advice)
        .select('*')
        .eq('ba_id', id.toString())
        .single();

      if (!term) return null;

      const article = this.transformTermToArticle(term);
      await this.cacheManager.set(cacheKey, article, 3600); // 1h

      return article;
    } catch (error) {
      this.logger.error(
        `❌ Erreur récupération terme ${id}: ${(error as Error).message}`,
      );
      return null;
    }
  }

  /**
   * 🔤 Récupérer les termes par lettre
   */
  async getTermsByLetter(letter: string): Promise<BlogArticle[]> {
    const cacheKey = `glossary_letter:${letter.toLowerCase()}`;

    try {
      const cached = await this.cacheManager.get<BlogArticle[]>(cacheKey);
      if (cached) {
        return cached;
      }

      const client = this.supabaseService.getClient();

      const { data: termsList } = await client
        .from(TABLES.blog_advice)
        .select('*')
        .ilike('ba_title', `${letter}%`)
        .order('ba_title', { ascending: true });

      if (!termsList) return [];

      const articles = termsList.map((term) =>
        this.transformTermToArticle(term),
      );

      await this.cacheManager.set(cacheKey, articles, 7200); // 2h
      return articles;
    } catch (error) {
      this.logger.error(
        `❌ Erreur termes lettre ${letter}: ${(error as Error).message}`,
      );
      return [];
    }
  }

  /**
   * 🔍 Rechercher des termes
   */
  async searchTerms(query: string, limit: number = 20): Promise<BlogArticle[]> {
    const cacheKey = `glossary_search:${query.toLowerCase()}:${limit}`;

    try {
      const cached = await this.cacheManager.get<BlogArticle[]>(cacheKey);
      if (cached) {
        return cached;
      }

      const client = this.supabaseService.getClient();

      const { data: termsList } = await client
        .from(TABLES.blog_advice)
        .select('*')
        .or(
          [
            `bgl_terme.ilike.%${query}%`,
            `bgl_definition.ilike.%${query}%`,
            `bgl_keywords.ilike.%${query}%`,
          ].join(','),
        )
        .order('ba_visit', { ascending: false })
        .limit(limit);

      if (!termsList) return [];

      const articles = termsList.map((term) =>
        this.transformTermToArticle(term),
      );

      await this.cacheManager.set(cacheKey, articles, 1800); // 30min
      return articles;
    } catch (error) {
      this.logger.error(
        `❌ Erreur recherche termes: ${(error as Error).message}`,
      );
      return [];
    }
  }

  /**
   * 📚 Récupérer tous les termes groupés par lettre
   */
  async getTermsAlphabetical(): Promise<{ [letter: string]: BlogArticle[] }> {
    const cacheKey = 'glossary_alphabetical';

    try {
      const cached = await this.cacheManager.get(cacheKey);
      if (cached) {
        return cached as any;
      }

      const client = this.supabaseService.getClient();

      const { data: termsList } = await client
        .from(TABLES.blog_advice)
        .select('*')
        .order('ba_title', { ascending: true });

      if (!termsList) return {};

      const termsByLetter: { [letter: string]: BlogArticle[] } = {};

      termsList.forEach((term) => {
        const article = this.transformTermToArticle(term);
        const firstLetter = term.bgl_terme.charAt(0).toUpperCase();

        if (!termsByLetter[firstLetter]) {
          termsByLetter[firstLetter] = [];
        }

        termsByLetter[firstLetter].push(article);
      });

      await this.cacheManager.set(cacheKey, termsByLetter, 7200); // 2h
      return termsByLetter;
    } catch (error) {
      this.logger.error(
        `❌ Erreur glossaire alphabétique: ${(error as Error).message}`,
      );
      return {};
    }
  }

  /**
   * 🎲 Récupérer des termes aléatoires
   */
  async getRandomTerms(count: number = 10): Promise<BlogArticle[]> {
    const cacheKey = `glossary_random:${count}`;

    try {
      const cached = await this.cacheManager.get<BlogArticle[]>(cacheKey);
      if (cached) {
        return cached;
      }

      const client = this.supabaseService.getClient();

      // Utiliser une fonction random ou ordre aléatoire
      const { data: termsList } = await client
        .from(TABLES.blog_advice)
        .select('*')
        .limit(count * 2) // Prendre plus pour avoir du choix
        .order('ba_visit', { ascending: false });

      if (!termsList) return [];

      // Mélanger et prendre le nombre demandé
      const shuffled = termsList.sort(() => 0.5 - Math.random());
      const randomTerms = shuffled.slice(0, count);

      const articles = randomTerms.map((term) =>
        this.transformTermToArticle(term),
      );

      // Cache plus court pour le contenu aléatoire
      await this.cacheManager.set(cacheKey, articles, 900); // 15min
      return articles;
    } catch (error) {
      this.logger.error(
        `❌ Erreur termes aléatoires: ${(error as Error).message}`,
      );
      return [];
    }
  }

  /**
   * 📊 Statistiques du glossaire
   */
  async getGlossaryStats(): Promise<{
    total: number;
    totalViews: number;
    avgViews: number;
    byLetter: Array<{ letter: string; count: number }>;
    mostPopular: BlogArticle[];
    averageDefinitionLength: number;
  }> {
    const cacheKey = 'glossary_stats';

    try {
      const cached = await this.cacheManager.get(cacheKey);
      if (cached) {
        return cached as any;
      }

      const client = this.supabaseService.getClient();

      // Statistiques de base
      const { data: allTerms } = await client
        .from(TABLES.blog_advice)
        .select('ba_visit, ba_title, ba_content');

      if (!allTerms) {
        return {
          total: 0,
          totalViews: 0,
          avgViews: 0,
          byLetter: [],
          mostPopular: [],
          averageDefinitionLength: 0,
        };
      }

      const totalViews = allTerms.reduce(
        (sum, term) => sum + (parseInt(term.ba_visit) || 0),
        0,
      );
      const avgViews = Math.round(totalViews / allTerms.length);

      // Longueur moyenne des définitions
      const totalLength = allTerms.reduce(
        (sum, term) => sum + (term.ba_content?.length || 0),
        0,
      );
      const averageDefinitionLength = Math.round(totalLength / allTerms.length);

      // Distribution par lettre
      const letterCount: { [letter: string]: number } = {};
      allTerms.forEach((term) => {
        const letter = term.ba_title.charAt(0).toUpperCase();
        letterCount[letter] = (letterCount[letter] || 0) + 1;
      });

      const byLetter = Object.entries(letterCount)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([letter, count]) => ({ letter, count }));

      // Termes les plus populaires
      const { data: popularTerms } = await client
        .from(TABLES.blog_advice)
        .select('*')
        .order('ba_visit', { ascending: false })
        .limit(10);

      const mostPopular = popularTerms
        ? popularTerms.map((term) => this.transformTermToArticle(term))
        : [];

      const stats = {
        total: allTerms.length,
        totalViews,
        avgViews,
        byLetter,
        mostPopular,
        averageDefinitionLength,
      };

      await this.cacheManager.set(cacheKey, stats, 3600);
      return stats;
    } catch (error) {
      this.logger.error(
        `❌ Erreur stats glossaire: ${(error as Error).message}`,
      );
      return {
        total: 0,
        totalViews: 0,
        avgViews: 0,
        byLetter: [],
        mostPopular: [],
        averageDefinitionLength: 0,
      };
    }
  }

  /**
   * 👀 Incrementer le compteur de vues d'un terme
   */
  async incrementTermViews(id: string | number): Promise<boolean> {
    try {
      const client = this.supabaseService.getClient();

      // Récupérer les vues actuelles
      const { data: current } = await client
        .from(TABLES.blog_advice)
        .select('ba_visit')
        .eq('ba_id', id.toString())
        .single();

      if (!current) return false;

      const newViews = (parseInt(current.ba_visit) || 0) + 1;

      // Mettre à jour
      const { error } = await client
        .from(TABLES.blog_advice)
        .update({ bgl_visit: newViews.toString() })
        .eq('ba_id', id.toString());

      if (error) {
        this.logger.error(`❌ Erreur mise à jour vues: ${error.message}`);
        return false;
      }

      // Invalider le cache
      await this.cacheManager.del(`glossary_term:${id}`);
      await this.cacheManager.del('glossary_stats');

      this.logger.debug(`👀 Vues mises à jour pour terme ${id}: ${newViews}`);
      return true;
    } catch (error) {
      this.logger.error(
        `❌ Erreur incrément vues: ${(error as Error).message}`,
      );
      return false;
    }
  }

  // MÉTHODES PRIVÉES

  private transformTermToArticle(term: any): BlogArticle {
    // Section unique avec la définition
    const sections: BlogSection[] = [
      {
        level: 2,
        title: 'Définition',
        content: term.ba_content,
        anchor: 'definition',
      },
    ];

    return {
      id: `glossary_${term.bgl_id}`,
      type: 'glossaire',
      title: term.ba_title,
      slug: term.ba_alias,
      excerpt: term.bgl_definition?.substring(0, 150) + '...',
      content: term.ba_content,
      h1: term.ba_title,
      h2: 'Définition',
      keywords: term.bgl_keywords ? term.bgl_keywords.split(', ') : [],
      tags: [`glossaire`, `terme:${term.bgl_terme.toLowerCase()}`],
      publishedAt: term.ba_create,
      updatedAt: term.ba_update,
      viewsCount: parseInt(term.ba_visit) || 0,
      sections,
      legacy_id: parseInt(term.ba_id),
      legacy_table: '__blog_glossaire',
      seo_data: {
        meta_title: `${term.bgl_terme} - Définition automobile`,
        meta_description: term.bgl_definition?.substring(0, 155) + '...',
        keywords: term.bgl_keywords ? term.bgl_keywords.split(', ') : [],
      },
    };
  }
}
