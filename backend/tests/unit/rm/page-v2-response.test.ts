import { classifyPageV2Result } from '../../../src/modules/rm/utils/page-v2-response';

describe('classifyPageV2Result', () => {
  it('ok when success', () => {
    expect(classifyPageV2Result({ success: true })).toBe('ok');
  });
  it('error when success:false AND result.error present', () => {
    expect(
      classifyPageV2Result({ success: false, error: { code: 'RPC_ERROR', message: 'x' } }),
    ).toBe('error');
  });
  it('empty when success:false and no error (valid combo, 0 products)', () => {
    expect(classifyPageV2Result({ success: false })).toBe('empty');
  });
  it('not_found for a deterministic missing vehicle/gamme (must map to 404, not 503)', () => {
    expect(
      classifyPageV2Result({
        success: false,
        error: { code: 'VEHICLE_NOT_FOUND', message: 'Vehicle not found' },
      }),
    ).toBe('not_found');
    expect(
      classifyPageV2Result({
        success: false,
        error: { code: 'GAMME_NOT_FOUND', message: 'Gamme not found' },
      }),
    ).toBe('not_found');
  });
  it('error (not not_found) for an error without a recognized not-found code', () => {
    expect(classifyPageV2Result({ success: false, error: 'unexpected' })).toBe(
      'error',
    );
    expect(
      classifyPageV2Result({ success: false, error: { message: 'no code' } }),
    ).toBe('error');
  });
});
