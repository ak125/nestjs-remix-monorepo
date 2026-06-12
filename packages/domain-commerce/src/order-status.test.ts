import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  OrderStatus,
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TRANSITIONS,
  isOrderStatusCode,
  isValidTransition,
  getOrderStatusLabel,
} from './order-status';

describe('OrderStatus enum', () => {
  it('has the 5 canonical DB values', () => {
    assert.deepEqual(Object.values(OrderStatus).sort(), ['1', '2', '3', '4', '5']);
  });

  it('PROCESSING is 1, CANCELLED is 2, PAID is 5', () => {
    assert.equal(OrderStatus.PROCESSING, '1');
    assert.equal(OrderStatus.CANCELLED, '2');
    assert.equal(OrderStatus.PAID, '5');
  });
});

describe('ORDER_STATUS_LABEL', () => {
  it('has a label for each canon code', () => {
    for (const code of Object.values(OrderStatus)) {
      assert.ok(
        typeof ORDER_STATUS_LABEL[code] === 'string' && ORDER_STATUS_LABEL[code].length > 0,
        `missing label for ${code}`,
      );
    }
  });

  it('exposes the cancellation label exactly as DB stores it', () => {
    assert.equal(ORDER_STATUS_LABEL['2'], 'Commande annulée');
  });
});

describe('ORDER_STATUS_TRANSITIONS — V1 anti-refund invariant', () => {
  it('5 (PAID) is terminal — refund would require payments/ module (off-limits)', () => {
    assert.deepEqual(ORDER_STATUS_TRANSITIONS['5'], []);
    assert.equal(isValidTransition('5', '2'), false);
  });

  it('2 (CANCELLED) is terminal', () => {
    assert.deepEqual(ORDER_STATUS_TRANSITIONS['2'], []);
  });

  it('1 → 2 (cancel from processing) is valid', () => {
    assert.equal(isValidTransition('1', '2'), true);
  });

  it('1 → 5 (processing → paid) is valid', () => {
    assert.equal(isValidTransition('1', '5'), true);
  });

  it('1 → 3 (processing → awaiting fee) is valid', () => {
    assert.equal(isValidTransition('1', '3'), true);
  });

  it('3 → 4 → 5 (fee workflow) is valid', () => {
    assert.equal(isValidTransition('3', '4'), true);
    assert.equal(isValidTransition('4', '5'), true);
  });

  it('5 → 1 (paid → processing) is invalid', () => {
    assert.equal(isValidTransition('5', '1'), false);
  });

  it('2 → 1 (cancelled → processing) is invalid', () => {
    assert.equal(isValidTransition('2', '1'), false);
  });
});

describe('isOrderStatusCode type guard', () => {
  it('accepts canonical codes', () => {
    assert.equal(isOrderStatusCode('1'), true);
    assert.equal(isOrderStatusCode('5'), true);
  });

  it('rejects non-canonical values', () => {
    assert.equal(isOrderStatusCode('99'), false);
    assert.equal(isOrderStatusCode('6'), false);
    assert.equal(isOrderStatusCode(2), false);
    assert.equal(isOrderStatusCode(null), false);
    assert.equal(isOrderStatusCode(undefined), false);
    assert.equal(isOrderStatusCode(''), false);
  });
});

describe('getOrderStatusLabel', () => {
  it('returns the canonical FR label', () => {
    assert.equal(getOrderStatusLabel('1'), 'Commande en cours de traitement');
    assert.equal(getOrderStatusLabel('5'), 'Payée — En préparation');
  });
});
