/**
 * 🎯 CONTRÔLEUR API POUR LES PAGES CATÉGORIES
 *
 * Expose les endpoints REST pour récupérer les données des pages catégories
 */

import {
  Controller,
  Get,
  Param,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { CategorySimpleService } from './category-simple.service';

@ApiTags('Categories - Pages catégories dynamiques')
@Controller('api/categories')
export class CategoryController {
  private readonly logger = new Logger(CategoryController.name);

  constructor(private readonly categoryService: CategorySimpleService) {}

  /**
   * 🔍 GET /api/categories/:slug - Récupère toutes les données d'une page catégorie
   */
  @Get(':slug')
  @ApiOperation({
    summary: "Récupérer les données complètes d'une page catégorie",
    description:
      'Retourne toutes les informations nécessaires pour afficher une page catégorie : infos de base, breadcrumbs, sélecteur véhicule, échantillon produits, catégories liées, informations techniques et statistiques.',
  })
  @ApiParam({
    name: 'slug',
    description:
      'Slug de la catégorie (ex: filtre-a-huile-7, plaquette-frein-12)',
    example: 'filtre-a-huile-7',
  })
  @ApiResponse({
    status: 200,
    description: 'Données de la page catégorie récupérées avec succès',
  })
  @ApiResponse({
    status: 404,
    description: 'Catégorie non trouvée',
  })
  @ApiResponse({
    status: 500,
    description: 'Erreur serveur lors de la récupération des données',
  })
  async getCategoryPageData(@Param('slug') slug: string) {
    this.logger.log(`🔍 [GET] /api/categories/${slug}`);

    try {
      // Validation basique du slug
      if (!slug || slug.length < 2) {
        throw new HttpException(
          'Slug de catégorie invalide',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Récupérer les données complètes de la catégorie
      const categoryData = await this.categoryService.getCategoryFullData(slug);

      this.logger.log(
        `✅ Données catégorie "${categoryData.name}" récupérées avec succès`,
      );

      return {
        success: true,
        data: categoryData,
        message: `Données catégorie "${categoryData.name}" récupérées avec succès`,
        meta: {
          timestamp: new Date().toISOString(),
          slug: slug,
          categoryId: categoryData.id,
          productsCount: categoryData.stats.totalProducts,
        },
      };
    } catch (error: any) {
      this.logger.error(`❌ Erreur récupération catégorie ${slug}:`, error);

      // Gestion spécifique des erreurs 404
      if (error.status === 404 || error.message?.includes('non trouvée')) {
        throw new HttpException(
          `Catégorie '${slug}' non trouvée`,
          HttpStatus.NOT_FOUND,
        );
      }

      // Gestion des autres erreurs
      throw new HttpException(
        `Erreur lors de la récupération de la catégorie "${slug}"`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 🔍 GET /api/categories/:slug/full - Récupère TOUTES les données d'une page catégorie avec contenu étendu
   */
  @Get(':slug/full')
  @ApiOperation({
    summary: "Récupérer les données complètes d'une page catégorie avec contenu étendu",
    description: 'Inclut les données de base plus articles blog, motorisations populaires, équipementiers, etc.',
  })
  @ApiParam({
    name: 'slug',
    description: 'Slug unique de la catégorie',
    example: 'filtre-a-huile',
  })
  @ApiResponse({
    status: 200,
    description: 'Données complètes de la catégorie récupérées avec succès',
  })
  @ApiResponse({
    status: 404,
    description: 'Catégorie non trouvée',
  })
  @ApiResponse({
    status: 500,
    description: 'Erreur serveur lors de la récupération des données',
  })
  async getCategoryFullData(@Param('slug') slug: string) {
    this.logger.log(`🔍 [GET] /api/categories/${slug}/full`);

    try {
      // Validation basique du slug
      if (!slug || slug.length < 2) {
        throw new HttpException(
          'Slug de catégorie invalide',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Récupérer les données complètes de la catégorie avec contenu étendu
      const categoryData = await this.categoryService.getCategoryFullData(slug);

      this.logger.log(
        `✅ Données complètes catégorie "${categoryData.name}" récupérées avec succès`,
      );

      return {
        success: true,
        data: categoryData,
        message: `Données complètes catégorie "${categoryData.name}" récupérées avec succès`,
        meta: {
          timestamp: new Date().toISOString(),
          slug: slug,
          categoryId: categoryData.id,
          productsCount: categoryData.stats.totalProducts,
          hasExtendedContent: {
            blogArticle: !!categoryData.blogArticle,
            relatedCategories: categoryData.relatedCategories.length,
            popularMotorizations: categoryData.popularMotorizations.length,
            equipmentiers: categoryData.equipmentiers.length,
            technicalInfo: categoryData.technicalInfo.length,
          },
        },
      };
    } catch (error: any) {
      this.logger.error(`❌ Erreur récupération complète catégorie ${slug}:`, error);

      // Gestion spécifique des erreurs 404
      if (error.status === 404 || error.message?.includes('non trouvée')) {
        throw new HttpException(
          `Catégorie '${slug}' non trouvée`,
          HttpStatus.NOT_FOUND,
        );
      }

      // Autres erreurs serveur
      throw new HttpException(
        `Erreur lors de la récupération de la catégorie: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 🔍 GET /api/categories/:slug/info - Récupère uniquement les infos de base d'une catégorie
   */
  @Get(':slug/info')
  @ApiOperation({
    summary: "Récupérer les informations de base d'une catégorie",
    description:
      "Endpoint léger pour récupérer uniquement les informations essentielles d'une catégorie (nom, description, image, etc.)",
  })
  @ApiParam({
    name: 'slug',
    description: 'Slug de la catégorie',
    example: 'filtre-a-huile-7',
  })
  async getCategoryInfo(@Param('slug') slug: string) {
    this.logger.log(`🔍 [GET] /api/categories/${slug}/info`);

    try {
      // Récupérer les données complètes mais ne retourner que les infos de base
      const categoryData = await this.categoryService.getCategoryPageData(slug);

      return {
        success: true,
        data: {
          category: categoryData.category,
          stats: categoryData.stats,
        },
        message: `Informations de base pour "${categoryData.category.name}" récupérées`,
      };
    } catch (error: any) {
      this.logger.error(
        `❌ Erreur récupération infos catégorie ${slug}:`,
        error,
      );

      if (error.status === 404 || error.message?.includes('non trouvée')) {
        throw new HttpException(
          `Catégorie '${slug}' non trouvée`,
          HttpStatus.NOT_FOUND,
        );
      }

      throw new HttpException(
        `Erreur lors de la récupération des infos: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 🛍️ GET /api/categories/:slug/products - Récupère les produits d'une catégorie avec pagination
   */
  @Get(':slug/products')
  @ApiOperation({
    summary: "Récupérer les produits d'une catégorie avec pagination",
    description:
      "Endpoint pour la liste paginée des produits d'une catégorie spécifique",
  })
  @ApiParam({
    name: 'slug',
    description: 'Slug de la catégorie',
    example: 'filtre-a-huile-7',
  })
  async getCategoryProducts(@Param('slug') slug: string) {
    this.logger.log(`🔍 [GET] /api/categories/${slug}/products`);

    try {
      // Pour l'instant, utiliser l'échantillon de produits
      // TODO: Implémenter la pagination complète dans le service
      const categoryData = await this.categoryService.getCategoryPageData(slug);

      return {
        success: true,
        data: {
          products: categoryData.productsSample,
          category: {
            id: categoryData.category.id,
            name: categoryData.category.name,
            slug: categoryData.category.slug,
          },
          pagination: {
            total: categoryData.stats.totalProducts,
            page: 1,
            limit: categoryData.productsSample.length,
            hasMore:
              categoryData.stats.totalProducts >
              categoryData.productsSample.length,
          },
        },
        message: `Produits de la catégorie "${categoryData.category.name}" récupérés`,
      };
    } catch (error: any) {
      this.logger.error(
        `❌ Erreur récupération produits catégorie ${slug}:`,
        error,
      );

      if (error.status === 404 || error.message?.includes('non trouvée')) {
        throw new HttpException(
          `Catégorie '${slug}' non trouvée`,
          HttpStatus.NOT_FOUND,
        );
      }

      throw new HttpException(
        `Erreur lors de la récupération des produits: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 🏥 GET /api/categories/health - Endpoint de santé pour vérifier l'API
   */
  @Get('health')
  @ApiOperation({
    summary: "Vérification de santé de l'API catégories",
    description:
      "Endpoint simple pour vérifier que l'API catégories fonctionne correctement",
  })
  async healthCheck() {
    this.logger.log('🏥 [GET] /api/categories/health');

    return {
      success: true,
      message: 'API Categories est opérationnelle',
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        endpoints: [
          'GET /api/categories/:slug - Page catégorie complète',
          'GET /api/categories/:slug/info - Infos de base',
          'GET /api/categories/:slug/products - Produits avec pagination',
          "GET /api/categories/health - Santé de l'API",
        ],
      },
    };
  }
}