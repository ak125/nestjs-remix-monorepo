import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiContentController } from './ai-content.controller';
import { AiContentService } from './ai-content.service';
import { AiContentCacheService } from './ai-content-cache.service';
import { PromptTemplateController } from './prompt-template.controller';
import { PromptTemplateService } from './prompt-template.service';

@Module({
  imports: [ConfigModule],
  controllers: [AiContentController, PromptTemplateController],
  providers: [AiContentService, AiContentCacheService, PromptTemplateService],
  exports: [AiContentService, PromptTemplateService],
})
export class AiContentModule implements OnModuleInit {
  constructor(
    private readonly aiContentService: AiContentService,
    private readonly cacheService: AiContentCacheService,
  ) {}

  onModuleInit() {
    // Inject cache service into AI content service
    this.aiContentService.setCacheService(this.cacheService);
  }
}
