/**
 * 🗂️ SERVICE BACKEND POUR LES PAGES CATÉGORIES
 * 
 * Service principal pour récupérer toutes les données d'une page de catégorie depuis la base de données
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseBaseService } from '../../database/services/supabase-base.service';
import { CategoryContentService, CategoryFullContent } from './category-content.service';
import { ProductsService } from '../products/products.service';

// ========================================
// 📋 INTERFACES TYPESCRIPT
// ========================================

export interface CategoryInfo {
  id: string;
  name: string;
  slug: string;
  description?: string;
  shortDescription?: string;
  image?: string;
  seoTitle?: string;
  seoDescription?: string;
  productsCount?: number;
}

export interface CategoryBreadcrumb {
  name: string;
  url: string;
}

export interface CategoryVehicleSelector {
  brands: {
    id: string;
    name: string;
    logo?: string;
  }[];
  searchByTypemine: boolean;
}

export interface CategoryProductSample {
  id: string;
  reference: string;
  name: string;
  brand?: string;
  price?: number;
  image?: string;
  hasImage: boolean;
}

export interface CategoryRelated {
  id: string;
  name: string;
  slug: string;
  description?: string;
  productsCount?: number;
  image?: string;
}

export interface CategoryTechnicalInfo {
  id: string;
  title: string;
  content: string;
  order: number;
  isMainInfo: boolean;
}

export interface CategoryPageData {
  category: CategoryInfo;
  breadcrumbs: CategoryBreadcrumb[];
  vehicleSelector: CategoryVehicleSelector;
  productsSample: CategoryProductSample[];
  relatedCategories: CategoryRelated[];
  technicalInfo: CategoryTechnicalInfo[];
  stats: {
    totalProducts: number;
    totalBrands: number;
    averagePrice?: number;
  };
}

@Injectable()
export class CategoryService extends SupabaseBaseService {
  protected readonly logger = new Logger(CategoryService.name);

  constructor(private readonly categoryContentService: CategoryContentService) {
    super();
  }

  /**
   * 🎯 MÉTHODE PRINCIPALE - Récupère toutes les données pour une page de catégorie
   */
  async getCategoryPageData(categorySlug: string): Promise<CategoryPageData> {
    this.logger.log(`🔍 Récupération des données pour la catégorie: ${categorySlug}`);

    try {
      // 1. 🔍 Récupérer les informations de base de la catégorie
      const category = await this.getCategoryInfo(categorySlug);
      if (!category) {
        throw new NotFoundException(`Catégorie '${categorySlug}' non trouvée`);
      }

      // 2. 🚀 Récupérer toutes les données en parallèle
      const [
        breadcrumbs,
        vehicleSelector,
        productsSample,
        relatedCategories,
        technicalInfo,
        stats
      ] = await Promise.all([
        this.getBreadcrumbs(category),
        this.getVehicleSelector(category),
        this.getProductsSample(category),
        this.getRelatedCategories(category),
        this.getTechnicalInfo(category),
        this.getCategoryStats(category)
      ]);

      const result: CategoryPageData = {
        category,
        breadcrumbs,
        vehicleSelector,
        productsSample,
        relatedCategories,
        technicalInfo,
        stats
      };

      this.logger.log(`✅ Données récupérées avec succès pour ${category.name}`);
      return result;

    } catch (error) {
      this.logger.error(`❌ Erreur récupération catégorie ${categorySlug}:`, error);
      throw error;
    }
  }

  /**
   * 🎯 MÉTHODE ÉTENDUE - Récupère toutes les données de page incluant le contenu dynamique
   */
  async getCategoryFullData(categorySlug: string): Promise<CategoryPageData & CategoryFullContent> {
    this.logger.log(`🔍 Récupération complète des données pour la catégorie: ${categorySlug}`);

    try {
      // 1. Récupérer les données de base
      const baseData = await this.getCategoryPageData(categorySlug);
      
      // 2. Récupérer les informations pour le contenu étendu
      const gammeData = await this.getGammeData(categorySlug);
      if (!gammeData) {
        return baseData;
      }

      // 3. Récupérer le contenu étendu
      const fullContent = await this.categoryContentService.getCategoryFullContent(
        gammeData.pg_id,
        gammeData.mf_id,
        categorySlug
      );

      return {
        ...baseData,
        ...fullContent
      };

    } catch (error) {
      this.logger.error(`❌ Erreur récupération complète catégorie ${categorySlug}:`, error);
      throw error;
    }
  }

  /**
   * 🔍 Récupère les données de gamme pour une catégorie
   */
  private async getGammeData(categorySlug: string) {
    const { data, error } = await this.supabase
      .from('pieces_gamme')
      .select('pg_id, mf_id, pg_alias')
      .eq('pg_alias', categorySlug)
      .single();

    if (error || !data) {
      this.logger.warn(`Données gamme non trouvées pour ${categorySlug}`);
      return null;
    }

    return data;
  }

  /**
   * 🔍 Récupère les informations de base de la catégorie depuis pieces_gamme
   */
  private async getCategoryInfo(slug: string): Promise<CategoryInfo | null> {
    try {
      // Essayer d'abord de chercher par pg_alias (slug)
      let { data: gamme, error } = await this.supabase
        .from('pieces_gamme')
        .select(`
          pg_id,
          pg_name,
          pg_alias,
          pg_lib_fr,
          pg_img,
          pg_pic,
          pg_description,
          pg_display
        `)
        .eq('pg_alias', slug)
        .eq('pg_display', '1')
        .single();

      // Si pas trouvé par alias, essayer par ID numérique extrait du slug
      if (error && slug.includes('-')) {
        const numericId = slug.split('-').pop();
        if (numericId && /^\d+$/.test(numericId)) {
          const { data: gammeById, error: errorById } = await this.supabase
            .from('pieces_gamme')
            .select(`
              pg_id,
              pg_name,
              pg_alias,
              pg_lib_fr,
              pg_img,
              pg_pic,
              pg_description,
              pg_display
            `)
            .eq('pg_id', numericId)
            .eq('pg_display', '1')
            .single();

          if (!errorById) {
            gamme = gammeById;
            error = null;
          }
        }
      }

      if (error || !gamme) {
        this.logger.warn(`Catégorie ${slug} non trouvée dans pieces_gamme`);
        return null;
      }

      // Compter les produits de cette gamme
      const { count: productsCount } = await this.supabase
        .from('pieces')
        .select('piece_id', { count: 'exact' })
        .eq('piece_fil_id', gamme.pg_id)
        .eq('piece_display', true);

      const categoryInfo: CategoryInfo = {
        id: gamme.pg_id,
        name: this.generateCategoryTitle(gamme.pg_name, slug),
        slug: gamme.pg_alias || slug,
        description: this.generateCategoryDescription(gamme.pg_name),
        shortDescription: `${gamme.pg_name} pour tous véhicules - Prix bas garantis`,
        image: gamme.pg_img || gamme.pg_pic || '/images/categories/default.webp',
        seoTitle: `${gamme.pg_name} pas cher | FAFA AUTO`,
        seoDescription: `Trouvez votre ${gamme.pg_name?.toLowerCase()} au meilleur prix chez FAFA AUTO. Large choix de marques premium. Livraison rapide.`,
        productsCount: productsCount || 0
      };

      return categoryInfo;

    } catch (error) {
      this.logger.error('Erreur récupération info catégorie:', error);
      throw error;
    }
  }

  /**
   * 🍞 Génère les breadcrumbs pour la navigation
   */
  private async getBreadcrumbs(category: CategoryInfo): Promise<CategoryBreadcrumb[]> {
    return [
      { name: 'Accueil', url: '/' },
      { name: 'Pièces auto', url: '/pieces' },
      { name: category.name, url: `/pieces/${category.slug}` }
    ];
  }

  /**
   * 🚗 Récupère les données pour le sélecteur de véhicule
   */
  private async getVehicleSelector(category: CategoryInfo): Promise<CategoryVehicleSelector> {
    try {
      // Récupérer les marques qui ont des pièces dans cette catégorie
      const { data: brands } = await this.supabase
        .from('pieces')
        .select(`
          piece_marque,
          marques_pieces!inner(mp_id, mp_name, mp_logo)
        `)
        .eq('piece_fil_id', category.id)
        .eq('piece_display', true)
        .not('piece_marque', 'is', null);

      // Déduplication et formatage des marques
      const uniqueBrands = new Map();
      brands?.forEach(piece => {
        if (piece.marques_pieces && !uniqueBrands.has(piece.piece_marque)) {
          uniqueBrands.set(piece.piece_marque, {
            id: piece.marques_pieces.mp_id,
            name: piece.marques_pieces.mp_name,
            logo: piece.marques_pieces.mp_logo
          });
        }
      });

      return {
        brands: Array.from(uniqueBrands.values()),
        searchByTypemine: true
      };

    } catch (error) {
      this.logger.warn('Erreur récupération marques:', error);
      return {
        brands: [],
        searchByTypemine: true
      };
    }
  }

  /**
   * 🛍️ Récupère un échantillon de produits de la catégorie
   */
  private async getProductsSample(category: CategoryInfo): Promise<CategoryProductSample[]> {
    try {
      const { data: products } = await this.supabase
        .from('pieces')
        .select(`
          piece_id,
          piece_ref,
          piece_name,
          piece_has_img,
          piece_price_public,
          marques_pieces(mp_name)
        `)
        .eq('piece_fil_id', category.id)
        .eq('piece_display', true)
        .order('piece_sort', { ascending: true })
        .limit(8);

      return products?.map(product => ({
        id: product.piece_id,
        reference: product.piece_ref,
        name: product.piece_name,
        brand: product.marques_pieces?.mp_name,
        price: product.piece_price_public,
        hasImage: product.piece_has_img,
        image: product.piece_has_img ? 
          `/images/pieces/${product.piece_ref}.webp` : 
          '/images/pieces/default.webp'
      })) || [];

    } catch (error) {
      this.logger.warn('Erreur récupération échantillon produits:', error);
      return [];
    }
  }

  /**
   * 🔗 Récupère les catégories liées
   */
  private async getRelatedCategories(category: CategoryInfo): Promise<CategoryRelated[]> {
    try {
      // Récupérer des catégories similaires basées sur des mots-clés
      const categoryKeywords = this.extractKeywords(category.name);
      
      const { data: relatedGammes } = await this.supabase
        .from('pieces_gamme')
        .select(`
          pg_id,
          pg_name,
          pg_alias,
          pg_img,
          pg_pic
        `)
        .eq('pg_display', '1')
        .neq('pg_id', category.id)
        .or(categoryKeywords.map(keyword => 
          `pg_name.ilike.%${keyword}%`
        ).join(','))
        .limit(6);

      const relatedPromises = relatedGammes?.map(async (gamme) => {
        // Compter les produits pour chaque catégorie liée
        const { count } = await this.supabase
          .from('pieces')
          .select('piece_id', { count: 'exact' })
          .eq('piece_fil_id', gamme.pg_id)
          .eq('piece_display', true);

        return {
          id: gamme.pg_id,
          name: gamme.pg_name,
          slug: gamme.pg_alias || `category-${gamme.pg_id}`,
          description: this.generateCategoryDescription(gamme.pg_name),
          productsCount: count || 0,
          image: gamme.pg_img || gamme.pg_pic || '/images/categories/default.webp'
        };
      }) || [];

      return await Promise.all(relatedPromises);

    } catch (error) {
      this.logger.warn('Erreur récupération catégories liées:', error);
      return [];
    }
  }

  /**
   * 📚 Récupère les informations techniques
   */
  private async getTechnicalInfo(category: CategoryInfo): Promise<CategoryTechnicalInfo[]> {
    // Pour l'instant, générer des informations techniques basées sur le nom de la catégorie
    // TODO: À terme, créer une table dédiée pour les informations techniques
    
    const categoryName = category.name.toLowerCase();
    const technicalInfo: CategoryTechnicalInfo[] = [];

    if (categoryName.includes('filtre')) {
      technicalInfo.push(
        {
          id: 'role-filtre',
          title: `Rôle du ${category.name.toLowerCase()}`,
          content: `Le ${category.name.toLowerCase()} est un élément essentiel qui retient les impuretés et protège les composants de votre véhicule contre l'usure prématurée.`,
          order: 1,
          isMainInfo: true
        },
        {
          id: 'changement-filtre',
          title: 'Quand le changer ?',
          content: `Le changement du ${category.name.toLowerCase()} doit être effectué selon les préconisations constructeur, généralement lors des vidanges ou révisions.`,
          order: 2,
          isMainInfo: true
        }
      );
    }

    if (categoryName.includes('plaquette') || categoryName.includes('frein')) {
      technicalInfo.push(
        {
          id: 'securite-freinage',
          title: 'Sécurité avant tout',
          content: `Les éléments de freinage comme les ${category.name.toLowerCase()} sont cruciaux pour votre sécurité. Changez-les dès les premiers signes d'usure.`,
          order: 1,
          isMainInfo: true
        }
      );
    }

    // Ajouter des informations générales
    technicalInfo.push({
      id: 'conseil-installation',
      title: 'Conseils d\'installation',
      content: `Pour l'installation de votre ${category.name.toLowerCase()}, nous recommandons de faire appel à un professionnel pour garantir sécurité et performance.`,
      order: 10,
      isMainInfo: false
    });

    return technicalInfo;
  }

  /**
   * 📊 Récupère les statistiques de la catégorie
   */
  private async getCategoryStats(category: CategoryInfo): Promise<{
    totalProducts: number;
    totalBrands: number;
    averagePrice?: number;
  }> {
    try {
      const [productsQuery, brandsQuery, priceQuery] = await Promise.all([
        // Compter les produits
        this.supabase
          .from('pieces')
          .select('piece_id', { count: 'exact' })
          .eq('piece_fil_id', category.id)
          .eq('piece_display', true),
        
        // Compter les marques uniques
        this.supabase
          .from('pieces')
          .select('piece_marque')
          .eq('piece_fil_id', category.id)
          .eq('piece_display', true)
          .not('piece_marque', 'is', null),
        
        // Calculer le prix moyen
        this.supabase
          .from('pieces')
          .select('piece_price_public')
          .eq('piece_fil_id', category.id)
          .eq('piece_display', true)
          .not('piece_price_public', 'is', null)
          .gt('piece_price_public', 0)
      ]);

      const uniqueBrands = new Set(brandsQuery.data?.map(p => p.piece_marque) || []);
      
      const prices = priceQuery.data?.map(p => p.piece_price_public).filter(p => p > 0) || [];
      const averagePrice = prices.length > 0 ? 
        prices.reduce((sum, price) => sum + price, 0) / prices.length : 
        undefined;

      return {
        totalProducts: productsQuery.count || 0,
        totalBrands: uniqueBrands.size,
        averagePrice
      };

    } catch (error) {
      this.logger.warn('Erreur récupération statistiques:', error);
      return {
        totalProducts: 0,
        totalBrands: 0
      };
    }
  }

  // ========================================
  // 🛠️ MÉTHODES UTILITAIRES
  // ========================================

  /**
   * Génère une description automatique pour une catégorie
   */
  private generateCategoryDescription(categoryName: string): string {
    const name = categoryName?.toLowerCase() || 'pièce auto';
    
    if (name.includes('filtre')) {
      return `Découvrez notre large gamme de ${name}s de qualité professionnelle. Filtration optimale pour protéger votre moteur et maintenir ses performances.`;
    }
    
    if (name.includes('plaquette') || name.includes('frein')) {
      return `${categoryName}s de haute qualité pour votre sécurité. Freinage efficace et durable avec nos pièces de marques premium.`;
    }
    
    if (name.includes('amortisseur')) {
      return `${categoryName}s premium pour un confort de conduite optimal. Tenue de route parfaite avec nos amortisseurs haute performance.`;
    }
    
    return `Pièces détachées ${name} de qualité professionnelle. Large choix de marques premium pour tous véhicules. Prix compétitifs et livraison rapide.`;
  }

  /**
   * Génère un titre H1 personnalisé pour une catégorie
   */
  private generateCategoryTitle(categoryName: string, slug: string): string {
    const name = categoryName?.toLowerCase() || 'pièce auto';
    
    // Titre spécifique pour filtre à huile
    if (name.includes('filtre') && name.includes('huile')) {
      return 'Filtre à huile pas cher pour votre véhicule';
    }
    
    // Autres filtres
    if (name.includes('filtre')) {
      return `${categoryName} pas cher pour votre véhicule`;
    }
    
    // Freinage
    if (name.includes('plaquette') || name.includes('frein')) {
      return `${categoryName} pas cher pour votre véhicule`;
    }
    
    // Titre générique
    return `${categoryName} pas cher pour votre véhicule`;
  }

  /**
   * Extrait les mots-clés d'un nom de catégorie pour les suggestions
   */
  private extractKeywords(categoryName: string): string[] {
    const name = categoryName?.toLowerCase() || '';
    const keywords: string[] = [];
    
    // Mots-clés spécifiques par domaine
    if (name.includes('filtre')) {
      keywords.push('filtre', 'filtration');
      if (name.includes('huile')) keywords.push('huile', 'lubrification');
      if (name.includes('air')) keywords.push('air', 'admission');
      if (name.includes('carburant')) keywords.push('carburant', 'essence', 'diesel');
    }
    
    if (name.includes('frein')) {
      keywords.push('frein', 'freinage', 'plaquette', 'disque');
    }
    
    if (name.includes('amortisseur')) {
      keywords.push('amortisseur', 'suspension', 'ressort');
    }
    
    // Ajouter des mots génériques
    keywords.push('pièce', 'auto', 'véhicule');
    
    return keywords.filter(k => k.length > 2); // Filtrer les mots trop courts
  }
}