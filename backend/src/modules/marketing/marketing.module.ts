import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { MarketingDashboardController } from './controllers/marketing-dashboard.controller';
import { MarketingBacklinksController } from './controllers/marketing-backlinks.controller';
import { MarketingContentRoadmapController } from './controllers/marketing-content-roadmap.controller';
import { MarketingDataService } from './services/marketing-data.service';
import { MarketingDashboardService } from './services/marketing-dashboard.service';
import { MarketingBacklinksService } from './services/marketing-backlinks.service';
import { MarketingContentRoadmapService } from './services/marketing-content-roadmap.service';

@Module({
  imports: [DatabaseModule],
  controllers: [
    MarketingDashboardController,
    MarketingBacklinksController,
    MarketingContentRoadmapController,
  ],
  providers: [
    MarketingDataService,
    MarketingDashboardService,
    MarketingBacklinksService,
    MarketingContentRoadmapService,
  ],
  exports: [MarketingDataService],
})
export class MarketingModule {}
