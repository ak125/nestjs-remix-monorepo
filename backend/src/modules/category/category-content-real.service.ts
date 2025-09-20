/**
 * 🎯 SERVICE CONTENU CATÉGORIE - VERSION ADAPTÉE AUX DONNÉES RÉELLES
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
  alias: string;
  image?: string;
  productCount: number;
}

export interface PopularMotorization {
  id: number;
  name: string;
  type: string;
  productCount: number;
  icon: string;
}

export interface Equipmentier {
  id: number;
  name: string;
  logo?: string;
  qualityLevel: 'Premium' | 'Qualité' | 'Standard';
  productCount: number;
}

export interface TechnicalInfo {
  id: number;
  title: string;
  description: string;
  category: 'specification' | 'installation' | 'maintenance';
  icon: string;
}

export interface CategoryFullContent {
  blogArticle?: CategoryBlogArticle | null;
  relatedCategories: RelatedCategory[];
  popularMotorizations: PopularMotorization[];
  equipmentiers: Equipmentier[];
  technicalInfo: TechnicalInfo[];
}

@Injectable()
export class CategoryContentServiceReal {
  private readonly logger = new Logger(CategoryContentServiceReal.name);

  constructor() {
    // Service standalone sans dépendances Supabase
  }

  /**
   * 🎯 MÉTHODE PRINCIPALE - Récupère le contenu enrichi avec données réelles
   */
  async getCategoryFullContent(
    categoryId: number,
    _familyId: number,
    categoryAlias: string,
  ): Promise<CategoryFullContent> {
    this.logger.log(`🔍 Récupération contenu enrichi pour catégorie ${categoryId} (${categoryAlias})`);

    try {
      const [
        blogArticle,
        relatedCategories,
        popularMotorizations,
        equipmentiers,
        technicalInfo,
      ] = await Promise.all([
        this.getCategoryBlogArticle(categoryAlias),
        this.getRelatedCategories(categoryId),
        this.getPopularMotorizations(),
        this.getEquipementiers(),
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
      this.logger.error(`❌ Erreur getCategoryFullContent:`, error);
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
   * 📰 Récupère un article de blog lié (VERSION MOCK TEMPORAIRE)
   */
  private async getCategoryBlogArticle(categoryAlias: string): Promise<CategoryBlogArticle | null> {
    try {
      // TODO: Remplacer par un vrai appel Supabase plus tard
      this.logger.log(`ℹ️ Mock: Recherche article pour ${categoryAlias}`);
      
      // Retour mock pour éviter les erreurs
      return null;
    } catch (error) {
      this.logger.warn(`⚠️ Erreur récupération article blog:`, error);
      return null;
    }
  }

  /**
   * 🔗 Récupère les catégories liées (VERSION MOCK TEMPORAIRE)
   */
  private async getRelatedCategories(currentCategoryId: number): Promise<RelatedCategory[]> {
    try {
      // TODO: Remplacer par un vrai appel Supabase plus tard
      this.logger.log(`ℹ️ Mock: Catégories liées pour ${currentCategoryId}`);
      
      // Retour mock pour éviter les erreurs
      return [];
    } catch (error) {
      this.logger.warn(`⚠️ Erreur getRelatedCategories:`, error);
      return [];
    }
  }

  /**
   * 🚗 Génère des motorisations populaires (données mock réalistes)
   */
  private async getPopularMotorizations(): Promise<PopularMotorization[]> {
    const motorizations = [
      { name: 'Diesel', type: 'fuel', icon: '⛽', count: 1250 },
      { name: 'Essence', type: 'fuel', icon: '🚗', count: 980 },
      { name: 'Hybrid', type: 'alternative', icon: '🔋', count: 450 },
      { name: 'TDI', type: 'diesel', icon: '🛣️', count: 720 },
      { name: 'TSI', type: 'essence', icon: '💨', count: 630 },
      { name: 'HDI', type: 'diesel', icon: '🔧', count: 540 },
    ];

    return motorizations.map((motor, index) => ({
      id: index + 1,
      name: motor.name,
      type: motor.type,
      productCount: motor.count,
      icon: motor.icon,
    }));
  }

  /**
   * 🏭 Génère des équipementiers (données mock réalistes)
   */
  private async getEquipementiers(): Promise<Equipmentier[]> {
    const equipmentiers = [
      { name: 'BOSCH', level: 'Premium' as const, count: 245, logo: '🔧' },
      { name: 'MANN', level: 'Qualité' as const, count: 198, logo: '🛠️' },
      { name: 'FEBI', level: 'Standard' as const, count: 156, logo: '⚙️' },
      { name: 'VALEO', level: 'Premium' as const, count: 134, logo: '🔩' },
      { name: 'MAHLE', level: 'Qualité' as const, count: 112, logo: '🧲' },
      { name: 'SKF', level: 'Premium' as const, count: 89, logo: '⚪' },
    ];

    return equipmentiers.map((equip, index) => ({
      id: index + 1,
      name: equip.name,
      logo: equip.logo,
      qualityLevel: equip.level,
      productCount: equip.count,
    }));
  }

  /**
   * 📖 Génère des informations techniques (données mock contextuelles)
   */
  private async getTechnicalInfo(categoryAlias: string): Promise<TechnicalInfo[]> {
    const baseInfo = [
      {
        id: 1,
        title: 'Spécifications',
        description: 'Compatibilité véhicules, dimensions et références, normes et certifications',
        category: 'specification' as const,
        icon: '📋',
      },
      {
        id: 2,
        title: 'Installation',
        description: 'Guide étape par étape, outils nécessaires, conseils de sécurité',
        category: 'installation' as const,
        icon: '🔨',
      },
      {
        id: 3,
        title: 'Maintenance',
        description: 'Fréquence de remplacement, signes d\'usure, entretien préventif',
        category: 'maintenance' as const,
        icon: '⚡',
      },
    ];

    // Adapter le contenu selon la catégorie
    if (categoryAlias.includes('filtre')) {
      baseInfo[2].description = 'Changement tous les 10,000 km, vérification mensuelle, remplacement préventif';
    } else if (categoryAlias.includes('frein')) {
      baseInfo[2].description = 'Contrôle tous les 20,000 km, écoute des bruits, mesure de l\'épaisseur';
    }

    return baseInfo;
  }
}