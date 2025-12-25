import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Logger,
  HttpException,
  HttpStatus,
  Header,
} from '@nestjs/common';
import { OemRefsResult } from '../services/vehicle-pieces-compatibility.service';
import { GammeUnifiedService } from '../services/gamme-unified.service';
import { VehiclesService } from '../../vehicles/vehicles.service';
import { UnifiedPageDataService } from '../services/unified-page-data.service';

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
  // 🔧 Codes moteur et types mines (V7)
  motorCodesFormatted?: string;
  mineCodesFormatted?: string;
  cnitCodesFormatted?: string;
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
  oemRefs?: OemRefsResult; // 🔧 V4: Refs OEM constructeur filtrées par marque véhicule
  oemRefsSeo?: string[]; // 🎯 V5: Refs OEM filtrées par plateforme véhicule (SEO optimisé)
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
    private readonly gammeService: GammeUnifiedService,
    private readonly vehiclesService: VehiclesService,
    private readonly unifiedPageDataService: UnifiedPageDataService,
  ) {}

  /**
   * 🚀 GET endpoint pour cache navigateur (LCP optimization)
   * Les navigateurs cachent uniquement les GET, pas les POST
   * 🔒 Validation SEO: Retourne 404 si typeId ou gammeId inexistant
   */
  @Get(':typeId/:gammeId')
  @Header(
    'Cache-Control',
    'public, max-age=86400, stale-while-revalidate=86400',
  )
  async batchLoadGet(
    @Param('typeId') typeId: string,
    @Param('gammeId') gammeId: string,
  ): Promise<BatchLoaderResponse> {
    const parsedTypeId = parseInt(typeId, 10);
    const parsedGammeId = parseInt(gammeId, 10);

    // 🔒 Validation SEO: Vérifier que les IDs sont valides
    if (isNaN(parsedTypeId) || parsedTypeId <= 0) {
      throw new HttpException(
        'Type de véhicule invalide',
        HttpStatus.NOT_FOUND,
      );
    }

    if (isNaN(parsedGammeId) || parsedGammeId <= 0) {
      throw new HttpException('Gamme de pièces invalide', HttpStatus.NOT_FOUND);
    }

    // 🚀 LCP OPTIMIZATION: Validations en parallèle (économie ~100-200ms)
    try {
      const [typeResult, gammeExists] = await Promise.all([
        this.vehiclesService.getTypeById(parsedTypeId),
        this.gammeService.gammeExists(parsedGammeId),
      ]);

      // 🔒 Validation SEO: Vérifier que le type existe
      if (!typeResult?.data || typeResult.data.length === 0) {
        this.logger.warn(
          `🔒 SEO: Type inexistant typeId=${parsedTypeId} → 404`,
        );
        throw new HttpException(
          'Type de véhicule inexistant',
          HttpStatus.NOT_FOUND,
        );
      }

      // 🔒 Validation SEO: Vérifier que la gamme existe
      if (!gammeExists) {
        this.logger.warn(
          `🔒 SEO: Gamme inexistante gammeId=${parsedGammeId} → 404`,
        );
        throw new HttpException(
          'Gamme de pièces inexistante',
          HttpStatus.NOT_FOUND,
        );
      }
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.warn(
        `🔒 SEO: Erreur validation typeId=${parsedTypeId} ou gammeId=${parsedGammeId} → 404`,
      );
      throw new HttpException('Ressource inexistante', HttpStatus.NOT_FOUND);
    }

    // Réutiliser la logique existante
    return this.batchLoad({
      typeId: parsedTypeId,
      gammeId: parsedGammeId,
      marqueId: 0,
      modeleId: 0,
    });
  }

  @Post()
  @Header(
    'Cache-Control',
    'public, max-age=86400, stale-while-revalidate=86400',
  )
  async batchLoad(
    @Body() request: BatchLoaderRequest,
  ): Promise<BatchLoaderResponse> {
    const startTime = Date.now();

    this.logger.log(
      `🚀 [BATCH-LOADER] START: type=${request.typeId}, gamme=${request.gammeId}, marque=${request.marqueId}, modele=${request.modeleId}`,
    );

    try {
      // Validation des paramètres
      if (!request.typeId || !request.gammeId) {
        throw new HttpException(
          'typeId et gammeId sont requis',
          HttpStatus.BAD_REQUEST,
        );
      }

      // ⚡ MODE RPC V3 UNIFIÉ: 1 requête PostgreSQL au lieu de ~33
      return this.batchLoadUnified(request, startTime);
    } catch (error: any) {
      const loadTime = Date.now() - startTime;

      this.logger.error(
        `❌ [BATCH-LOADER] ERROR: ${error.message}, ${loadTime}ms`,
      );

      throw new HttpException(
        {
          success: false,
          message: error.message, // Added for ExceptionFilter compatibility
          error: error.message,
          timestamp: new Date().toISOString(),
          loadTime,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
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
    const withoutBrand = pieces.filter(
      (p) => !p.marque || p.marque === 'Marque inconnue',
    );
    const percentWithoutBrand = (withoutBrand.length / pieces.length) * 100;

    if (percentWithoutBrand > 80) {
      issues.push('missing_brands');
    }

    // Pièces sans image
    const withoutImage = pieces.filter(
      (p) => !p.image || p.image === '/images/pieces/default.png',
    );
    const percentWithoutImage = (withoutImage.length / pieces.length) * 100;

    if (percentWithoutImage > 50) {
      issues.push('missing_images');
    }

    // Pièces sans prix
    const withoutPrice = pieces.filter(
      (p) => !p.prix_unitaire || p.prix_unitaire === 0,
    );
    const percentWithoutPrice = (withoutPrice.length / pieces.length) * 100;

    if (percentWithoutPrice > 20) {
      issues.push('missing_prices');
    }

    // Score qualité (0-100)
    const quality = Math.round(
      100 -
        percentWithoutBrand * 0.5 -
        percentWithoutImage * 0.3 -
        percentWithoutPrice * 0.2,
    );

    return {
      quality: Math.max(0, quality),
      pieces_with_brand_percent: Math.round(100 - percentWithoutBrand),
      pieces_with_image_percent: Math.round(100 - percentWithoutImage),
      pieces_with_price_percent: Math.round(100 - percentWithoutPrice),
      issues: issues.length > 0 ? issues : undefined,
    };
  }

  /**
   * ⚡ RPC V3 UNIFIÉ - 1 requête PostgreSQL optimisée
   *
   * Utilise get_pieces_for_type_gamme_v3 qui retourne TOUT en 1 appel:
   * - vehicle_info (type, modele, marque)
   * - gamme_info (pg_name, pg_alias, mf_id)
   * - seo_templates (h1, content, title, description)
   * - oem_refs (filtrées par marque véhicule)
   * - pieces, grouped_pieces, filters
   */
  private async batchLoadUnified(
    request: BatchLoaderRequest,
    startTime: number,
  ): Promise<BatchLoaderResponse> {
    this.logger.log(`⚡ [BATCH-LOADER] RPC V3 unifié`);

    try {
      // Appel unique au service unifié
      const pageData = await this.unifiedPageDataService.getPageData(
        request.typeId,
        request.gammeId,
      );

      const loadTime = Date.now() - startTime;

      // Mapper vers le format BatchLoaderResponse existant
      const vehicleInfo: VehicleInfo | undefined = pageData.vehicle
        ? {
            typeId: pageData.vehicle.type.id,
            typeName: pageData.vehicle.type.name,
            typeBody: pageData.vehicle.type.body || undefined,
            typeEngine: pageData.vehicle.type.engine || undefined,
            typePowerPs: pageData.vehicle.type.power_ps
              ? parseInt(pageData.vehicle.type.power_ps)
              : undefined,
            typeDateStart: pageData.vehicle.type.yearFrom || undefined,
            typeDateEnd: pageData.vehicle.type.yearTo || undefined,
            modeleId: pageData.vehicle.modele.id,
            modeleName: pageData.vehicle.modele.name,
            modelePic: pageData.vehicle.modele.pic || undefined,
            modeleAlias: pageData.vehicle.modele.alias || undefined,
            marqueId: pageData.vehicle.marque.id,
            marqueName: pageData.vehicle.marque.name,
            marqueAlias: pageData.vehicle.marque.alias || undefined,
            // 🔧 V7: Codes moteur (depuis RPC motorCodes ou vehicle.type)
            motorCodesFormatted: pageData.vehicle.motorCodes || undefined,
          }
        : undefined;

      // Construire oemRefs dans le format attendu
      const oemRefsData: OemRefsResult | undefined =
        pageData.oemRefs.length > 0
          ? {
              oemRefs: pageData.oemRefs,
              count: pageData.oemRefs.length,
              vehicleMarque: pageData.vehicle?.marque.name || '',
            }
          : undefined;

      this.logger.log(
        `✅ [BATCH-LOADER-V2] SUCCESS: ${pageData.count} pièces, ` +
          `min=${pageData.minPrice}€, SEO=${pageData.seo.success}, ` +
          `OEM=${pageData.oemRefs.length}, cache=${pageData.cacheHit}, ` +
          `source=${pageData.source}, ${loadTime}ms`,
      );

      return {
        pieces: pageData.pieces,
        grouped_pieces: pageData.groupedPieces,
        blocs: pageData.blocs,
        filters: pageData.filters,
        count: pageData.count,
        minPrice: pageData.minPrice || null,
        seo: {
          h1: pageData.seo.h1 || undefined,
          content: pageData.seo.content || undefined,
          title: pageData.seo.title || undefined,
          description: pageData.seo.description || undefined,
        },
        crossSelling: [], // Non implémenté en V2 pour l'instant
        vehicleInfo,
        oemRefs: oemRefsData,
        oemRefsSeo: pageData.oemRefs, // Déjà filtrées par la RPC
        validation: {
          valid: pageData.count > 0,
          relationsCount: pageData.count,
          dataQuality: this.analyzeDataQuality(pageData.pieces),
        },
        success: pageData.success,
        timestamp: new Date().toISOString(),
        loadTime,
      };
    } catch (error: any) {
      const loadTime = Date.now() - startTime;

      this.logger.error(
        `❌ [BATCH-LOADER] ERROR: ${error.message}, ${loadTime}ms`,
      );
      throw new HttpException(
        {
          success: false,
          message: error.message,
          error: error.message,
          timestamp: new Date().toISOString(),
          loadTime,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
