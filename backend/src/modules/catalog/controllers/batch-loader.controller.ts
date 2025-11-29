import { Controller, Post, Body, Logger, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { VehiclePiecesCompatibilityService } from '../services/vehicle-pieces-compatibility.service';
import { GammeUnifiedService } from '../services/gamme-unified.service';
import { VehiclesService } from '../../vehicles/vehicles.service';

interface BatchLoaderRequest {
  typeId: number;
  gammeId: number;
  marqueId: number;
  modeleId: number;
}

/** 🚗 Informations véhicule enrichies pour éviter des appels API séparés */
interface VehicleInfo {
  typeId: number;
  typeName: string;
  typeBody?: string;
  typeEngine?: string;
  typePowerPs?: number;
  typeDateStart?: string;
  typeDateEnd?: string;
  modeleId: number;
  modeleName: string;
  modelePic?: string;
  modeleAlias?: string;
  marqueId: number;
  marqueName: string;
  marqueAlias?: string;
}

interface BatchLoaderResponse {
  pieces: any[];
  grouped_pieces?: any[]; // ✨ Groupes avec title_h2 pour affichage par section
  blocs?: any[]; // ✨ Alias pour compatibilité
  filters?: any; // ✨ V2: Filtres intégrés (côté, qualité, marques)
  count: number;
  minPrice: number | null;
  seo: {
    h1?: string;
    content?: string;
    title?: string;
    description?: string;
  };
  crossSelling: any[];
  vehicleInfo?: VehicleInfo; // 🚗 V3: Infos véhicule intégrées
  validation: {
    valid: boolean;
    relationsCount: number;
    dataQuality?: any;
  };
  success: boolean;
  timestamp: string;
  loadTime: number;
}

/**
 * 🚀 BATCH LOADER CONTROLLER - Optimisation Performance
 * 
 * Endpoint unique qui regroupe 4-5 appels API en 1 seul
 * Réduit le waterfall réseau de 8-10 calls → 2-3 calls
 * 
 * Regroupe :
 * - Validation compatibilité (integrity/validate)
 * - Récupération pièces (pieces/php-logic)
 * - Contenu SEO (gammes/{id}/seo)
 * - Cross-selling gammes (cross-selling)
 */
@Controller('api/catalog/batch-loader')
export class BatchLoaderController {
  private readonly logger = new Logger(BatchLoaderController.name);

  constructor(
    private readonly piecesService: VehiclePiecesCompatibilityService,
    private readonly gammeService: GammeUnifiedService,
    private readonly vehiclesService: VehiclesService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  @Post()
  async batchLoad(@Body() request: BatchLoaderRequest): Promise<BatchLoaderResponse> {
    const startTime = Date.now();
    
    this.logger.log(
      `🚀 [BATCH-LOADER] START: type=${request.typeId}, gamme=${request.gammeId}, marque=${request.marqueId}, modele=${request.modeleId}`
    );

    try {
      // Validation des paramètres
      if (!request.typeId || !request.gammeId) {
        throw new HttpException(
          'typeId et gammeId sont requis',
          HttpStatus.BAD_REQUEST
        );
      }

      // ✅ CACHE REDIS: Vérifier le cache (5 minutes TTL)
      const cacheKey = `batch-loader:${request.typeId}:${request.gammeId}:${request.marqueId || 0}:${request.modeleId || 0}`;
      const cached = await this.cacheManager.get<BatchLoaderResponse>(cacheKey);

      if (cached) {
        const loadTime = Date.now() - startTime;
        this.logger.log(
          `⚡ [BATCH-LOADER] Cache HIT: type=${request.typeId}, gamme=${request.gammeId} (${loadTime}ms)`
        );
        return {
          ...cached,
          loadTime,
          timestamp: new Date().toISOString(),
        };
      }

      // 🔥 PARALLÉLISATION MAXIMALE: 4 appels en parallèle
      const [piecesResult, seoResult, crossSellingResult, vehicleResult] = await Promise.all([
        // 1. Pièces via RPC optimisée (1 requête au lieu de 9)
        this.piecesService.getPiecesViaRPC(request.typeId, request.gammeId).catch(error => {
          this.logger.error(`❌ Erreur récupération pièces:`, error);
          return { pieces: [], count: 0, minPrice: null, success: false, error: error.message };
        }),

        // 2. SEO content
        this.gammeService.getGammeSeoContent(
          request.gammeId,
          request.typeId,
          request.marqueId,
          request.modeleId
        ).catch(error => {
          this.logger.warn(`⚠️ Erreur récupération SEO (fallback):`, error);
          return { h1: null, content: null, title: null, description: null };
        }),

        // 3. Cross-selling - Pour l'instant retourner vide car pas implémenté dans gammeService
        // TODO: Implémenter getCrossSellingGammes dans GammeUnifiedService
        Promise.resolve([]),

        // 4. 🚗 Informations véhicule (type, modèle, marque) 
        this.vehiclesService.getTypeById(request.typeId).catch(error => {
          this.logger.warn(`⚠️ Erreur récupération véhicule:`, error);
          return { data: null, error };
        }),
      ]);

      // Extraction des données
      const pieces = Array.isArray(piecesResult.pieces) ? piecesResult.pieces : [];
      const grouped_pieces = (piecesResult as any).grouped_pieces || (piecesResult as any).blocs || [];
      const filters = (piecesResult as any).filters || null; // ✨ V2: Filtres intégrés depuis RPC
      const count = pieces.length;
      const minPrice = piecesResult.minPrice || null;

      // 🚗 Extraction des infos véhicule
      let vehicleInfo: VehicleInfo | undefined;
      if (vehicleResult?.data?.[0]) {
        const typeData = vehicleResult.data[0];
        const modeleData = typeData.auto_modele;
        const marqueData = modeleData?.auto_marque;
        
        vehicleInfo = {
          typeId: typeData.type_id,
          typeName: typeData.type_name || '',
          typeBody: typeData.type_body || undefined,
          typeEngine: typeData.type_engine || undefined,
          typePowerPs: typeData.type_power_ps || undefined,
          typeDateStart: typeData.type_date_start || undefined,
          typeDateEnd: typeData.type_date_end || undefined,
          modeleId: modeleData?.modele_id || request.modeleId,
          modeleName: modeleData?.modele_name || '',
          modelePic: modeleData?.modele_pic || undefined,
          modeleAlias: modeleData?.modele_alias || undefined,
          marqueId: marqueData?.marque_id || request.marqueId,
          marqueName: marqueData?.marque_name || '',
          marqueAlias: marqueData?.marque_alias || undefined,
        };
      }

      // Validation basée sur les pièces retournées
      const validation = {
        valid: count > 0,
        relationsCount: count,
        dataQuality: this.analyzeDataQuality(pieces)
      };

      const loadTime = Date.now() - startTime;

      this.logger.log(
        `✅ [BATCH-LOADER] SUCCESS: ${count} pièces, min=${minPrice}€, SEO=${!!seoResult.content}, cross=${Array.isArray(crossSellingResult) ? crossSellingResult.length : 0}, vehicle=${!!vehicleInfo}, ${loadTime}ms`
      );

      const response: BatchLoaderResponse = {
        pieces,
        grouped_pieces, // ✨ Groupes avec title_h2
        blocs: grouped_pieces, // ✨ Alias pour compatibilité
        filters, // ✨ V2: Filtres intégrés (plus d'appel séparé)
        count,
        minPrice,
        seo: {
          h1: seoResult.h1 || undefined,
          content: seoResult.content || undefined,
          title: seoResult.title || undefined,
          description: seoResult.description || undefined,
        },
        crossSelling: Array.isArray(crossSellingResult) ? crossSellingResult : [],
        vehicleInfo, // 🚗 V3: Infos véhicule intégrées
        validation,
        success: true,
        timestamp: new Date().toISOString(),
        loadTime,
      };

      // ✅ METTRE EN CACHE (5 minutes = 300 secondes) si succès avec pièces
      if (count > 0) {
        await this.cacheManager.set(cacheKey, response, 300000); // 5 min en ms
        this.logger.log(`💾 [BATCH-LOADER] Mis en cache: ${cacheKey}`);
      }

      return response;
    } catch (error: any) {
      const loadTime = Date.now() - startTime;
      
      this.logger.error(
        `❌ [BATCH-LOADER] ERROR: ${error.message}, ${loadTime}ms`
      );

      throw new HttpException(
        {
          success: false,
          message: error.message, // Added for ExceptionFilter compatibility
          error: error.message,
          timestamp: new Date().toISOString(),
          loadTime,
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Analyse la qualité des données retournées
   */
  private analyzeDataQuality(pieces: any[]): any {
    if (!pieces || pieces.length === 0) {
      return { quality: 0, issues: ['no_pieces'] };
    }

    const issues: string[] = [];
    
    // Pièces sans marque
    const withoutBrand = pieces.filter(p => !p.marque || p.marque === 'Marque inconnue');
    const percentWithoutBrand = (withoutBrand.length / pieces.length) * 100;
    
    if (percentWithoutBrand > 80) {
      issues.push('missing_brands');
    }

    // Pièces sans image
    const withoutImage = pieces.filter(p => !p.image || p.image === '/images/pieces/default.png');
    const percentWithoutImage = (withoutImage.length / pieces.length) * 100;
    
    if (percentWithoutImage > 50) {
      issues.push('missing_images');
    }

    // Pièces sans prix
    const withoutPrice = pieces.filter(p => !p.prix_unitaire || p.prix_unitaire === 0);
    const percentWithoutPrice = (withoutPrice.length / pieces.length) * 100;
    
    if (percentWithoutPrice > 20) {
      issues.push('missing_prices');
    }

    // Score qualité (0-100)
    const quality = Math.round(
      100 - (percentWithoutBrand * 0.5) - (percentWithoutImage * 0.3) - (percentWithoutPrice * 0.2)
    );

    return {
      quality: Math.max(0, quality),
      pieces_with_brand_percent: Math.round(100 - percentWithoutBrand),
      pieces_with_image_percent: Math.round(100 - percentWithoutImage),
      pieces_with_price_percent: Math.round(100 - percentWithoutPrice),
      issues: issues.length > 0 ? issues : undefined,
    };
  }
}
