import {
  Controller,
  Get,
  Post,
  Patch,
  Query,
  Param,
  Body,
  Res,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthenticatedGuard } from '@auth/authenticated.guard';
import { IsAdminGuard } from '@auth/is-admin.guard';
import { R3ImagePromptService } from '../services/r3-image-prompt.service';
import {
  GenerateImagePromptsDto,
  ImagePromptQueryDto,
} from '../dto/r3-image-prompt.dto';

@Controller('api/admin/r3-image-prompts')
@UseGuards(AuthenticatedGuard, IsAdminGuard)
export class AdminR3ImagePromptsController {
  private readonly logger = new Logger(AdminR3ImagePromptsController.name);

  constructor(private readonly imagePromptService: R3ImagePromptService) {}

  /**
   * POST /api/admin/r3-image-prompts/generate
   * Batch generation for multiple gammes
   */
  @Post('generate')
  async generateBatch(@Body() body: unknown) {
    const parsed = GenerateImagePromptsDto.parse(body);
    this.logger.log(`Batch generate for ${parsed.pgAliases.length} gammes`);
    return this.imagePromptService.generateBatch(parsed.pgAliases, {
      force: parsed.force,
      slotsFilter: parsed.slotsFilter,
    });
  }

  /**
   * POST /api/admin/r3-image-prompts/generate/:pgAlias
   * Single gamme generation
   */
  @Post('generate/:pgAlias')
  async generateSingle(@Param('pgAlias') pgAlias: string) {
    this.logger.log(`Generate for ${pgAlias}`);

    // Look up pgId and pgName from the batch method (single-item batch)
    const result = await this.imagePromptService.generateBatch([pgAlias], {});
    return result.items[0] ?? { pgAlias, status: 'failed', reason: 'Unknown' };
  }

  /**
   * GET /api/admin/r3-image-prompts
   * List prompts with filters
   */
  @Get()
  async listPrompts(
    @Query('status') status?: string,
    @Query('slot_id') slot_id?: string,
    @Query('pg_alias') pg_alias?: string,
    @Query('selected_only') selected_only?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const parsed = ImagePromptQueryDto.parse({
      status,
      slot_id,
      pg_alias,
      selected_only,
      limit,
      offset,
    });
    return this.imagePromptService.listPrompts({
      ...parsed,
      limit: parsed.limit ?? 50,
      offset: parsed.offset ?? 0,
    });
  }

  /**
   * GET /api/admin/r3-image-prompts/export
   * CSV download
   */
  @Get('export')
  async exportCsv(
    @Res() res: Response,
    @Query('status') status?: string,
    @Query('slot_id') slot_id?: string,
    @Query('selected_only') selected_only?: string,
  ) {
    const csv = await this.imagePromptService.exportCsv({
      status,
      slot_id,
      selected_only: selected_only === 'true',
    });

    const date = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="r3-image-prompts-${date}.csv"`,
    );
    res.send(csv);
  }

  /**
   * GET /api/admin/r3-image-prompts/export/json
   * JSON download
   */
  @Get('export/json')
  async exportJson(
    @Query('status') status?: string,
    @Query('slot_id') slot_id?: string,
    @Query('selected_only') selected_only?: string,
  ) {
    return this.imagePromptService.exportJson({
      status,
      slot_id,
      selected_only: selected_only === 'true',
    });
  }

  /**
   * GET /api/admin/r3-image-prompts/:pgAlias
   * All prompts for one gamme
   */
  @Get(':pgAlias')
  async getForGamme(@Param('pgAlias') pgAlias: string) {
    return this.imagePromptService.getPromptsForGamme(pgAlias);
  }

  /**
   * PATCH /api/admin/r3-image-prompts/:id/approve
   * Mark prompt as approved
   */
  @Patch(':id/approve')
  async approvePrompt(@Param('id') id: string) {
    const numId = parseInt(id, 10);
    if (isNaN(numId)) {
      return { error: 'Invalid ID' };
    }
    return this.imagePromptService.approvePrompt(numId);
  }

  /**
   * PATCH /api/admin/r3-image-prompts/:id/set-image-url
   * Set the actual image URL after upload
   */
  @Patch(':id/set-image-url')
  async setImageUrl(
    @Param('id') id: string,
    @Body() body: { imageUrl: string },
  ) {
    const numId = parseInt(id, 10);
    if (isNaN(numId)) {
      return { error: 'Invalid ID' };
    }
    if (!body.imageUrl || typeof body.imageUrl !== 'string') {
      return { error: 'imageUrl is required' };
    }
    return this.imagePromptService.setImageUrl(numId, body.imageUrl);
  }
}
