import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  OrderLineStatus,
  ORDER_LINE_STATUS_LABEL,
  isOrderLineStatusCode,
  getOrderLineStatusLabel,
} from './order-line-status';

describe('OrderLineStatus enum', () => {
  it('has the 10 canonical DB values (1..6, 91..94)', () => {
    assert.deepEqual(
      Object.values(OrderLineStatus).sort(),
      ['1', '2', '3', '4', '5', '6', '91', '92', '93', '94'].sort(),
    );
  });

  it('exposes equivalence workflow statuses (91..94)', () => {
    assert.equal(OrderLineStatus.EQUIV_PROPOSED, '91');
    assert.equal(OrderLineStatus.EQUIV_VALIDATED, '94');
  });
});

describe('ORDER_LINE_STATUS_LABEL', () => {
  it('has a label for each canon code', () => {
    for (const code of Object.values(OrderLineStatus)) {
      assert.ok(
        typeof ORDER_LINE_STATUS_LABEL[code] === 'string' &&
          ORDER_LINE_STATUS_LABEL[code].length > 0,
        `missing label for ${code}`,
      );
    }
  });

  it('exposes the FR label exactly as DB stores it', () => {
    assert.equal(ORDER_LINE_STATUS_LABEL['5'], 'Pièce disponible');
    assert.equal(ORDER_LINE_STATUS_LABEL['91'], "Proposition d'équivalence");
  });
});

describe('isOrderLineStatusCode type guard', () => {
  it('accepts canonical codes', () => {
    assert.equal(isOrderLineStatusCode('1'), true);
    assert.equal(isOrderLineStatusCode('94'), true);
  });

  it('rejects non-canonical values', () => {
    assert.equal(isOrderLineStatusCode('99'), false);
    assert.equal(isOrderLineStatusCode('7'), false);
    assert.equal(isOrderLineStatusCode(91), false);
  });
});

describe('getOrderLineStatusLabel', () => {
  it('returns the canonical FR label', () => {
    assert.equal(getOrderLineStatusLabel('2'), 'Pièce annulée');
    assert.equal(getOrderLineStatusLabel('92'), 'Equivalence acceptée');
  });
});
