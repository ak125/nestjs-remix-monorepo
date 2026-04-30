import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiContentController } from './ai-content.controller';
import { AiContentService } from './ai-content.service';
import { AiContentCacheService } from './ai-content-cache.service';
import { PromptTemplateController } from './prompt-template.controller';
import { PromptTemplateService } from './prompt-template.service';
import { CircuitBreakerService } from './services/circuit-breaker.service';

@Module({
  imports: [ConfigModule],
  controllers: [AiContentController, PromptTemplateController],
  providers: [
    AiContentService,
    AiContentCacheService,
    PromptTemplateService,
    CircuitBreakerService,
  ],
  exports: [AiContentService, PromptTemplateService, CircuitBreakerService],
})
export class AiContentModule implements OnModuleInit {
  private readonly logger = new Logger(AiContentModule.name);

  constructor(
    private readonly aiContentService: AiContentService,
    private readonly cacheService: AiContentCacheService,
    private readonly circuitBreaker: CircuitBreakerService,
  ) {}

  onModuleInit() {
    // Inject cache service into AI content service
    this.aiContentService.setCacheService(this.cacheService);

    // Inject circuit breaker for provider failover
    this.aiContentService.setCircuitBreaker(this.circuitBreaker);

    this.logger.log('🤖 AI Content Module initialized with:');
    this.logger.log('   • Cache service');
    this.logger.log('   • Circuit breaker for failover');
  }
}
