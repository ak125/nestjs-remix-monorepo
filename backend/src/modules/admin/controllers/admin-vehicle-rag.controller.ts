import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  Logger,
  BadRequestException,
  ParseIntPipe,
} from '@nestjs/common';
import { AuthenticatedGuard } from '../../../auth/authenticated.guard';
import { IsAdminGuard } from '../../../auth/is-admin.guard';
import { VehicleRagGeneratorService } from '../services/vehicle-rag-generator.service';

@Controller('api/admin/vehicle-rag')
@UseGuards(AuthenticatedGuard, IsAdminGuard)
export class AdminVehicleRagController {
  private readonly logger = new Logger(AdminVehicleRagController.name);

  constructor(private readonly ragGenerator: VehicleRagGeneratorService) {}

  /**
   * POST /api/admin/vehicle-rag/generate/:modeleId
   * Generate a vehicle RAG .md file for a single model.
   */
  @Post('generate/:modeleId')
  async generateSingle(@Param('modeleId', ParseIntPipe) modeleId: number) {
    if (modeleId <= 0) {
      throw new BadRequestException('modeleId must be a positive integer');
    }

    this.logger.log(`Vehicle RAG generate: modeleId=${modeleId}`);
    const result = await this.ragGenerator.generateForModel(modeleId);
    this.logger.log(
      `Vehicle RAG done: ${result.slug} status=${result.status} sections=${result.sections.length}`,
    );

    return { result };
  }

  /**
   * POST /api/admin/vehicle-rag/generate-batch
   * Generate vehicle RAG files for multiple models.
   * Body: { modeleIds: number[] }
   */
  @Post('generate-batch')
  async generateBatch(@Body() body: { modeleIds?: number[] }) {
    const ids = body.modeleIds || [];
    if (!ids.length || ids.length > 100) {
      throw new BadRequestException('modeleIds required (1-100 items)');
    }

    this.logger.log(`Vehicle RAG batch: ${ids.length} models`);
    const { results, summary } = await this.ragGenerator.generateBatch(ids);
    this.logger.log(`Vehicle RAG batch done: ${summary}`);

    return { summary, results };
  }

  /**
   * GET /api/admin/vehicle-rag/status
   * Get coverage status of vehicle RAG files.
   */
  @Get('status')
  async getStatus() {
    return this.ragGenerator.getStatus();
  }
}
