import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AiContentModule } from '../ai-content/ai-content.module';
// Existing controllers
import { MarketingDashboardController } from './controllers/marketing-dashboard.controller';
import { MarketingBacklinksController } from './controllers/marketing-backlinks.controller';
import { MarketingContentRoadmapController } from './controllers/marketing-content-roadmap.controller';
// Hub controllers
import { MarketingSocialPostsController } from './controllers/marketing-social-posts.controller';
import { MarketingPipelineController } from './controllers/marketing-pipeline.controller';
// ADR-036 Phase 1 controllers
import { MarketingBriefsController } from './controllers/marketing-briefs.controller';
// Existing services
import { MarketingDataService } from './services/marketing-data.service';
import { MarketingDashboardService } from './services/marketing-dashboard.service';
import { MarketingBacklinksService } from './services/marketing-backlinks.service';
import { MarketingContentRoadmapService } from './services/marketing-content-roadmap.service';
// Hub services
import { MarketingHubDataService } from './services/marketing-hub-data.service';
import { UTMBuilderService } from './services/utm-builder.service';
import { WeeklyPlanGeneratorService } from './services/weekly-plan-generator.service';
import { MultiChannelCopywriterService } from './services/multi-channel-copywriter.service';
import { BrandComplianceGateService } from './services/brand-compliance-gate.service';
import { PublishQueueService } from './services/publish-queue.service';
// ADR-036 Phase 1 services
import { MarketingBriefsService } from './services/marketing-briefs.service';

@Module({
  imports: [DatabaseModule, forwardRef(() => AiContentModule)],
  controllers: [
    MarketingDashboardController,
    MarketingBacklinksController,
    MarketingContentRoadmapController,
    MarketingSocialPostsController,
    MarketingPipelineController,
    // ADR-036 Phase 1
    MarketingBriefsController,
  ],
  providers: [
    // Existing
    MarketingDataService,
    MarketingDashboardService,
    MarketingBacklinksService,
    MarketingContentRoadmapService,
    // Hub
    MarketingHubDataService,
    UTMBuilderService,
    WeeklyPlanGeneratorService,
    MultiChannelCopywriterService,
    BrandComplianceGateService,
    PublishQueueService,
    // ADR-036 Phase 1
    MarketingBriefsService,
  ],
  exports: [MarketingDataService, MarketingHubDataService, UTMBuilderService],
})
export class MarketingModule {}
