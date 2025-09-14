import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { SupabaseBaseService } from '../../database/services/supabase-base.service';
import { VehicleCacheService, CacheType } from '../vehicles/services/core/vehicle-cache.service';
import { VehicleTypesService } from '../vehicles/services/data/vehicle-types.service';
import { MetadataService } from '../config/services/metadata.service';
import { 
  VehicleType, 
  VehicleBrand, 
  VehicleModel,
  VehicleResponse 
} from '../vehicles/types/vehicle.types';

// ========================================
// 🔍 VALIDATION SCHEMAS ZOD
// ========================================

const VehicleCatalogParamsSchema = z.object({
  brandSlug: z.string().min(1, 'brandSlug est obligatoire'),
  modelSlug: z.string().min(1, 'modelSlug est obligatoire'), 
  typeSlug: z.string().min(1, 'typeSlug est obligatoire'),
});

const PopularPartsParamsSchema = z.object({
  vehicleTypeId: z.string().min(1, 'vehicleTypeId est obligatoire'),
  limit: z.number().min(1).max(100).optional().default(20),
});

const MineSearchParamsSchema = z.object({
  mineType: z.string().min(1, 'mineType est obligatoire'),
});

// ========================================
// 🏗️ INTERFACES ET TYPES
// ========================================

interface VehicleCatalogData {
  vehicle: VehicleWithRelations;
  categories: CategoryWithSubcategories[];
  breadcrumbs: BreadcrumbItem[];
  metadata: VehicleMetadata;
  analytics: CatalogAnalytics;
}

interface VehicleWithRelations extends VehicleType {
  model: VehicleModel & {
    brand: VehicleBrand;
  };
}

interface CategoryWithSubcategories {
  id: number;
  name: string;
  slug: string;
  description?: string;
  subcategories: Array<{
    id: number;
    name: string;
    slug: string;
    description?: string;
  }>;
}

interface BreadcrumbItem {
  label: string;
  path: string;
  position: number;
}

interface VehicleMetadata {
  title: string;
  description: string;
  keywords: string[];
  ogTitle: string;
  ogDescription: string;
  ogImage?: string;
  schemaMarkup: Record<string, any>;
  canonicalUrl?: string;
}

interface CatalogAnalytics {
  vehicleViews: number;
  popularCategories: string[];
  recommendedParts: number;
  cacheStatus: {
    vehicle: boolean;
    categories: boolean;
    metadata: boolean;
  };
}

type VehicleCatalogParams = z.infer<typeof VehicleCatalogParamsSchema>;
type PopularPartsParams = z.infer<typeof PopularPartsParamsSchema>;
type MineSearchParams = z.infer<typeof MineSearchParamsSchema>;

// ========================================
// 🚗 ENHANCED VEHICLE CATALOG SERVICE
// ========================================

/**
 * 🚗 ENHANCED VEHICLE CATALOG SERVICE - Service Catalogue Véhicule Modernisé
 * 
 * ✅ ARCHITECTURE MODULAIRE INTÉGRÉE
 * 
 * 🏗️ Utilise l'architecture vehicle existante :
 * - VehicleTypesService : Gestion des types/motorisations
 * - VehicleCacheService : Cache TTL intelligent
 * - MetadataService : Génération métadonnées SEO
 * 
 * 🔍 Fonctionnalités avancées :
 * - Validation Zod des paramètres
 * - Cache TTL avec invalidation intelligente
 * - Gestion d'erreurs structurée
 * - Logging complet avec analytics
 * - Métadonnées SEO optimisées
 * 
 * 🎯 API REST endpoints :
 * - getVehicleCatalog() : Données complètes catalogue
 * - getPopularParts() : Pièces populaires par véhicule
 * - searchByMineType() : Recherche par type mine
 */
@Injectable()
export class EnhancedVehicleCatalogService extends SupabaseBaseService {
  protected readonly logger = new Logger(EnhancedVehicleCatalogService.name);
  
  private readonly analytics = {
    catalogRequests: 0,
    cacheHits: 0,
    cacheMisses: 0,
    errorCount: 0,
    avgResponseTime: 0,
  };

  constructor(
    private readonly cacheService: VehicleCacheService,
    private readonly vehicleTypesService: VehicleTypesService,
    private readonly metadataService: MetadataService,
  ) {
    super();
    this.logger.log('🚗 EnhancedVehicleCatalogService initialisé avec architecture modulaire');
  }

  // =====================================================
  // 🔍 MÉTHODE PRINCIPALE - CATALOGUE VÉHICULE
  // =====================================================

  /**
   * 🚗 Récupérer les données complètes pour la page catalogue véhicule
   * ✅ Validation Zod + Cache TTL + Gestion erreurs + Analytics
   */
  async getVehicleCatalog(params: VehicleCatalogParams): Promise<VehicleCatalogData> {
    const startTime = Date.now();
    this.analytics.catalogRequests++;

    try {
      // 1. Validation des paramètres avec Zod
      const validatedParams = VehicleCatalogParamsSchema.parse(params);
      const { brandSlug, modelSlug, typeSlug } = validatedParams;

      this.logger.log(`🔍 Récupération catalogue: ${brandSlug}/${modelSlug}/${typeSlug}`);

      // 2. Vérification cache
      const cacheKey = `catalog:${brandSlug}:${modelSlug}:${typeSlug}`;
      const cached = await this.cacheService.get(cacheKey, CacheType.VEHICLE_CATALOG);
      
      if (cached) {
        this.analytics.cacheHits++;
        this.logger.debug(`✅ Cache hit pour ${cacheKey}`);
        return cached;
      }

      this.analytics.cacheMisses++;
      this.logger.debug(`❌ Cache miss pour ${cacheKey}`);

      // 3. Récupération véhicule avec relations
      const vehicle = await this.getVehicleWithRelations(brandSlug, modelSlug, typeSlug);
      
      if (!vehicle) {
        throw new NotFoundException(`Véhicule non trouvé: ${brandSlug}/${modelSlug}/${typeSlug}`);
      }

      // 4. Récupération des catégories compatibles en parallèle
      const [categories, metadata] = await Promise.all([
        this.getCompatibleCategories(vehicle.id),
        this.generateVehicleMetadata(vehicle),
      ]);

      // 5. Génération des breadcrumbs
      const breadcrumbs = this.generateBreadcrumbs(vehicle, brandSlug, modelSlug);

      // 6. Analytics du catalogue
      const analytics = await this.generateCatalogAnalytics(vehicle.id);

      // 7. Construction de la réponse
      const catalogData: VehicleCatalogData = {
        vehicle,
        categories,
        breadcrumbs,
        metadata,
        analytics,
      };

      // 8. Mise en cache (TTL: 1 heure)
      await this.cacheService.set(cacheKey, catalogData, CacheType.VEHICLE_CATALOG, 3600);

      // 9. Tracking performance
      const responseTime = Date.now() - startTime;
      this.updateAnalytics(responseTime);

      this.logger.log(`✅ Catalogue récupéré avec succès en ${responseTime}ms`);
      return catalogData;

    } catch (error) {
      this.analytics.errorCount++;
      
      if (error instanceof z.ZodError) {
        this.logger.error('❌ Erreur validation Zod:', error.errors);
        throw new BadRequestException({
          message: 'Paramètres invalides',
          errors: error.errors,
        });
      }

      if (error instanceof NotFoundException) {
        this.logger.error(`❌ Véhicule non trouvé: ${JSON.stringify(params)}`);
        throw error;
      }

      this.logger.error('❌ Erreur lors de la récupération du catalogue:', error);
      throw new BadRequestException('Erreur lors de la récupération du catalogue véhicule');
    }
  }

  // =====================================================
  // 🔧 MÉTHODES UTILITAIRES PRIVÉES
  // =====================================================

  /**
   * 🔍 Récupérer le véhicule avec toutes ses relations
   */
  private async getVehicleWithRelations(
    brandSlug: string, 
    modelSlug: string, 
    typeSlug: string
  ): Promise<VehicleWithRelations | null> {
    try {
      const { data: vehicle } = await this.getClient()
        .from('vehicle_types')
        .select(`
          *,
          model:vehicle_models(
            *,
            brand:vehicle_brands(*)
          )
        `)
        .eq('slug', typeSlug)
        .eq('model.slug', modelSlug)
        .eq('model.brand.slug', brandSlug)
        .single();

      return vehicle as VehicleWithRelations;
    } catch (error) {
      this.logger.error('❌ Erreur récupération véhicule avec relations:', error);
      return null;
    }
  }

  /**
   * 🗂️ Récupérer les catégories compatibles avec un véhicule
   */
  private async getCompatibleCategories(vehicleTypeId: number): Promise<CategoryWithSubcategories[]> {
    try {
      const { data: compatibilities } = await this.getClient()
        .from('vehicle_part_compatibility')
        .select(`
          *,
          category:part_categories(*),
          subcategory:part_subcategories(*)
        `)
        .eq('vehicle_type_id', vehicleTypeId)
        .eq('is_compatible', true);

      if (!compatibilities) return [];

      // Grouper par catégorie avec Map pour performance
      const categoriesMap = new Map<number, CategoryWithSubcategories>();
      
      compatibilities.forEach(comp => {
        if (!comp.category) return;

        if (!categoriesMap.has(comp.category.id)) {
          categoriesMap.set(comp.category.id, {
            id: comp.category.id,
            name: comp.category.name,
            slug: comp.category.slug,
            description: comp.category.description,
            subcategories: [],
          });
        }

        if (comp.subcategory) {
          const category = categoriesMap.get(comp.category.id)!;
          category.subcategories.push({
            id: comp.subcategory.id,
            name: comp.subcategory.name,
            slug: comp.subcategory.slug,
            description: comp.subcategory.description,
          });
        }
      });

      return Array.from(categoriesMap.values());
    } catch (error) {
      this.logger.error('❌ Erreur récupération catégories compatibles:', error);
      return [];
    }
  }

  /**
   * 🍞 Générer les breadcrumbs pour la navigation
   */
  private generateBreadcrumbs(
    vehicle: VehicleWithRelations, 
    brandSlug: string, 
    modelSlug: string
  ): BreadcrumbItem[] {
    return [
      { 
        label: 'Automecanik', 
        path: '/', 
        position: 1 
      },
      { 
        label: vehicle.model.brand.name, 
        path: `/constructeurs/${brandSlug}`, 
        position: 2 
      },
      { 
        label: `${vehicle.model.name} ${vehicle.name}`, 
        path: '#', 
        position: 3 
      },
    ];
  }

  /**
   * 📊 Générer les métadonnées SEO optimisées
   */
  private async generateVehicleMetadata(vehicle: VehicleWithRelations): Promise<VehicleMetadata> {
    try {
      const brandName = vehicle.model.brand.name;
      const modelName = vehicle.model.name;
      const typeName = vehicle.name;
      const fullName = `${brandName} ${modelName} ${typeName}`;
      const power = vehicle.power || vehicle.powerKw || '';

      // Utiliser le MetadataService pour une génération cohérente
      const baseMetadata = await this.metadataService.generateVehicleMetadata({
        brandName,
        modelName,
        typeName,
        power,
        yearFrom: vehicle.yearFrom,
        yearTo: vehicle.yearTo,
        fuel: vehicle.fuel,
      });

      return {
        title: `Pièces ${fullName} acheter avec le meilleur prix`,
        description: `Catalogue pièces détachées pour ${fullName} ${power} neuves pas cher et changer si défectueux`,
        keywords: [brandName, modelName, typeName, power, 'pièces détachées', 'automobile'].filter(Boolean),
        ogTitle: `Pièces ${fullName} - Automecanik`,
        ogDescription: `Trouvez toutes les pièces détachées pour votre ${fullName}`,
        ogImage: `/images/vehicles/${vehicle.model.brand.code}/${vehicle.model.name}.jpg`,
        canonicalUrl: `/pieces/${vehicle.model.brand.code}/${vehicle.model.name}/${vehicle.name}`,
        schemaMarkup: {
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: `Pièces détachées ${fullName}`,
          brand: {
            '@type': 'Brand',
            name: brandName,
          },
          category: 'Pièces automobiles',
          offers: {
            '@type': 'AggregateOffer',
            priceCurrency: 'EUR',
            availability: 'https://schema.org/InStock',
          },
          ...baseMetadata.schemaMarkup,
        },
      };
    } catch (error) {
      this.logger.error('❌ Erreur génération métadonnées:', error);
      // Métadonnées par défaut en cas d'erreur
      return {
        title: 'Pièces détachées automobile',
        description: 'Catalogue de pièces détachées automobiles',
        keywords: ['pièces détachées', 'automobile'],
        ogTitle: 'Pièces détachées - Automecanik',
        ogDescription: 'Catalogue de pièces détachées automobiles',
        schemaMarkup: {},
      };
    }
  }

  /**
   * 📈 Générer les analytics du catalogue
   */
  private async generateCatalogAnalytics(vehicleTypeId: number): Promise<CatalogAnalytics> {
    try {
      // Simulation des analytics - à remplacer par vraies données
      return {
        vehicleViews: Math.floor(Math.random() * 1000) + 100,
        popularCategories: ['Freinage', 'Moteur', 'Suspension', 'Échappement'],
        recommendedParts: Math.floor(Math.random() * 50) + 10,
        cacheStatus: {
          vehicle: true,
          categories: true,
          metadata: true,
        },
      };
    } catch (error) {
      this.logger.error('❌ Erreur génération analytics:', error);
      return {
        vehicleViews: 0,
        popularCategories: [],
        recommendedParts: 0,
        cacheStatus: {
          vehicle: false,
          categories: false,
          metadata: false,
        },
      };
    }
  }

  // =====================================================
  // 🔍 MÉTHODES PUBLIQUES SUPPLÉMENTAIRES
  // =====================================================

  /**
   * 🔥 Récupérer les pièces populaires pour un véhicule
   * ✅ Validation Zod + Cache + Gestion erreurs
   */
  async getPopularParts(params: PopularPartsParams): Promise<any[]> {
    try {
      const validatedParams = PopularPartsParamsSchema.parse(params);
      const { vehicleTypeId, limit } = validatedParams;

      this.logger.log(`🔥 Récupération pièces populaires: vehicleTypeId=${vehicleTypeId}, limit=${limit}`);

      // Cache check
      const cacheKey = `popular_parts:${vehicleTypeId}:${limit}`;
      const cached = await this.cacheService.get(cacheKey, CacheType.PARTS);
      
      if (cached) {
        this.logger.debug(`✅ Cache hit pour pièces populaires ${vehicleTypeId}`);
        return cached;
      }

      const { data } = await this.getClient()
        .from('vehicle_part_compatibility')
        .select(`
          category:part_categories(*),
          subcategory:part_subcategories(*)
        `)
        .eq('vehicle_type_id', vehicleTypeId)
        .eq('is_compatible', true)
        .limit(limit);

      const result = data || [];
      
      // Cache pour 30 minutes
      await this.cacheService.set(cacheKey, result, CacheType.PARTS, 1800);

      this.logger.log(`✅ ${result.length} pièces populaires récupérées`);
      return result;

    } catch (error) {
      if (error instanceof z.ZodError) {
        this.logger.error('❌ Erreur validation pièces populaires:', error.errors);
        throw new BadRequestException({
          message: 'Paramètres invalides',
          errors: error.errors,
        });
      }

      this.logger.error('❌ Erreur récupération pièces populaires:', error);
      throw new BadRequestException('Erreur lors de la récupération des pièces populaires');
    }
  }

  /**
   * 🔍 Recherche par type mine avec validation
   * ✅ Validation Zod + Cache + Gestion erreurs
   */
  async searchByMineType(params: MineSearchParams): Promise<VehicleWithRelations> {
    try {
      const validatedParams = MineSearchParamsSchema.parse(params);
      const { mineType } = validatedParams;

      this.logger.log(`🔍 Recherche par type mine: ${mineType}`);

      // Cache check
      const cacheKey = `mine_search:${mineType.toUpperCase()}`;
      const cached = await this.cacheService.get(cacheKey, CacheType.SEARCH);
      
      if (cached) {
        this.logger.debug(`✅ Cache hit pour recherche mine ${mineType}`);
        return cached;
      }

      const { data } = await this.getClient()
        .from('vehicle_types')
        .select(`
          *,
          model:vehicle_models(
            *,
            brand:vehicle_brands(*)
          )
        `)
        .eq('mine_type', mineType.toUpperCase())
        .single();

      if (!data) {
        throw new NotFoundException(`Aucun véhicule trouvé avec le type mine: ${mineType}`);
      }

      const result = data as VehicleWithRelations;
      
      // Cache pour 1 heure
      await this.cacheService.set(cacheKey, result, CacheType.SEARCH, 3600);

      this.logger.log(`✅ Véhicule trouvé par type mine: ${result.model.brand.name} ${result.model.name} ${result.name}`);
      return result;

    } catch (error) {
      if (error instanceof z.ZodError) {
        this.logger.error('❌ Erreur validation type mine:', error.errors);
        throw new BadRequestException({
          message: 'Paramètres invalides',
          errors: error.errors,
        });
      }

      if (error instanceof NotFoundException) {
        this.logger.error(`❌ Type mine non trouvé: ${params.mineType}`);
        throw error;
      }

      this.logger.error('❌ Erreur recherche par type mine:', error);
      throw new BadRequestException('Erreur lors de la recherche par type mine');
    }
  }

  // =====================================================
  // 📊 MÉTHODES ANALYTICS ET MONITORING
  // =====================================================

  /**
   * 📊 Mettre à jour les analytics de performance
   */
  private updateAnalytics(responseTime: number): void {
    this.analytics.avgResponseTime = 
      (this.analytics.avgResponseTime + responseTime) / 2;
  }

  /**
   * 📈 Récupérer les statistiques du service
   */
  getServiceStats() {
    return {
      ...this.analytics,
      cacheHitRate: this.analytics.cacheHits / (this.analytics.cacheHits + this.analytics.cacheMisses) * 100,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 🧹 Nettoyer le cache du service
   */
  async clearServiceCache(): Promise<void> {
    try {
      await this.cacheService.clear(CacheType.VEHICLE_CATALOG);
      await this.cacheService.clear(CacheType.PARTS);
      await this.cacheService.clear(CacheType.SEARCH);
      
      this.logger.log('✅ Cache du service nettoyé avec succès');
    } catch (error) {
      this.logger.error('❌ Erreur nettoyage cache service:', error);
      throw new BadRequestException('Erreur lors du nettoyage du cache');
    }
  }
}