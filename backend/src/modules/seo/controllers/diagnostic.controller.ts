import {
  Controller,
  Get,
  Param,
  Query,
  NotFoundException,
  Logger,
  Header,
} from '@nestjs/common';
import {
  DiagnosticService,
  SeoDiagnostic,
  SeoDiagnosticListItem,
} from '../services/diagnostic.service';

/**
 * Controleur API pour les pages Diagnostic (R5)
 * Observable Pro: Symptom (60%) / Sign (85%) / DTC (95%)
 *
 * Endpoints:
 * - GET /api/seo/diagnostic/featured      -> Diagnostics populaires
 * - GET /api/seo/diagnostic/cluster/:id   -> Diagnostics d'un cluster
 * - GET /api/seo/diagnostic/dtc/:code     -> Recherche par code OBD
 * - GET /api/seo/diagnostic/:slug         -> Diagnostic par slug
 * - GET /api/seo/diagnostic/:slug/exists  -> Verification d'existence
 */
@Controller('api/seo/diagnostic')
export class DiagnosticController {
  private readonly logger = new Logger(DiagnosticController.name);

  constructor(private readonly diagnosticService: DiagnosticService) {}

  /**
   * Liste les diagnostics featured (populaires)
   * GET /api/seo/diagnostic/featured
   *
   * IMPORTANT: Cette route doit etre declaree AVANT :slug
   * pour eviter que "featured" soit interprete comme un slug
   */
  @Get('featured')
  @Header('Cache-Control', 'public, max-age=3600') // Cache 1 heure
  async getFeatured(
    @Query('limit') limit?: string,
  ): Promise<{ data: SeoDiagnosticListItem[] }> {
    this.logger.debug('GET /api/seo/diagnostic/featured');

    const items = await this.diagnosticService.getFeatured(
      limit ? parseInt(limit, 10) : 10,
    );

    return { data: items };
  }

  /**
   * Liste les diagnostics d'un cluster
   * GET /api/seo/diagnostic/cluster/:clusterId
   *
   * Clusters disponibles: embrayage, freinage, moteur, suspension, electricite, refroidissement
   */
  @Get('cluster/:clusterId')
  @Header('Cache-Control', 'public, max-age=3600') // Cache 1 heure
  async getByCluster(
    @Param('clusterId') clusterId: string,
    @Query('limit') limit?: string,
  ): Promise<{ data: SeoDiagnosticListItem[] }> {
    this.logger.debug(`GET /api/seo/diagnostic/cluster/${clusterId}`);

    const items = await this.diagnosticService.getByCluster(
      clusterId,
      limit ? parseInt(limit, 10) : 20,
    );

    return { data: items };
  }

  /**
   * Recherche des diagnostics par code DTC (OBD-II)
   * GET /api/seo/diagnostic/dtc/:code
   *
   * Exemple: /api/seo/diagnostic/dtc/P0300
   */
  @Get('dtc/:code')
  @Header('Cache-Control', 'public, max-age=86400') // Cache 24h (codes DTC stables)
  async searchByDtc(
    @Param('code') code: string,
  ): Promise<{ data: SeoDiagnosticListItem[] }> {
    this.logger.debug(`GET /api/seo/diagnostic/dtc/${code}`);

    const items = await this.diagnosticService.searchByDtc(code);

    return { data: items };
  }

  /**
   * Verifie si un diagnostic existe (pour prechargement)
   * GET /api/seo/diagnostic/:slug/exists
   *
   * IMPORTANT: Doit etre avant :slug car plus specifique
   */
  @Get(':slug/exists')
  @Header('Cache-Control', 'public, max-age=86400') // Cache 24h
  async checkExists(@Param('slug') slug: string): Promise<{ exists: boolean }> {
    const exists = await this.diagnosticService.exists(slug);
    return { exists };
  }

  /**
   * Recupere un diagnostic par son slug
   * GET /api/seo/diagnostic/:slug
   *
   * Retourne le diagnostic complet avec:
   * - Section "Ce que vous ressentez" (symptom_description)
   * - Section "Ce que le technicien verifie" (sign_description)
   * - Codes OBD associes (dtc_codes, dtc_descriptions)
   * - Contexte d'apparition (ctx_phase, ctx_temp, ctx_freq)
   * - Actions recommandees
   * - Estimation couts
   * - Schema.org JSON-LD
   */
  @Get(':slug')
  @Header('Cache-Control', 'public, max-age=3600') // Cache 1 heure
  async getBySlug(
    @Param('slug') slug: string,
  ): Promise<{ data: SeoDiagnostic }> {
    this.logger.debug(`GET /api/seo/diagnostic/${slug}`);

    const diagnostic = await this.diagnosticService.getBySlug(slug);

    if (!diagnostic) {
      throw new NotFoundException(`Diagnostic non trouve: ${slug}`);
    }

    // Generer schema_org si absent
    if (!diagnostic.schema_org) {
      diagnostic.schema_org =
        this.diagnosticService.generateSchemaOrg(diagnostic);
    }

    return { data: diagnostic };
  }
}
