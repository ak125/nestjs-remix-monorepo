import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '../../database/services/supabase-base.service';
// 📁 backend/src/modules/catalog/catalog.service.ts
// 🏗️ Service principal pour le catalogue - Orchestrateur des données

// import { GammeService } from './services/gamme.service'; // TEMPORAIREMENT DÉSACTIVÉ - dépendance VehicleCacheService
import { SupplierDto, SuppliersResponseDto } from './dtos/suppliers.dto';
import {
  PopularProductDto,
  PopularProductsResponseDto,
} from './dtos/popular-products.dto';
import {
  FamilyWithGammesDto,
  GammeDto,
  CatalogHierarchyResponseDto,
} from './dtos/catalog-hierarchy.dto';
import { CatalogGammeService } from './services/catalog-gamme.service';
import { AutomobileService, CatalogFamily, ProductGamme, EquipmentBrand, CarBrand } from './automobile.service';

// ========================================
// 📊 INTERFACES ÉTENDUES
// ========================================

export interface CatalogItem {
  id: number;
  code: string;
  name: string;
  description?: string;
  image_url?: string;
  piece_count?: number;
  is_featured?: boolean;
}

export interface HomeCatalogData {
  mainCategories: CatalogItem[];
  featuredCategories: CatalogItem[];
  quickAccess: any[];
  stats: {
    total_categories: number;
    total_pieces: number;
    featured_count: number;
  };
}

@Injectable()
export class CatalogService extends SupabaseBaseService implements OnModuleInit {
  protected readonly logger = new Logger(CatalogService.name);
  
  // 🗄️ Cache intelligent pour performance
  private catalogCache: Map<string, any> = new Map();
  private readonly CACHE_TTL = 3600000; // 1 heure

  constructor(
    protected readonly configService: ConfigService,
    private readonly automobileService: AutomobileService,
    // private readonly catalogFamilyService: CatalogFamilyService,
    // private readonly catalogGammeService: CatalogGammeService,
  ) {
    super(configService);
  }

  /**
   * 🚀 Initialisation du module - Préchargement intelligent
   */
  async onModuleInit() {
    this.logger.log('🚀 Initialisation CatalogService avec préchargement...');
    
    try {
      // Préchargement parallèle des données critiques
      await Promise.allSettled([
        this.preloadMainCategories(),
        this.preloadAutoBrands(),
        this.preloadGlobalStats()
      ]);
      
      this.logger.log('✅ Préchargement du catalogue terminé avec succès');
    } catch (error) {
      this.logger.error('❌ Erreur préchargement catalogue:', error);
    }
  }

  /**
   * 👨‍👩‍👧‍👦 Récupérer les familles de gammes (utilise catalog_family)
   */
  async getGamesFamilies() {
    this.logger.log('👨‍👩‍👧‍👦 Récupération familles de gammes via CatalogService');
    return this.catalogFamilyService.getFamiliesWithGammes();
  }

  /**
   * � Récupérer les familles avec leurs gammes (TEMPORAIREMENT DÉSACTIVÉ)
   */
  async getFamiliesWithGammes() {
    this.logger.log('⚠️ getFamiliesWithGammes temporairement désactivé');
    return {};
    // return this.catalogFamilyService.getFamiliesWithGammes();
  }

  /**
   * 🔄 Récupérer les familles du catalogue formatées en gammes (TEMPORAIREMENT DÉSACTIVÉ)
   */
  async getAllFamiliesAsGammes() {
    this.logger.log('⚠️ getAllFamiliesAsGammes temporairement désactivé');
    return {};
    // return this.catalogFamilyService.getAllFamiliesAsGammes();
  }

  /**
   * 🏠 Récupérer les familles pour la page d'accueil (réplique logique PHP)
   */
  async getHomepageFamilies(): Promise<any> {
    this.logger.log('🔄 Récupération des familles pour la homepage...');
    
    try {
      const { data, error } = await this.supabase
        .from('CATALOG_FAMILY')
        .select('*')
        .eq('MF_DISPLAY', 1)
        .order('MF_SORT');

      if (error) {
        this.logger.error('❌ Erreur lors de la récupération des familles:', error);
        throw new Error(`Erreur database: ${error.message}`);
      }

      this.logger.log(`✅ ${data?.length || 0} familles trouvées`);
      
      // Convertir en format compatible avec le frontend
      const families = this.convertFamiliesToGammes(data);
      this.logger.log(`✅ ${families.length} familles converties en gammes`);
      
      return families;
    } catch (error) {
      this.logger.error('❌ Erreur dans getHomepageFamilies:', error);
      throw error;
    }
  }

  async getPopularProducts(): Promise<PopularProductsResponseDto> {
    this.logger.log('🔄 Récupération des pièces les plus vendues...');
    
    try {
      // 🚀 Tentative avec AutomobileService (données réelles)
      try {
        const realData = await this.automobileService.getTopSellingGammes();
        if (realData && realData.length > 0) {
          this.logger.log(`✅ ${realData.length} produits populaires récupérés depuis AutomobileService`);
          
          // Conversion du format ProductGamme vers PopularProductDto
          const products: PopularProductDto[] = realData.map((gamme) => ({
            pg_id: gamme.pg_id.toString(),
            pg_alias: gamme.pg_alias || '',
            pg_name: gamme.pg_name,
            pg_name_url: gamme.pg_name_url || '',
            pg_name_meta: gamme.pg_name_meta || '',
            pg_img: gamme.pg_img || '',
            sg_title: gamme.sg_title || '',
            sg_description: gamme.sg_descrip || '',
            ba_preview: gamme.ba_preview || '',
          }));

          return {
            products,
            success: true,
          };
        }
      } catch (autoError) {
        this.logger.warn('⚠️ AutomobileService non disponible, fallback vers Supabase');
      }

      // 🔄 Fallback vers Supabase RPC
      const { data, error } = await this.supabase
        .rpc('get_popular_products_with_seo');

      if (error) {
        this.logger.error('❌ Erreur lors de la récupération des produits populaires:', error);
        throw new Error(`Erreur database: ${error.message}`);
      }

      if (data && data.length > 0) {
        this.logger.log(`✅ ${data.length} produits populaires récupérés depuis Supabase`);
        return {
          products: data,
          success: true,
        };
      }

      this.logger.log(`✅ ${data?.length || 0} produits populaires trouvés`);
      
      // 🎯 Dernier recours : données mock
      return this.getMockPopularProducts();
    } catch (error) {
      this.logger.error('❌ Erreur dans getPopularProducts:', error);
      return this.getMockPopularProducts();
    }
  }

  private getMockPopularProducts(): PopularProductsResponseDto {
    const products = [
      {
        pg_id: '1',
        pg_alias: 'filtres',
        pg_name: 'Filtres',
        pg_name_url: 'filtres',
        pg_name_meta: 'Filtres automobile',
        pg_img: 'Filtres.webp',
        sg_title: 'Filtres haute qualité pour votre véhicule',
        sg_description: 'Découvrez notre gamme complète de filtres automobiles',
        ba_preview: 'Filtres d\'origine et adaptables pour tous modèles'
      },
      {
        pg_id: '2',
        pg_alias: 'freinage',
        pg_name: 'Freinage',
        pg_name_url: 'freinage',
        pg_name_meta: 'Système de freinage',
        pg_img: 'Freinage.webp',
        sg_title: 'Système de freinage sécurisé',
        sg_description: 'Plaquettes, disques et accessoires de freinage',
        ba_preview: 'Pièces de freinage certifiées pour votre sécurité'
      },
      {
        pg_id: '3',
        pg_alias: 'courroie-galet-poulie',
        pg_name: 'Courroie, galet, poulie',
        pg_name_url: 'courroie-galet-poulie',
        pg_name_meta: 'Courroies et galets',
        pg_img: 'Courroie_galet_poulie.webp',
        sg_title: 'Transmission par courroie optimisée',
        sg_description: 'Kits de distribution et accessoires moteur',
        ba_preview: 'Qualité OEM pour la transmission de votre moteur'
      },
      {
        pg_id: '14',
        pg_alias: 'moteur',
        pg_name: 'Moteur',
        pg_name_url: 'moteur',
        pg_name_meta: 'Pièces moteur',
        pg_img: 'Moteur.webp',
        sg_title: 'Pièces moteur haute performance',
        sg_description: 'Joints, segments et pièces d\'étanchéité',
        ba_preview: 'Réparation moteur avec pièces d\'origine'
      }
    ];

    return {
      products,
      success: true,
    };
  }

  /**
   * 🏭 Récupérer les équipementiers (fournisseurs) populaires
   */
  async getSuppliers(): Promise<SuppliersResponseDto> {
    try {
      this.logger.log('🏭 Récupération des équipementiers populaires...');

      // 🚀 Tentative avec AutomobileService (données réelles)
      try {
        const realData = await this.automobileService.getTopEquipmentBrands();
        if (realData && realData.length > 0) {
          this.logger.log(`✅ ${realData.length} équipementiers récupérés depuis AutomobileService`);
          
          // Conversion du format EquipmentBrand vers SupplierDto
          const suppliers: SupplierDto[] = realData.map((brand) => ({
            pm_id: brand.pm_id,
            pm_alias: brand.pm_name?.toLowerCase().replace(/\s+/g, '-') || '',
            pm_name: brand.pm_name || '',
            pm_description: brand.pm_preview || 'Équipementier automobile de qualité',
            pm_logo: brand.pm_logo || `/upload/articles/marques-produits/logos/${brand.pm_name?.toLowerCase()}.webp`,
            pm_website: `https://www.${brand.pm_name?.toLowerCase().replace(/\s+/g, '')}.com`,
            pm_top: brand.pm_top || 1,
          }));

          return {
            suppliers,
            total: suppliers.length,
            message: 'Équipementiers récupérés depuis AutomobileService',
          };
        }
      } catch (autoError) {
        this.logger.warn('⚠️ AutomobileService non disponible, fallback vers Supabase');
      }

      // 🔄 Fallback vers Supabase RPC
      try {
        const { data, error } = await this.supabase.rpc('get_suppliers_with_top');

        if (error) {
          this.logger.error('❌ Erreur lors de la récupération des équipementiers:', error);
          this.logger.log('🔄 Utilisation des données mock pour les équipementiers');
          return this.getMockSuppliers();
        }

        if (data && data.length > 0) {
          this.logger.log(`✅ ${data.length} équipementiers récupérés depuis Supabase`);
          return {
            suppliers: data,
            total: data.length,
            message: 'Équipementiers récupérés avec succès',
          };
        }

        this.logger.log('⚠️ Aucun équipementier trouvé dans Supabase, utilisation des données mock');
        return this.getMockSuppliers();
      } catch (dbError) {
        this.logger.error('❌ Erreur database:', dbError);
        this.logger.log('🔄 Fallback vers les données mock');
        return this.getMockSuppliers();
      }
    } catch (error) {
      this.logger.error('❌ Erreur dans getSuppliers:', error);
      return this.getMockSuppliers();
    }
  }

  /**
   * 🏭 Données mock pour les équipementiers
   */
  private getMockSuppliers(): SuppliersResponseDto {
    const suppliers: SupplierDto[] = [
      {
        pm_id: 1,
        pm_alias: 'bosch',
        pm_name: 'Bosch',
        pm_description: 'Leader mondial des équipements automobiles d\'origine',
        pm_logo: '/upload/articles/marques-produits/logos/bosch.webp',
        pm_website: 'https://www.bosch.fr',
        pm_top: 1,
      },
      {
        pm_id: 2,
        pm_alias: 'valeo',
        pm_name: 'Valeo',
        pm_description: 'Équipementier innovant pour l\'automobile',
        pm_logo: '/upload/articles/marques-produits/logos/valeo.webp',
        pm_website: 'https://www.valeo.com',
        pm_top: 1,
      },
      {
        pm_id: 3,
        pm_alias: 'continental',
        pm_name: 'Continental',
        pm_description: 'Technologie automobile et pneumatiques',
        pm_logo: '/upload/articles/marques-produits/logos/continental.webp',
        pm_website: 'https://www.continental.com',
        pm_top: 1,
      },
      {
        pm_id: 4,
        pm_alias: 'febi',
        pm_name: 'Febi Bilstein',
        pm_description: 'Pièces détachées de qualité d\'origine',
        pm_logo: '/upload/articles/marques-produits/logos/febi.webp',
        pm_website: 'https://www.febi.com',
        pm_top: 1,
      },
      {
        pm_id: 5,
        pm_alias: 'skf',
        pm_name: 'SKF',
        pm_description: 'Roulements et composants de transmission',
        pm_logo: '/upload/articles/marques-produits/logos/skf.webp',
        pm_website: 'https://www.skf.com',
        pm_top: 1,
      },
      {
        pm_id: 6,
        pm_alias: 'trw',
        pm_name: 'TRW',
        pm_description: 'Systèmes de freinage et direction',
        pm_logo: '/upload/articles/marques-produits/logos/trw.webp',
        pm_website: 'https://www.trwaftermarket.com',
        pm_top: 1,
      },
    ];

    this.logger.log(`✅ Retour des données mock: ${suppliers.length} équipementiers`);

    return {
      suppliers,
      total: suppliers.length,
      message: 'Équipementiers récupérés (données mock)',
    };
  }

  /**
   * 🏗️ Récupérer la hiérarchie complète du catalogue (Familles → Gammes)
   */
  async getCatalogHierarchy(): Promise<CatalogHierarchyResponseDto> {
    try {
      this.logger.log('🏗️ Récupération de la hiérarchie complète du catalogue...');

      // Tentative de récupération depuis Supabase
      try {
        const { data, error } = await this.supabase.rpc('get_catalog_hierarchy');

        if (error) {
          this.logger.error('❌ Erreur lors de la récupération de la hiérarchie:', error);
          this.logger.log('🔄 Utilisation des données mock pour la hiérarchie');
          return this.getMockCatalogHierarchy();
        }

        if (data && data.length > 0) {
          this.logger.log(`✅ Hiérarchie récupérée depuis Supabase: ${data.length} familles`);
          return {
            families: data,
            total_families: data.length,
            total_gammes: data.reduce((sum: number, family: any) => sum + family.gammes.length, 0),
            total_products: data.reduce((sum: number, family: any) => sum + family.stats.total_products, 0),
            message: 'Hiérarchie récupérée avec succès',
          };
        }

        this.logger.log('⚠️ Aucune hiérarchie trouvée dans Supabase, utilisation des données mock');
        return this.getMockCatalogHierarchy();
      } catch (dbError) {
        this.logger.error('❌ Erreur database:', dbError);
        this.logger.log('🔄 Fallback vers les données mock');
        return this.getMockCatalogHierarchy();
      }
    } catch (error) {
      this.logger.error('❌ Erreur dans getCatalogHierarchy:', error);
      return this.getMockCatalogHierarchy();
    }
  }

  /**
   * 🏗️ Données mock pour la hiérarchie complète du catalogue
   */
  private getMockCatalogHierarchy(): CatalogHierarchyResponseDto {
    const families: FamilyWithGammesDto[] = [
      {
        mf_id: 1,
        mf_name: 'Filtres',
        mf_description: 'Le système de filtration du véhicule est conçu pour filtrer l\'air et les fluides entrant dans le moteur et dans l\'habitacle.',
        mf_pic: 'Filtres.webp',
        mf_sort: 1,
        gammes: [
          {
            pg_id: 101,
            pg_name: 'Filtre à huile',
            pg_alias: 'filtre-huile',
            pg_description: 'Filtres à huile moteur pour tous véhicules',
            pg_img: 'filtre-huile.webp',
            pg_sort: 1,
            product_count: 1250,
          },
          {
            pg_id: 102,
            pg_name: 'Filtre à air',
            pg_alias: 'filtre-air',
            pg_description: 'Filtres à air moteur et habitacle',
            pg_img: 'filtre-air.webp',
            pg_sort: 2,
            product_count: 980,
          },
          {
            pg_id: 103,
            pg_name: 'Filtre à carburant',
            pg_alias: 'filtre-carburant',
            pg_description: 'Filtres à carburant essence et diesel',
            pg_img: 'filtre-carburant.webp',
            pg_sort: 3,
            product_count: 720,
          },
        ],
        stats: {
          total_gammes: 3,
          total_products: 2950,
        },
      },
      {
        mf_id: 2,
        mf_name: 'Freinage',
        mf_description: 'Le système de freinage est l\'élément de sécurité le plus important du véhicule.',
        mf_pic: 'Freinage.webp',
        mf_sort: 2,
        gammes: [
          {
            pg_id: 201,
            pg_name: 'Plaquettes de frein',
            pg_alias: 'plaquettes-frein',
            pg_description: 'Plaquettes de frein avant et arrière',
            pg_img: 'plaquettes-frein.webp',
            pg_sort: 1,
            product_count: 1850,
          },
          {
            pg_id: 202,
            pg_name: 'Disques de frein',
            pg_alias: 'disques-frein',
            pg_description: 'Disques de frein ventilés et pleins',
            pg_img: 'disques-frein.webp',
            pg_sort: 2,
            product_count: 1420,
          },
          {
            pg_id: 203,
            pg_name: 'Étriers de frein',
            pg_alias: 'etriers-frein',
            pg_description: 'Étriers de frein et accessoires',
            pg_img: 'etriers-frein.webp',
            pg_sort: 3,
            product_count: 680,
          },
        ],
        stats: {
          total_gammes: 3,
          total_products: 3950,
        },
      },
      {
        mf_id: 3,
        mf_name: 'Moteur',
        mf_description: 'L\'étanchéité du moteur et l\'ensemble des pièces qui assurent le bon fonctionnement du moteur.',
        mf_pic: 'Moteur.webp',
        mf_sort: 3,
        gammes: [
          {
            pg_id: 301,
            pg_name: 'Joints moteur',
            pg_alias: 'joints-moteur',
            pg_description: 'Joints de culasse, carter et étanchéité',
            pg_img: 'joints-moteur.webp',
            pg_sort: 1,
            product_count: 890,
          },
          {
            pg_id: 302,
            pg_name: 'Segments moteur',
            pg_alias: 'segments-moteur',
            pg_description: 'Segments de piston et accessoires',
            pg_img: 'segments-moteur.webp',
            pg_sort: 2,
            product_count: 650,
          },
        ],
        stats: {
          total_gammes: 2,
          total_products: 1540,
        },
      },
      {
        mf_id: 4,
        mf_name: 'Transmission',
        mf_description: 'Le système de transmission assure la transmission du mouvement du moteur vers les roues.',
        mf_pic: 'Transmission.webp',
        mf_sort: 4,
        gammes: [
          {
            pg_id: 401,
            pg_name: 'Cardans',
            pg_alias: 'cardans',
            pg_description: 'Cardans complets et accessoires',
            pg_img: 'cardans.webp',
            pg_sort: 1,
            product_count: 1100,
          },
          {
            pg_id: 402,
            pg_name: 'Soufflets de cardan',
            pg_alias: 'soufflets-cardan',
            pg_description: 'Soufflets et kits de réparation',
            pg_img: 'soufflets-cardan.webp',
            pg_sort: 2,
            product_count: 450,
          },
        ],
        stats: {
          total_gammes: 2,
          total_products: 1550,
        },
      },
    ];

    const totalFamilies = families.length;
    const totalGammes = families.reduce((sum, family) => sum + family.stats.total_gammes, 0);
    const totalProducts = families.reduce((sum, family) => sum + family.stats.total_products, 0);

    this.logger.log(`✅ Retour des données mock: ${totalFamilies} familles, ${totalGammes} gammes, ${totalProducts} produits`);

    return {
      families,
      total_families: totalFamilies,
      total_gammes: totalGammes,
      total_products: totalProducts,
      message: 'Hiérarchie du catalogue récupérée (données mock)',
    };
  }

  /**
   * 🔧 Récupérer les vraies gammes de la table catalog_gamme (TEMPORAIREMENT DÉSACTIVÉ)
   */
  async getCatalogGammes() {
    this.logger.log('⚠️ getCatalogGammes temporairement désactivé');
    return { manufacturers: {}, stats: { total_gammes: 0, total_manufacturers: 0 } };
    // return this.catalogGammeService.getGammesForDisplay();
  }

  /**
   * 🔄 Récupérer les gammes combinées (familles + catalog_gamme) (TEMPORAIREMENT DÉSACTIVÉ)
   */
  async getCombinedGammes() {
    this.logger.log('⚠️ getCombinedGammes temporairement désactivé');
    
    return {
      families: {},
      catalog_gammes: { manufacturers: {}, stats: { total_gammes: 0, total_manufacturers: 0 } },
      combined_stats: {
        total_families: 0,
        total_catalog_gammes: 0,
        total_manufacturers: 0
      }
    };
    
    // try {
    //   // Récupérer les deux sources en parallèle
    //   const [familiesGammes, catalogGammes] = await Promise.all([
    //     this.catalogFamilyService.getAllFamiliesAsGammes(),
    //     this.catalogGammeService.getGammesForDisplay()
    //   ]);

    //   return {
    //     families: familiesGammes || {},
    //     catalog_gammes: catalogGammes || { manufacturers: {}, stats: { total_gammes: 0, total_manufacturers: 0 } },
    //     combined_stats: {
    //       total_families: Object.keys(familiesGammes || {}).length,
    //       total_catalog_gammes: catalogGammes?.stats?.total_gammes || 0,
    //       total_manufacturers: catalogGammes?.stats?.total_manufacturers || 0
    //     }
    //   };
    // } catch (error) {
    //   this.logger.error('❌ Erreur récupération gammes combinées:', error);
    //   return {
    //     families: {},
    //     catalog_gammes: { manufacturers: {}, stats: { total_gammes: 0, total_manufacturers: 0 } },
    //     combined_stats: { total_families: 0, total_catalog_gammes: 0, total_manufacturers: 0 }
    //   };
    // }
  }

  /**
   * 🏠 Récupère les gammes principales pour la page d'accueil
   * Version fusionnée optimisée avec cache intelligent
   */
  async getHomeCatalog(): Promise<HomeCatalogData> {
    const cacheKey = 'home_catalog_v2';
    
    // Vérifier le cache d'abord
    if (this.catalogCache.has(cacheKey)) {
      this.logger.log('🎯 Cache hit - Données homepage catalogue');
      return this.catalogCache.get(cacheKey);
    }

    try {
      this.logger.log('🏠 Génération catalogue homepage avec données réelles...');

      // Exécution parallèle optimisée  
      const [categoriesResult, statsResult, quickAccessResult] = await Promise.allSettled([
        this.getMainCategories(),
        this.getCatalogStats(), 
        this.getQuickAccessItems()
      ]);

      // Extraction sécurisée des résultats
      const mainCategories = categoriesResult.status === 'fulfilled' ? categoriesResult.value : [];
      const stats = statsResult.status === 'fulfilled' ? statsResult.value : {
        total_categories: 0,
        total_pieces: 0,
        featured_count: 0
      };
      const quickAccess = quickAccessResult.status === 'fulfilled' ? quickAccessResult.value : [];

      // Filtrage des catégories featured
      const featuredCategories = mainCategories.filter(cat => cat.is_featured);

      const result: HomeCatalogData = {
        mainCategories,
        featuredCategories,
        quickAccess,
        stats: {
          total_categories: mainCategories.length,
          total_pieces: stats.total_pieces || 0,
          featured_count: featuredCategories.length
        }
      };

      // Mise en cache avec TTL
      this.catalogCache.set(cacheKey, result);
      setTimeout(() => {
        this.catalogCache.delete(cacheKey);
        this.logger.log('♻️ Cache homepage catalogue expiré');
      }, this.CACHE_TTL);

      this.logger.log(`✅ Catalogue homepage: ${mainCategories.length} catégories, ${featuredCategories.length} featured`);
      return result;

    } catch (error) {
      this.logger.error('❌ Erreur génération catalogue homepage:', error);
      throw error;
    }
  }

  /**
   * 📋 Récupère les catégories principales (gammes)
   */
  private async getMainCategories(): Promise<CatalogItem[]> {
    try {
      const { data, error } = await this.supabase
        .from('pieces_gamme')
        .select(`
          pg_id,
          pg_name,
          pg_alias,
          pg_description,
          pg_image,
          pg_featured,
          pg_display,
          pg_sort
        `)
        .eq('pg_display', 1)
        .order('pg_sort', { ascending: true });

      if (error) {
        throw error;
      }

      // Transformation vers interface CatalogItem
      const catalogItems: CatalogItem[] = (data || []).map(item => ({
        id: item.pg_id,
        code: item.pg_alias || `gamme-${item.pg_id}`,
        name: item.pg_name,
        description: item.pg_description,
        image_url: item.pg_image,
        is_featured: item.pg_featured || false,
        piece_count: 0 // Sera enrichi par RPC si disponible
      }));

      // Enrichissement avec compteur de produits
      return await this.enrichWithProductCounts(catalogItems);

    } catch (error) {
      this.logger.error('❌ Erreur récupération catégories principales:', error);
      return [];
    }
  }

  /**
   * 🔥 Récupère les éléments d'accès rapide (populaires)
   */
  private async getQuickAccessItems(): Promise<any[]> {
    try {
      // Essayer d'abord la fonction RPC si disponible
      const { data, error } = await this.supabase
        .rpc('get_popular_catalog_items', { limit_count: 10 });

      if (error || !data) {
        // Fallback sur requête simple
        this.logger.warn('⚠️ RPC popular items non disponible, fallback sur gammes featured');
        return await this.getFallbackQuickAccess();
      }

      return data;
    } catch (error) {
      this.logger.warn('⚠️ Erreur accès rapide, fallback utilisé:', error);
      return await this.getFallbackQuickAccess();
    }
  }

  /**
   * 🔄 Fallback pour accès rapide
   */
  private async getFallbackQuickAccess(): Promise<CatalogItem[]> {
    const { data } = await this.supabase
      .from('pieces_gamme')
      .select('pg_id, pg_name, pg_alias, pg_image')
      .eq('pg_featured', 1)
      .eq('pg_display', 1)
      .limit(8);

    return (data || []).map(item => ({
      id: item.pg_id,
      code: item.pg_alias,
      name: item.pg_name,
      image_url: item.pg_image,
      is_featured: true,
      piece_count: 0
    }));
  }

  /**
   * 📊 Enrichit les catégories avec le nombre de produits
   */
  private async enrichWithProductCounts(categories: CatalogItem[]): Promise<CatalogItem[]> {
    if (categories.length === 0) return [];

    try {
      const categoryIds = categories.map(cat => cat.id);
      
      const { data, error } = await this.supabase
        .rpc('get_products_count_by_gamme', {
          gamme_ids: categoryIds
        });

      if (error || !data) {
        this.logger.warn('⚠️ Enrichissement compteurs produits échoué');
        return categories;
      }

      // Créer un map pour lookup rapide
      const countMap = new Map();
      data.forEach((item: any) => {
        countMap.set(item.gamme_id, item.products_count);
      });

      // Enrichir les catégories
      return categories.map(cat => ({
        ...cat,
        piece_count: countMap.get(cat.id) || 0
      }));

    } catch (error) {
      this.logger.warn('⚠️ Erreur enrichissement compteurs:', error);
      return categories;
    }
  }

  /**
   * 🔍 Recherche dans le catalogue (version améliorée)
   */
  async searchCatalog(query: string, filters?: {
    minPrice?: number;
    maxPrice?: number;
    categoryId?: number;
    brandId?: number;
    limit?: number;
  }): Promise<any[]> {
    try {
      this.logger.log(`🔍 Recherche catalogue: "${query}" avec filtres`);

      let queryBuilder = this.supabase
        .from('pieces_gamme')
        .select(`
          pg_id,
          pg_name,
          pg_alias,
          pg_description,
          pg_image,
          products_pieces!inner(
            piece_id,
            piece_name,
            piece_ref,
            piece_price,
            piece_brand,
            piece_image
          )
        `);

      // Recherche textuelle
      if (query) {
        queryBuilder = queryBuilder.or(
          `pg_name.ilike.%${query}%,pg_alias.ilike.%${query}%`
        );
      }

      // Appliquer les filtres
      if (filters?.minPrice) {
        queryBuilder = queryBuilder.gte('products_pieces.piece_price', filters.minPrice);
      }
      if (filters?.maxPrice) {
        queryBuilder = queryBuilder.lte('products_pieces.piece_price', filters.maxPrice);
      }
      if (filters?.categoryId) {
        queryBuilder = queryBuilder.eq('pg_id', filters.categoryId);
      }

      const { data, error } = await queryBuilder
        .limit(filters?.limit || 50);

      if (error) {
        throw error;
      }

      this.logger.log(`✅ Recherche: ${(data || []).length} résultats trouvés`);
      return data || [];

    } catch (error) {
      this.logger.error('❌ Erreur recherche catalogue:', error);
      return [];
    }
  }

  /**
   * ♻️ Méthodes de préchargement pour OnModuleInit
   */
  private async preloadMainCategories(): Promise<void> {
    try {
      await this.getHomeCatalog();
      this.logger.log('✅ Catégories principales préchargées');
    } catch (error) {
      this.logger.error('❌ Erreur préchargement catégories:', error);
    }
  }

  private async preloadAutoBrands(): Promise<void> {
    try {
      await this.getAutoBrands(50);
      this.logger.log('✅ Marques automobiles préchargées');
    } catch (error) {
      this.logger.error('❌ Erreur préchargement marques:', error);
    }
  }

  private async preloadGlobalStats(): Promise<void> {
    try {
      await this.getCatalogStats();
      this.logger.log('✅ Statistiques globales préchargées');
    } catch (error) {
      this.logger.error('❌ Erreur préchargement stats:', error);
    }
  }

  /**
   * 🗑️ Invalidation du cache
   */
  invalidateCache(pattern?: string): void {
    if (pattern) {
      for (const key of this.catalogCache.keys()) {
        if (key.includes(pattern)) {
          this.catalogCache.delete(key);
        }
      }
      this.logger.log(`♻️ Cache invalidé pour pattern: ${pattern}`);
    } else {
      this.catalogCache.clear();
      this.logger.log('♻️ Cache complet invalidé');
    }
  }
  async getAutoBrands(limit: number = 50) {
    try {
      const { data, error } = await this.supabase
        .from('auto_marque')
        .select(
          `
          marque_id,
          marque_name,
          marque_alias,
          marque_logo,
          marque_display,
          marque_top
        `,
        )
        .eq('marque_display', 1)
        .order('marque_sort', { ascending: true })
        .limit(limit);

      if (error) {
        throw error;
      }

      return {
        success: true,
        data:
          data?.map((brand) => ({
            id: brand.marque_id,
            name: brand.marque_name,
            alias: brand.marque_alias,
            logo: brand.marque_logo,
            isTop: brand.marque_top === 1,
            isActive: brand.marque_display === 1,
          })) || [],
        count: data?.length || 0,
      };
    } catch (error) {
      this.logger.error('Erreur lors de la récupération des marques:', error);
      return {
        success: false,
        error: error.message,
        data: [],
        count: 0,
      };
    }
  }

  /**
   * Récupérer les modèles d'une marque
   */
  async getModelsByBrand(marqueId: number, limit: number = 100) {
    try {
      const { data, error } = await this.supabase
        .from('auto_modele')
        .select(
          `
          modele_id,
          modele_name,
          modele_alias,
          modele_year_from,
          modele_year_to,
          modele_body,
          modele_pic,
          modele_display
        `,
        )
        .eq('modele_marque_id', marqueId)
        .eq('modele_display', 1)
        .order('modele_sort', { ascending: true })
        .limit(limit);

      if (error) {
        throw error;
      }

      return {
        success: true,
        data:
          data?.map((model) => ({
            id: model.modele_id,
            name: model.modele_name,
            alias: model.modele_alias,
            yearFrom: model.modele_year_from,
            yearTo: model.modele_year_to,
            body: model.modele_body,
            picture: model.modele_pic,
            isActive: model.modele_display === 1,
          })) || [],
        count: data?.length || 0,
      };
    } catch (error) {
      this.logger.error('Erreur lors de la récupération des modèles:', error);
      return {
        success: false,
        error: error.message,
        data: [],
        count: 0,
      };
    }
  }

  /**
   * Rechercher des pièces par référence ou nom
   */
  async searchPieces(query: string, limit: number = 50, offset: number = 0) {
    try {
      const { data, error } = await this.supabase
        .from('pieces')
        .select(
          `
          piece_id,
          piece_ref,
          piece_name,
          piece_des,
          piece_name_comp,
          piece_weight_kgm,
          piece_has_img,
          piece_display
        `,
        )
        .or(
          `piece_ref.ilike.%${query}%,piece_name.ilike.%${query}%,piece_des.ilike.%${query}%`,
        )
        .eq('piece_display', true)
        .order('piece_sort', { ascending: true })
        .range(offset, offset + limit - 1);

      if (error) {
        throw error;
      }

      return {
        success: true,
        data:
          data?.map((piece) => ({
            id: piece.piece_id,
            reference: piece.piece_ref,
            name: piece.piece_name,
            description: piece.piece_des,
            completeName: piece.piece_name_comp,
            weight: piece.piece_weight_kgm,
            hasImage: piece.piece_has_img,
            isActive: piece.piece_display,
          })) || [],
        count: data?.length || 0,
      };
    } catch (error) {
      this.logger.error('Erreur lors de la recherche de pièces:', error);
      return {
        success: false,
        error: error.message,
        data: [],
        count: 0,
      };
    }
  }

  /**
   * Récupérer les détails d'une pièce
   */
  async getPieceById(pieceId: number) {
    try {
      const { data, error } = await this.supabase
        .from('pieces')
        .select(
          `
          piece_id,
          piece_ref,
          piece_ref_clean,
          piece_name,
          piece_des,
          piece_name_comp,
          piece_name_side,
          piece_weight_kgm,
          piece_has_oem,
          piece_has_img,
          piece_year,
          piece_qty_sale,
          piece_qty_pack
        `,
        )
        .eq('piece_id', pieceId)
        .eq('piece_display', true)
        .single();

      if (error) {
        throw error;
      }

      return {
        success: true,
        data: data
          ? {
              id: data.piece_id,
              reference: data.piece_ref,
              referenceClean: data.piece_ref_clean,
              name: data.piece_name,
              description: data.piece_des,
              completeName: data.piece_name_comp,
              side: data.piece_name_side,
              weight: data.piece_weight_kgm,
              hasOem: data.piece_has_oem,
              hasImage: data.piece_has_img,
              year: data.piece_year,
              quantitySale: data.piece_qty_sale,
              quantityPack: data.piece_qty_pack,
            }
          : null,
      };
    } catch (error) {
      this.logger.error('Erreur lors de la récupération de la pièce:', error);
      return {
        success: false,
        error: error.message,
        data: null,
      };
    }
  }

  /**
   * Obtenir les statistiques du catalogue
   */
  async getCatalogStats() {
    try {
      // Statistiques des marques
      const { count: brandsCount, error: brandsError } = await this.supabase
        .from('auto_marque')
        .select('*', { count: 'exact', head: true })
        .eq('marque_display', 1);

      // Statistiques des modèles
      const { count: modelsCount, error: modelsError } = await this.supabase
        .from('auto_modele')
        .select('*', { count: 'exact', head: true })
        .eq('modele_display', 1);

      // Statistiques des pièces
      const { count: piecesCount, error: piecesError } = await this.supabase
        .from('pieces')
        .select('*', { count: 'exact', head: true })
        .eq('piece_display', true);

      if (brandsError || modelsError || piecesError) {
        throw new Error('Erreur lors du calcul des statistiques');
      }

      return {
        success: true,
        stats: {
          brands: brandsCount || 0,
          models: modelsCount || 0,
          pieces: piecesCount || 0,
          lastUpdate: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error('Erreur lors du calcul des statistiques:', error);
      return {
        success: false,
        error: error.message,
        stats: null,
      };
    }
  }

  /**
   * 🏠 Obtient toutes les données nécessaires pour la page d'accueil
   * Agrège marques, statistiques et gammes en un seul appel optimisé
   */
  async getHomepageData() {
    try {
      this.logger.log('🏠 Génération données complètes page d\'accueil');

      // Exécution parallèle pour performance optimale
      const [brandsResult, statsResult] = await Promise.allSettled([
        this.getAutoBrands(20), // Top 20 marques pour homepage
        this.getGlobalStats(),
      ]);

      // Extraction sécurisée des résultats
      const brands = brandsResult.status === 'fulfilled' ? brandsResult.value : {
        success: false,
        data: [],
        count: 0
      };

      const stats = statsResult.status === 'fulfilled' ? statsResult.value : {
        success: false,
        stats: {
          brands: 0,
          models: 0,
          pieces: 0,
          lastUpdate: new Date().toISOString()
        }
      };

      // Construction de la réponse optimisée
      const result = {
        success: true,
        timestamp: new Date().toISOString(),
        data: {
          // 🚗 Marques automobiles populaires
          brands: {
            success: brands.success,
            data: brands.data || [],
            count: brands.count || 0,
            featured: (brands.data || [])
              .filter((brand: any) => brand.marque_top === 1)
              .slice(0, 8) // Top 8 marques featured
          },
          
          // 📊 Statistiques globales  
          stats: {
            success: stats.success,
            ...stats.stats,
            // Statistiques enrichies pour homepage
            formatted: {
              brands: this.formatNumber(stats.stats?.brands || 0),
              models: this.formatNumber(stats.stats?.models || 0), 
              pieces: this.formatNumber(stats.stats?.pieces || 0),
              satisfaction: '4.8/5' // Valeur statique pour l'exemple
            }
          },

          // 🎯 Métadonnées pour le cache et l'affichage
          cache_info: {
            generated_at: new Date().toISOString(),
            ttl_seconds: 1800, // 30 minutes
            version: '2.0.0'
          }
        },
        message: 'Données homepage générées avec succès'
      };

      this.logger.log(`✅ Homepage data: ${brands.count} marques, ${stats.stats?.pieces || 0} pièces`);
      return result;

    } catch (error) {
      this.logger.error('❌ Erreur génération données homepage:', error);
      return {
        success: false,
        error: error.message,
        data: null,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 🔢 Formate les nombres pour l'affichage (ex: 50000 -> "50K+")
   */
  private formatNumber(num: number): string {
    if (num >= 1000000) {
      return `${Math.floor(num / 1000000)}M+`;
    } else if (num >= 1000) {
      return `${Math.floor(num / 1000)}K+`;
    }
    return num.toString();
  }

  /**
   * 🎯 Obtient les marques optimisées pour le sélecteur de véhicule
   */
  async getBrandsForVehicleSelector(limit: number = 50) {
    try {
      this.logger.log(`🎯 Récupération marques pour sélecteur (limite: ${limit})`);

      const { data, error } = await this.supabase
        .from('auto_marque')
        .select(`
          marque_id,
          marque_name,
          marque_alias,
          marque_logo,
          marque_top,
          marque_display
        `)
        .eq('marque_display', 1)
        .order('marque_top', { ascending: false }) // Featured d'abord
        .order('marque_sort', { ascending: true })
        .limit(limit);

      if (error) {
        throw error;
      }

      // Structurer pour VehicleSelector
      const structuredBrands = (data || []).map(brand => ({
        id: brand.marque_id,
        name: brand.marque_name,
        slug: brand.marque_alias,
        logo: brand.marque_logo,
        isFeatured: brand.marque_top === 1,
        isActive: brand.marque_display === 1
      }));

      this.logger.log(`✅ ${structuredBrands.length} marques structurées pour sélecteur`);
      
      return {
        success: true,
        data: structuredBrands,
        count: structuredBrands.length,
        featured_count: structuredBrands.filter(b => b.isFeatured).length
      };

    } catch (error) {
      this.logger.error('❌ Erreur marques sélecteur:', error);
      return {
        success: false,
        error: error.message,
        data: [],
        count: 0
      };
    }
  }

  /**
   * 🔍 MÉTHODE TEMPORAIRE - Test d'une table Supabase
   * Utilisée pour explorer les tables gammes disponibles
   */
  async testTable(tableName: string) {
    this.logger.log(`🔍 Test de la table: ${tableName}`);

    try {
      // Récupérer quelques échantillons
      const { data: samples, error: samplesError } = await this.supabase
        .from(tableName)
        .select('*')
        .limit(2);

      if (samplesError) {
        throw new Error(`Erreur échantillons ${tableName}: ${samplesError.message}`);
      }

      // Compter le total
      const { count, error: countError } = await this.supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });

      if (countError) {
        this.logger.warn(`⚠️ Erreur comptage ${tableName}:`, countError);
      }

      const columns = samples && samples.length > 0 ? Object.keys(samples[0]) : [];

      this.logger.log(`✅ Table ${tableName}: ${count || 0} enregistrements, ${columns.length} colonnes`);

      return {
        count: count || 0,
        columns,
        sample: samples?.[0] || null
      };

    } catch (error) {
      this.logger.error(`❌ Erreur test table ${tableName}:`, error);
      throw error;
    }
  }
}
