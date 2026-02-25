import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { AuthenticatedGuard } from '../../../auth/authenticated.guard';
import { IsAdminGuard } from '../../../auth/is-admin.guard';
import {
  VideoDataService,
  type CreateProductionDto,
  type UpdateProductionDto,
  type ProductionFilters,
} from '../services/video-data.service';
import { ScriptGeneratorService } from '../services/script-generator.service';

@Controller('api/admin/video')
@UseGuards(AuthenticatedGuard, IsAdminGuard)
export class VideoProductionController {
  private readonly logger = new Logger(VideoProductionController.name);

  constructor(
    private readonly dataService: VideoDataService,
    private readonly scriptGenerator: ScriptGeneratorService,
  ) {}

  // ── Dashboard ──

  @Get('dashboard')
  async getDashboard() {
    const stats = await this.dataService.getDashboardStats();
    return {
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    };
  }

  // ── Productions CRUD ──

  @Get('productions')
  async listProductions(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('vertical') vertical?: string,
    @Query('videoType') videoType?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ) {
    const filters: ProductionFilters = {};
    if (status) filters.status = status as ProductionFilters['status'];
    if (vertical) filters.vertical = vertical;
    if (videoType)
      filters.videoType = videoType as ProductionFilters['videoType'];
    if (search) filters.search = search;

    const result = await this.dataService.listProductions(filters, {
      page: parseInt(page || '1', 10),
      limit: Math.min(parseInt(limit || '20', 10), 100),
      sortBy: sortBy || 'created_at',
      sortOrder: (sortOrder as 'asc' | 'desc') || 'desc',
    });

    return {
      success: true,
      data: result.data,
      total: result.total,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('productions/:briefId')
  async getProduction(@Param('briefId') briefId: string) {
    const production = await this.dataService.getProduction(briefId);
    return {
      success: true,
      data: production,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('productions')
  async createProduction(@Body() body: CreateProductionDto) {
    this.logger.log(`Creating production: ${body.briefId}`);
    const production = await this.dataService.createProduction(body);
    return {
      success: true,
      data: production,
      message: `Production ${production.briefId} created`,
      timestamp: new Date().toISOString(),
    };
  }

  @Patch('productions/:briefId')
  async updateProduction(
    @Param('briefId') briefId: string,
    @Body() body: UpdateProductionDto,
  ) {
    this.logger.log(`Updating production: ${briefId}`);
    const production = await this.dataService.updateProduction(briefId, body);
    return {
      success: true,
      data: production,
      message: `Production ${briefId} updated`,
      timestamp: new Date().toISOString(),
    };
  }

  // ── Script Generation (Step 1) ──

  @Post('productions/:briefId/generate-script')
  async generateScript(
    @Param('briefId') briefId: string,
    @Body() body: { regenerate?: boolean },
  ) {
    this.logger.log(
      `Generating script for ${briefId} (regenerate=${body.regenerate ?? false})`,
    );

    const production = await this.dataService.getProduction(briefId);

    const result = await this.scriptGenerator.generateScript({
      briefId,
      videoType: production.videoType,
      vertical: production.vertical,
      gammeAlias: production.gammeAlias,
      regenerate: body.regenerate,
    });

    return {
      success: true,
      data: result,
      message: `Script generated: ${result.claimCount} claims, ~${result.estimatedDurationSecs}s`,
      timestamp: new Date().toISOString(),
    };
  }

  @Patch('productions/:briefId/script')
  async updateScript(
    @Param('briefId') briefId: string,
    @Body()
    body: {
      scriptText?: string;
      claimTable?: unknown[];
      disclaimerPlan?: { disclaimers: unknown[] };
    },
  ) {
    this.logger.log(`Updating script for ${briefId}`);

    const result = await this.scriptGenerator.updateScript(briefId, {
      scriptText: body.scriptText,
      claimTable: body.claimTable as Parameters<
        typeof this.scriptGenerator.updateScript
      >[1]['claimTable'],
      disclaimerPlan: body.disclaimerPlan as Parameters<
        typeof this.scriptGenerator.updateScript
      >[1]['disclaimerPlan'],
    });

    return {
      success: true,
      data: result,
      message: `Script updated: ${result.updatedFields.join(', ')}`,
      timestamp: new Date().toISOString(),
    };
  }

  // ── Templates ──

  @Get('templates')
  async listTemplates() {
    const templates = await this.dataService.listTemplates();
    return {
      success: true,
      data: templates,
      timestamp: new Date().toISOString(),
    };
  }

  // ── Assets ──

  @Get('assets')
  async listAssets(
    @Query('visualType') visualType?: string,
    @Query('validated') validated?: string,
  ) {
    const assets = await this.dataService.listAssets({
      visualType,
      validated: validated !== undefined ? validated === 'true' : undefined,
    });
    return {
      success: true,
      data: assets,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('assets')
  async createAsset(
    @Body()
    body: {
      assetKey: string;
      visualType: string;
      truthDependency?: string;
      tags?: string[];
      filePath?: string;
    },
  ) {
    this.logger.log(`Creating asset: ${body.assetKey}`);
    const asset = await this.dataService.createAsset(body);
    return {
      success: true,
      data: asset,
      message: `Asset ${asset.assetKey} created`,
      timestamp: new Date().toISOString(),
    };
  }

  @Patch('assets/:assetKey/validate')
  async validateAsset(
    @Param('assetKey') assetKey: string,
    @Body() body: { validatedBy: string },
  ) {
    this.logger.log(`Validating asset: ${assetKey} by ${body.validatedBy}`);
    const asset = await this.dataService.validateAsset(
      assetKey,
      body.validatedBy,
    );
    return {
      success: true,
      data: asset,
      message: `Asset ${assetKey} validated`,
      timestamp: new Date().toISOString(),
    };
  }
}
