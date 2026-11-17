/**
 * Mandat BM — décision du 2026-11-17 : Expédier écrit « Expédiée », Livrer
 * écrit « Livrée ». Identifiants donnés par BN (#2147) : 7 et 8, dans la
 * constante unique ORDER_FULFILMENT_STATUS. Repli `null` : codes
 * historiques 4 / 5 écrits, les dates portant l'étape.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ORDER_FULFILMENT_STATUS,
  fulfilmentStatusToWrite,
  orderFulfilment,
} from './order-status';

const NONE = { SHIPPED: null, DELIVERED: null } as const;

describe('ORDER_FULFILMENT_STATUS', () => {
  it('porte les identifiants donnés par BN : Expédiée 7, Livrée 8', () => {
    assert.equal(ORDER_FULFILMENT_STATUS.SHIPPED, '7');
    assert.equal(ORDER_FULFILMENT_STATUS.DELIVERED, '8');
    assert.ok(Object.isFrozen(ORDER_FULFILMENT_STATUS));
  });
});

describe('fulfilmentStatusToWrite', () => {
  it('écrit « Expédiée » 7 / « Livrée » 8', () => {
    assert.deepEqual(fulfilmentStatusToWrite('SHIPPED'), {
      code: '7',
      legacy: false,
    });
    assert.deepEqual(fulfilmentStatusToWrite('DELIVERED'), {
      code: '8',
      legacy: false,
    });
  });

  it('repli null : codes historiques 4 / 5, marqués legacy', () => {
    assert.deepEqual(fulfilmentStatusToWrite('SHIPPED', NONE), {
      code: '4',
      legacy: true,
    });
    assert.deepEqual(fulfilmentStatusToWrite('DELIVERED', NONE), {
      code: '5',
      legacy: true,
    });
  });
});

describe('orderFulfilment', () => {
  const shipDate = '2026-11-17T17:00:00Z';
  const delivDate = '2026-11-19T10:00:00Z';

  it('null avant l’expédition', () => {
    assert.equal(orderFulfilment({ ord_ords_id: '3', ord_date_ship: null }), null);
    assert.equal(orderFulfilment({ ord_ords_id: '5' }), null);
  });

  it('commandes antérieures (4 / 5) : les dates posées par les boutons portent l’étape', () => {
    assert.equal(
      orderFulfilment({ ord_ords_id: '4', ord_date_ship: shipDate }),
      'shipped',
    );
    assert.equal(
      orderFulfilment({
        ord_ords_id: '5',
        ord_date_ship: shipDate,
        ord_date_deliv: delivDate,
      }),
      'delivered',
    );
  });

  it('une commande annulée n’a pas d’étape, même datée', () => {
    assert.equal(
      orderFulfilment({ ord_ords_id: '2', ord_date_ship: shipDate }),
      null,
    );
  });

  it('statut nouveau : il suffit (code nombre ou texte)', () => {
    assert.equal(orderFulfilment({ ord_ords_id: '7' }), 'shipped');
    assert.equal(orderFulfilment({ ord_ords_id: 8 }), 'delivered');
    assert.equal(orderFulfilment({ ord_ords_id: '3', ord_date_ship: null }), null);
  });

  it('repli null : 7 / 8 ne sont pas lus, seules les dates comptent', () => {
    assert.equal(orderFulfilment({ ord_ords_id: '7' }, NONE), null);
  });
});
