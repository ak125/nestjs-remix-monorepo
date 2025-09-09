import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  Logger,
  HttpException,
  HttpStatus,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { BlogService } from '../services/blog.service';
import { AdviceService } from '../services/advice.service';
import { GuideService } from '../services/guide.service';
import { ConstructeurService } from '../services/constructeur.service';
import { GlossaryService } from '../services/glossary.service';
import { AuthGuard } from '@nestjs/passport';
import { OptionalAuthGuard } from '../../../auth/guards/optional-auth.guard';

/**
 * 📚 BlogController - Contrôleur principal du module blog
 *
 * Endpoints centralisés pour toutes les fonctionnalités blog :
 * - Recherche globale
 * - Articles populaires
 * - Statistiques
 * - Navigation générale
 */
@Controller('api/blog')
export class BlogController {
  private readonly logger = new Logger(BlogController.name);

  constructor(
    private readonly blogService: BlogService,
    private readonly adviceService: AdviceService,
    private readonly guideService: GuideService,
    private readonly constructeurService: ConstructeurService,
    private readonly glossaryService: GlossaryService,
  ) {}

  /**
   * 🏠 Page d'accueil du blog avec contenu complet
   * GET /api/blog/homepage
   */
  @Get('homepage')
  @UseGuards(OptionalAuthGuard)
  async getBlogHomepage() {
    try {
      this.logger.log('[BlogController] GET /api/blog/homepage');
      const homepage = await this.blogService.getHomepageContent();

      return {
        data: homepage,
        success: true,
        message: 'Homepage blog récupérée avec succès',
      };
    } catch (error) {
      this.logger.error('[BlogController] Erreur homepage:', error);
      throw new HttpException(
        'Erreur lors de la récupération de la homepage',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 🔍 Recherche globale dans tout le blog
   * GET /api/blog/search?q=moteur&type=advice&limit=20
   */
  @Get('search')
  @UseGuards(OptionalAuthGuard)
  async searchBlog(
    @Query('q') query: string = '',
    @Query('type') type?: 'advice' | 'guide' | 'constructeur' | 'glossaire',
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number = 20,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
  ) {
    try {
      if (!query.trim()) {
        throw new HttpException(
          'Paramètre de recherche requis',
          HttpStatus.BAD_REQUEST,
        );
      }

      const offset = (page - 1) * limit;

      // Recherche globale ou spécialisée
      const results = await this.blogService.searchBlog(query, {
        type,
        limit,
        offset,
      });

      this.logger.log(
        `🔍 Recherche blog: "${query}" - ${results.articles.length} résultats`,
      );

      return {
        success: true,
        data: {
          query,
          type: type || 'all',
          results: results.articles,
          total: results.total,
          page,
          limit,
          totalPages: Math.ceil(results.total / limit),
        },
      };
    } catch (error) {
      this.logger.error(
        `❌ Erreur recherche blog: ${(error as Error).message}`,
      );
      throw new HttpException(
        'Erreur lors de la recherche',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 📊 Tableau de bord - Vue d'ensemble
   * GET /api/blog/dashboard
   */
  @Get('dashboard')
  async getBlogDashboard() {
    try {
      const [
        blogStats,
        adviceStats,
        guideStats,
        constructeurStats,
        glossaryStats,
        popularArticles,
      ] = await Promise.all([
        this.blogService.getSimpleBlogStats(),
        this.adviceService.getAdviceStats(),
        this.guideService.getGuideStats(),
        this.constructeurService.getConstructeurStats(),
        this.glossaryService.getGlossaryStats(),
        this.blogService.getPopularArticles(10),
      ]);

      return {
        success: true,
        data: {
          overview: {
            totalArticles: blogStats.totalArticles,
            totalViews: blogStats.totalViews,
            totalAdvice: blogStats.totalAdvice,
            totalGuides: blogStats.totalGuides,
          },
          byType: {
            advice: {
              total: adviceStats.total,
              views: adviceStats.totalViews,
              avgViews: adviceStats.avgViews,
            },
            guide: {
              total: guideStats.total,
              views: guideStats.totalViews,
              avgViews: guideStats.avgViews,
            },
            constructeur: {
              total: constructeurStats.total,
              views: constructeurStats.totalViews,
              avgViews: constructeurStats.avgViews,
            },
            glossaire: {
              total: glossaryStats.total,
              views: glossaryStats.totalViews,
              avgViews: glossaryStats.avgViews,
            },
          },
          popular: popularArticles,
          lastUpdated: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `❌ Erreur dashboard blog: ${(error as Error).message}`,
      );
      throw new HttpException(
        'Erreur lors du chargement du dashboard',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 📄 Récupérer un article par ID ou slug
   * GET /api/blog/article/advice_123
   * GET /api/blog/article/comment-choisir-huile-moteur
   */
  @Get('article/:identifier')
  @UseGuards(OptionalAuthGuard)
  async getArticle(@Param('identifier') identifier: string) {
    try {
      // Déterminer le type d'identifiant
      let article = null;

      if (identifier.includes('_')) {
        // Format: type_id (ex: advice_123)
        article = await this.blogService.getArticleBySlug(identifier);
      } else {
        // Format: slug (ex: comment-choisir-huile-moteur)
        article = await this.blogService.getArticleBySlug(identifier);
      }

      if (!article) {
        throw new HttpException('Article non trouvé', HttpStatus.NOT_FOUND);
      }

      // Incrementer les vues si c'est un vrai utilisateur
      if (article.legacy_table && article.legacy_id) {
        this.incrementArticleViews(article);
      }

      return {
        success: true,
        data: {
          article,
          related: await this.getRelatedArticles(article),
        },
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(
        `❌ Erreur récupération article: ${(error as Error).message}`,
      );
      throw new HttpException(
        'Erreur lors de la récupération',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 🌟 Articles populaires
   * GET /api/blog/popular?limit=10&type=advice
   */
  @Get('popular')
  async getPopularArticles(
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number = 10,
    @Query('type') type?: 'advice' | 'guide' | 'constructeur' | 'glossaire',
  ) {
    try {
      let articles = [];

      if (type) {
        // Articles populaires par type
        switch (type) {
          case 'advice':
            const adviceResult = await this.adviceService.getAllAdvice({
              limit,
              sortBy: 'views',
            });
            articles = adviceResult.articles;
            break;
          case 'guide':
            const guideResult = await this.guideService.getAllGuides({ limit });
            articles = guideResult.articles;
            break;
          case 'constructeur':
            articles =
              await this.constructeurService.getPopularConstructeurs(limit);
            break;
          case 'glossaire':
            const glossaryStats = await this.glossaryService.getGlossaryStats();
            articles = glossaryStats.mostPopular.slice(0, limit);
            break;
        }
      } else {
        // Mélange de tous types
        articles = await this.blogService.getPopularArticles(limit);
      }

      return {
        success: true,
        data: {
          articles,
          type: type || 'all',
          limit,
          total: articles.length,
        },
      };
    } catch (error) {
      this.logger.error(
        `❌ Erreur articles populaires: ${(error as Error).message}`,
      );
      throw new HttpException(
        'Erreur lors de la récupération',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 📈 Statistiques générales
   * GET /api/blog/stats
   */
  @Get('stats')
  async getBlogStats() {
    try {
      const stats = await this.blogService.getBlogStats();

      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      this.logger.error(`❌ Erreur stats blog: ${(error as Error).message}`);
      throw new HttpException(
        'Erreur lors des statistiques',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 🗂️ Navigation - Catégories et types
   * GET /api/blog/navigation
   */
  @Get('navigation')
  async getBlogNavigation() {
    try {
      const [adviceStats, guideStats, constructeurs, glossaryStats] =
        await Promise.all([
          this.adviceService.getAdviceStats(),
          this.guideService.getGuideStats(),
          this.constructeurService.getConstructeursByAlpha(),
          this.glossaryService.getGlossaryStats(),
        ]);

      return {
        success: true,
        data: {
          advice: {
            keywords: [], // TODO: Implémenter la récupération des mots-clés
            total: adviceStats.total,
          },
          guide: {
            byType: guideStats.byType,
            total: guideStats.total,
          },
          constructeur: {
            byLetter: Object.keys(constructeurs).map((letter) => ({
              letter,
              count: constructeurs[letter].length,
            })),
            total: (await this.constructeurService.getConstructeurStats())
              .total,
          },
          glossaire: {
            byLetter: glossaryStats.byLetter,
            total: glossaryStats.total,
          },
        },
      };
    } catch (error) {
      this.logger.error(
        `❌ Erreur navigation blog: ${(error as Error).message}`,
      );
      throw new HttpException(
        'Erreur lors de la navigation',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 🔄 Rafraîchir le cache (admin seulement)
   * POST /api/blog/refresh-cache
   */
  @Post('refresh-cache')
  @UseGuards(AuthGuard('jwt'))
  async refreshCache(@Body('type') type?: string) {
    try {
      // TODO: Implémenter la logique de rafraîchissement du cache
      // selon le type spécifié ou global

      this.logger.log(`🔄 Cache rafraîchi: ${type || 'global'}`);

      return {
        success: true,
        message: 'Cache rafraîchi avec succès',
        type: type || 'global',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `❌ Erreur rafraîchissement cache: ${(error as Error).message}`,
      );
      throw new HttpException(
        'Erreur lors du rafraîchissement',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // MÉTHODES PRIVÉES

  /**
   * Incrémenter les vues d'un article selon son type
   */
  private async incrementArticleViews(article: any): Promise<void> {
    try {
      const { legacy_table, legacy_id } = article;

      switch (legacy_table) {
        case '__blog_advice':
          await this.adviceService.incrementAdviceViews(legacy_id);
          break;
        case '__blog_guide':
          await this.guideService.incrementGuideViews(legacy_id);
          break;
        case '__blog_constructeur':
          await this.constructeurService.incrementConstructeurViews(legacy_id);
          break;
        case '__blog_glossaire':
          await this.glossaryService.incrementTermViews(legacy_id);
          break;
      }
    } catch (error) {
      // Erreur silencieuse pour ne pas impacter l'utilisateur
      this.logger.debug(
        `⚠️ Erreur incrément vues: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Récupérer des articles similaires
   */
  private async getRelatedArticles(
    article: any,
    limit: number = 5,
  ): Promise<any[]> {
    try {
      // Recherche basée sur les mots-clés de l'article
      const keywords = article.keywords || [];
      if (keywords.length === 0) return [];

      const searchQuery = keywords.slice(0, 3).join(' ');
      const searchResults = await this.blogService.searchBlog(searchQuery, {
        limit: limit + 1,
      });

      return searchResults.articles
        .filter((a) => a.id !== article.id)
        .slice(0, limit);
    } catch (error) {
      this.logger.debug(
        `⚠️ Erreur articles similaires: ${(error as Error).message}`,
      );
      return [];
    }
  }
}
