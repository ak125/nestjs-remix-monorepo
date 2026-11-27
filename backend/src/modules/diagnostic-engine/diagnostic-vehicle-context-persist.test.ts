/**
 * Mandat GE, étape 6.4 (C-1) — a diagnostic that names the vehicle without
 * its motorisation must not rewrite a vehicle_ctx cookie that already
 * carries type_id for the same brand and model.
 */

import type { Response } from 'express';
import { DiagnosticEngineController } from './diagnostic-engine.controller';

type Ctx = {
  v: 1;
  type_id?: number;
  brand_slug?: string;
  model_slug?: string;
  engine_slug?: string;
  source: 'diagnostic';
  iat: number;
};

function controllerWith(existing: Ctx | null) {
  const persist = jest.fn().mockResolvedValue(undefined);
  const get = jest.fn().mockReturnValue(existing);
  const controller = Object.create(
    DiagnosticEngineController.prototype,
  ) as DiagnosticEngineController;
  Object.assign(controller, {
    vehicleContext: { get, persist, clear: jest.fn() },
    logger: { warn: jest.fn(), log: jest.fn() },
  });
  const run = (body: unknown) =>
    (
      controller as unknown as {
        persistVehicleContextIfPresent(b: unknown, r: Response): Promise<void>;
      }
    ).persistVehicleContextIfPresent(body, { req: {} } as unknown as Response);
  return { run, persist, get };
}

const clio19047: Ctx = {
  v: 1,
  type_id: 19047,
  brand_slug: 'RENAULT',
  model_slug: 'CLIO III',
  engine_slug: '1.2 16V 65',
  source: 'diagnostic',
  iat: 1_795_000_000,
};

describe('persistVehicleContextIfPresent — motorisation kept (mandat GE)', () => {
  test('same brand and model without type_id keeps the known motorisation', async () => {
    const { run, persist } = controllerWith(clio19047);
    await run({
      vehicle_context: {
        brand: 'RENAULT',
        model: 'CLIO III',
        mileage_km: 120000,
      },
    });
    expect(persist).toHaveBeenCalledTimes(1);
    expect(persist.mock.calls[0][0]).toEqual({
      source: 'diagnostic',
      type_id: 19047,
      brand_slug: 'RENAULT',
      model_slug: 'CLIO III',
      engine_slug: '1.2 16V 65',
      mileage_km: 120000,
    });
  });

  test('brand and model compare without case or surrounding spaces', async () => {
    const { run, persist } = controllerWith(clio19047);
    await run({ vehicle_context: { brand: 'renault', model: ' Clio III ' } });
    expect(persist.mock.calls[0][0].type_id).toBe(19047);
  });

  test('a new type_id replaces the known one', async () => {
    const { run, persist } = controllerWith(clio19047);
    await run({
      vehicle_context: {
        type_id: 19045,
        brand: 'RENAULT',
        model: 'CLIO III',
        engine: '1.2 16V 75',
      },
    });
    expect(persist.mock.calls[0][0]).toEqual({
      source: 'diagnostic',
      type_id: 19045,
      brand_slug: 'RENAULT',
      model_slug: 'CLIO III',
      engine_slug: '1.2 16V 75',
    });
  });

  test('another model does not inherit the motorisation', async () => {
    const { run, persist } = controllerWith(clio19047);
    await run({ vehicle_context: { brand: 'RENAULT', model: 'MEGANE II' } });
    expect(persist.mock.calls[0][0]).toEqual({
      source: 'diagnostic',
      brand_slug: 'RENAULT',
      model_slug: 'MEGANE II',
    });
  });

  test('a known context without brand and model is not presumed the same vehicle', async () => {
    const { run, persist } = controllerWith({
      v: 1,
      type_id: 19047,
      source: 'diagnostic',
      iat: 1_795_000_000,
    });
    await run({ vehicle_context: { brand: 'RENAULT', model: 'CLIO III' } });
    expect(persist.mock.calls[0][0].type_id).toBeUndefined();
  });

  test('another engine name does not inherit the type_id', async () => {
    const { run, persist } = controllerWith(clio19047);
    await run({
      vehicle_context: {
        brand: 'RENAULT',
        model: 'CLIO III',
        engine: '1.5 dCi 86',
      },
    });
    expect(persist.mock.calls[0][0]).toEqual({
      source: 'diagnostic',
      brand_slug: 'RENAULT',
      model_slug: 'CLIO III',
      engine_slug: '1.5 dCi 86',
    });
  });

  test('no cookie yet: the payload is written as sent', async () => {
    const { run, persist } = controllerWith(null);
    await run({ vehicle_context: { brand: 'RENAULT', model: 'CLIO III' } });
    expect(persist.mock.calls[0][0]).toEqual({
      source: 'diagnostic',
      brand_slug: 'RENAULT',
      model_slug: 'CLIO III',
    });
  });

  test('a read failure falls back to the payload as sent, never throws', async () => {
    const { run, persist, get } = controllerWith(null);
    get.mockImplementation(() => {
      throw new Error('boom');
    });
    await expect(
      run({ vehicle_context: { brand: 'RENAULT', model: 'CLIO III' } }),
    ).resolves.toBeUndefined();
    expect(persist.mock.calls[0][0].type_id).toBeUndefined();
  });
});
