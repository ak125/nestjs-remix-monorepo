import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { VideoDataService } from './services/video-data.service';
import { VideoGatesService } from './services/video-gates.service';
import { VideoProductionController } from './controllers/video-production.controller';
import { VideoGateCheckController } from './controllers/video-gate-check.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [VideoProductionController, VideoGateCheckController],
  providers: [VideoDataService, VideoGatesService],
  exports: [VideoDataService, VideoGatesService],
})
export class MediaFactoryModule {}
