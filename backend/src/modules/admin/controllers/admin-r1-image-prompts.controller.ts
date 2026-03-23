import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { AuthenticatedGuard } from '../../../auth/authenticated.guard';
import { IsAdminGuard } from '../../../auth/is-admin.guard';
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
    const result = await this.imagePromptService.generateBatch([pgAlias], {});
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
    @Body() body: { imageUrl: string },
  ) {
    return this.imagePromptService.setImageUrl(Number(id), body.imageUrl);
  }
}
