import {
  classifyActivationRow,
  type ActivationOutcome,
} from '../price-activation.service';

/**
 * The eligibility projection must mirror pricing_activate_chunk's SQL guards
 * EXACTLY — these tests lock that contract (no false in-stock, no collateral).
 */
describe('classifyActivationRow', () => {
  const row = (
    dispo: string | null,
    state = 'ACTIVE',
  ): { dispo: string | null; state: string } => ({ dispo, state });

  it('ACTIVATE: non-sellable (null) ACTIVE row, target 1 or 2', () => {
    expect(classifyActivationRow('1', row(null))).toBe('ACTIVATE');
    expect(classifyActivationRow('2', row(null))).toBe('ACTIVATE');
    expect(classifyActivationRow('1', row('0'))).toBe('ACTIVATE');
  });

  it('REJECTED: any target other than 1/2 (incl 0,3,empty,garbage)', () => {
    for (const t of ['0', '3', '', 'x', '12'] as const) {
      expect(classifyActivationRow(t, row(null))).toBe(
        'REJECTED' as ActivationOutcome,
      );
    }
  });

  it('MISSING: no pieces_price row for the ref', () => {
    expect(classifyActivationRow('1', undefined)).toBe('MISSING');
  });

  it('SKIP_FROZEN_MANUAL: respects quarantine / manual control', () => {
    expect(classifyActivationRow('1', row(null, 'FROZEN'))).toBe(
      'SKIP_FROZEN_MANUAL',
    );
    expect(classifyActivationRow('2', row(null, 'MANUAL_OVERRIDE'))).toBe(
      'SKIP_FROZEN_MANUAL',
    );
  });

  it('SKIP_ALREADY_SELLABLE: never downgrades nor re-touches an active price', () => {
    for (const d of ['1', '2', '3'] as const) {
      expect(classifyActivationRow('1', row(d))).toBe('SKIP_ALREADY_SELLABLE');
    }
  });

  it('rejection precedes row lookup (bad target on a frozen row still REJECTED)', () => {
    expect(classifyActivationRow('0', row(null, 'FROZEN'))).toBe('REJECTED');
  });
});
