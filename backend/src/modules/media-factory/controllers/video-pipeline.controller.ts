/**
 * VideoPipelineController — Pipeline generation endpoints (script, audio, derivatives).
 *
 * Separated from VideoProductionController (CRUD) to keep single-responsibility
 * and avoid linter conflicts with multi-service injection.
 *
 * 4 endpoints:
 *   POST productions/:briefId/generate-script
 *   POST productions/:briefId/generate-audio
 *   POST productions/:briefId/derive
 *   GET  productions/:briefId/derivatives
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { AuthenticatedGuard } from '../../../auth/authenticated.guard';
import { IsAdminGuard } from '../../../auth/is-admin.guard';
import { VideoDataService } from '../services/video-data.service';
import { ScriptGeneratorService } from '../services/script-generator.service';
import { TtsService, type TtsVoice } from '../services/tts.service';
import {
  DerivativeEngineService,
  type DerivativePolicy,
} from '../services/derivative-engine.service';

@Controller('api/admin/video')
@UseGuards(AuthenticatedGuard, IsAdminGuard)
export class VideoPipelineController {
  private readonly logger = new Logger(VideoPipelineController.name);

  constructor(
    private readonly dataService: VideoDataService,
    private readonly scriptGenerator: ScriptGeneratorService,
    private readonly ttsService: TtsService,
    private readonly derivativeEngine: DerivativeEngineService,
  ) {}

  // ── Script Generation ──

  @Post('productions/:briefId/generate-script')
  async generateScript(
    @Param('briefId') briefId: string,
    @Body() body: { regenerate?: boolean },
  ) {
    this.logger.log(`[PIPELINE] generate-script for ${briefId}`);

    const production = await this.dataService.getProduction(briefId);

    const result = await this.scriptGenerator.generateScript({
      briefId,
      videoType: production.videoType,
      vertical: production.vertical,
      gammeAlias: production.gammeAlias ?? null,
      regenerate: body.regenerate ?? false,
    });

    return {
      success: true,
      data: result,
      message: `Script generated for ${briefId} (${result.claimCount} claims)`,
      timestamp: new Date().toISOString(),
    };
  }

  // ── Audio Generation (TTS) ──

  @Post('productions/:briefId/generate-audio')
  async generateAudio(
    @Param('briefId') briefId: string,
    @Body() body: { voice?: string; speed?: number; regenerate?: boolean },
  ) {
    this.logger.log(`[PIPELINE] generate-audio for ${briefId}`);

    const production = await this.dataService.getProduction(briefId);

    if (!production.scriptText) {
      return {
        success: false,
        error: `Production ${briefId} has no script — generate a script first`,
        timestamp: new Date().toISOString(),
      };
    }

    const result = await this.ttsService.generateAudio({
      briefId,
      text: production.scriptText,
      voice: (body.voice as TtsVoice) || undefined,
      speed: body.speed,
      regenerate: body.regenerate ?? false,
    });

    return {
      success: true,
      data: result,
      message: `Audio generated for ${briefId} (${result.costChars} chars, cached=${result.cached})`,
      timestamp: new Date().toISOString(),
    };
  }

  // ── Derivative Engine ──

  @Post('productions/:briefId/derive')
  async deriveFromMaster(
    @Param('briefId') briefId: string,
    @Body() body: { policy?: Partial<DerivativePolicy> },
  ) {
    this.logger.log(`[PIPELINE] derive from master ${briefId}`);

    const result = await this.derivativeEngine.deriveFromMaster(
      briefId,
      body.policy,
    );

    return {
      success: true,
      data: result,
      message: `${result.derivativesCreated} derivatives created from ${briefId}`,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('productions/:briefId/derivatives')
  async listDerivatives(@Param('briefId') briefId: string) {
    const derivatives = await this.derivativeEngine.listDerivatives(briefId);

    return {
      success: true,
      data: derivatives,
      total: derivatives.length,
      timestamp: new Date().toISOString(),
    };
  }
}
