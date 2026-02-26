import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { DatabaseModule } from '../../database/database.module';
import { VideoDataService } from './services/video-data.service';
import { VideoGatesService } from './services/video-gates.service';
import { VideoJobService } from './services/video-job.service';
import { VideoProductionController } from './controllers/video-production.controller';
import { VideoGateCheckController } from './controllers/video-gate-check.controller';
import { VideoExecutionController } from './controllers/video-execution.controller';
import { RenderAdapterService } from './render/render-adapter.service';

@Module({
  imports: [DatabaseModule, BullModule.registerQueue({ name: 'video-render' })],
  controllers: [
    VideoProductionController,
    VideoGateCheckController,
    VideoExecutionController,
  ],
  providers: [
    VideoDataService,
    VideoGatesService,
    VideoJobService,
    RenderAdapterService,
  ],
  exports: [
    VideoDataService,
    VideoGatesService,
    VideoJobService,
    RenderAdapterService,
  ],
})
export class MediaFactoryModule {}
