/**
 * Tests SeoProjectionReadController — HTTP endpoint surface stable.
 */
import { BadRequestException } from '@nestjs/common';

import { SeoProjectionReadController } from '../seo-projection-read.controller';


function makeAdapter(getResult: jest.Mock) {
  return { getActiveProjection: getResult } as unknown as Parameters<
    typeof SeoProjectionReadController.prototype.getActive
  > extends never
    ? never
    : ConstructorParameters<typeof SeoProjectionReadController>[0];
}


function makeController(adapterMock: ReturnType<typeof makeAdapter>): SeoProjectionReadController {
  const c = new SeoProjectionReadController(adapterMock);
  (c as unknown as { readLogger: { warn: jest.Mock; error: jest.Mock; log: jest.Mock } }).readLogger = {
    warn: jest.fn(),
    error: jest.fn(),
    log: jest.fn(),
  };
  return c;
}


describe('SeoProjectionReadController', () => {
  it('rejects empty entity_id with BadRequest', async () => {
    const adapter = makeAdapter(jest.fn());
    const ctrl = makeController(adapter);
    await expect(ctrl.getActive('')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('delegates to adapter with role=null when role omitted', async () => {
    const getResult = jest.fn().mockResolvedValue({
      status: 'success',
      payload: { entity_id: 'gamme:x' },
      error: null,
    });
    const adapter = makeAdapter(getResult);
    const ctrl = makeController(adapter);
    await ctrl.getActive('gamme:filtre-a-huile');
    expect(getResult).toHaveBeenCalledWith('gamme:filtre-a-huile', { role: null });
  });

  it('passes role filter when provided', async () => {
    const getResult = jest.fn().mockResolvedValue({
      status: 'success',
      payload: null,
      error: null,
    });
    const adapter = makeAdapter(getResult);
    const ctrl = makeController(adapter);
    await ctrl.getActive('gamme:filtre-a-huile', 'R3_CONSEILS');
    expect(getResult).toHaveBeenCalledWith('gamme:filtre-a-huile', { role: 'R3_CONSEILS' });
  });

  it('returns adapter result unchanged (status enum forwarded)', async () => {
    const expected = { status: 'empty' as const, payload: null, error: null };
    const adapter = makeAdapter(jest.fn().mockResolvedValue(expected));
    const ctrl = makeController(adapter);
    const result = await ctrl.getActive('gamme:filtre-a-huile');
    expect(result).toEqual(expected);
  });

  it('forwards rpc_failed status with logger warn', async () => {
    const adapter = makeAdapter(
      jest.fn().mockResolvedValue({
        status: 'rpc_failed',
        payload: null,
        error: 'permission denied',
      }),
    );
    const ctrl = makeController(adapter);
    const result = await ctrl.getActive('gamme:filtre-a-huile');
    expect(result.status).toBe('rpc_failed');
  });
});
