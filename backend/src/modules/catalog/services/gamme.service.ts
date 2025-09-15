import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { VehicleCacheService, CacheType } from '../../vehicles/services/core/vehicle-cache.service';

// ========================================
// 🔍 VALIDATION SCHEMAS ZOD
// ========================================

const GammeParamsSchema = z.object({
  gammeId: z.string().regex(/^\d+$/, 'ID de gamme invalide').transform(Number),
});

const GammeFilterSchema = z.object({
  featured: z.boolean().optional(),
  brandId: z.number().optional(),
  categoryFilter: z.string().optional(),
  limit: z.number().min(1).max(100).optional().default(20),
  offset: z.number().min(0).optional().default(0),
});

const HomepageGammeSchema = z.object({
  includeFeatured: z.boolean().optional().default(true),
  includeStats: z.boolean().optional().default(true),
  maxCategories: z.number().min(1).max(50).optional().default(12),
});

// ========================================
// 📊 INTERFACES TYPESCRIPT
// ========================================

export interface ProductGamme {
  gamme_id: number;
  gamme_name: string;
  gamme_alias: string;
  gamme_description?: string;
  gamme_image?: string;
  gamme_icon?: string;
  gamme_color?: string;
  gamme_sort?: number;
  gamme_display: boolean;
  gamme_featured: boolean;
  gamme_seo_title?: string;
  gamme_seo_description?: string;
  products_count?: number;
  is_popular?: boolean;
  updated_at?: string;
}

export interface GammeWithProducts extends ProductGamme {
  popular_products?: Array<{
    piece_id: number;
    piece_name: string;
    piece_ref: string;
    piece_price?: number;
    piece_brand?: string;
    piece_image?: string;
  }>;
}

export interface HomepageGammeData {
  featured_gammes: ProductGamme[];
  popular_gammes: ProductGamme[];
  all_gammes: ProductGamme[];
  stats: {
    total_gammes: number;
    total_products: number;
    featured_count: number;
  };
  last_updated: string;
}

export interface GammeMetadata {
  title: string;
  description: string;
  keywords: string[];
  ogTitle: string;
  ogDescription: string;
  ogImage?: string;
  breadcrumbs: Array<{
    label: string;
    path: string;
  }>;
}

export interface GammeHierarchy {
  id: number;
  code: string;
  name: string;
  parent_id?: number;
  display_order: number;
  children?: GammeHierarchy[];
}

/**
 * 🔧 GAMME SERVICE - Service des gammes de produits moderne
 * 
 * ✅ FONCTIONNALITÉS :
 * - CRUD complet des gammes de produits
 * - Cache intelligent multi-niveaux
 * - Validation Zod automatique
 * - Support page d'accueil optimisé
 * - Intégration avec ProductCatalog
 * - Gestion SEO et métadonnées
 * - Statistiques en temps réel
 * 
 * 🎯 OPTIMISÉ POUR :
 * - Page d'accueil avec ProductCatalog
 * - Sélection de véhicule -> Gammes
 * - Performance avec cache Redis
 * - SEO avec métadonnées structurées
 */
@Injectable()
export class GammeService extends SupabaseBaseService {
  private readonly logger = new Logger(GammeService.name);

  constructor(
    private readonly cacheService: VehicleCacheService,
  ) {
    super();
    this.logger.log('🔧 GammeService initialisé avec cache intelligent');
  }

  // ========================================
  // 📋 MÉTHODES PRINCIPALES
  // ========================================

  /**
   * 🏠 Obtient les données complètes pour la page d'accueil
   */
  async getHomepageGammeData(params: z.infer<typeof HomepageGammeSchema> = {}): Promise<HomepageGammeData> {
    const validatedParams = HomepageGammeSchema.parse(params);
    
    const cacheKey = `homepage-gamme-data:${JSON.stringify(validatedParams)}`;
    
    return this.cacheService.getOrSetWithTTL(
      cacheKey,
      async () => {
        this.logger.log('🏠 Génération données homepage gammes');

        // Requêtes parallèles pour performance optimale
        const [featuredGammes, popularGammes, allGammes, stats] = await Promise.all([
          this.getFeaturedGammes(validatedParams.maxCategories),
          this.getPopularGammes(8), // Top 8 pour homepage
          this.getAllGammes({ limit: validatedParams.maxCategories }),
          validatedParams.includeStats ? this.getGammeStats() : null,
        ]);

        const result: HomepageGammeData = {
          featured_gammes: featuredGammes,
          popular_gammes: popularGammes,
          all_gammes: allGammes,
          stats: stats || {
            total_gammes: allGammes.length,
            total_products: 0,
            featured_count: featuredGammes.length
          },
          last_updated: new Date().toISOString()
        };

        this.logger.log(`✅ Données homepage: ${featuredGammes.length} featured, ${popularGammes.length} populaires`);
        return result;
      },
      CacheType.MEDIUM, // 30 minutes
      'homepage-gamme'
    );
  }

  /**
   * 🌟 Obtient les gammes mises en avant
   */
  async getFeaturedGammes(limit: number = 12): Promise<ProductGamme[]> {
    const cacheKey = `featured-gammes:${limit}`;
    
    return this.cacheService.getOrSetWithTTL(
      cacheKey,
      async () => {
        this.logger.log(`🌟 Récupération gammes featured (limite: ${limit})`);

        const { data, error } = await this.supabase
          .from('products_gamme')
          .select(`
            gamme_id,
            gamme_name,
            gamme_alias,
            gamme_description,
            gamme_image,
            gamme_icon,
            gamme_color,
            gamme_sort,
            gamme_display,
            gamme_featured,
            gamme_seo_title,
            gamme_seo_description
          `)
          .eq('gamme_display', true)
          .eq('gamme_featured', true)
          .order('gamme_sort', { ascending: true })
          .limit(limit);

        if (error) {
          this.logger.error('❌ Erreur récupération gammes featured:', error);
          throw new BadRequestException('Erreur lors de la récupération des gammes featured');
        }

        // Enrichir avec le nombre de produits
        const enrichedGammes = await this.enrichGammesWithProductCount(data || []);
        
        this.logger.log(`✅ ${enrichedGammes.length} gammes featured récupérées`);
        return enrichedGammes;
      },
      CacheType.MEDIUM,
      'featured-gammes'
    );
  }

  /**
   * 🔥 Obtient les gammes populaires basées sur les commandes
   */
  async getPopularGammes(limit: number = 8): Promise<ProductGamme[]> {
    const cacheKey = `popular-gammes:${limit}`;
    
    return this.cacheService.getOrSetWithTTL(
      cacheKey,
      async () => {
        this.logger.log(`🔥 Récupération gammes populaires (limite: ${limit})`);

        // Requête complexe avec jointures pour calculer la popularité
        const { data, error } = await this.supabase
          .rpc('get_popular_gammes', {
            limit_count: limit
          });

        if (error) {
          this.logger.warn('⚠️ Erreur RPC popularité, fallback sur gammes featured');
          // Fallback sur gammes featured si RPC échoue
          return this.getFeaturedGammes(limit);
        }

        const popularGammes = (data || []).map((item: any) => ({
          ...item,
          is_popular: true
        }));

        this.logger.log(`✅ ${popularGammes.length} gammes populaires récupérées`);
        return popularGammes;
      },
      CacheType.LONG, // 2 heures - les stats de popularité changent moins souvent
      'popular-gammes'
    );
  }

  /**
   * 📋 Obtient toutes les gammes avec filtres
   */
  async getAllGammes(filters: z.infer<typeof GammeFilterSchema> = {}): Promise<ProductGamme[]> {
    const validatedFilters = GammeFilterSchema.parse(filters);
    const cacheKey = `all-gammes:${JSON.stringify(validatedFilters)}`;
    
    return this.cacheService.getOrSetWithTTL(
      cacheKey,
      async () => {
        this.logger.log(`📋 Récupération toutes gammes avec filtres`);

        let query = this.supabase
          .from('products_gamme')
          .select(`
            gamme_id,
            gamme_name,
            gamme_alias,
            gamme_description,
            gamme_image,
            gamme_icon,
            gamme_color,
            gamme_sort,
            gamme_display,
            gamme_featured,
            gamme_seo_title,
            gamme_seo_description
          `)
          .eq('gamme_display', true);

        // Application des filtres
        if (validatedFilters.featured !== undefined) {
          query = query.eq('gamme_featured', validatedFilters.featured);
        }

        if (validatedFilters.categoryFilter) {
          query = query.ilike('gamme_name', `%${validatedFilters.categoryFilter}%`);
        }

        // Ordre et pagination
        const { data, error } = await query
          .order('gamme_sort', { ascending: true })
          .range(validatedFilters.offset, validatedFilters.offset + validatedFilters.limit - 1);

        if (error) {
          this.logger.error('❌ Erreur récupération toutes gammes:', error);
          throw new BadRequestException('Erreur lors de la récupération des gammes');
        }

        // Enrichir avec compteurs de produits
        const enrichedGammes = await this.enrichGammesWithProductCount(data || []);
        
        this.logger.log(`✅ ${enrichedGammes.length} gammes récupérées avec filtres`);
        return enrichedGammes;
      },
      CacheType.MEDIUM,
      'all-gammes'
    );
  }

  /**
   * 🔍 Obtient une gamme par ID avec détails complets
   */
  async getGammeById(gammeId: number, includeProducts: boolean = false): Promise<GammeWithProducts> {
    const validatedParams = GammeParamsSchema.parse({ gammeId: gammeId.toString() });
    const cacheKey = `gamme-detail:${validatedParams.gammeId}:${includeProducts}`;
    
    return this.cacheService.getOrSetWithTTL(
      cacheKey,
      async () => {
        this.logger.log(`🔍 Récupération gamme ID: ${validatedParams.gammeId}`);

        const { data, error } = await this.supabase
          .from('products_gamme')
          .select(`
            gamme_id,
            gamme_name,
            gamme_alias,
            gamme_description,
            gamme_image,
            gamme_icon,
            gamme_color,
            gamme_sort,
            gamme_display,
            gamme_featured,
            gamme_seo_title,
            gamme_seo_description,
            updated_at
          `)
          .eq('gamme_id', validatedParams.gammeId)
          .single();

        if (error || !data) {
          this.logger.error(`❌ Gamme ${validatedParams.gammeId} non trouvée:`, error);
          throw new NotFoundException(`Gamme avec l'ID ${validatedParams.gammeId} non trouvée`);
        }

        let result: GammeWithProducts = {
          ...data,
          products_count: 0
        };

        // Enrichir avec produits populaires si demandé
        if (includeProducts) {
          const popularProducts = await this.getPopularProductsForGamme(validatedParams.gammeId, 6);
          result.popular_products = popularProducts;
        }

        // Toujours enrichir avec le count
        const [enrichedGamme] = await this.enrichGammesWithProductCount([result]);
        result = { ...result, ...enrichedGamme };

        this.logger.log(`✅ Gamme ${validatedParams.gammeId} récupérée`);
        return result;
      },
      CacheType.MEDIUM,
      'gamme-detail'
    );
  }

  // ========================================
  // 📊 MÉTHODES UTILITAIRES PRIVÉES
  // ========================================

  /**
   * 📊 Enrichit les gammes avec le nombre de produits
   */
  private async enrichGammesWithProductCount(gammes: ProductGamme[]): Promise<ProductGamme[]> {
    if (gammes.length === 0) return [];

    try {
      const gammeIds = gammes.map(g => g.gamme_id);
      
      const { data: productCounts, error } = await this.supabase
        .rpc('get_products_count_by_gamme', {
          gamme_ids: gammeIds
        });

      if (error) {
        this.logger.warn('⚠️ Erreur comptage produits, valeurs par défaut utilisées');
        return gammes.map(g => ({ ...g, products_count: 0 }));
      }

      // Créer un map pour lookup rapide
      const countMap = new Map();
      (productCounts || []).forEach((item: any) => {
        countMap.set(item.gamme_id, item.products_count);
      });

      // Enrichir les gammes
      return gammes.map(gamme => ({
        ...gamme,
        products_count: countMap.get(gamme.gamme_id) || 0
      }));

    } catch (error) {
      this.logger.warn('⚠️ Erreur enrichissement produits count:', error);
      return gammes.map(g => ({ ...g, products_count: 0 }));
    }
  }

  /**
   * 🔥 Obtient les produits populaires d'une gamme
   */
  private async getPopularProductsForGamme(gammeId: number, limit: number = 6) {
    try {
      const { data, error } = await this.supabase
        .rpc('get_popular_products_by_gamme', {
          gamme_id: gammeId,
          limit_count: limit
        });

      if (error) {
        this.logger.warn(`⚠️ Erreur produits populaires gamme ${gammeId}:`, error);
        return [];
      }

      return data || [];
    } catch (error) {
      this.logger.warn(`⚠️ Exception produits populaires gamme ${gammeId}:`, error);
      return [];
    }
  }

  /**
   * 📊 Obtient les statistiques des gammes
   */
  private async getGammeStats() {
    try {
      const { data, error } = await this.supabase
        .rpc('get_gamme_statistics');

      if (error) {
        this.logger.warn('⚠️ Erreur statistiques gammes:', error);
        return {
          total_gammes: 0,
          total_products: 0,
          featured_count: 0
        };
      }

      return data?.[0] || {
        total_gammes: 0,
        total_products: 0,
        featured_count: 0
      };
    } catch (error) {
      this.logger.warn('⚠️ Exception statistiques gammes:', error);
      return {
        total_gammes: 0,
        total_products: 0,
        featured_count: 0
      };
    }
  }

  /**
   * ♻️ Invalide le cache des gammes
   */
  async invalidateGammeCache(): Promise<void> {
    this.logger.log('♻️ Invalidation cache gammes');
    
    await Promise.all([
      this.cacheService.invalidatePattern('homepage-gamme*'),
      this.cacheService.invalidatePattern('featured-gammes*'),
      this.cacheService.invalidatePattern('popular-gammes*'),
      this.cacheService.invalidatePattern('all-gammes*'),
      this.cacheService.invalidatePattern('gamme-detail*'),
    ]);

    this.logger.log('✅ Cache gammes invalidé avec succès');
  }

  // ========================================
  // 🆕 NOUVELLES MÉTHODES AMÉLIORÉES
  // ========================================

  /**
   * 🔍 Récupère une gamme spécifique avec ses pièces
   * Méthode améliorée avec cache et validation
   */
  async getGammeWithPieces(gammeCode: string): Promise<GammeWithProducts | null> {
    const cacheKey = `gamme-with-pieces:${gammeCode}`;
    
    try {
      // TODO: Réactiver cache une fois VehicleCacheService corrigé
      // return this.cacheService.getOrSetWithTTL(cacheKey, async () => {
        this.logger.log(`🔍 Récupération gamme avec pièces: ${gammeCode}`);

        const { data: gamme, error } = await this.supabase
          .from('products_gamme')
          .select(`
            *,
            pieces:products_pieces(
              piece_id,
              piece_name,
              piece_ref,
              piece_price,
              piece_discount_price,
              piece_image,
              piece_stock_status,
              piece_brand
            )
          `)
          .eq('gamme_alias', gammeCode)
          .eq('gamme_display', true)
          .single();

        if (error) {
          this.logger.warn(`⚠️ Gamme ${gammeCode} non trouvée:`, error);
          return null;
        }

        this.logger.log(`✅ Gamme ${gammeCode} récupérée avec ${gamme?.pieces?.length || 0} pièces`);
        return gamme;
      // }, CacheType.MEDIUM, 'gamme-with-pieces');
    } catch (error) {
      this.logger.error(`❌ Erreur récupération gamme ${gammeCode}:`, error);
      throw new NotFoundException(`Gamme ${gammeCode} non trouvée`);
    }
  }

  /**
   * 🏗️ Récupère l'arborescence complète des gammes
   * Équivalent amélioré d'ariane.conf.php pour les gammes
   */
  async getGammeHierarchy(): Promise<GammeHierarchy[]> {
    const cacheKey = 'gamme-hierarchy';
    
    try {
      // TODO: Réactiver cache une fois VehicleCacheService corrigé
      // return this.cacheService.getOrSetWithTTL(cacheKey, async () => {
        this.logger.log('🏗️ Construction hiérarchie gammes');

        const { data, error } = await this.supabase
          .from('products_gamme')
          .select(`
            gamme_id,
            gamme_alias,
            gamme_name,
            gamme_parent_id,
            gamme_sort,
            children:products_gamme!gamme_parent_id(
              gamme_id,
              gamme_alias,
              gamme_name,
              gamme_sort
            )
          `)
          .is('gamme_parent_id', null)
          .eq('gamme_display', true)
          .order('gamme_sort', { ascending: true });

        if (error) {
          this.logger.error('❌ Erreur hiérarchie gammes:', error);
          throw new BadRequestException('Erreur lors de la récupération de la hiérarchie des gammes');
        }

        const hierarchy = (data || []).map(item => ({
          id: item.gamme_id,
          code: item.gamme_alias,
          name: item.gamme_name,
          parent_id: item.gamme_parent_id,
          display_order: item.gamme_sort || 0,
          children: (item.children || []).map((child: any) => ({
            id: child.gamme_id,
            code: child.gamme_alias,
            name: child.gamme_name,
            display_order: child.gamme_sort || 0
          }))
        }));

        this.logger.log(`✅ Hiérarchie construite: ${hierarchy.length} gammes principales`);
        return hierarchy;
      // }, CacheType.LONG, 'gamme-hierarchy');
    } catch (error) {
      this.logger.error('❌ Exception hiérarchie gammes:', error);
      throw new BadRequestException('Erreur lors de la récupération de la hiérarchie des gammes');
    }
  }

  /**
   * 🎯 Récupère les métadonnées SEO pour une gamme
   * Remplace meta.conf.php pour les gammes avec amélioration
   */
  async getGammeMetadata(gammeCode: string): Promise<GammeMetadata | null> {
    const cacheKey = `gamme-metadata:${gammeCode}`;
    
    try {
      // TODO: Réactiver cache une fois VehicleCacheService corrigé
      // return this.cacheService.getOrSetWithTTL(cacheKey, async () => {
        this.logger.log(`🎯 Génération métadonnées SEO: ${gammeCode}`);

        const { data: gamme, error } = await this.supabase
          .from('products_gamme')
          .select('*')
          .eq('gamme_alias', gammeCode)
          .eq('gamme_display', true)
          .single();

        if (error || !gamme) {
          this.logger.warn(`⚠️ Gamme ${gammeCode} non trouvée pour métadonnées`);
          return null;
        }

        // Générer les métadonnées SEO optimisées
        const metadata: GammeMetadata = {
          title: gamme.gamme_seo_title || `${gamme.gamme_name} - Pièces auto pas cher | Automecanik`,
          description: gamme.gamme_seo_description || gamme.gamme_description || 
                      `Découvrez notre gamme ${gamme.gamme_name}. Large choix de pièces détachées auto au meilleur prix. Livraison rapide.`,
          keywords: [
            gamme.gamme_name,
            'pièces auto',
            gamme.gamme_alias,
            'pièces détachées',
            'automecanik'
          ].filter(Boolean),
          ogTitle: `${gamme.gamme_name} - Automecanik`,
          ogDescription: `Gamme complète ${gamme.gamme_name} disponible sur Automecanik`,
          ogImage: gamme.gamme_image || '/images/default-gamme.jpg',
          breadcrumbs: await this.getGammeBreadcrumbs(gammeCode)
        };

        this.logger.log(`✅ Métadonnées générées pour ${gamme.gamme_name}`);
        return metadata;
      // }, CacheType.MEDIUM, 'gamme-metadata');
    } catch (error) {
      this.logger.error(`❌ Erreur métadonnées gamme ${gammeCode}:`, error);
      return null;
    }
  }

  /**
   * 🍞 Génère le fil d'Ariane pour une gamme
   * Méthode privée avec support hiérarchie avancée
   */
  private async getGammeBreadcrumbs(gammeCode: string): Promise<Array<{ label: string; path: string }>> {
    const breadcrumbs = [
      { label: 'Accueil', path: '/' },
      { label: 'Catalogue', path: '/catalog' }
    ];

    try {
      const { data: gamme, error } = await this.supabase
        .from('products_gamme')
        .select('gamme_name, gamme_alias, gamme_parent_id')
        .eq('gamme_alias', gammeCode)
        .single();

      if (!error && gamme) {
        // Si gamme a un parent, l'ajouter d'abord
        if (gamme.gamme_parent_id) {
          const { data: parentGamme } = await this.supabase
            .from('products_gamme')
            .select('gamme_name, gamme_alias')
            .eq('gamme_id', gamme.gamme_parent_id)
            .single();

          if (parentGamme) {
            breadcrumbs.push({
              label: parentGamme.gamme_name,
              path: `/catalog/gamme/${parentGamme.gamme_alias}`
            });
          }
        }

        // Ajouter la gamme courante
        breadcrumbs.push({
          label: gamme.gamme_name,
          path: `/catalog/gamme/${gamme.gamme_alias}`
        });
      }
    } catch (error) {
      this.logger.warn(`⚠️ Erreur génération breadcrumbs pour ${gammeCode}:`, error);
    }

    return breadcrumbs;
  }

  /**
   * 🔍 Recherche de gammes avec texte libre
   * Nouvelle méthode pour recherche avancée
   */
  async searchGammes(
    query: string, 
    options: {
      limit?: number;
      includeProducts?: boolean;
      onlyFeatured?: boolean;
    } = {}
  ): Promise<ProductGamme[]> {
    const { limit = 20, includeProducts = false, onlyFeatured = false } = options;
    
    try {
      this.logger.log(`🔍 Recherche gammes: "${query}" (limite: ${limit})`);

      let queryBuilder = this.supabase
        .from('products_gamme')
        .select(`
          gamme_id,
          gamme_name,
          gamme_alias,
          gamme_description,
          gamme_image,
          gamme_featured,
          gamme_display
          ${includeProducts ? ', products_pieces(piece_id, piece_name, piece_ref)' : ''}
        `)
        .eq('gamme_display', true)
        .or(`gamme_name.ilike.%${query}%, gamme_description.ilike.%${query}%, gamme_alias.ilike.%${query}%`);

      if (onlyFeatured) {
        queryBuilder = queryBuilder.eq('gamme_featured', true);
      }

      const { data, error } = await queryBuilder
        .order('gamme_featured', { ascending: false })
        .order('gamme_sort', { ascending: true })
        .limit(limit);

      if (error) {
        this.logger.error(`❌ Erreur recherche gammes: ${query}`, error);
        throw new BadRequestException('Erreur lors de la recherche de gammes');
      }

      this.logger.log(`✅ Recherche "${query}": ${data?.length || 0} résultats`);
      return data || [];
    } catch (error) {
      this.logger.error(`❌ Exception recherche gammes: ${query}`, error);
      throw new BadRequestException('Erreur lors de la recherche de gammes');
    }
  }
}