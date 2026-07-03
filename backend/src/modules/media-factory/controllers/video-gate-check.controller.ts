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
import {
  VideoGatesService,
  type VideoGateInput,
} from '../services/video-gates.service';
import { VideoDataService } from '../services/video-data.service';

@Controller('api/admin/video')
@UseGuards(AuthenticatedGuard, IsAdminGuard)
export class VideoGateCheckController {
  private readonly logger = new Logger(VideoGateCheckController.name);

  constructor(
    private readonly gatesService: VideoGatesService,
    private readonly dataService: VideoDataService,
  ) {}

  /**
   * Dry-run: execute les 7 gates sans ecriture DB.
   * Retourne les verdicts + artefact check.
   */
  @Post('validate-gates')
  async validateGates(@Body() body: VideoGateInput) {
    this.logger.log('Dry-run gate validation requested');

    const artefacts = this.gatesService.checkArtefacts(body);

    if (!artefacts.canProceed) {
      return {
        success: false,
        canPublish: false,
        artefacts,
        gates: null,
        flags: [`MISSING_ARTEFACTS:${artefacts.missingArtefacts.join(',')}`],
        message: `Missing artefacts: ${artefacts.missingArtefacts.join(', ')}`,
        timestamp: new Date().toISOString(),
      };
    }

    const result = this.gatesService.runAllGates(body);

    return {
      success: true,
      canPublish: result.canPublish,
      artefacts,
      gates: result.gates,
      flags: result.flags,
      message: result.canPublish
        ? 'All gates passed — ready to publish'
        : `${result.flags.filter((f) => f.startsWith('GATE_FAIL')).length} gate(s) failed`,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Verifie les 5 artefacts obligatoires sans executer les gates.
   */
  @Post('check-artefacts')
  async checkArtefacts(@Body() body: Partial<VideoGateInput>) {
    const result = this.gatesService.checkArtefacts(body);
    return {
      success: true,
      data: result,
      message: result.canProceed
        ? 'All 5 artefacts present'
        : `Missing: ${result.missingArtefacts.join(', ')}`,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Recupere les derniers gate_results enregistres pour une production.
   */
  @Get('productions/:briefId/gates')
  async getProductionGates(@Param('briefId') briefId: string) {
    const production = await this.dataService.getProduction(briefId);
    return {
      success: true,
      data: {
        briefId: production.briefId,
        status: production.status,
        gateResults: production.gateResults,
        qualityScore: production.qualityScore,
        qualityFlags: production.qualityFlags,
      },
      timestamp: new Date().toISOString(),
    };
  }
}
