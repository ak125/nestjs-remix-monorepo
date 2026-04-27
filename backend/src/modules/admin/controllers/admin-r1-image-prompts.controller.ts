import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  Logger,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthenticatedGuard } from '@auth/authenticated.guard';
import { IsAdminGuard } from '@auth/is-admin.guard';
import { R1ImagePromptService } from '../services/r1-image-prompt.service';

@Controller('api/admin/r1-image-prompts')
@UseGuards(AuthenticatedGuard, IsAdminGuard)
export class AdminR1ImagePromptsController {
  private readonly logger = new Logger(AdminR1ImagePromptsController.name);

  constructor(private readonly imagePromptService: R1ImagePromptService) {}

  /**
   * POST /api/admin/r1-image-prompts/generate
   * Batch generation for multiple gammes
   */
  @Post('generate')
  async generateBatch(@Body() body: { pgAliases: string[]; force?: boolean }) {
    this.logger.log(
      `Batch generate R1 images for ${body.pgAliases?.length ?? 0} gammes`,
    );
    return this.imagePromptService.generateBatch(body.pgAliases ?? [], {
      force: body.force,
    });
  }

  /**
   * POST /api/admin/r1-image-prompts/generate-all
   * Generate briefs for ALL gammes with validated R1 KP
   */
  @Post('generate-all')
  async generateAll(@Body() body: { force?: boolean; limit?: number }) {
    this.logger.log(
      `Generate R1 image briefs for all eligible gammes (limit=${body.limit ?? 300})`,
    );
    return this.imagePromptService.generateAll({
      force: body.force,
      limit: body.limit,
    });
  }

  /**
   * POST /api/admin/r1-image-prompts/generate/:pgAlias
   * Single gamme generation
   */
  @Post('generate/:pgAlias')
  async generateSingle(@Param('pgAlias') pgAlias: string) {
    this.logger.log(`Generate R1 images for ${pgAlias}`);
    const result = await this.imagePromptService.generateBatch([pgAlias], {
      force: true,
    });
    return result.items[0] ?? { pgAlias, status: 'failed', reason: 'Unknown' };
  }

  /**
   * GET /api/admin/r1-image-prompts/:pgAlias
   * Get all prompts for a gamme
   */
  @Get(':pgAlias')
  async getForGamme(@Param('pgAlias') pgAlias: string) {
    return this.imagePromptService.getPromptsForGamme(pgAlias);
  }

  /**
   * PATCH /api/admin/r1-image-prompts/:id/approve
   * Approve a prompt
   */
  @Patch(':id/approve')
  async approve(@Param('id') id: string) {
    return this.imagePromptService.approvePrompt(Number(id));
  }

  /**
   * PATCH /api/admin/r1-image-prompts/:id/set-image-url
   * Set image URL after upload
   */
  @Patch(':id/set-image-url')
  async setImageUrl(
    @Param('id') id: string,
    @Body() body: { imageUrl: string; forceSelect?: boolean },
  ) {
    return this.imagePromptService.setImageUrl(Number(id), body.imageUrl, {
      forceSelect: body.forceSelect,
    });
  }

  /**
   * POST /api/admin/r1-image-prompts/:id/upload
   * Upload image file → Supabase Storage → set URL on prompt
   * - Slot vide → visible immédiatement
   * - Slot occupé → approved mais pas selected (sauf forceSelect=true)
   */
  @Post(':id/upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { forceSelect?: string },
  ) {
    if (!file) throw new BadRequestException('No file provided');

    const ripId = Number(id);
    const forceSelect =
      body?.forceSelect === 'true' || body?.forceSelect === '1';
    const result = await this.imagePromptService.uploadAndSetImage(
      ripId,
      file,
      { forceSelect },
    );
    if (!result.success) {
      throw new BadRequestException(result.error);
    }
    return result;
  }
}
