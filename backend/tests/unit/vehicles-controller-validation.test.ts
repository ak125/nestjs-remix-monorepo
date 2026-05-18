/**
 * VehiclesController param-validation e2e tests.
 *
 * Couvre tous les routes path-param numériques wirées sur
 * `PositiveSmallIntParamPipe` / `PositiveIntParamPipe`.
 *
 * Repro Sentry initiale : `GET /api/vehicles/brands/mini-f56/models`
 * doit retourner HTTP 400 (jamais 500 + NaN smallint crash Postgres).
 *
 * @see backend/src/modules/vehicles/vehicles.controller.ts
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { VehiclesController } from '../../src/modules/vehicles/vehicles.controller';
import { VehiclesService } from '../../src/modules/vehicles/vehicles.service';
import { VehicleBrandsService } from '../../src/modules/vehicles/services/data/vehicle-brands.service';
import { VehicleModelsService } from '../../src/modules/vehicles/services/data/vehicle-models.service';
import { VehicleTypesService } from '../../src/modules/vehicles/services/data/vehicle-types.service';
import { VehicleSearchService } from '../../src/modules/vehicles/services/search/vehicle-search.service';
import { VehicleMineService } from '../../src/modules/vehicles/services/search/vehicle-mine.service';
import { VehicleMetaService } from '../../src/modules/vehicles/services/vehicle-meta.service';
import { PopularGammesService } from '../../src/modules/catalog/services/popular-gammes.service';
import { VehicleRpcService } from '../../src/modules/vehicles/services/vehicle-rpc.service';
import { BrandBestsellersService } from '../../src/modules/vehicles/services/brand-bestsellers.service';
import { VehicleMotorCodesService } from '../../src/modules/vehicles/services/vehicle-motor-codes.service';
import { VehicleProfileService } from '../../src/modules/vehicles/services/vehicle-profile.service';
import { PositiveSmallIntParamPipe } from '../../src/common/pipes/params/positive-smallint-param.pipe';
import { PositiveIntParamPipe } from '../../src/common/pipes/params/positive-int-param.pipe';

describe('VehiclesController param validation (anti NaN smallint)', () => {
  let app: INestApplication;

  const stub = {
    getBrandById: jest.fn().mockResolvedValue({ ok: true }),
    getModelsByBrand: jest.fn().mockResolvedValue({ data: [] }),
    getYearsByBrand: jest.fn().mockResolvedValue([]),
    getTypesByModel: jest.fn().mockResolvedValue([]),
    getTypeById: jest.fn().mockResolvedValue({ ok: true }),
    getMinesByModel: jest.fn().mockResolvedValue([]),
    getMetaTagsByTypeId: jest.fn().mockResolvedValue({ meta: {} }),
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [VehiclesController],
      providers: [
        PositiveSmallIntParamPipe,
        PositiveIntParamPipe,
        { provide: VehiclesService, useValue: { searchAdvanced: jest.fn(), getVehicleStats: jest.fn() } },
        { provide: VehicleBrandsService, useValue: stub },
        { provide: VehicleModelsService, useValue: stub },
        { provide: VehicleTypesService, useValue: stub },
        { provide: VehicleSearchService, useValue: { searchByCnit: jest.fn() } },
        { provide: VehicleMineService, useValue: stub },
        { provide: VehicleMetaService, useValue: stub },
        { provide: PopularGammesService, useValue: {} },
        { provide: VehicleRpcService, useValue: {} },
        { provide: BrandBestsellersService, useValue: {} },
        { provide: VehicleMotorCodesService, useValue: {} },
        { provide: VehicleProfileService, useValue: {} },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    Object.values(stub).forEach((fn) => fn.mockClear());
  });

  describe('Sentry repro and adjacent failures (must be 400, never 500)', () => {
    it.each([
      ['/api/vehicles/brands/mini-f56/models', 'Sentry repro: alpha slug'],
      ['/api/vehicles/brands/mini-f56', 'parent route, alpha slug'],
      ['/api/vehicles/brands/0/models', 'boundary zero (smallint min violation)'],
      ['/api/vehicles/brands/00042/models', 'leading-zero canonical violation'],
      ['/api/vehicles/brands/32768/models', 'boundary above smallint max'],
      ['/api/vehicles/brands/-1/models', 'signed negative'],
      ['/api/vehicles/brands/abc', 'pure alpha brandId'],
      ['/api/vehicles/brands/abc/years', 'years sub-route alpha'],
      ['/api/vehicles/models/x/types', 'modelId alpha'],
      ['/api/vehicles/types/0x1E', 'typeId hex'],
      ['/api/vehicles/mines/model/-1', 'mines negative'],
    ])('GET %s returns 400 (%s)', async (path) => {
      const res = await request(app.getHttpServer()).get(path);
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({
        message: 'Validation failed',
        errors: expect.any(Array),
      });
    });
  });

  describe('Positive cases must still reach service layer', () => {
    it('GET /api/vehicles/brands/42 → 200 + brandId=42 typed number', async () => {
      const res = await request(app.getHttpServer()).get('/api/vehicles/brands/42');
      expect(res.status).toBe(200);
      expect(stub.getBrandById).toHaveBeenCalledWith(42);
      expect(typeof stub.getBrandById.mock.calls[0][0]).toBe('number');
    });

    it('GET /api/vehicles/brands/42/models → 200 + brandId=42 typed number', async () => {
      const res = await request(app.getHttpServer()).get('/api/vehicles/brands/42/models');
      expect(res.status).toBe(200);
      expect(stub.getModelsByBrand).toHaveBeenCalled();
      expect(typeof stub.getModelsByBrand.mock.calls[0][0]).toBe('number');
      expect(stub.getModelsByBrand.mock.calls[0][0]).toBe(42);
    });

    it('GET /api/vehicles/types/83456 → 200 + typeId int4 typed number', async () => {
      const res = await request(app.getHttpServer()).get('/api/vehicles/types/83456');
      expect(res.status).toBe(200);
      expect(stub.getTypeById).toHaveBeenCalledWith(83456, true);
    });
  });
});
