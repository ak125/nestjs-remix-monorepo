/**
 * MerchantCenterModule — Google Shopping XML feed.
 *
 * Wires up the public `/api/feed/merchant-center.xml` endpoint.
 * GMC fetches the URL directly per its own schedule (default daily).
 *
 * Plan ref : superpower-1-d-abord-proud-cookie.md step 5B.
 */
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { MerchantCenterController } from './controllers/merchant-center.controller';
import { MerchantCenterFeedService } from './services/merchant-center-feed.service';
import { PriceCompetitivenessController } from './controllers/price-competitiveness.controller';
import { PriceCompetitivenessService } from './services/price-competitiveness.service';
import { GoogleCredentialsService } from '../seo-monitoring/services/google-credentials.service';

@Module({
  imports: [DatabaseModule],
  controllers: [MerchantCenterController, PriceCompetitivenessController],
  // GoogleCredentialsService is stateless (ConfigService only) — provided here to
  // avoid importing the whole SeoMonitoringModule just for Content API auth.
  providers: [
    MerchantCenterFeedService,
    PriceCompetitivenessService,
    GoogleCredentialsService,
  ],
  exports: [MerchantCenterFeedService, PriceCompetitivenessService],
})
export class MerchantCenterModule {}
