import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { VEHICLE_CONTEXT_PORT } from '../diagnostic-engine/ports/vehicle-context.port';
import { VehicleContextMiddleware } from './vehicle-context.middleware';
import { VehicleContextService } from './vehicle-context.service';

/**
 * VehicleContextModule — D4 implementation of the VehicleContextPort.
 *
 * Provides :
 *  - `VehicleContextService` (concrete) — direct DI for D4 internal use.
 *  - `VEHICLE_CONTEXT_PORT` symbol — DI token consumed by D7 (Diagnostic)
 *    and D11 (Commerce) so they never reach into D4 internals.
 *
 * Middleware is mounted on the narrow surface that actually needs the
 * context (canon : minimise blast radius — global middlewares cost
 * latency on every request including static assets).
 */
@Module({
  imports: [ConfigModule, EventEmitterModule],
  providers: [
    VehicleContextService,
    {
      provide: VEHICLE_CONTEXT_PORT,
      useExisting: VehicleContextService,
    },
  ],
  exports: [VehicleContextService, VEHICLE_CONTEXT_PORT],
})
export class VehicleContextModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(VehicleContextMiddleware).forRoutes(
      { path: 'api/diagnostic/*', method: RequestMethod.ALL },
      { path: 'api/v1/orientation/*', method: RequestMethod.ALL },
    );
  }
}
