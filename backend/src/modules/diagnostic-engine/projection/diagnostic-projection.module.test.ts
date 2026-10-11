// Lu par les constructeurs à la compilation du module (aucune connexion) :
// `getAppConfig()` (services de DatabaseModule) et `getOrThrow('JWT_SECRET')`
// (VehicleContextService, importé par DiagnosticEngineModule).
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';
process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'test-jwt-secret-not-a-real-secret-0000000000';

import { getQueueToken } from '@nestjs/bull';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';
import { CacheModule } from '@cache/cache.module';
import { RpcGateModule } from '@security/rpc-gate/rpc-gate.module';
import { RpcGateService } from '@security/rpc-gate/rpc-gate.service';
import { FeatureFlagsModule } from '../../../config/feature-flags.module';
import { DiagnosticProjectionAdminController } from './diagnostic-projection-admin.controller';
import { DiagnosticProjectionModule } from './diagnostic-projection.module';
import { DiagnosticProjectionProcessor } from './diagnostic-projection.processor';
import { DiagnosticProjectionSchedulerService } from './diagnostic-projection-scheduler.service';
import { DiagnosticProjectionWriterService } from './diagnostic-projection-writer.service';
import { DIAGNOSTIC_PROJECTION_QUEUE } from './diagnostic-projection.types';

/**
 * DiagnosticProjectionModule — preuve de composition DI AVANT fusion.
 *
 * Aucune CI de PR ne démarre le backend : une dépendance non résolue ne
 * casserait qu'au démarrage du container PREPROD. Ce test compile le VRAI
 * module avec les modules globaux de l'AppModule dont il dépend (Config,
 * EventEmitter, Cache, FeatureFlags, RpcGate) ; seule la file Bull est
 * remplacée (sa connexion Redis vient de la config racine du WorkerModule).
 * `compile()` n'appelle pas `onModuleInit` : aucune connexion Redis ni Supabase.
 *
 * Fail-closed : sans `RpcGateModule`, le boot est REFUSÉ — jamais un writer
 * dont `callRpc` passerait sans gate (précédent : SeoProjectionReadModule).
 */
const compileWith = (globals: unknown[]) =>
  Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
      EventEmitterModule.forRoot(),
      CacheModule,
      FeatureFlagsModule,
      ...(globals as []),
      DiagnosticProjectionModule,
    ],
  })
    .overrideProvider(getQueueToken(DIAGNOSTIC_PROJECTION_QUEUE))
    .useValue({})
    .compile();

describe('DiagnosticProjectionModule — composition DI', () => {
  it('avec les modules globaux de l’AppModule → boot VERT, writer résolu avec LA gate RPC', async () => {
    const moduleRef = await compileWith([RpcGateModule]);
    const writer = moduleRef.get(DiagnosticProjectionWriterService);
    expect(writer).toBeInstanceOf(DiagnosticProjectionWriterService);
    expect((writer as unknown as { rpcGate?: unknown }).rpcGate).toBe(
      moduleRef.get(RpcGateService),
    );
    expect(moduleRef.get(DiagnosticProjectionSchedulerService)).toBeDefined();
    expect(moduleRef.get(DiagnosticProjectionProcessor)).toBeDefined();
    expect(moduleRef.get(DiagnosticProjectionAdminController)).toBeDefined();
    await moduleRef.close();
  });

  it('SANS RpcGateModule → boot REFUSÉ (RpcGateService non résolu)', async () => {
    await expect(compileWith([])).rejects.toThrow(/RpcGateService/);
  });
});
