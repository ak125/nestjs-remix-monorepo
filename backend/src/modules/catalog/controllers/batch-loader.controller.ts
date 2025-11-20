import { Controller, Post, Body, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { VehiclePiecesCompatibilityService } from '../services/vehicle-pieces-compatibility.service';
import { GammeUnifiedService } from '../services/gamme-unified.service';

interface BatchLoaderRequest {
  typeId: number;
  gammeId: number;
  marqueId: number;
  modeleId: number;
}

interface BatchLoaderResponse {
  pieces: any[];
  count: number;
  minPrice: number | null;
  seo: {
    h1?: string;
    content?: string;
    title?: string;
    description?: string;
  };
  crossSelling: any[];
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

      // 🔥 PARALLÉLISATION MAXIMALE: 3 appels en parallèle
      const [piecesResult, seoResult, crossSellingResult] = await Promise.all([
        // 1. Pièces avec validation intégrée
        this.piecesService.getPiecesExactPHP(request.typeId, request.gammeId).catch(error => {
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
      ]);

      // Extraction des données
      const pieces = Array.isArray(piecesResult.pieces) ? piecesResult.pieces : [];
      const count = pieces.length;
      const minPrice = piecesResult.minPrice || null;

      // Validation basée sur les pièces retournées
      const validation = {
        valid: count > 0,
        relationsCount: count,
        dataQuality: this.analyzeDataQuality(pieces)
      };

      const loadTime = Date.now() - startTime;

      this.logger.log(
        `✅ [BATCH-LOADER] SUCCESS: ${count} pièces, min=${minPrice}€, SEO=${!!seoResult.content}, cross=${Array.isArray(crossSellingResult) ? crossSellingResult.length : 0}, ${loadTime}ms`
      );

      return {
        pieces,
        count,
        minPrice,
        seo: {
          h1: seoResult.h1 || undefined,
          content: seoResult.content || undefined,
          title: seoResult.title || undefined,
          description: seoResult.description || undefined,
        },
        crossSelling: Array.isArray(crossSellingResult) ? crossSellingResult : [],
        validation,
        success: true,
        timestamp: new Date().toISOString(),
        loadTime,
      };
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
