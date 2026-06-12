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

@Module({
  imports: [DatabaseModule],
  controllers: [MerchantCenterController],
  providers: [MerchantCenterFeedService],
  exports: [MerchantCenterFeedService],
})
export class MerchantCenterModule {}
