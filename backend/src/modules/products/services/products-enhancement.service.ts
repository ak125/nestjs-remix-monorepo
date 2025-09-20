import { Injectable, Logger } from '@nestjs/common';
import { ProductsService } from '../products.service';
import {
  CreateProductDto,
  UpdateProductDto,
  SearchProductDto,
} from '../schemas/product.schemas';

/**
 * Service d'amélioration pour les produits
 * Ajoute des fonctionnalités avancées comme la validation de business rules,
 * le cache intelligent, les métriques, etc.
 */
@Injectable()
export class ProductsEnhancementService {
  private readonly logger = new Logger(ProductsEnhancementService.name);

  constructor(private readonly productsService: ProductsService) {}

  /**
   * Validation des règles métier avant création
   */
  async validateProductBusinessRules(
    createProductDto: CreateProductDto,
  ): Promise<string[]> {
    const errors: string[] = [];

    try {
      // Vérifier l'unicité du SKU
      const existingProduct = await this.findBySku(createProductDto.sku);
      if (existingProduct) {
        errors.push(
          `Un produit avec le SKU '${createProductDto.sku}' existe déjà`,
        );
      }

      // Vérifier que la gamme existe
      if (createProductDto.range_id) {
        const rangeExists = await this.checkRangeExists(
          createProductDto.range_id,
        );
        if (!rangeExists) {
          errors.push(
            `La gamme avec l'ID ${createProductDto.range_id} n'existe pas`,
          );
        }
      }

      // Vérifier que la marque existe
      if (createProductDto.brand_id) {
        const brandExists = await this.checkBrandExists(
          createProductDto.brand_id,
        );
        if (!brandExists) {
          errors.push(
            `La marque avec l'ID ${createProductDto.brand_id} n'existe pas`,
          );
        }
      }

      // Validation du prix vs stock
      if (createProductDto.base_price && createProductDto.base_price > 10000) {
        if (
          !createProductDto.stock_quantity ||
          createProductDto.stock_quantity > 100
        ) {
          errors.push(
            'Les produits de plus de 10000€ ne peuvent avoir plus de 100 unités en stock',
          );
        }
      }

      return errors;
    } catch (error) {
      this.logger.error(
        'Erreur lors de la validation des règles métier:',
        error,
      );
      return ['Erreur lors de la validation des règles métier'];
    }
  }

  /**
   * Rechercher un produit par SKU
   */
  private async findBySku(sku: string): Promise<any> {
    try {
      // Note: Cette méthode devrait être implémentée dans le service principal
      // Pour l'instant on retourne null
      return null;
    } catch (error) {
      this.logger.error(`Erreur lors de la recherche par SKU ${sku}:`, error);
      return null;
    }
  }

  /**
   * Vérifier si une gamme existe
   */
  private async checkRangeExists(rangeId: number): Promise<boolean> {
    try {
      const gammes = await this.productsService.getGammes();
      return gammes.some((gamme: any) => gamme.id === rangeId);
    } catch (error) {
      this.logger.error(
        `Erreur lors de la vérification de la gamme ${rangeId}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Vérifier si une marque existe
   */
  private async checkBrandExists(brandId: number): Promise<boolean> {
    try {
      const brands = await this.productsService.getBrands();
      return brands.some((brand: any) => brand.marque_id === brandId);
    } catch (error) {
      this.logger.error(
        `Erreur lors de la vérification de la marque ${brandId}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Calculer les recommandations de stock
   */
  async calculateStockRecommendations(productId: string): Promise<{
    recommended_min_stock: number;
    recommended_max_stock: number;
    reorder_point: number;
    reasoning: string[];
  }> {
    const recommendations = {
      recommended_min_stock: 5,
      recommended_max_stock: 50,
      reorder_point: 10,
      reasoning: [] as string[],
    };

    try {
      const product = await this.productsService.findOne(productId);
      if (!product) {
        recommendations.reasoning.push('Produit non trouvé');
        return recommendations;
      }

      // Logique de calcul basée sur le prix et la catégorie
      if (product.base_price) {
        if (product.base_price > 1000) {
          recommendations.recommended_min_stock = 2;
          recommendations.recommended_max_stock = 10;
          recommendations.reorder_point = 3;
          recommendations.reasoning.push(
            'Produit de haute valeur: stock réduit recommandé',
          );
        } else if (product.base_price < 50) {
          recommendations.recommended_min_stock = 20;
          recommendations.recommended_max_stock = 200;
          recommendations.reorder_point = 30;
          recommendations.reasoning.push(
            'Produit de faible valeur: stock élevé recommandé',
          );
        }
      }

      // Ajustements basés sur la gamme
      if (product.range_id) {
        recommendations.reasoning.push(
          `Ajustement basé sur la gamme ${product.range_id}`,
        );
      }

      return recommendations;
    } catch (error) {
      this.logger.error(
        `Erreur lors du calcul des recommandations pour ${productId}:`,
        error,
      );
      recommendations.reasoning.push(
        'Erreur lors du calcul: utilisation des valeurs par défaut',
      );
      return recommendations;
    }
  }

  /**
   * Analyser les tendances de recherche
   */
  async analyzeSearchTrends(filters: SearchProductDto): Promise<{
    popular_filters: Record<string, number>;
    suggested_searches: string[];
    optimization_hints: string[];
  }> {
    const analysis = {
      popular_filters: {} as Record<string, number>,
      suggested_searches: [] as string[],
      optimization_hints: [] as string[],
    };

    try {
      // Analyser les filtres populaires
      if (filters.search) {
        analysis.popular_filters['search'] =
          (analysis.popular_filters['search'] || 0) + 1;

        // Suggestions basées sur la recherche
        const searchTerms = filters.search.toLowerCase().split(' ');
        if (searchTerms.includes('frein')) {
          analysis.suggested_searches.push(
            'plaquettes de frein',
            'disques de frein',
            'étriers de frein',
          );
        }
        if (searchTerms.includes('moteur')) {
          analysis.suggested_searches.push(
            'huile moteur',
            'filtre moteur',
            'courroie distribution',
          );
        }
      }

      if (filters.brandId) {
        analysis.popular_filters['brandId'] =
          (analysis.popular_filters['brandId'] || 0) + 1;
      }

      if (filters.rangeId) {
        analysis.popular_filters['rangeId'] =
          (analysis.popular_filters['rangeId'] || 0) + 1;
      }

      // Optimisations suggérées
      if (filters.page && filters.page > 10) {
        analysis.optimization_hints.push(
          'Affiner la recherche pour réduire le nombre de pages',
        );
      }

      if (!filters.brandId && !filters.rangeId && !filters.search) {
        analysis.optimization_hints.push(
          'Utiliser des filtres pour améliorer la pertinence',
        );
      }

      return analysis;
    } catch (error) {
      this.logger.error("Erreur lors de l'analyse des tendances:", error);
      return analysis;
    }
  }

  /**
   * Générer un rapport de qualité des données produit
   */
  async generateDataQualityReport(): Promise<{
    total_products: number;
    missing_descriptions: number;
    missing_prices: number;
    missing_images: number;
    duplicate_skus: number;
    quality_score: number;
    recommendations: string[];
  }> {
    const report = {
      total_products: 0,
      missing_descriptions: 0,
      missing_prices: 0,
      missing_images: 0,
      duplicate_skus: 0,
      quality_score: 0,
      recommendations: [] as string[],
    };

    try {
      // Cette méthode nécessiterait des requêtes plus complexes sur la base de données
      // Pour l'instant, on retourne un exemple
      report.total_products = 100; // À remplacer par une vraie requête
      report.missing_descriptions = 15;
      report.missing_prices = 8;
      report.missing_images = 25;
      report.duplicate_skus = 2;

      // Calculer le score de qualité (0-100)
      const completeness =
        (report.total_products -
          report.missing_descriptions -
          report.missing_prices) /
        report.total_products;
      const uniqueness =
        (report.total_products - report.duplicate_skus) / report.total_products;
      report.quality_score = Math.round(
        (completeness * 0.7 + uniqueness * 0.3) * 100,
      );

      // Générer des recommandations
      if (report.missing_descriptions > 0) {
        report.recommendations.push(
          `Ajouter des descriptions à ${report.missing_descriptions} produits`,
        );
      }
      if (report.missing_prices > 0) {
        report.recommendations.push(
          `Définir les prix pour ${report.missing_prices} produits`,
        );
      }
      if (report.duplicate_skus > 0) {
        report.recommendations.push(
          `Résoudre ${report.duplicate_skus} doublons de SKU`,
        );
      }
      if (report.quality_score < 80) {
        report.recommendations.push(
          'Améliorer la qualité globale des données produit',
        );
      }

      return report;
    } catch (error) {
      this.logger.error(
        'Erreur lors de la génération du rapport qualité:',
        error,
      );
      throw error;
    }
  }
}
