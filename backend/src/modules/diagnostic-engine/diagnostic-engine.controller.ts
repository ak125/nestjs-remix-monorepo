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
  Logger,
} from '@nestjs/common';
import { DiagnosticEngineOrchestrator } from './diagnostic-engine.orchestrator';
import { DiagnosticEngineDataService } from './diagnostic-engine.data-service';

@Controller('api/diagnostic-engine')
export class DiagnosticEngineController {
  private readonly logger = new Logger(DiagnosticEngineController.name);

  constructor(
    private readonly orchestrator: DiagnosticEngineOrchestrator,
    private readonly dataService: DiagnosticEngineDataService,
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
   * POST /api/diagnostic-engine/breakdown
   *
   * ADR-032 — endpoint urgence routière (panne immobilisante).
   * Force `intent_type: 'breakdown'` et délègue à l'orchestrator standard
   * (le `RiskSafetyEngine` priorise les rules safety_gate=stop_immediate
   * via la priority haute du flag breakdown).
   */
  @Post('breakdown')
  async breakdown(@Body() body: unknown) {
    this.logger.log('POST /breakdown');

    const input = (body && typeof body === 'object' ? body : {}) as Record<
      string,
      unknown
    >;
    const result = await this.orchestrator.analyze({
      ...input,
      intent_type: 'breakdown',
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error,
        hint: 'Voir le schema AnalyzeDiagnosticInput pour le format attendu (intent_type forcé à breakdown).',
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
  async getSystems() {
    const systems = await this.dataService.getActiveSystems();
    return {
      success: true,
      count: systems.length,
      systems: systems.map((s) => ({
        slug: s.slug,
        label: s.label,
        description: s.description,
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
