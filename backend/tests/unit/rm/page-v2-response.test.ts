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
});
