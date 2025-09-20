/**
 * 🎯 SERVICE CONTENU CATÉGORIE - VERSION SIMPLE SANS DÉPENDANCES
 */

import { Injectable, Logger } from '@nestjs/common';

// ========================================
// 📋 INTERFACES SIMPLIFIÉES
// ========================================

export interface CategoryBlogArticle {
  id: number;
  title: string;
  content: string;
  url: string;
  publishedAt: string;
}

export interface RelatedCategory {
  id: number;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  productCount: number;
}

export interface PopularMotorization {
  id: number;
  name: string;
  type: string;
  description: string;
  productCount: number;
  icon: string;
}

export interface Equipmentier {
  id: number;
  name: string;
  logo?: string;
  category: string;
  productCount: number;
  description: string;
}

export interface TechnicalInfo {
  id: number;
  title: string;
  description: string;
  category: string;
  icon: string;
}

export interface CategoryFullContentReal {
  blogArticle: CategoryBlogArticle | null;
  relatedCategories: RelatedCategory[];
  popularMotorizations: PopularMotorization[];
  equipmentiers: Equipmentier[];
  technicalInfo: TechnicalInfo[];
}

// ========================================
// 🚀 SERVICE SIMPLIFIÉ
// ========================================

@Injectable()
export class CategoryContentServiceSimple {
  private readonly logger = new Logger(CategoryContentServiceSimple.name);

  /**
   * 🎯 Récupère tout le contenu enrichi pour une catégorie
   */
  async getCategoryFullContent(
    categoryId: number,
    familyId: number,
    categoryAlias: string,
  ): Promise<CategoryFullContentReal> {
    this.logger.log(
      `🔍 Récupération contenu enrichi pour catégorie ${categoryId} (${categoryAlias})`,
    );

    try {
      // Utiliser des données mock réalistes pour éviter les erreurs DB
      const [
        blogArticle,
        relatedCategories,
        popularMotorizations,
        equipmentiers,
        technicalInfo,
      ] = await Promise.all([
        this.getCategoryBlogArticle(categoryAlias),
        this.getRelatedCategories(categoryId),
        this.getPopularMotorizations(categoryAlias),
        this.getEquipementiers(categoryAlias),
        this.getTechnicalInfo(categoryAlias),
      ]);

      return {
        blogArticle,
        relatedCategories,
        popularMotorizations,
        equipmentiers,
        technicalInfo,
      };
    } catch (error) {
      this.logger.error(
        `❌ Erreur récupération contenu enrichi pour ${categoryAlias}:`,
        error,
      );
      
      // Retourner des données vides en cas d'erreur
      return {
        blogArticle: null,
        relatedCategories: [],
        popularMotorizations: [],
        equipmentiers: [],
        technicalInfo: [],
      };
    }
  }

  /**
   * 📄 Récupérer l'article de blog associé (mock)
   */
  private async getCategoryBlogArticle(
    categoryAlias: string,
  ): Promise<CategoryBlogArticle | null> {
    // Simulation d'articles de blog selon la catégorie
    const blogData: Record<string, CategoryBlogArticle> = {
      'filtre-a-huile': {
        id: 1,
        title: 'Guide complet du filtre à huile',
        content: 'Tout savoir sur le changement et l\'entretien de votre filtre à huile...',
        url: '/blog/guide-filtre-huile',
        publishedAt: '2024-09-15',
      },
      'plaquettes-de-frein': {
        id: 2,
        title: 'Comment changer ses plaquettes de frein',
        content: 'Étapes détaillées pour remplacer vos plaquettes en toute sécurité...',
        url: '/blog/changer-plaquettes-frein',
        publishedAt: '2024-09-10',
      },
    };

    return blogData[categoryAlias] || null;
  }

  /**
   * 🔗 Récupérer les catégories liées (mock)
   */
  private async getRelatedCategories(
    currentCategoryId: number,
  ): Promise<RelatedCategory[]> {
    const mockCategories: RelatedCategory[] = [
      {
        id: 1,
        name: 'Plaquettes de frein',
        slug: 'plaquettes-de-frein',
        description: 'Plaquettes de frein haute performance',
        image: 'plaquettes-frein.webp',
        productCount: 245,
      },
      {
        id: 2,
        name: 'Amortisseurs',
        slug: 'amortisseurs',
        description: 'Amortisseurs pour tous véhicules',
        image: 'amortisseurs.webp',
        productCount: 189,
      },
      {
        id: 3,
        name: 'Huile moteur',
        slug: 'huile-moteur',
        description: 'Huiles moteur de qualité',
        image: 'huile-moteur.webp',
        productCount: 156,
      },
    ];

    // Filtrer la catégorie actuelle
    return mockCategories.filter(cat => cat.id !== currentCategoryId);
  }

  /**
   * 🏎️ Récupérer les motorisations populaires (mock)
   */
  private async getPopularMotorizations(
    categoryAlias: string,
  ): Promise<PopularMotorization[]> {
    return [
      {
        id: 1,
        name: 'Diesel',
        type: 'diesel',
        description: 'Motorisations diesel tous véhicules',
        productCount: 1250,
        icon: '⛽',
      },
      {
        id: 2,
        name: 'Essence',
        type: 'essence',
        description: 'Motorisations essence tous véhicules',
        productCount: 980,
        icon: '🚗',
      },
      {
        id: 3,
        name: 'Hybrid',
        type: 'hybrid',
        description: 'Véhicules hybrides électrique-essence',
        productCount: 450,
        icon: '🔋',
      },
      {
        id: 4,
        name: 'TDI',
        type: 'tdi',
        description: 'Moteurs TDI Volkswagen Group',
        productCount: 720,
        icon: '🛣️',
      },
      {
        id: 5,
        name: 'TSI',
        type: 'tsi',
        description: 'Moteurs TSI Volkswagen Group',
        productCount: 630,
        icon: '💨',
      },
      {
        id: 6,
        name: 'HDI',
        type: 'hdi',
        description: 'Moteurs HDI Peugeot Citroën',
        productCount: 540,
        icon: '🔧',
      },
    ];
  }

  /**
   * 🏭 Récupérer les équipementiers (mock)
   */
  private async getEquipementiers(categoryAlias: string): Promise<Equipmentier[]> {
    return [
      {
        id: 1,
        name: 'BOSCH',
        logo: 'bosch-logo.webp',
        category: 'Premium',
        productCount: 245,
        description: 'Leader mondial des pièces automobiles',
      },
      {
        id: 2,
        name: 'MANN',
        logo: 'mann-logo.webp',
        category: 'Qualité',
        productCount: 198,
        description: 'Spécialiste de la filtration automobile',
      },
      {
        id: 3,
        name: 'FEBI',
        logo: 'febi-logo.webp',
        category: 'Standard',
        productCount: 156,
        description: 'Pièces de rechange de qualité',
      },
      {
        id: 4,
        name: 'VALEO',
        logo: 'valeo-logo.webp',
        category: 'Premium',
        productCount: 134,
        description: 'Innovation automobile française',
      },
      {
        id: 5,
        name: 'MAHLE',
        logo: 'mahle-logo.webp',
        category: 'Qualité',
        productCount: 112,
        description: 'Technologie moteur allemande',
      },
      {
        id: 6,
        name: 'SKF',
        logo: 'skf-logo.webp',
        category: 'Premium',
        productCount: 89,
        description: 'Spécialiste roulements et transmission',
      },
    ];
  }

  /**
   * ⚙️ Récupérer les informations techniques (mock)
   */
  private async getTechnicalInfo(categoryAlias: string): Promise<TechnicalInfo[]> {
    const baseInfo: TechnicalInfo[] = [
      {
        id: 1,
        title: 'Spécifications',
        description: 'Compatibilité véhicules, dimensions et références, normes et certifications',
        category: 'technique',
        icon: '📋',
      },
      {
        id: 2,
        title: 'Installation',
        description: 'Guide étape par étape, outils nécessaires, conseils de sécurité',
        category: 'montage',
        icon: '🔨',
      },
      {
        id: 3,
        title: 'Maintenance',
        description: 'Fréquence de remplacement, signes d\'usure, entretien préventif',
        category: 'entretien',
        icon: '⚡',
      },
    ];

    // Adapter selon la catégorie
    if (categoryAlias === 'filtre-a-huile') {
      baseInfo[2].description = 'Changement tous les 10,000 km, vérification mensuelle, remplacement préventif';
    } else if (categoryAlias === 'plaquettes-de-frein') {
      baseInfo[2].description = 'Contrôle tous les 20,000 km, écoute des bruits, mesure de l\'épaisseur';
    }

    return baseInfo;
  }
}