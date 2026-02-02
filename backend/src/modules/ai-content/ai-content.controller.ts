import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
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
import {
  RateLimitStrict,
  RateLimitModerate,
} from '../../common/decorators/rate-limit.decorator';

/**
 * 🤖 AI CONTENT CONTROLLER
 *
 * REST endpoints for AI-powered content generation.
 * Protected by rate limiting to prevent API abuse.
 *
 * Rate limits:
 * - Generate endpoints: 5 req/min (strict - LLM calls are expensive)
 * - Batch endpoint: 2 req/min (very strict - multiple LLM calls)
 * - Status endpoint: 30 req/min (moderate - monitoring)
 */
@Controller('api/ai-content')
export class AiContentController {
  private readonly logger = new Logger(AiContentController.name);

  constructor(private readonly aiContentService: AiContentService) {}

  // ════════════════════════════════════════════════════════════════════════════
  // 📊 STATUS & MONITORING
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Get current provider status and circuit breaker metrics
   */
  @Get('status')
  @RateLimitModerate()
  getStatus() {
    return this.aiContentService.getProviderStatus();
  }

  /**
   * Health check for all providers
   */
  @Get('health')
  @RateLimitModerate()
  async getHealth() {
    const providerHealth =
      await this.aiContentService.checkAllProvidersHealth();
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      providers: providerHealth,
    };
  }

  /**
   * Reset circuit breaker for a specific provider
   */
  @Post('circuit/reset/:provider')
  @RateLimitModerate()
  @HttpCode(HttpStatus.OK)
  resetCircuit(@Param('provider') provider: string) {
    this.aiContentService.resetProviderCircuit(provider);
    return { success: true, provider, message: 'Circuit reset' };
  }

  /**
   * Reset all circuit breakers
   */
  @Post('circuit/reset-all')
  @RateLimitModerate()
  @HttpCode(HttpStatus.OK)
  resetAllCircuits() {
    this.aiContentService.resetAllCircuits();
    return { success: true, message: 'All circuits reset' };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 📝 CONTENT GENERATION
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Generate content using AI (rate limited: 5 req/min)
   */
  @Post('generate')
  @RateLimitStrict()
  @HttpCode(HttpStatus.OK)
  async generateContent(
    @Body() dto: GenerateContentDto,
  ): Promise<ContentResponse> {
    this.logger.log(`Generating ${dto.type} content`);
    return this.aiContentService.generateContent(dto);
  }

  /**
   * Generate product description (rate limited: 5 req/min)
   */
  @Post('generate/product-description')
  @RateLimitStrict()
  @HttpCode(HttpStatus.OK)
  async generateProductDescription(
    @Body() dto: GenerateProductDescriptionDto,
  ): Promise<ContentResponse> {
    this.logger.log(`Generating product description for ${dto.productName}`);
    return this.aiContentService.generateProductDescription(dto);
  }

  /**
   * Generate SEO meta tags (rate limited: 5 req/min)
   */
  @Post('generate/seo-meta')
  @RateLimitStrict()
  @HttpCode(HttpStatus.OK)
  async generateSEOMeta(
    @Body() dto: GenerateSEOMetaDto,
  ): Promise<ContentResponse> {
    this.logger.log(`Generating SEO meta for ${dto.pageTitle}`);
    return this.aiContentService.generateSEOMeta(dto);
  }

  /**
   * Batch generate content (rate limited: 2 req/min - very strict)
   * Warning: This makes multiple LLM calls
   */
  @Post('generate/batch')
  @RateLimitStrict()
  @HttpCode(HttpStatus.OK)
  async batchGenerate(
    @Body() dto: BatchGenerateContentDto,
  ): Promise<ContentResponse[]> {
    this.logger.log(`Batch generating ${dto.requests.length} items`);
    return this.aiContentService.batchGenerate(dto.requests);
  }
}
