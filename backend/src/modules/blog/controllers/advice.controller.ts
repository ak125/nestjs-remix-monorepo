import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  Logger,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import {
  OperationFailedException,
  DomainValidationException,
  DomainNotFoundException,
} from '../../../common/exceptions';
import { AdviceService, AdviceFilters } from '../services/advice.service';
import { OptionalAuthGuard } from '../../../auth/guards/optional-auth.guard';
import { IsAdminGuard } from '../../../auth/is-admin.guard';

/**
 * 💡 AdviceController - Contrôleur spécialisé pour les conseils automobiles
 *
 * Endpoints pour gérer spécifiquement les articles de conseils
 * de la table __blog_advice avec leurs fonctionnalités dédiées.
 */
@Controller('api/blog/advice')
export class AdviceController {
  private readonly logger = new Logger(AdviceController.name);

  constructor(private readonly adviceService: AdviceService) {}

  /**
   * 📋 Liste paginée des conseils
   * GET /api/blog/advice?page=1&limit=20&category=entretien
   */
  @Get()
  async getAllAdvice(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number = 20,
    @Query('category') category?: string,
    @Query('difficulty') difficulty?: 'débutant' | 'intermédiaire' | 'expert',
    @Query('minViews', new DefaultValuePipe(0), ParseIntPipe) minViews?: number,
  ) {
    try {
      const offset = (page - 1) * limit;

      const filters: AdviceFilters = {};
      if (category) filters.category = category;
      // Mapping difficulté : débutant/intermédiaire/expert → facile/moyen/difficile
      if (difficulty) {
        const difficultyMap: Record<string, 'facile' | 'moyen' | 'difficile'> =
          {
            débutant: 'facile',
            intermédiaire: 'moyen',
            expert: 'difficile',
          };
        filters.difficulty = difficultyMap[difficulty] || 'facile';
      }
      if (minViews && minViews > 0) filters.minViews = minViews;

      const result = await this.adviceService.getAllAdvice({
        limit,
        offset,
        filters,
      });

      return {
        success: true,
        data: {
          articles: result.articles,
          total: result.total,
          page,
          limit,
          totalPages: Math.ceil(result.total / limit),
          filters,
        },
      };
    } catch (error) {
      this.logger.error(
        `❌ Erreur liste conseils: ${(error as Error).message}`,
      );
      throw new OperationFailedException({
        message: 'Erreur lors de la récupération des conseils',
      });
    }
  }

  /**
   * 🔍 Recherche dans les conseils par mots-clés
   * GET /api/blog/advice/search?keywords=huile,moteur&limit=10
   */
  @Get('search')
  async searchAdvice(
    @Query('keywords') keywords: string = '',
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number = 20,
  ) {
    try {
      if (!keywords.trim()) {
        throw new DomainValidationException({
          message: 'Mots-clés requis pour la recherche',
        });
      }

      const keywordArray = keywords
        .split(',')
        .map((k) => k.trim())
        .filter((k) => k.length > 0);

      const articles = await this.adviceService.getAdviceByKeywords(
        keywordArray,
        limit,
      );

      this.logger.log(
        `🔍 Recherche conseils: [${keywordArray.join(', ')}] - ${articles.length} résultats`,
      );

      return {
        success: true,
        data: {
          keywords: keywordArray,
          articles,
          total: articles.length,
          limit,
        },
      };
    } catch (error) {
      if (error instanceof DomainValidationException) {
        throw error;
      }

      this.logger.error(
        `❌ Erreur recherche conseils: ${(error as Error).message}`,
      );
      throw new OperationFailedException({
        message: 'Erreur lors de la recherche',
      });
    }
  }

  /**
   * ✏️ Mettre à jour un conseil (admin seulement)
   * PATCH /api/blog/advice/123
   */
  @Patch(':id')
  @UseGuards(IsAdminGuard)
  async updateAdvice(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: {
      title?: string;
      preview?: string;
      content?: string;
      h1?: string;
      descrip?: string;
      keywords?: string;
    },
  ) {
    try {
      this.logger.log(`✏️ PATCH /api/blog/advice/${id}`);

      const result = await this.adviceService.updateAdvice(id, body);

      if (!result.success) {
        throw new DomainValidationException({
          message: result.message,
        });
      }

      return {
        success: true,
        message: 'Conseil mis à jour avec succès',
        data: result.data,
      };
    } catch (error) {
      if (error instanceof DomainValidationException) {
        throw error;
      }

      this.logger.error(
        `❌ Erreur mise à jour conseil ${id}: ${(error as Error).message}`,
      );
      throw new OperationFailedException({
        message: 'Erreur lors de la mise à jour',
      });
    }
  }

  /**
   * 📄 Récupérer un conseil par ID
   * GET /api/blog/advice/123
   */
  @Get(':id')
  @UseGuards(OptionalAuthGuard)
  async getAdviceById(@Param('id', ParseIntPipe) id: number) {
    try {
      const article = await this.adviceService.getAdviceById(id);

      if (!article) {
        throw new DomainNotFoundException({
          message: 'Conseil non trouvé',
        });
      }

      // Incrémenter les vues
      await this.adviceService.incrementAdviceViews(id);

      // Articles similaires basés sur les mots-clés
      const similarArticles = await this.getSimilarAdvice(article, 5);

      return {
        success: true,
        data: {
          article,
          similar: similarArticles,
        },
      };
    } catch (error) {
      if (error instanceof DomainNotFoundException) {
        throw error;
      }

      this.logger.error(
        `❌ Erreur récupération conseil ${id}: ${(error as Error).message}`,
      );
      throw new OperationFailedException({
        message: 'Erreur lors de la récupération',
      });
    }
  }

  /**
   * 🚗 Conseils pour un modèle de véhicule
   * GET /api/blog/advice/for-product/12345?limit=10
   */
  @Get('for-product/:productId')
  async getAdviceForProduct(
    @Param('productId', ParseIntPipe) productId: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number = 10,
  ) {
    try {
      const articles = await this.adviceService.getAdviceForProduct(
        productId.toString(),
        limit,
      );

      return {
        success: true,
        data: {
          productId,
          articles,
          total: articles.length,
          limit,
        },
      };
    } catch (error) {
      this.logger.error(
        `❌ Erreur conseils produit ${productId}: ${(error as Error).message}`,
      );
      throw new OperationFailedException({
        message: 'Erreur lors de la récupération',
      });
    }
  }

  /**
   * 📊 Statistiques des conseils
   * GET /api/blog/advice/stats
   */
  @Get('stats/overview')
  async getAdviceStats() {
    try {
      const stats = await this.adviceService.getAdviceStats();

      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      this.logger.error(
        `❌ Erreur stats conseils: ${(error as Error).message}`,
      );
      throw new OperationFailedException({
        message: 'Erreur lors des statistiques',
      });
    }
  }

  /**
   * 🏷️ Mots-clés les plus utilisés
   * GET /api/blog/advice/keywords?limit=50
   */
  @Get('keywords/popular')
  async getPopularKeywords(
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number = 50,
  ) {
    try {
      // Simuler la récupération des mots-clés populaires
      // TODO: Implémenter dans AdviceService
      const keywords = await this.getTopKeywords(limit);

      return {
        success: true,
        data: {
          keywords,
          limit,
          total: keywords.length,
        },
      };
    } catch (error) {
      this.logger.error(
        `❌ Erreur mots-clés populaires: ${(error as Error).message}`,
      );
      throw new OperationFailedException({
        message: 'Erreur lors de la récupération',
      });
    }
  }

  /**
   * 🌟 Conseils les plus populaires
   * GET /api/blog/advice/popular?limit=10&period=month
   */
  @Get('popular/trending')
  async getPopularAdvice(
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number = 10,
    @Query('period') period?: 'week' | 'month' | 'year',
  ) {
    try {
      // Récupérer simplement par vues pour l'instant
      const result = await this.adviceService.getAllAdvice({
        limit,
        // TODO: Ajouter tri par popularité/période
      });

      // Trier par vues décroissantes
      const popularArticles = result.articles
        .sort((a, b) => b.viewsCount - a.viewsCount)
        .slice(0, limit);

      return {
        success: true,
        data: {
          articles: popularArticles,
          period: period || 'all-time',
          limit,
          total: popularArticles.length,
        },
      };
    } catch (error) {
      this.logger.error(
        `❌ Erreur conseils populaires: ${(error as Error).message}`,
      );
      throw new OperationFailedException({
        message: 'Erreur lors de la récupération',
      });
    }
  }

  // MÉTHODES PRIVÉES

  /**
   * Récupérer des conseils similaires basés sur les mots-clés
   */
  private async getSimilarAdvice(
    article: any,
    limit: number = 5,
  ): Promise<any[]> {
    try {
      if (!article.keywords || article.keywords.length === 0) {
        return [];
      }

      // Prendre les 3 premiers mots-clés
      const searchKeywords = article.keywords.slice(0, 3);

      const similarArticles =
        await this.adviceService.getAdviceByKeywords(searchKeywords);

      // Exclure l'article actuel
      return similarArticles
        .filter((a) => a.legacy_id !== article.legacy_id)
        .slice(0, limit);
    } catch (error) {
      this.logger.debug(
        `⚠️ Erreur articles similaires: ${(error as Error).message}`,
      );
      return [];
    }
  }

  /**
   * Récupérer les mots-clés les plus utilisés
   */
  private async getTopKeywords(
    limit: number,
  ): Promise<Array<{ keyword: string; count: number }>> {
    try {
      // Récupérer un échantillon d'articles pour analyser les mots-clés
      const { articles } = await this.adviceService.getAllAdvice({
        limit: 200,
      });

      // Compter les occurrences des mots-clés
      const keywordCount: { [key: string]: number } = {};

      articles.forEach((article) => {
        article.keywords.forEach((keyword) => {
          const normalizedKeyword = keyword.toLowerCase().trim();
          keywordCount[normalizedKeyword] =
            (keywordCount[normalizedKeyword] || 0) + 1;
        });
      });

      // Trier et retourner les plus populaires
      return Object.entries(keywordCount)
        .sort(([, a], [, b]) => b - a)
        .slice(0, limit)
        .map(([keyword, count]) => ({ keyword, count }));
    } catch (error) {
      this.logger.debug(
        `⚠️ Erreur analyse mots-clés: ${(error as Error).message}`,
      );
      return [];
    }
  }
}
