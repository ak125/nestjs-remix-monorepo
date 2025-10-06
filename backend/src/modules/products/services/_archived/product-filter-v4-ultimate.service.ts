/**
 * 🎯 PRODUCT FILTER SERVICE V4 ULTIMATE
 * 
 * Service de filtrage de produits avancé appliquant la méthodologie
 * "Vérifier existant avant et utiliser le meilleur et améliorer"
 * 
 * @version 4.0.0
 * @package @monorepo/products
 */

import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { SupabaseBaseService } from '../../database/services/supabase-base.service';

// 🎯 MEILLEUR IDENTIFIÉ : Interface FilterGroup du SearchFilterService
export interface FilterOption {
  id: string | number;
  value: string;
  label: string;
  count: number;
  selected?: boolean;
  metadata?: Record<string, any>;
}

export interface FilterGroup {
  name: string;
  label: string;
  options: FilterOption[];
  type: 'checkbox' | 'radio' | 'range' | 'select' | 'multiselect' | 'stars';
  category?: string;
  priority?: number;
}

// 🚀 AMÉLIORATION : Schema Zod pour validation complète
const FilterOptionsSchema = z.object({
  pgId: z.number().positive(),
  typeId: z.number().positive(),
  filters: z.object({
    gammeProduct: z.array(z.string()).optional(),
    criteria: z.array(z.string()).optional(),
    quality: z.array(z.string()).optional(),
    stars: z.array(z.string()).optional(),
    manufacturer: z.array(z.string()).optional(),
    priceRange: z.object({
      min: z.number().min(0).optional(),
      max: z.number().min(0).optional(),
    }).optional(),
    availability: z.enum(['instock', 'order', 'all']).optional(),
    side: z.array(z.string()).optional(),
    oem: z.boolean().optional(),
  }).optional(),
  pagination: z.object({
    page: z.number().min(1).default(1),
    limit: z.number().min(1).max(100).default(50),
  }).optional(),
  sorting: z.object({
    field: z.enum(['price', 'name', 'brand', 'stars', 'popularity']).default('name'),
    order: z.enum(['asc', 'desc']).default('asc'),
  }).optional(),
});

type FilterOptionsInput = z.infer<typeof FilterOptionsSchema>;

// 🎯 AMÉLIORATION : Types de réponse enrichis
export interface ProductFilterResult {
  products: EnhancedProduct[];
  filters: FilterGroup[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  stats: {
    totalProducts: number;
    averagePrice: number;
    priceRange: { min: number; max: number };
    topManufacturers: Array<{ name: string; count: number }>;
    qualityDistribution: Record<string, number>;
  };
  metadata: {
    processingTime: number;
    cacheHit: boolean;
    filtersApplied: string[];
    suggestedFilters?: FilterGroup[];
  };
}

export interface EnhancedProduct {
  id: number;
  name: string;
  reference: string;
  referenceClean?: string;
  description?: string;
  hasImage: boolean;
  hasOEM: boolean;
  
  // Prix enrichi
  price: {
    ttc: number;
    ht?: number;
    consigne?: number;
    formatted: string;
    currency: string;
  };
  
  // Fabricant enrichi
  manufacturer: {
    id: number;
    name: string;
    alias: string;
    logo?: string;
    quality: 'OES' | 'AFTERMARKET' | 'FIRST';
    stars: number;
    country?: string;
  };
  
  // Informations techniques
  technical: {
    side?: string;
    category?: string;
    criteria?: Array<{
      type: string;
      value: string | number;
      unit?: string;
    }>;
  };
  
  // Disponibilité
  availability: {
    inStock: boolean;
    quantity?: number;
    deliveryTime?: string;
    status: 'available' | 'order' | 'discontinued';
  };
  
  // SEO et metadata
  metadata: {
    slug: string;
    popularity: number;
    isTopProduct?: boolean;
    isPromotion?: boolean;
    tags?: string[];
  };
}

@Injectable()
export class ProductFilterV4UltimateService extends SupabaseBaseService {
  private readonly logger = new Logger(ProductFilterV4UltimateService.name);
  
  // 🚀 AMÉLIORATION : Cache intelligent multi-niveaux
  private readonly filtersCache = new Map<string, { data: FilterGroup[]; expires: number }>();
  private readonly productsCache = new Map<string, { data: ProductFilterResult; expires: number }>();
  
  private readonly CACHE_TTL_FILTERS = 900000; // 15 min pour les filtres
  private readonly CACHE_TTL_PRODUCTS = 300000; // 5 min pour les produits
  private readonly CACHE_TTL_STATS = 1800000; // 30 min pour les stats

  /**
   * 🎯 MÉTHODE PRINCIPALE - Récupère les filtres et produits filtrés
   */
  async getFilteredProductsWithFilters(options: FilterOptionsInput): Promise<ProductFilterResult> {
    const startTime = Date.now();
    
    // Validation avec Zod
    const validatedOptions = FilterOptionsSchema.parse(options);
    
    this.logger.log(`🎯 [ProductFilter V4] Début filtrage: pgId=${validatedOptions.pgId}, typeId=${validatedOptions.typeId}`);
    
    const cacheKey = this.generateCacheKey('products', validatedOptions);
    const cached = this.productsCache.get(cacheKey);
    
    if (cached && cached.expires > Date.now()) {
      this.logger.log(`⚡ [ProductFilter V4] Cache HIT pour produits`);
      return {
        ...cached.data,
        metadata: { ...cached.data.metadata, cacheHit: true, processingTime: Date.now() - startTime }
      };
    }

    try {
      // 🚀 Processing en parallèle pour performance optimale
      const [availableFilters, filteredProducts] = await Promise.all([
        this.getAvailableFilters(validatedOptions.pgId, validatedOptions.typeId),
        this.applyFiltersAndGetProducts(validatedOptions)
      ]);

      // 🎯 Génération des statistiques enrichies
      const stats = this.generateProductStats(filteredProducts.products);
      
      const result: ProductFilterResult = {
        products: filteredProducts.products,
        filters: availableFilters,
        pagination: filteredProducts.pagination,
        stats,
        metadata: {
          processingTime: Date.now() - startTime,
          cacheHit: false,
          filtersApplied: this.extractAppliedFilters(validatedOptions),
          suggestedFilters: this.generateSuggestedFilters(availableFilters, validatedOptions)
        }
      };

      // Mise en cache
      this.productsCache.set(cacheKey, {
        data: result,
        expires: Date.now() + this.CACHE_TTL_PRODUCTS
      });

      this.logger.log(`✅ [ProductFilter V4] Produits filtrés: ${result.products.length}/${stats.totalProducts} en ${result.metadata.processingTime}ms`);
      
      return result;

    } catch (error) {
      this.logger.error(`❌ [ProductFilter V4] Erreur filtrage:`, error);
      throw new Error(`Erreur lors du filtrage des produits: ${error.message}`);
    }
  }

  /**
   * 🎯 MÉTHODE PUBLIQUE - Récupère uniquement les filtres disponibles
   */
  async getAvailableFilters(pgId: number, typeId: number): Promise<FilterGroup[]> {
    const cacheKey = this.generateCacheKey('filters', { pgId, typeId });
    const cached = this.filtersCache.get(cacheKey);
    
    if (cached && cached.expires > Date.now()) {
      this.logger.log(`⚡ [ProductFilter V4] Cache HIT pour filtres`);
      return cached.data;
    }

    try {
      // 🚀 AMÉLIORATION : Récupération parallèle de tous les filtres
      const [
        gammeFilters,
        criteriaFilters,
        qualityFilters,
        starsFilters,
        manufacturerFilters,
        priceRangeFilter,
        availabilityFilters,
        oemFilters
      ] = await Promise.all([
        this.getGammeProductFilters(pgId, typeId),
        this.getCriteriaFilters(pgId, typeId),
        this.getQualityFilters(pgId, typeId),
        this.getStarsFilters(pgId, typeId),
        this.getManufacturerFilters(pgId, typeId),
        this.getPriceRangeFilter(pgId, typeId),
        this.getAvailabilityFilters(pgId, typeId),
        this.getOEMFilters(pgId, typeId)
      ]);

      const allFilters: FilterGroup[] = [
        {
          name: 'gammeProduct',
          label: 'Catégories de produits',
          options: gammeFilters,
          type: 'checkbox',
          category: 'product',
          priority: 1
        },
        {
          name: 'manufacturer',
          label: 'Équipementiers',
          options: manufacturerFilters,
          type: 'multiselect',
          category: 'brand',
          priority: 2
        },
        {
          name: 'quality',
          label: 'Qualité',
          options: qualityFilters,
          type: 'radio',
          category: 'quality',
          priority: 3
        },
        {
          name: 'stars',
          label: 'Performance',
          options: starsFilters,
          type: 'stars',
          category: 'quality',
          priority: 4
        },
        {
          name: 'criteria',
          label: 'Critères techniques',
          options: criteriaFilters,
          type: 'checkbox',
          category: 'technical',
          priority: 5
        },
        {
          name: 'priceRange',
          label: 'Prix',
          options: priceRangeFilter,
          type: 'range',
          category: 'price',
          priority: 6
        },
        {
          name: 'availability',
          label: 'Disponibilité',
          options: availabilityFilters,
          type: 'radio',
          category: 'stock',
          priority: 7
        },
        {
          name: 'oem',
          label: 'OEM / Références',
          options: oemFilters,
          type: 'checkbox',
          category: 'reference',
          priority: 8
        }
      ].filter(group => group.options.length > 0);

      // Mise en cache
      this.filtersCache.set(cacheKey, {
        data: allFilters,
        expires: Date.now() + this.CACHE_TTL_FILTERS
      });

      return allFilters;

    } catch (error) {
      this.logger.error(`❌ [ProductFilter V4] Erreur récupération filtres:`, error);
      throw error;
    }
  }

  /**
   * 🚀 AMÉLIORATION : Filtres de gamme de produits avec compteurs
   */
  private async getGammeProductFilters(pgId: number, typeId: number): Promise<FilterOption[]> {
    const { data } = await this.client
      .rpc('get_gamme_product_filters', {
        p_pg_id: pgId,
        p_type_id: typeId
      });

    return data?.map((item: any) => ({
      id: item.piece_fil_id,
      value: this.createAlias(item.piece_fil_name),
      label: item.piece_fil_name,
      count: item.nbp || 0,
      metadata: {
        originalId: item.piece_fil_id,
        category: 'product_category'
      }
    })) || [];
  }

  /**
   * ✨ MEILLEUR IDENTIFIÉ + AMÉLIORATION : Filtres de critères techniques
   */
  private async getCriteriaFilters(pgId: number, typeId: number): Promise<FilterOption[]> {
    const { data } = await this.client
      .from('pieces_relation_type')
      .select(`
        pieces_side_filtre!inner (
          psf_id,
          psf_side,
          psf_sort,
          psf_icon,
          psf_description
        )
      `)
      .eq('rtp_type_id', typeId)
      .eq('rtp_pg_id', pgId)
      .neq('rtp_psf_id', 9999)
      .order('pieces_side_filtre.psf_sort');

    const uniqueMap = new Map();
    const counts = new Map();

    data?.forEach((item: any) => {
      const criteria = item.pieces_side_filtre;
      if (criteria) {
        const key = criteria.psf_id;
        
        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, {
            id: criteria.psf_id,
            value: this.createAlias(criteria.psf_side),
            label: criteria.psf_side,
            count: 0,
            metadata: {
              icon: criteria.psf_icon,
              description: criteria.psf_description,
              sort: criteria.psf_sort,
              category: 'technical_criteria'
            }
          });
        }
        
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    });

    // Mise à jour des compteurs
    uniqueMap.forEach((filter, key) => {
      filter.count = counts.get(key) || 0;
    });

    return Array.from(uniqueMap.values())
      .sort((a: any, b: any) => (a.metadata.sort || 0) - (b.metadata.sort || 0));
  }

  /**
   * 🎯 AMÉLIORATION : Filtres de qualité avec logique métier avancée
   */
  private async getQualityFilters(pgId: number, typeId: number): Promise<FilterOption[]> {
    const { data } = await this.client
      .rpc('get_quality_filters', {
        p_pg_id: pgId,
        p_type_id: typeId
      });

    const qualities: FilterOption[] = [];
    const qualityCounts = new Map();

    // OES/AFTERMARKET avec compteurs
    data?.forEach((item: any) => {
      if (item.pm_oes) {
        const quality = item.pm_oes === 'A' ? 'AFTERMARKET' : 'OES';
        qualityCounts.set(quality, (qualityCounts.get(quality) || 0) + 1);
      }
    });

    // Ajout des qualités avec métadonnées
    qualityCounts.forEach((count, quality) => {
      qualities.push({
        id: quality.toLowerCase(),
        value: quality.toLowerCase(),
        label: quality === 'OES' ? 'Qualité Origine (OES)' : 'Marché de l\'Après-Vente',
        count,
        metadata: {
          type: 'quality_level',
          priority: quality === 'OES' ? 1 : 2,
          description: quality === 'OES' 
            ? 'Pièces de qualité équivalente à l\'origine'
            : 'Pièces aftermarket de qualité contrôlée'
        }
      });
    });

    // 🚀 AMÉLIORATION : Vérification échanges standard
    const { data: hasConsigne } = await this.client
      .from('pieces_relation_type')
      .select(`
        pieces!inner (
          pieces_price!inner (
            pri_consigne_ttc
          )
        )
      `)
      .eq('rtp_type_id', typeId)
      .eq('rtp_pg_id', pgId)
      .gt('pieces.pieces_price.pri_consigne_ttc', 0)
      .limit(1);

    if (hasConsigne && hasConsigne.length > 0) {
      // Compter le nombre de pièces en échange standard
      const { count } = await this.client
        .from('pieces_relation_type')
        .select('*', { count: 'exact', head: true })
        .eq('rtp_type_id', typeId)
        .eq('rtp_pg_id', pgId)
        .gt('pieces.pieces_price.pri_consigne_ttc', 0);

      qualities.push({
        id: 'echange-standard',
        value: 'echange-standard',
        label: 'Échange Standard',
        count: count || 0,
        metadata: {
          type: 'exchange_program',
          priority: 3,
          description: 'Pièces disponibles en échange standard avec consigne'
        }
      });
    }

    return qualities.sort((a, b) => (a.metadata.priority || 0) - (b.metadata.priority || 0));
  }

  /**
   * 🌟 AMÉLIORATION : Filtres étoiles avec affichage enrichi
   */
  private async getStarsFilters(pgId: number, typeId: number): Promise<FilterOption[]> {
    const { data } = await this.client
      .rpc('get_stars_filters', {
        p_pg_id: pgId,
        p_type_id: typeId
      });

    return data?.map((item: any) => ({
      id: `st${item.pm_nb_stars}ars`,
      value: `st${item.pm_nb_stars}ars`,
      label: this.generateStarsDisplay(item.pm_nb_stars),
      count: item.count || 0,
      metadata: {
        stars: item.pm_nb_stars,
        starsDisplay: '★'.repeat(item.pm_nb_stars) + '☆'.repeat(5 - item.pm_nb_stars),
        category: 'performance_rating',
        numericValue: item.pm_nb_stars
      }
    })).sort((a: any, b: any) => b.metadata.stars - a.metadata.stars) || [];
  }

  /**
   * 🏭 AMÉLIORATION : Filtres fabricants avec logos et métadonnées
   */
  private async getManufacturerFilters(pgId: number, typeId: number): Promise<FilterOption[]> {
    const { data } = await this.client
      .from('pieces_relation_type')
      .select(`
        pieces_marque!inner (
          pm_id,
          pm_name,
          pm_alias,
          pm_logo,
          pm_sort,
          pm_country,
          pm_website,
          pm_quality
        )
      `)
      .eq('rtp_type_id', typeId)
      .eq('rtp_pg_id', pgId)
      .eq('pieces_marque.pm_display', true)
      .order('pieces_marque.pm_sort');

    const uniqueMap = new Map();
    const counts = new Map();

    data?.forEach((item: any) => {
      const manufacturer = item.pieces_marque;
      if (manufacturer) {
        const key = manufacturer.pm_id;
        
        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, {
            id: manufacturer.pm_id,
            value: manufacturer.pm_alias || manufacturer.pm_name.toLowerCase(),
            label: manufacturer.pm_name,
            count: 0,
            metadata: {
              logo: manufacturer.pm_logo,
              country: manufacturer.pm_country,
              website: manufacturer.pm_website,
              quality: manufacturer.pm_quality,
              sort: manufacturer.pm_sort,
              category: 'manufacturer'
            }
          });
        }
        
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    });

    // Mise à jour des compteurs
    uniqueMap.forEach((filter, key) => {
      filter.count = counts.get(key) || 0;
    });

    return Array.from(uniqueMap.values())
      .sort((a: any, b: any) => b.count - a.count); // Tri par popularité
  }

  /**
   * 💰 NOUVEAU : Filtre de gamme de prix intelligent
   */
  private async getPriceRangeFilter(pgId: number, typeId: number): Promise<FilterOption[]> {
    const { data } = await this.client
      .from('pieces_relation_type')
      .select(`
        pieces!inner (
          pieces_price!inner (
            pri_vente_ttc
          )
        )
      `)
      .eq('rtp_type_id', typeId)
      .eq('rtp_pg_id', pgId)
      .not('pieces.pieces_price.pri_vente_ttc', 'is', null)
      .order('pieces.pieces_price.pri_vente_ttc');

    if (!data || data.length === 0) return [];

    const prices = data.map((item: any) => item.pieces.pieces_price.pri_vente_ttc).filter(p => p > 0);
    
    if (prices.length === 0) return [];

    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceStep = (maxPrice - minPrice) / 4; // 4 tranches

    const priceRanges = [
      { min: minPrice, max: minPrice + priceStep, label: `${minPrice.toFixed(2)}€ - ${(minPrice + priceStep).toFixed(2)}€` },
      { min: minPrice + priceStep, max: minPrice + 2 * priceStep, label: `${(minPrice + priceStep).toFixed(2)}€ - ${(minPrice + 2 * priceStep).toFixed(2)}€` },
      { min: minPrice + 2 * priceStep, max: minPrice + 3 * priceStep, label: `${(minPrice + 2 * priceStep).toFixed(2)}€ - ${(minPrice + 3 * priceStep).toFixed(2)}€` },
      { min: minPrice + 3 * priceStep, max: maxPrice, label: `${(minPrice + 3 * priceStep).toFixed(2)}€ - ${maxPrice.toFixed(2)}€` }
    ];

    return priceRanges.map((range, index) => ({
      id: `price-range-${index}`,
      value: `${range.min}-${range.max}`,
      label: range.label,
      count: prices.filter(p => p >= range.min && p <= range.max).length,
      metadata: {
        min: range.min,
        max: range.max,
        category: 'price_range',
        step: index
      }
    }));
  }

  /**
   * 📦 NOUVEAU : Filtres de disponibilité
   */
  private async getAvailabilityFilters(pgId: number, typeId: number): Promise<FilterOption[]> {
    const { data: stockData } = await this.client
      .from('pieces_relation_type')
      .select(`
        pieces!inner (
          pieces_price!inner (
            pri_dispo
          )
        )
      `)
      .eq('rtp_type_id', typeId)
      .eq('rtp_pg_id', pgId);

    if (!stockData) return [];

    const inStock = stockData.filter(item => item.pieces.pieces_price.pri_dispo === true).length;
    const onOrder = stockData.filter(item => item.pieces.pieces_price.pri_dispo === false).length;

    return [
      {
        id: 'instock',
        value: 'instock',
        label: 'En stock immédiat',
        count: inStock,
        metadata: { category: 'availability', priority: 1 }
      },
      {
        id: 'order',
        value: 'order',
        label: 'Sur commande',
        count: onOrder,
        metadata: { category: 'availability', priority: 2 }
      }
    ].filter(filter => filter.count > 0);
  }

  /**
   * 🔧 NOUVEAU : Filtres OEM / Références
   */
  private async getOEMFilters(pgId: number, typeId: number): Promise<FilterOption[]> {
    const { data: oemData } = await this.client
      .from('pieces_relation_type')
      .select(`
        pieces!inner (
          piece_has_oem
        )
      `)
      .eq('rtp_type_id', typeId)
      .eq('rtp_pg_id', pgId);

    if (!oemData) return [];

    const hasOEM = oemData.filter(item => item.pieces.piece_has_oem === true).length;

    return hasOEM > 0 ? [{
      id: 'has-oem',
      value: 'true',
      label: 'Avec références OEM',
      count: hasOEM,
      metadata: { category: 'reference_type', priority: 1 }
    }] : [];
  }

  /**
   * 🎯 CŒUR DU SYSTÈME : Application des filtres et récupération des produits
   */
  private async applyFiltersAndGetProducts(options: FilterOptionsInput): Promise<{
    products: EnhancedProduct[];
    pagination: ProductFilterResult['pagination'];
  }> {
    const { pgId, typeId, filters = {}, pagination = { page: 1, limit: 50 }, sorting = { field: 'name', order: 'asc' } } = options;

    // Construction de la requête de base
    let query = this.client
      .from('pieces_relation_type')
      .select(`
        rtp_id,
        pieces!inner (
          piece_id,
          piece_ref,
          piece_ref_clean,
          piece_name,
          piece_des,
          piece_qty_sale,
          piece_qty_pack,
          piece_has_img,
          piece_has_oem,
          piece_fil_id,
          piece_fil_name,
          piece_name_side,
          piece_name_comp,
          pieces_marque!inner (
            pm_id,
            pm_name,
            pm_alias,
            pm_logo,
            pm_quality,
            pm_oes,
            pm_nb_stars,
            pm_country
          ),
          pieces_price!inner (
            pri_vente_ttc,
            pri_vente_ht,
            pri_consigne_ttc,
            pri_dispo
          ),
          pieces_media_img (
            pmi_folder,
            pmi_name
          ),
          pieces_criteria (
            pc_cri_value,
            pieces_criteria_link (
              pcl_cri_criteria,
              pcl_cri_unit,
              pcl_level,
              pcl_sort
            )
          )
        ),
        pieces_side_filtre (
          psf_id,
          psf_side
        )
      `, { count: 'exact' })
      .eq('rtp_type_id', typeId)
      .eq('rtp_pg_id', pgId)
      .eq('pieces.piece_display', true)
      .eq('pieces.pieces_price.pri_dispo', true);

    // 🚀 AMÉLIORATION : Application des filtres avec logique métier avancée
    
    // Filtre gamme de produits
    if (filters.gammeProduct && filters.gammeProduct.length > 0) {
      const gammeIds = await this.resolveGammeProductIds(filters.gammeProduct);
      if (gammeIds.length > 0) {
        query = query.in('pieces.piece_fil_id', gammeIds);
      }
    }

    // Filtre critères techniques (side)
    if (filters.criteria && filters.criteria.length > 0) {
      const criteriaIds = await this.resolveCriteriaIds(filters.criteria);
      if (criteriaIds.length > 0) {
        query = query.in('rtp_psf_id', criteriaIds);
      }
    }

    // Filtre qualité
    if (filters.quality && filters.quality.length > 0) {
      const qualityConditions = [];
      
      if (filters.quality.includes('oes')) {
        qualityConditions.push('pieces.pieces_marque.pm_oes.neq.A');
      }
      if (filters.quality.includes('aftermarket')) {
        qualityConditions.push('pieces.pieces_marque.pm_oes.eq.A');
      }
      if (filters.quality.includes('echange-standard')) {
        query = query.gt('pieces.pieces_price.pri_consigne_ttc', 0);
      }
    }

    // Filtre étoiles
    if (filters.stars && filters.stars.length > 0) {
      const starsValues = filters.stars.map(s => parseInt(s.replace('st', '').replace('ars', '')));
      query = query.in('pieces.pieces_marque.pm_nb_stars', starsValues);
    }

    // Filtre fabricants
    if (filters.manufacturer && filters.manufacturer.length > 0) {
      const manufacturerIds = await this.resolveManufacturerIds(filters.manufacturer);
      if (manufacturerIds.length > 0) {
        query = query.in('pieces.pieces_marque.pm_id', manufacturerIds);
      }
    }

    // Filtre prix
    if (filters.priceRange) {
      if (filters.priceRange.min) {
        query = query.gte('pieces.pieces_price.pri_vente_ttc', filters.priceRange.min);
      }
      if (filters.priceRange.max) {
        query = query.lte('pieces.pieces_price.pri_vente_ttc', filters.priceRange.max);
      }
    }

    // Filtre disponibilité
    if (filters.availability && filters.availability !== 'all') {
      if (filters.availability === 'instock') {
        query = query.eq('pieces.pieces_price.pri_dispo', true);
      } else if (filters.availability === 'order') {
        query = query.eq('pieces.pieces_price.pri_dispo', false);
      }
    }

    // Filtre OEM
    if (filters.oem === true) {
      query = query.eq('pieces.piece_has_oem', true);
    }

    // 🎯 Tri intelligent
    switch (sorting.field) {
      case 'price':
        query = query.order('pieces.pieces_price.pri_vente_ttc', { ascending: sorting.order === 'asc' });
        break;
      case 'brand':
        query = query.order('pieces.pieces_marque.pm_name', { ascending: sorting.order === 'asc' });
        break;
      case 'stars':
        query = query.order('pieces.pieces_marque.pm_nb_stars', { ascending: sorting.order === 'asc' });
        break;
      case 'popularity':
        query = query.order('pieces.pieces_marque.pm_nb_stars', { ascending: false })
                   .order('pieces.pieces_price.pri_vente_ttc', { ascending: true });
        break;
      default: // name
        query = query.order('pieces.piece_name', { ascending: sorting.order === 'asc' });
    }

    // Pagination
    const offset = (pagination.page - 1) * pagination.limit;
    query = query.range(offset, offset + pagination.limit - 1);

    const { data, error, count } = await query;

    if (error) {
      this.logger.error('Erreur requête produits filtrés:', error);
      throw error;
    }

    // 🎨 Transformation en produits enrichis
    const enhancedProducts = this.transformToEnhancedProducts(data || []);

    // Calcul pagination
    const total = count || 0;
    const totalPages = Math.ceil(total / pagination.limit);

    return {
      products: enhancedProducts,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages,
        hasNext: pagination.page < totalPages,
        hasPrev: pagination.page > 1
      }
    };
  }

  /**
   * 🎨 Transformation des données brutes en produits enrichis
   */
  private transformToEnhancedProducts(rawData: any[]): EnhancedProduct[] {
    return rawData.map((item: any) => {
      const piece = item.pieces;
      const manufacturer = piece.pieces_marque;
      const price = piece.pieces_price;
      const criteria = piece.pieces_criteria || [];
      const side = item.pieces_side_filtre;

      return {
        id: piece.piece_id,
        name: piece.piece_name || `Pièce ${piece.piece_id}`,
        reference: piece.piece_ref || `REF-${piece.piece_id}`,
        referenceClean: piece.piece_ref_clean,
        description: piece.piece_des,
        hasImage: piece.piece_has_img || false,
        hasOEM: piece.piece_has_oem || false,
        
        price: {
          ttc: price.pri_vente_ttc || 0,
          ht: price.pri_vente_ht,
          consigne: price.pri_consigne_ttc || 0,
          formatted: `${(price.pri_vente_ttc || 0).toFixed(2)}€`,
          currency: 'EUR'
        },
        
        manufacturer: {
          id: manufacturer.pm_id,
          name: manufacturer.pm_name,
          alias: manufacturer.pm_alias || manufacturer.pm_name.toLowerCase(),
          logo: manufacturer.pm_logo,
          quality: manufacturer.pm_oes === 'A' ? 'AFTERMARKET' : 'OES',
          stars: manufacturer.pm_nb_stars || 0,
          country: manufacturer.pm_country
        },
        
        technical: {
          side: side?.psf_side,
          category: piece.piece_fil_name,
          criteria: criteria.map((c: any) => ({
            type: c.pieces_criteria_link?.pcl_cri_criteria || 'N/A',
            value: c.pc_cri_value,
            unit: c.pieces_criteria_link?.pcl_cri_unit
          }))
        },
        
        availability: {
          inStock: price.pri_dispo || false,
          status: price.pri_dispo ? 'available' : 'order'
        },
        
        metadata: {
          slug: this.createAlias(`${piece.piece_name}-${piece.piece_ref}`),
          popularity: manufacturer.pm_nb_stars || 0,
          isTopProduct: manufacturer.pm_nb_stars >= 4,
          isPromotion: price.pri_consigne_ttc > 0,
          tags: [
            manufacturer.pm_quality,
            side?.psf_side,
            piece.piece_fil_name
          ].filter(Boolean)
        }
      };
    });
  }

  /**
   * 📊 Génération de statistiques enrichies
   */
  private generateProductStats(products: EnhancedProduct[]): ProductFilterResult['stats'] {
    if (products.length === 0) {
      return {
        totalProducts: 0,
        averagePrice: 0,
        priceRange: { min: 0, max: 0 },
        topManufacturers: [],
        qualityDistribution: {}
      };
    }

    const prices = products.map(p => p.price.ttc).filter(p => p > 0);
    const manufacturerCounts = new Map<string, number>();
    const qualityDistribution: Record<string, number> = {};

    products.forEach(product => {
      // Comptage fabricants
      const manufacturerName = product.manufacturer.name;
      manufacturerCounts.set(manufacturerName, (manufacturerCounts.get(manufacturerName) || 0) + 1);
      
      // Distribution qualité
      const quality = product.manufacturer.quality;
      qualityDistribution[quality] = (qualityDistribution[quality] || 0) + 1;
    });

    // Top 5 fabricants
    const topManufacturers = Array.from(manufacturerCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    return {
      totalProducts: products.length,
      averagePrice: prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0,
      priceRange: {
        min: prices.length > 0 ? Math.min(...prices) : 0,
        max: prices.length > 0 ? Math.max(...prices) : 0
      },
      topManufacturers,
      qualityDistribution
    };
  }

  /**
   * 🧠 NOUVEAU : Génération de filtres suggérés basés sur les sélections
   */
  private generateSuggestedFilters(availableFilters: FilterGroup[], options: FilterOptionsInput): FilterGroup[] {
    const suggestedFilters: FilterGroup[] = [];
    const appliedFilters = this.extractAppliedFilters(options);

    // Logique de suggestion intelligente
    if (appliedFilters.includes('manufacturer') && !appliedFilters.includes('stars')) {
      const starsFilter = availableFilters.find(f => f.name === 'stars');
      if (starsFilter) {
        suggestedFilters.push({
          ...starsFilter,
          label: 'Performance recommandée'
        });
      }
    }

    if (appliedFilters.includes('quality') && !appliedFilters.includes('priceRange')) {
      const priceFilter = availableFilters.find(f => f.name === 'priceRange');
      if (priceFilter) {
        suggestedFilters.push({
          ...priceFilter,
          label: 'Gamme de prix suggérée'
        });
      }
    }

    return suggestedFilters;
  }

  // 🔧 MÉTHODES UTILITAIRES

  private extractAppliedFilters(options: FilterOptionsInput): string[] {
    const applied: string[] = [];
    const filters = options.filters || {};

    Object.entries(filters).forEach(([key, value]) => {
      if (Array.isArray(value) && value.length > 0) {
        applied.push(key);
      } else if (typeof value === 'object' && value !== null) {
        applied.push(key);
      } else if (typeof value === 'boolean' && value) {
        applied.push(key);
      }
    });

    return applied;
  }

  private generateCacheKey(type: string, data: any): string {
    return `${type}_${JSON.stringify(data)}`.replace(/\s+/g, '');
  }

  private createAlias(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-');
  }

  private generateStarsDisplay(stars: number): string {
    const fullStars = '★'.repeat(stars);
    const emptyStars = '☆'.repeat(5 - stars);
    return `${fullStars}${emptyStars} (${stars}/5)`;
  }

  // Méthodes de résolution des IDs
  private async resolveGammeProductIds(aliases: string[]): Promise<number[]> {
    // Implémentation pour résoudre les aliases en IDs
    return []; // TODO: Implémenter
  }

  private async resolveCriteriaIds(aliases: string[]): Promise<number[]> {
    // Implémentation pour résoudre les aliases en IDs
    return []; // TODO: Implémenter
  }

  private async resolveManufacturerIds(aliases: string[]): Promise<number[]> {
    // Implémentation pour résoudre les aliases en IDs
    return []; // TODO: Implémenter
  }

  /**
   * 🧹 Nettoyage du cache
   */
  public invalidateCache(): void {
    this.filtersCache.clear();
    this.productsCache.clear();
    this.logger.log('🧹 [ProductFilter V4] Cache nettoyé');
  }
}