/**
 * Banc d'essai hors production : sert `GET /api/vehicles/brands/:brandId/models`
 * avec le code compilé du backend (`backend/dist`), sans démarrer `AppModule`
 * (ses tâches planifiées et ses files partagent la base et Redis de PROD).
 *
 * Réels : VehiclesController, ses pipes zod et PositiveIntParamPipe,
 * VehicleModelsService (sélecteur VEHICLE_MODELS_RS_ENABLED compris),
 * VehicleCacheService sur le cache borné du module véhicules, FeatureFlagsService,
 * GlobalErrorFilter, journal pino de production.
 * Remplacés : les onze autres dépendances du contrôleur (non appelées par cette
 * route) et ErrorService, dont `logError` écrit en base.
 * Hors périmètre, identiques pour les deux chemins : helmet, compression,
 * sessions, throttler.
 *
 * Lancé par `bench/bench.sh` (A : flag éteint, B : flag allumé). À la main :
 *   NODE_ENV=production BENCH_PORT=3130 SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=…
 *   [VEHICLE_MODELS_RS_ENABLED=true VEHICLE_MODELS_RS_URL=…] node bench/harness.cjs
 */
'use strict';

const path = require('node:path');
const { createRequire } = require('node:module');

const backend = path.resolve(__dirname, '../../../backend');
const dist = (p) => require(path.join(backend, 'dist', p));
const backendRequire = createRequire(path.join(backend, 'package.json'));

const { Module } = backendRequire('@nestjs/common');
const { NestFactory, APP_FILTER } = backendRequire('@nestjs/core');
const { ConfigModule, ConfigService } = backendRequire('@nestjs/config');
const { CacheModule } = backendRequire('@nestjs/cache-manager');
const { LoggerModule, Logger } = backendRequire('nestjs-pino');

const { loggerConfig } = dist('config/logger.config');
const { boundedMemoryCache } = dist('config/cache-store.factory');
const { FeatureFlagsService } = dist('config/feature-flags.service');
const { ParamsPipesModule } = dist('common/pipes/params');
const { GlobalErrorFilter } = dist('modules/errors/filters/global-error.filter');
const { ErrorService } = dist('modules/errors/services/error.service');
const { VehiclesController } = dist('modules/vehicles/vehicles.controller');
const { VehicleModelsService } = dist(
  'modules/vehicles/services/data/vehicle-models.service',
);
const { VehicleCacheService } = dist(
  'modules/vehicles/services/core/vehicle-cache.service',
);

const unusedByThisRoute = [
  ['modules/vehicles/vehicles.service', 'VehiclesService'],
  ['modules/vehicles/services/data/vehicle-brands.service', 'VehicleBrandsService'],
  ['modules/vehicles/services/data/vehicle-types.service', 'VehicleTypesService'],
  ['modules/vehicles/services/search/vehicle-search.service', 'VehicleSearchService'],
  ['modules/vehicles/services/search/vehicle-mine.service', 'VehicleMineService'],
  ['modules/vehicles/services/vehicle-meta.service', 'VehicleMetaService'],
  ['modules/catalog/services/popular-gammes.service', 'PopularGammesService'],
  ['modules/vehicles/services/vehicle-rpc.service', 'VehicleRpcService'],
  ['modules/vehicles/services/brand-bestsellers.service', 'BrandBestsellersService'],
  ['modules/vehicles/services/vehicle-motor-codes.service', 'VehicleMotorCodesService'],
  ['modules/vehicles/services/vehicle-profile.service', 'VehicleProfileService'],
].map(([file, name]) => ({ provide: dist(file)[name], useValue: {} }));

let errorLogCalls = 0;
const errorServiceStub = {
  logError: async () => {
    errorLogCalls += 1;
  },
};

class HarnessModule {}
Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
    LoggerModule.forRoot(loggerConfig),
    ParamsPipesModule,
    CacheModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config) =>
        boundedMemoryCache(
          Number(config.get('VEHICLES_CACHE_TTL', 300)),
          Number(config.get('VEHICLES_CACHE_MAX', 100)),
        ),
    }),
  ],
  controllers: [VehiclesController],
  providers: [
    VehicleModelsService,
    VehicleCacheService,
    FeatureFlagsService,
    ...unusedByThisRoute,
    { provide: ErrorService, useValue: errorServiceStub },
    { provide: APP_FILTER, useClass: GlobalErrorFilter },
  ],
})(HarnessModule);

async function main() {
  const port = Number(process.env.BENCH_PORT);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('BENCH_PORT absent ou invalide');
  }
  const app = await NestFactory.create(HarnessModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();
  const flags = app.get(FeatureFlagsService);
  app.getHttpAdapter().get('/__bench', (_req, res) => {
    res.json({
      pid: process.pid,
      vehicleModelsRsEnabled: flags.vehicleModelsRsEnabled,
      errorLogCalls,
    });
  });
  await app.listen(port, '127.0.0.1');
}

main().catch((error) => {
  process.stderr.write(`harness: ${error.stack || error}\n`);
  process.exit(1);
});
