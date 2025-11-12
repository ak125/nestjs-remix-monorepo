import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { AiContentService } from './ai-content.service';
import {
  GenerateContentDto,
  GenerateProductDescriptionDto,
  GenerateSEOMetaDto,
  BatchGenerateContentDto,
  ContentResponse,
} from './dto/generate-content.dto';

@Controller('api/ai-content')
export class AiContentController {
  private readonly logger = new Logger(AiContentController.name);

  constructor(private readonly aiContentService: AiContentService) {}

  @Post('generate')
  @HttpCode(HttpStatus.OK)
  async generateContent(
    @Body() dto: GenerateContentDto,
  ): Promise<ContentResponse> {
    this.logger.log(`Generating ${dto.type} content`);
    return this.aiContentService.generateContent(dto);
  }

  @Post('generate/product-description')
  @HttpCode(HttpStatus.OK)
  async generateProductDescription(
    @Body() dto: GenerateProductDescriptionDto,
  ): Promise<ContentResponse> {
    this.logger.log(`Generating product description for ${dto.productName}`);
    return this.aiContentService.generateProductDescription(dto);
  }

  @Post('generate/seo-meta')
  @HttpCode(HttpStatus.OK)
  async generateSEOMeta(
    @Body() dto: GenerateSEOMetaDto,
  ): Promise<ContentResponse> {
    this.logger.log(`Generating SEO meta for ${dto.pageTitle}`);
    return this.aiContentService.generateSEOMeta(dto);
  }

  @Post('generate/batch')
  @HttpCode(HttpStatus.OK)
  async batchGenerate(
    @Body() dto: BatchGenerateContentDto,
  ): Promise<ContentResponse[]> {
    this.logger.log(`Batch generating ${dto.requests.length} items`);
    return this.aiContentService.batchGenerate(dto.requests);
  }
}
