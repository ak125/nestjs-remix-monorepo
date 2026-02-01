/**
 * 🏷️ BRANDS CONTROLLER
 *
 * API REST pour les marques automobiles et leurs modèles
 * Routes: /api/brands/*
 *
 * Utilise VehicleBrandsService et VehicleModelsService
 * Tables: auto_marque, auto_modele, auto_type
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  Logger,
  ParseIntPipe,
  Header,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { VehicleBrandsService } from './services/data/vehicle-brands.service';
import { VehicleModelsService } from './services/data/vehicle-models.service';
import { VehicleTypesService } from './services/data/vehicle-types.service';
import { BrandSeoService } from './services/seo/brand-seo.service';
import { BrandRpcService } from './services/brand-rpc.service';
// ⚠️ IMAGES: Utiliser image-urls.utils.ts - NE PAS définir de constantes locales
import {
  buildBrandLogoUrl,
  buildModelImageUrl,
} from '../catalog/utils/image-urls.utils';

@Controller('api/brands')
export class BrandsController {
  private readonly logger = new Logger(BrandsController.name);

  constructor(
    private readonly brandsService: VehicleBrandsService,
    private readonly modelsService: VehicleModelsService,
    private readonly typesService: VehicleTypesService,
    private readonly brandSeoService: BrandSeoService,
    private readonly brandRpcService: BrandRpcService,
  ) {
    this.logger.log(
      '✅ BrandsController initialisé - Routes /api/brands/* actives',
    );
  }

  /**
   * GET /api/brands
   * Retourne toutes les marques avec recherche optionnelle
   */
  @Get()
  @Header('Cache-Control', 'public, max-age=1800, stale-while-revalidate=7200')
  async getAllBrands(@Query('search') search?: string) {
    return this.brandsService.getBrands({ search, limit: 200 });
  }

  /**
   * GET /api/brands/brands-logos
   * Retourne marques avec logos
   */
  @Get('brands-logos')
  async getBrandsLogos(@Query('limit', ParseIntPipe) limit: number = 50) {
    const result = await this.brandsService.getBrands({ limit });

    return {
      success: true,
      data: result.data || [],
      total: result.total,
    };
  }

  /**
   * GET /api/brands/popular-models
   * Retourne modèles populaires
   */
  @Get('popular-models')
  async getPopularModels(@Query('limit', ParseIntPipe) limit: number = 12) {
    const result = await this.modelsService.getModels({ limit });

    return {
      success: true,
      data: result.data || [],
      total: result.total,
    };
  }

  /**
   * GET /api/brands/brand/:brand
   * Retourne info marque par alias (slug URL) + SEO enrichi
   */
  @Get('brand/:brand')
  async getBrandBySlug(@Param('brand') brandSlug: string) {
    // Recherche par alias (marque_alias) pour correspondance exacte
    const brand = await this.brandsService.getBrandByAlias(brandSlug);

    if (!brand) {
      return {
        success: false,
        message: `Marque "${brandSlug}" introuvable`,
      };
    }

    // 🔥 INTÉGRATION SEO __seo_marque
    let seoData = null;
    const marqueId = (brand as any).marque_id;
    const marqueNom = (brand as any).marque_name || brandSlug;

    if (marqueId) {
      seoData = await this.brandSeoService.getProcessedBrandSeo(
        marqueId,
        marqueNom,
        0, // typeId=0 pour rotation #PrixPasCher# variation 0
      );

      // Fallback si pas de SEO custom
      if (!seoData) {
        seoData = this.brandSeoService.generateDefaultBrandSeo(marqueNom);
      }
    }

    return {
      success: true,
      data: {
        ...brand,
        seo: seoData, // 🎯 SEO enrichi avec variables remplacées
      },
    };
  }

  /**
   * GET /api/brands/brand/:brand/model/:model
   * Retourne modèle spécifique d'une marque avec ses motorisations
   * Format attendu par blog-pieces-auto.auto.$marque.$modele.tsx
   */
  @Get('brand/:brand/model/:model')
  async getModelByBrandAndSlug(
    @Param('brand') brandSlug: string,
    @Param('model') modelSlug: string,
  ) {
    try {
      this.logger.log(`🔍 Recherche modèle: ${brandSlug}/${modelSlug}`);

      // 1. Trouver marque par alias exact
      const brand = await this.brandsService.getBrandByAlias(brandSlug);

      if (!brand) {
        this.logger.warn(`❌ Marque "${brandSlug}" introuvable`);
        return {
          success: false,
          message: `Marque "${brandSlug}" introuvable`,
        };
      }

      const brandData = brand as any;
      const marqueId = brandData.marque_id;
      const marqueAlias = brandData.marque_alias || brandSlug;

      // 2. Trouver modèle par alias (méthode directe, pas de filtrage motorisations)
      const model = await this.modelsService.getModelByBrandAndAlias(
        marqueId,
        modelSlug,
      );

      if (!model) {
        this.logger.warn(
          `❌ Modèle "${modelSlug}" introuvable pour "${brandSlug}"`,
        );
        return {
          success: false,
          message: `Modèle "${modelSlug}" introuvable pour "${brandSlug}"`,
        };
      }

      const modelData = model as any;
      const modeleId = modelData.modele_id;

      // 3. Récupérer les types (motorisations) du modèle
      const typesResult = await this.typesService.getTypesByModel(modeleId, {
        limit: 500, // Récupérer toutes les motorisations
      });

      // 4. Formater les types pour le frontend
      // ✅ Colonnes correctes: type_power_kw et type_power_ps (pas type_kw/type_ch)
      const formattedTypes = (typesResult.data || []).map((type: any) => ({
        id: type.type_id,
        designation:
          type.type_name ||
          `${type.type_power_kw || 0} kW / ${type.type_power_ps || 0} ch`,
        kw: type.type_power_kw || 0,
        ch: type.type_power_ps || 0,
        carburant: type.type_fuel || 'Inconnu',
        engineCode: type.type_engine_code || null,
        monthFrom: type.type_month_from?.toString() || null,
        yearFrom: type.type_year_from?.toString() || null,
        monthTo: type.type_month_to?.toString() || null,
        yearTo: type.type_year_to?.toString() || null,
        carosserie: type.type_body || null,
        cylindre: type.type_cylinder ? `${type.type_cylinder} cm³` : null,
        slug: type.type_alias || null,
      }));

      // 5. Générer l'URL de l'image du modèle via fonction centralisée (avec fallback marques-concepts)
      const imageUrl = buildModelImageUrl(
        marqueAlias,
        modelData.modele_pic,
        modelData.modele_alias,
      );

      // 6. Préparer la réponse au format attendu par le frontend
      return {
        success: true,
        data: {
          brand: {
            id: marqueId,
            name: brandData.marque_name,
            alias: marqueAlias,
            // ✅ Priorité: marque_logo > marque_img > alias.webp
            logo: brandData.marque_logo
              ? `/img/uploads/constructeurs-automobiles/marques-logos/${brandData.marque_logo}`
              : brandData.marque_img
                ? buildBrandLogoUrl(brandData.marque_img)
                : `/img/uploads/constructeurs-automobiles/marques-logos/${marqueAlias}.webp`,
          },
          model: {
            id: modeleId,
            name: modelData.modele_name,
            alias: modelData.modele_alias,
            yearFrom: modelData.modele_year_from || null,
            yearTo: modelData.modele_year_to || null,
            imageUrl: imageUrl,
            body: modelData.modele_body || null,
          },
          types: formattedTypes,
          metadata: null, // SEO à implémenter si nécessaire
        },
      };
    } catch (error) {
      this.logger.error(`❌ Erreur getModelByBrandAndSlug:`, error);
      // Retourner 500 au lieu de 200 avec success: false
      throw new HttpException(
        'Erreur interne du serveur',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /api/brands/page-metadata/:page
   * Métadonnées SEO pour pages constructeurs
   */
  @Get('page-metadata/:page')
  async getPageMetadata(@Param('page') page: string) {
    return {
      success: true,
      data: {
        page,
        title: `Pièces auto par ${page}`,
        description: `Trouvez les meilleures pièces automobiles`,
        keywords: 'pièces auto, constructeurs, marques',
      },
    };
  }

  /**
   * GET /api/brands/:id
   * Retourne info marque par ID + SEO enrichi
   */
  @Get(':id')
  async getBrandById(@Param('id', ParseIntPipe) marqueId: number) {
    const result = await this.brandsService.getBrands({ limit: 1000 });

    if (!result.data || result.data.length === 0) {
      return {
        success: false,
        message: 'Aucune marque trouvée',
      };
    }

    const brand = result.data.find((b: any) => b.marque_id === marqueId);

    if (!brand) {
      return {
        success: false,
        message: `Marque ID ${marqueId} introuvable`,
      };
    }

    // 🔥 INTÉGRATION SEO __seo_marque
    const marqueNom = (brand as any).marque_name;
    const seoData = await this.brandSeoService.getProcessedBrandSeo(
      marqueId,
      marqueNom,
      0, // typeId=0 pour rotation #PrixPasCher# variation 0
    );

    return {
      success: true,
      marqueId: (brand as any).marque_id,
      marqueNom: (brand as any).marque_name,
      marqueSlug: (brand as any).marque_slug,
      marqueImg: (brand as any).marque_img,
      seo: seoData,
    };
  }

  /**
   * PUT /api/brands/:id/seo
   * Met à jour le SEO d'une marque dans __seo_marque
   */
  @Put(':id/seo')
  async updateBrandSeo(
    @Param('id', ParseIntPipe) marqueId: number,
    @Body()
    seoData: {
      sm_title?: string;
      sm_descrip?: string;
      sm_h1?: string;
      sm_content?: string;
      sm_keywords?: string;
    },
  ) {
    this.logger.log(`📝 Mise à jour SEO marque ID ${marqueId}`);

    try {
      const updated = await this.brandSeoService.updateBrandSeo(
        marqueId,
        seoData,
      );

      return {
        success: true,
        data: updated,
        message: 'SEO mis à jour avec succès',
      };
    } catch (error) {
      this.logger.error(`❌ Erreur MAJ SEO marque ${marqueId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      };
    }
  }

  // ========================================
  // 🚀 RPC OPTIMISÉ - Endpoint pour page marque (LCP)
  // ========================================

  /**
   * GET /api/brands/:id/page-data-rpc
   * ⚡ Récupère TOUTES les données d'une page marque en 1 seule requête RPC
   * Remplace 6 appels API séquentiels (400-800ms → ~100ms)
   * Utilisé par le loader frontend /constructeurs/{brand}.html
   */
  @Get(':id/page-data-rpc')
  async getBrandPageDataRpc(@Param('id', ParseIntPipe) marqueId: number) {
    this.logger.log(`⚡ GET /api/brands/${marqueId}/page-data-rpc`);

    try {
      const result =
        await this.brandRpcService.getBrandPageDataOptimized(marqueId);

      return {
        success: true,
        data: result,
        _performance: result._performance,
        _cache: result._cache,
      };
    } catch (error) {
      this.logger.error(
        `❌ RPC Error for brand ${marqueId}:`,
        error instanceof Error ? error.message : error,
      );

      // Pas de fallback - erreur 500
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        marque_id: marqueId,
      };
    }
  }

  /**
   * POST /api/brands/cache/warm
   * 🔥 Préchauffe le cache pour les marques populaires
   */
  @Post('cache/warm')
  async warmBrandCache(@Body() body: { marqueIds?: number[] }) {
    // Marques populaires par défaut
    const defaultPopularBrands = [140, 33, 32, 85, 177, 106, 121, 52]; // Renault, BMW, Audi, Mercedes, VW, Peugeot, Citroën, Ford
    const marqueIds = body.marqueIds || defaultPopularBrands;

    this.logger.log(`🔥 Warm cache pour ${marqueIds.length} marques`);

    const result = await this.brandRpcService.warmCache(marqueIds);
    return { status: 200, ...result };
  }

  /**
   * POST /api/brands/:id/cache/invalidate
   * 🗑️ Invalide le cache d'une marque spécifique
   */
  @Post(':id/cache/invalidate')
  async invalidateBrandCache(@Param('id', ParseIntPipe) marqueId: number) {
    await this.brandRpcService.invalidateCache(marqueId);
    return { status: 200, message: `Cache invalidé pour brand ${marqueId}` };
  }
}
