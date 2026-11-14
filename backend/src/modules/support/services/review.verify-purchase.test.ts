/**
 * ReviewService.verifyPurchase — vérification d'achat d'un avis.
 *
 * Le service étend SupabaseBaseService (createClient + SUPABASE_URL) : comme
 * pour OrderFunnelListener, l'instance est construite via Object.create et le
 * client Supabase est un faux qui, à l'image de PostgREST, répond une erreur
 * pour toute colonne inconnue ou toute jointure sans clé étrangère.
 */
import { TABLES } from '@repo/database-types';
import { ReviewService } from './review.service';

const ORDER_COLUMNS = new Set(['ord_id', 'ord_cst_id']);
const LINE_COLUMNS = new Set(['orl_id', 'orl_ord_id', 'orl_pg_id']);

interface Fixture {
  orders: Array<{ ord_id: string; ord_cst_id: string }>;
  lines: Array<{ orl_id: string; orl_ord_id: string; orl_pg_id: string }>;
  failOn?: 'order' | 'line';
}

function fakeSupabase(fx: Fixture) {
  return {
    from(table: string) {
      const kind =
        table === TABLES.xtr_order
          ? 'order'
          : table === TABLES.xtr_order_line
            ? 'line'
            : null;
      const known =
        kind === 'order'
          ? ORDER_COLUMNS
          : kind === 'line'
            ? LINE_COLUMNS
            : new Set<string>();
      const rows: Array<Record<string, string>> =
        kind === 'order' ? fx.orders : kind === 'line' ? fx.lines : [];
      const filters: Array<[string, string]> = [];
      let error: { message: string } | null =
        kind !== null && fx.failOn === kind ? { message: 'db down' } : null;

      const check = (column: string) => {
        if (!known.has(column) && !error) {
          error = { message: `column ${table}.${column} does not exist` };
        }
      };
      const matched = () =>
        rows.filter((r) => filters.every(([c, v]) => r[c] === v));

      const chain = {
        select(columns: string) {
          if (columns.includes('!inner') && !error) {
            error = {
              message: `Could not find a relationship between '${table}' and the embedded table`,
            };
          }
          return chain;
        },
        eq(column: string, value: string) {
          check(column);
          filters.push([column, value]);
          return chain;
        },
        maybeSingle() {
          return Promise.resolve(
            error
              ? { data: null, error }
              : { data: matched()[0] ?? null, error },
          );
        },
        then(resolve: (v: unknown) => unknown) {
          return Promise.resolve(
            error
              ? { data: null, count: null, error }
              : { data: matched(), count: matched().length, error },
          ).then(resolve);
        },
      };
      return chain;
    },
  };
}

function verify(
  fx: Fixture,
  customerId: string,
  productId: string,
  orderId: string,
) {
  const service = Object.create(ReviewService.prototype) as ReviewService;
  const logger = { error: jest.fn(), warn: jest.fn(), log: jest.fn() };
  Object.assign(service, { supabase: fakeSupabase(fx), logger });
  const run = (
    service as unknown as {
      verifyPurchase: (c: string, p: string, o: string) => Promise<boolean>;
    }
  ).verifyPurchase(customerId, productId, orderId);
  return { run, logger };
}

const COMMANDE: Fixture = {
  orders: [{ ord_id: 'ORD-1', ord_cst_id: '42' }],
  lines: [{ orl_id: 'ORD-1-L001', orl_ord_id: 'ORD-1', orl_pg_id: '5660748' }],
};

describe('ReviewService.verifyPurchase', () => {
  it("vérifie l'avis quand la commande du client contient le produit", async () => {
    const { run, logger } = verify(COMMANDE, '42', '5660748', 'ORD-1');
    const ok = await run;
    expect(logger.error).not.toHaveBeenCalled();
    expect(ok).toBe(true);
  });

  it('refuse quand la commande appartient à un autre client', async () => {
    await expect(verify(COMMANDE, '7', '5660748', 'ORD-1').run).resolves.toBe(
      false,
    );
  });

  it('refuse quand la commande ne contient pas le produit', async () => {
    await expect(verify(COMMANDE, '42', '1', 'ORD-1').run).resolves.toBe(false);
  });

  it('refuse quand la commande est inconnue', async () => {
    await expect(
      verify(COMMANDE, '42', '5660748', 'ORD-404').run,
    ).resolves.toBe(false);
  });

  it.each(['order', 'line'] as const)(
    'journalise une erreur de lecture (%s) et laisse l’avis non vérifié',
    async (failOn) => {
      const { run, logger } = verify(
        { ...COMMANDE, failOn },
        '42',
        '5660748',
        'ORD-1',
      );
      await expect(run).resolves.toBe(false);
      expect(logger.error).toHaveBeenCalledTimes(1);
    },
  );
});
