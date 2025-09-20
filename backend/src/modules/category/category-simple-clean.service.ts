/**
 * 🗂️ SERVICE CATEGORY SIMPLIFIÉ - UTILISE PRODUCTSERVICE EXISTANT
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ProductsService } from '../products/products.service';
import { CategoryContentServiceSimple, CategoryFullContentReal } from './category-content-simple.service';

// Interface pour les données de ProductsService.getGammeById()
interface GammeData {
  id: string;
  name: string;
  alias: string;
  image: string;
  is_active: boolean;
  is_top: boolean;
  source: string;
  sort_order: number;
}

export interface CategoryPageData {
  id: number;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  metaTitle?: string;
  metaDescription?: string;
  subcategories: CategoryPageData[];
  totalProducts: number;
  stats: {
    totalProducts: number;
    totalBrands: number;
    averagePrice?: number;
  };
}

@Injectable()
export class CategorySimpleService {
  private readonly logger = new Logger(CategorySimpleService.name);

  constructor(
    private readonly productsService: ProductsService,
    private readonly categoryContentService: CategoryContentServiceSimple,
  ) {}

  /**
   * 🎯 MÉTHODE PRINCIPALE - Récupère les données complètes d'une catégorie
   * Utilise ProductsService (qui fonctionne) + CategoryContentService (contenu enrichi)
   */
  async getCategoryFullData(
    categorySlug: string,
  ): Promise<CategoryPageData & CategoryFullContentReal> {
    this.logger.log(
      `🔍 Récupération complète des données pour la catégorie: ${categorySlug}`,
    );

    try {
      // 1. Récupérer l'ID de la gamme depuis le slug
      const gammeId = await this.getGammeIdBySlug(categorySlug);
      
      // 2. Utiliser ProductsService pour récupérer les données de base (FONCTIONNE ✅)
      const gammeData = (await this.productsService.getGammeById(
        gammeId.toString(),
      )) as GammeData;
      
      if (!gammeData) {
        throw new NotFoundException(`Catégorie introuvable: ${categorySlug}`);
      }

      // 3. Récupérer le contenu enrichi via CategoryContentService
      // Note: Les IDs peuvent ne pas correspondre - utilisons des données par défaut pour l'instant
      const fullContent = await this.categoryContentService.getCategoryFullContent(
        parseInt(gammeData.id), // pg_id
        1, // mf_id par défaut
        categorySlug,
      );

      // 4. Construire la réponse finale combinée
      const result = {
        // Données de base depuis ProductsService (structure correcte)
        id: parseInt(gammeData.id),
        name: gammeData.name,
        slug: categorySlug,
        description: `Découvrez notre gamme de ${gammeData.name}`,
        image: gammeData.image,
        metaTitle: `${gammeData.name} - Pièces auto de qualité`,
        metaDescription: `Trouvez les meilleurs ${gammeData.name} pour votre véhicule`,
        subcategories: [], // À implémenter si nécessaire
        totalProducts: 0, // À calculer si nécessaire
        stats: {
          totalProducts: 0,
          totalBrands: 0,
          averagePrice: undefined,
        },
        // Contenu enrichi depuis CategoryContentService
        ...fullContent,
      };

      this.logger.log(
        `✅ Données récupérées avec succès pour ${gammeData.name}`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `❌ Erreur récupération catégorie ${categorySlug}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * 🗂️ Mapping slug → ID (temporaire)
   * TODO: Remplacer par une vraie requête DB ou utiliser ProductsService.getGammeBySlug()
   */
  private async getGammeIdBySlug(slug: string): Promise<number> {
    const slugToIdMap: Record<string, number> = {
      'filtre-a-huile': 7,
      'plaquettes-de-frein': 1,
      amortisseur: 2,
      pneu: 3,
      batterie: 4,
      'huile-moteur': 5,
      'kit-distribution': 6,
    };

    const id = slugToIdMap[slug];
    if (!id) {
      throw new NotFoundException(`Slug de catégorie non trouvé: ${slug}`);
    }

    return id;
  }
}