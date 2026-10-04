/**
 * OrdersService.cancelOrder — contrat entre les refus de cancel_order_atomic et
 * les codes HTTP.
 *
 * La RPC refuse par RAISE EXCEPTION ; le service traduit le texte du message en
 * 409 / 404 / 400. Les messages ne sont PAS recopiés ici : ils sont extraits de
 * la migration la plus récente qui définit la fonction. Si la migration ajoute,
 * retire ou reformule un refus, ce test échoue tant que la traduction n'a pas
 * été revue.
 *
 * @see backend/src/modules/orders/services/orders.service.ts (cancelOrder)
 * @see backend/supabase/migrations/20260924_cancel_order_atomic_refuse_paid.sql
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { OrdersService } from '../../src/modules/orders/services/orders.service';

const MIGRATIONS_DIR = join(__dirname, '../../supabase/migrations');

/** Dernière migration (ordre des noms de fichier) qui (re)définit la RPC. */
function latestCancelOrderAtomicMigration(): { file: string; sql: string } {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql') && !f.endsWith('.down.sql'))
    .sort();
  let found: { file: string; sql: string } | null = null;
  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    if (/CREATE OR REPLACE FUNCTION public\.cancel_order_atomic\(/.test(sql)) {
      found = { file, sql };
    }
  }
  if (!found)
    throw new Error('aucune migration ne définit cancel_order_atomic');
  return found;
}

/** Messages de refus de la RPC, avec des valeurs d'exemple à la place des %. */
function rpcRefusalMessages(sql: string): string[] {
  const body = sql.slice(
    sql.indexOf('CREATE OR REPLACE FUNCTION public.cancel_order_atomic('),
  );
  const functionBody = body.slice(0, body.indexOf('$function$;'));
  const formats = [...functionBody.matchAll(/RAISE EXCEPTION '([^']*)'/g)].map(
    (m) => m[1],
  );
  const samples = ['ORD-TEST-1', '1', '1'];
  return formats.map((fmt) => {
    let i = 0;
    return fmt.replace(/%/g, () => samples[Math.min(i++, samples.length - 1)]);
  });
}

function makeService(): { service: OrdersService; callRpc: jest.Mock } {
  const service = new OrdersService(
    {} as never, // calculationService — hors du chemin cancelOrder
    {} as never, // statusService
    {} as never, // shippingService
    {} as never, // shippingCalculator
    { emit: jest.fn() } as never,
    {} as never, // mailService
  );
  const callRpc = jest.fn();
  Object.defineProperty(service, 'callRpc', {
    value: callRpc,
    configurable: true,
  });
  return { service, callRpc };
}

describe('OrdersService.cancelOrder — refus de cancel_order_atomic → HTTP', () => {
  beforeAll(() => {
    process.env.SUPABASE_URL ||= 'http://localhost:54321';
    process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-role-key';
  });

  const { file, sql } = latestCancelOrderAtomicMigration();
  const messages = rpcRefusalMessages(sql);

  // Chaque refus de la migration a une traduction attendue, et une seule.
  const expected: Array<{
    fragment: string;
    type: new (...args: never[]) => Error;
    text?: string;
  }> = [
    { fragment: 'p_ord_id is required', type: BadRequestException },
    { fragment: 'p_correlation_id is required', type: BadRequestException },
    {
      fragment: 'not found',
      type: NotFoundException,
      text: 'introuvable',
    },
    {
      fragment: 'already cancelled',
      type: ConflictException,
      text: 'déjà annulée',
    },
    {
      fragment: 'is paid (status 5)',
      type: ConflictException,
      text: 'workflow remboursement',
    },
    {
      fragment: 'is paid (ord_is_pay=',
      type: ConflictException,
      text: 'workflow remboursement',
    },
    {
      fragment: 'invalid transition',
      type: ConflictException,
      text: 'ne peut plus être annulée',
    },
  ];

  it(`${file} : chaque refus de la RPC est couvert par ce test`, () => {
    expect(messages).toHaveLength(expected.length);
    for (const message of messages) {
      const owners = expected.filter((e) => message.includes(e.fragment));
      expect({ message, owners: owners.length }).toEqual({
        message,
        owners: 1,
      });
    }
  });

  it.each(expected)(
    'refus « $fragment » → $type.name',
    async ({ fragment, type, text }) => {
      const message = messages.find((m) => m.includes(fragment));
      expect(message).toBeDefined();

      const { service, callRpc } = makeService();
      callRpc.mockResolvedValue({ error: { message } });

      const call = service.cancelOrder('ORD-TEST-1', 'motif', undefined);
      await expect(call).rejects.toBeInstanceOf(type);
      if (text) {
        await expect(call).rejects.toThrow(text);
      }
    },
  );

  it('succès : un seul appel RPC, identifiant de corrélation transmis', async () => {
    const { service, callRpc } = makeService();
    callRpc.mockResolvedValue({ error: null });
    const correlationId = '5f0c6f1e-2b8a-4c4e-9d7a-2f1b3c4d5e6f';

    await expect(
      service.cancelOrder('ORD-TEST-1', 'motif', undefined, correlationId),
    ).resolves.toEqual({
      success: true,
      message: 'Commande annulée',
      ord_id: 'ORD-TEST-1',
    });
    expect(callRpc).toHaveBeenCalledTimes(1);
    expect(callRpc).toHaveBeenCalledWith(
      'cancel_order_atomic',
      {
        p_ord_id: 'ORD-TEST-1',
        p_reason: 'motif',
        p_user_id: null,
        p_correlation_id: correlationId,
      },
      { isServiceRole: true, source: 'internal' },
    );
  });
});
