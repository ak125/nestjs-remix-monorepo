/**
 * MetricsModule — global, exporte MetricsService partout.
 *
 * Implémente ADR-050 Livrable 3 bis (counters minimum MVP-0).
 *
 * Branché dans AppModule comme @Global() pour que les enrichers puissent
 * l'injecter sans importer le module.
 */

import { Global, Module } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { MetricsController } from './metrics.controller';

@Global()
@Module({
  providers: [MetricsService],
  controllers: [MetricsController],
  exports: [MetricsService],
})
export class MetricsModule {}
