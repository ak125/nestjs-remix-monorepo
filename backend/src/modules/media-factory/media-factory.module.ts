import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { DatabaseModule } from '../../database/database.module';
import { VideoDataService } from './services/video-data.service';
import { VideoGatesService } from './services/video-gates.service';
import { VideoJobService } from './services/video-job.service';
import { VideoProductionController } from './controllers/video-production.controller';
import { VideoGateCheckController } from './controllers/video-gate-check.controller';
import { VideoExecutionController } from './controllers/video-execution.controller';
import { VideoPipelineController } from './controllers/video-pipeline.controller';
import { RenderAdapterService } from './render/render-adapter.service';
import { ScriptGeneratorService } from './services/script-generator.service';
import { AudioCacheService } from './services/audio-cache.service';
import { TtsService } from './services/tts.service';
import { PostprocessService } from './services/postprocess.service';
import { DerivativeEngineService } from './services/derivative-engine.service';

@Module({
  imports: [DatabaseModule, BullModule.registerQueue({ name: 'video-render' })],
  controllers: [
    VideoProductionController,
    VideoGateCheckController,
    VideoExecutionController,
    VideoPipelineController,
  ],
  providers: [
    VideoDataService,
    VideoGatesService,
    VideoJobService,
    RenderAdapterService,
    ScriptGeneratorService,
    AudioCacheService,
    TtsService,
    PostprocessService,
    DerivativeEngineService,
  ],
  exports: [
    VideoDataService,
    VideoGatesService,
    VideoJobService,
    RenderAdapterService,
    ScriptGeneratorService,
    AudioCacheService,
    TtsService,
    PostprocessService,
    DerivativeEngineService,
  ],
})
export class MediaFactoryModule {}
