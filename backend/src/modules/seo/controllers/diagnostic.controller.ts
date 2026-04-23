import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  Logger,
  Header,
  UseGuards,
} from '@nestjs/common';
import { DomainNotFoundException } from '../../../common/exceptions';
import { IsAdminGuard } from '../../../auth/is-admin.guard';
import {
  DiagnosticService,
  SeoDiagnostic,
  SeoDiagnosticListItem,
  DiagnosticQualityResult,
} from '../validation/diagnostic.service';

/**
 * Controleur API pour les pages Diagnostic (R5)
 * Observable Pro: Symptom (60%) / Sign (85%) / DTC (95%)
 *
 * IMPORTANT: L'ordre des routes compte en NestJS!
 * Les routes statiques doivent être AVANT les routes dynamiques (:slug)
 */
@Controller('api/seo/diagnostic')
export class DiagnosticController {
  private readonly logger = new Logger(DiagnosticController.name);

  constructor(private readonly diagnosticService: DiagnosticService) {}

  // ============================================
  // ROUTES STATIQUES (AVANT les routes avec :slug)
  // ============================================

  /**
   * Liste les diagnostics featured (populaires)
   * GET /api/seo/diagnostic/featured
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
   * Liste tous les drafts (diagnostics non publiés)
   * GET /api/seo/diagnostic/drafts
   * ADMIN ONLY
   */
  @Get('drafts')
  @UseGuards(IsAdminGuard)
  async getDrafts(): Promise<{
    drafts: SeoDiagnosticListItem[];
    total: number;
  }> {
    this.logger.debug('📝 GET /api/seo/diagnostic/drafts');
    const drafts = await this.diagnosticService.getDrafts();
    return { drafts, total: drafts.length };
  }

  /**
   * Génère des diagnostics R5 depuis les templates
   * POST /api/seo/diagnostic/generate
   * Crée les entrées en mode DRAFT (is_published: false)
   * ADMIN ONLY
   */
  /**
   * @deprecated since breezy-eagle plan (2026-04-18). Use the DiagnosticEngine
   * at /api/diagnostic-engine backed by __diag_* tables instead. This legacy
   * generation path writes to __seo_observable which is no longer the source
   * of truth for the public diagnostic surface.
   */
  @Post('generate')
  @UseGuards(IsAdminGuard)
  async generateFromTemplates(): Promise<{ created: number; skipped: number }> {
    this.logger.warn(
      '[DEPRECATED] POST /api/seo/diagnostic/generate — use /api/diagnostic-engine (breezy-eagle plan)',
    );
    return this.diagnosticService.generateFromTemplates();
  }

  /**
   * Audit qualite de toutes les pages R5 (read-only, grace mode).
   * GET /api/seo/diagnostic/quality-audit
   * ADMIN ONLY
   */
  @Get('quality-audit')
  @UseGuards(IsAdminGuard)
  async qualityAudit(): Promise<{
    total: number;
    publishable: number;
    blocked: number;
    avgScore: number;
    topFlags: Array<{ flag: string; count: number }>;
    details: Array<{
      slug: string;
      title: string;
      score: number;
      flags: string[];
      isPublishable: boolean;
      vehicleDependencyScore: number;
      surfaceRecommendation: string | null;
    }>;
  }> {
    this.logger.log('📊 GET /api/seo/diagnostic/quality-audit');
    return this.diagnosticService.qualityAudit();
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

  // ============================================
  // ROUTES AVEC :slug (sous-routes d'abord)
  // ============================================

  /**
   * Valide la qualite d'un diagnostic (read-only, grace mode).
   * GET /api/seo/diagnostic/:slug/quality
   */
  @Get(':slug/quality')
  async getQuality(@Param('slug') slug: string): Promise<{
    slug: string;
    quality: DiagnosticQualityResult | null;
    error?: string;
  }> {
    this.logger.debug(`GET /api/seo/diagnostic/${slug}/quality`);

    const diagnostic = await this.diagnosticService.getBySlug(slug);
    if (!diagnostic) {
      return { slug, quality: null, error: 'Diagnostic not found' };
    }

    const quality =
      this.diagnosticService.validateDiagnosticQuality(diagnostic);
    return { slug, quality };
  }

  /**
   * Verifie si un diagnostic existe (pour prechargement)
   * GET /api/seo/diagnostic/:slug/exists
   */
  @Get(':slug/exists')
  @Header('Cache-Control', 'public, max-age=86400') // Cache 24h
  async checkExists(@Param('slug') slug: string): Promise<{ exists: boolean }> {
    const exists = await this.diagnosticService.exists(slug);
    return { exists };
  }

  /**
   * Publie un diagnostic (is_published: true)
   * PATCH /api/seo/diagnostic/:slug/publish
   * ADMIN ONLY
   */
  /**
   * @deprecated since breezy-eagle plan (2026-04-18). __seo_observable publish
   * path is frozen — use the DiagnosticEngine at /api/diagnostic-engine for
   * new authored content.
   */
  @Patch(':slug/publish')
  @UseGuards(IsAdminGuard)
  async publishDiagnostic(
    @Param('slug') slug: string,
  ): Promise<{ success: boolean; error?: string }> {
    this.logger.warn(
      `[DEPRECATED] PATCH /api/seo/diagnostic/${slug}/publish — use /api/diagnostic-engine (breezy-eagle plan)`,
    );
    return this.diagnosticService.publish(slug);
  }

  /**
   * Met à jour un diagnostic (draft ou publié)
   * PATCH /api/seo/diagnostic/:slug
   * ADMIN ONLY
   */
  @Patch(':slug')
  @UseGuards(IsAdminGuard)
  async updateDiagnostic(
    @Param('slug') slug: string,
    @Body()
    body: Partial<{
      title: string;
      meta_description: string;
      symptom_description: string;
      sign_description: string;
      observable_type: string;
      perception_channel: string;
      risk_level: string;
      safety_gate: string;
      dtc_codes: string[];
      dtc_descriptions: Record<string, string>;
      recommended_actions: Array<{
        action: string;
        urgency: string;
        skill_level: string;
        duration: string;
      }>;
      estimated_repair_cost_min: number;
      estimated_repair_cost_max: number;
      estimated_repair_duration: string;
      differentiation_checklist: Array<{
        criterion: string;
        if_yes: string;
        if_no: string;
      }>;
      consultation_triggers: Array<{
        trigger: string;
        urgency: string;
        reason: string;
      }>;
      do_dont_list: { do: string[]; dont: string[] };
    }>,
  ): Promise<{ success: boolean; error?: string }> {
    this.logger.log(`✏️ PATCH /api/seo/diagnostic/${slug}`);
    return this.diagnosticService.update(slug, body);
  }

  /**
   * Supprime un draft (non publié uniquement)
   * DELETE /api/seo/diagnostic/:slug
   * ADMIN ONLY
   */
  @Delete(':slug')
  @UseGuards(IsAdminGuard)
  async deleteDraft(
    @Param('slug') slug: string,
  ): Promise<{ success: boolean; error?: string }> {
    this.logger.log(`🗑️ DELETE /api/seo/diagnostic/${slug}`);
    return this.diagnosticService.deleteDraft(slug);
  }

  // ============================================
  // ROUTE GÉNÉRIQUE :slug (EN DERNIER!)
  // ============================================

  /**
   * Returns 301 redirect target for R5 sub-pages → R3 conseil.
   * GET /api/seo/diagnostic/redirect/:slug
   */
  @Get('redirect/:slug')
  @Header('Cache-Control', 'public, max-age=86400')
  async getRedirectTarget(
    @Param('slug') slug: string,
  ): Promise<{ redirect_to: string | null; pg_alias: string | null }> {
    const result = await this.diagnosticService.getRedirectTarget(slug);
    return result ?? { redirect_to: null, pg_alias: null };
  }

  /**
   * Recupere un diagnostic par son slug
   * GET /api/seo/diagnostic/:slug
   *
   * IMPORTANT: Cette route doit être EN DERNIER car elle capture tout!
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
      throw new DomainNotFoundException({
        message: `Diagnostic non trouvé: ${slug}`,
        code: 'DIAGNOSTIC.NOT_FOUND',
        details: `Aucun diagnostic publié pour le slug "${slug}"`,
        context: { slug, route: 'R5_DIAGNOSTIC' },
      });
    }

    // Generer schema_org si absent
    if (!diagnostic.schema_org) {
      diagnostic.schema_org =
        this.diagnosticService.generateSchemaOrg(diagnostic);
    }

    return { data: diagnostic };
  }
}
