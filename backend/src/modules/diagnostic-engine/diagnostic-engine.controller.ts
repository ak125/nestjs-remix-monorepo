/**
 * DiagnosticEngine Controller — API REST
 *
 * POST /api/diagnostic-engine/analyze      → Evidence Pack
 * GET  /api/diagnostic-engine/systems      → Systemes actifs
 * GET  /api/diagnostic-engine/symptoms     → Symptomes par systeme
 * GET  /api/diagnostic-engine/sessions     → Historique sessions
 * GET  /api/diagnostic-engine/sessions/:id → Session par UUID
 */
import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Param,
  Header,
  Logger,
} from '@nestjs/common';
import { DiagnosticEngineOrchestrator } from './diagnostic-engine.orchestrator';
import { DiagnosticEngineDataService } from './diagnostic-engine.data-service';
import { DiagnosticEngineSearchService } from './diagnostic-engine.search.service';
import {
  SearchQuerySchema,
  DtcCodeSchema,
  MaintenanceListQuerySchema,
  SlugParamSchema,
  PopularQuerySchema,
} from './types/public-endpoints.schema';

@Controller('api/diagnostic-engine')
export class DiagnosticEngineController {
  private readonly logger = new Logger(DiagnosticEngineController.name);

  constructor(
    private readonly orchestrator: DiagnosticEngineOrchestrator,
    private readonly dataService: DiagnosticEngineDataService,
    private readonly searchService: DiagnosticEngineSearchService,
  ) {}

  /**
   * POST /api/diagnostic-engine/analyze
   *
   * Main endpoint — accepts AnalyzeDiagnosticInput, returns EvidencePack
   */
  @Post('analyze')
  async analyze(@Body() body: unknown) {
    this.logger.log('POST /analyze');

    const result = await this.orchestrator.analyze(body);

    if (!result.success) {
      return {
        success: false,
        error: result.error,
        hint: 'Voir le schema AnalyzeDiagnosticInput pour le format attendu.',
      };
    }

    return {
      success: true,
      session_id: result.data!.session_id,
      ...result.data!.evidence,
    };
  }

  /**
   * GET /api/diagnostic-engine/systems
   *
   * List active diagnostic systems
   */
  @Get('systems')
  @Header('Cache-Control', 'public, max-age=3600')
  async getSystems() {
    const systems = await this.dataService.getActiveSystems();
    return {
      success: true,
      count: systems.length,
      systems: systems.map((s) => ({
        slug: s.slug,
        label: s.label,
        description: s.description,
        icon_slug: s.icon_slug,
        color_token: s.color_token,
      })),
    };
  }

  /**
   * GET /api/diagnostic-engine/symptoms?system=freinage
   *
   * List available symptoms for a system
   */
  @Get('symptoms')
  async getSymptoms(@Query('system') systemSlug?: string) {
    if (!systemSlug) {
      return {
        success: false,
        error: 'Paramètre "system" requis (ex: ?system=freinage)',
      };
    }

    const symptoms = await this.dataService.getSymptomsBySystem(systemSlug);
    return {
      success: true,
      system: systemSlug,
      count: symptoms.length,
      symptoms: symptoms.map((s) => ({
        slug: s.slug,
        label: s.label,
        description: s.description,
        urgency: s.urgency,
      })),
    };
  }

  /**
   * GET /api/diagnostic-engine/stats
   *
   * Dashboard stats (session counts, system coverage, knowledge base)
   */
  @Get('stats')
  async getStats() {
    const stats = await this.dataService.getStats();
    return { success: true, ...stats };
  }

  /**
   * GET /api/diagnostic-engine/sessions
   *
   * List recent diagnostic sessions
   */
  @Get('sessions')
  async listSessions(@Query('limit') limit?: string) {
    const parsedLimit = Math.min(
      Math.max(parseInt(limit || '20', 10) || 20, 1),
      50,
    );
    const sessions = await this.dataService.listRecentSessions(parsedLimit);
    return {
      success: true,
      count: sessions.length,
      sessions: sessions.map((s) => ({
        id: s.id,
        system_scope: s.system_scope,
        vehicle: s.vehicle_context,
        created_at: s.created_at,
      })),
    };
  }

  // ==========================================================================
  // Public discovery endpoints (breezy-eagle plan Phase A4)
  // Pour la surface /diagnostic-auto refactored + /entretien + typeahead
  // ==========================================================================

  /**
   * GET /api/diagnostic-engine/search?q=...&limit=10
   * Typeahead unifie symptomes + entretien + DTC
   */
  @Get('search')
  @Header('Cache-Control', 'public, max-age=60')
  async search(@Query() query: Record<string, string>) {
    const parsed = SearchQuerySchema.safeParse(query);
    if (!parsed.success) {
      return {
        success: false,
        error: 'Parametres invalides',
        details: parsed.error.issues.map((i) => i.message),
      };
    }
    const results = await this.searchService.search(
      parsed.data.q,
      parsed.data.limit,
    );
    return { success: true, q: parsed.data.q, count: results.length, results };
  }

  /**
   * GET /api/diagnostic-engine/dtc/:code
   * Lookup DTC OBD-II → symptomes + causes probables
   */
  @Get('dtc/:code')
  @Header('Cache-Control', 'public, max-age=86400')
  async lookupDtc(@Param() params: Record<string, string>) {
    const parsed = DtcCodeSchema.safeParse(params);
    if (!parsed.success) {
      return {
        success: false,
        error: 'Format DTC invalide (ex: P0300, C0035)',
      };
    }
    // Delegue au RAG via searchService (pivot 2026-04-18)
    const result = await this.searchService.lookupDtc(parsed.data.code);
    return { success: true, ...result };
  }

  /**
   * GET /api/diagnostic-engine/maintenance?system=&popular=&limit=
   * Liste des operations d'entretien
   */
  @Get('maintenance')
  @Header('Cache-Control', 'public, max-age=3600')
  async listMaintenance(@Query() query: Record<string, string>) {
    const parsed = MaintenanceListQuerySchema.safeParse(query);
    if (!parsed.success) {
      return {
        success: false,
        error: 'Parametres invalides',
        details: parsed.error.issues.map((i) => i.message),
      };
    }

    if (parsed.data.popular) {
      const items = await this.dataService.popularMaintenance(
        parsed.data.limit,
      );
      return { success: true, count: items.length, items };
    }

    const items = await this.dataService.listMaintenanceOps({
      system: parsed.data.system,
      limit: parsed.data.limit,
    });
    return { success: true, count: items.length, items };
  }

  /**
   * GET /api/diagnostic-engine/maintenance/:slug
   * Detail d'une operation d'entretien + symptomes lies
   */
  @Get('maintenance/:slug')
  @Header('Cache-Control', 'public, max-age=3600')
  async getMaintenance(@Param() params: Record<string, string>) {
    const parsed = SlugParamSchema.safeParse(params);
    if (!parsed.success) {
      return { success: false, error: 'Slug invalide' };
    }
    const result = await this.dataService.getMaintenanceBySlug(
      parsed.data.slug,
    );
    if (!result) {
      return {
        success: false,
        error: `Operation d'entretien non trouvee: ${parsed.data.slug}`,
      };
    }
    return { success: true, ...result };
  }

  /**
   * GET /api/diagnostic-engine/popular?kind=symptom|maintenance&limit=6
   * Top-N depuis __diag_session (signal agrege)
   */
  @Get('popular')
  @Header('Cache-Control', 'public, max-age=600')
  async popular(@Query() query: Record<string, string>) {
    const parsed = PopularQuerySchema.safeParse(query);
    if (!parsed.success) {
      return { success: false, error: 'Parametres invalides' };
    }
    const items =
      parsed.data.kind === 'symptom'
        ? await this.dataService.popularSymptoms(parsed.data.limit)
        : await this.dataService.popularMaintenance(parsed.data.limit);
    return {
      success: true,
      kind: parsed.data.kind,
      count: items.length,
      items,
    };
  }

  /**
   * GET /api/diagnostic-engine/symptoms/:slug
   * Detail symptome + causes probables scorees + regles securite du systeme parent
   */
  @Get('symptoms/:slug')
  @Header('Cache-Control', 'public, max-age=3600')
  async getSymptomBySlug(@Param() params: Record<string, string>) {
    const parsed = SlugParamSchema.safeParse(params);
    if (!parsed.success) {
      return { success: false, error: 'Slug invalide' };
    }
    const symptom = await this.dataService.getSymptomBySlug(parsed.data.slug);
    if (!symptom) {
      return {
        success: false,
        error: `Symptome non trouve: ${parsed.data.slug}`,
      };
    }
    const [causesLinks, system, maintenanceOps] = await Promise.all([
      this.dataService.getScoredCausesForSymptom(parsed.data.slug),
      this.dataService.getSystemById(symptom.system_id),
      this.dataService.getMaintenanceForSymptom(parsed.data.slug),
    ]);
    const safety_rules = system?.slug
      ? await this.dataService.getSafetyRules(system.slug)
      : [];

    return {
      success: true,
      symptom,
      system,
      causes: causesLinks.map((l) => ({
        slug: l.cause?.slug || `cause-${l.cause_id}`,
        label: l.cause?.label || '',
        cause_type: l.cause?.cause_type || '',
        description: l.cause?.description || null,
        verification_method: l.cause?.verification_method || null,
        urgency: l.cause?.urgency || null,
        relative_score: l.relative_score,
        evidence_for: l.evidence_for || [],
        evidence_against: l.evidence_against || [],
        requires_verification: l.requires_verification,
      })),
      safety_rules,
      maintenance_ops: maintenanceOps.map((m) => ({
        slug: m.slug,
        label: m.label,
        severity_if_overdue: m.severity_if_overdue,
        interval_km_min: m.interval_km_min,
        interval_km_max: m.interval_km_max,
      })),
    };
  }

  /**
   * GET /api/diagnostic-engine/systems/:slug
   * Systeme + symptomes + regles securite
   */
  @Get('systems/:slug')
  @Header('Cache-Control', 'public, max-age=3600')
  async getSystemBySlug(@Param() params: Record<string, string>) {
    const parsed = SlugParamSchema.safeParse(params);
    if (!parsed.success) {
      return { success: false, error: 'Slug invalide' };
    }
    const result = await this.dataService.getSystemBySlugWithSymptoms(
      parsed.data.slug,
    );
    if (!result) {
      return {
        success: false,
        error: `Systeme non trouve: ${parsed.data.slug}`,
      };
    }
    return { success: true, ...result };
  }

  /**
   * GET /api/diagnostic-engine/sessions/:id
   *
   * Retrieve a single diagnostic session by UUID (for revisiting results)
   */
  @Get('sessions/:id')
  async getSession(@Param('id') id: string) {
    // Basic UUID format validation
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id,
      )
    ) {
      return { success: false, error: 'Format UUID invalide.' };
    }

    const session = await this.dataService.getSession(id);
    if (!session) {
      return { success: false, error: 'Session introuvable.' };
    }

    return {
      success: true,
      session: {
        id: session.id,
        system_scope: session.system_scope,
        vehicle_context: session.vehicle_context,
        signal_input: session.signal_input,
        result: session.result,
        created_at: session.created_at,
      },
    };
  }
}
