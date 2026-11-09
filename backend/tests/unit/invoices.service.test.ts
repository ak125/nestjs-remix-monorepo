/**
 * InvoicesService — lecture des factures (liste paginée, détail avec lignes, compteur).
 *
 * Tests unitaires avec client Supabase et cache simulés : aucune base, aucun réseau.
 *
 * @see backend/src/modules/invoices/invoices.service.ts
 */
import { ConfigService } from '@nestjs/config';
import { Cache } from 'cache-manager';
import { TABLES } from '@repo/database-types';

import { DatabaseException, ErrorCodes } from '../../src/common/exceptions';
import { InvoicesService } from '../../src/modules/invoices/invoices.service';

type QueryResult = { data?: unknown; error?: unknown; count?: number | null };

interface QueryCall {
  table: string;
  select?: [string, unknown];
  range?: [number, number];
  order?: [string, unknown];
  eq?: [string, unknown];
  single?: boolean;
}

/**
 * Chaque appel à `from()` consomme le résultat suivant de la file, dans l'ordre
 * des requêtes du service. Le builder est « thenable » comme celui de supabase-js.
 */
function buildSupabaseStub(results: QueryResult[]) {
  const calls: QueryCall[] = [];
  const from = jest.fn((table: string) => {
    const call: QueryCall = { table };
    calls.push(call);
    const result = results.shift();
    if (!result) throw new Error(`requête inattendue sur ${table}`);
    const builder = {
      select: jest.fn((cols: string, opts?: unknown) => {
        call.select = [cols, opts];
        return builder;
      }),
      range: jest.fn((a: number, b: number) => {
        call.range = [a, b];
        return builder;
      }),
      order: jest.fn((col: string, opts?: unknown) => {
        call.order = [col, opts];
        return builder;
      }),
      eq: jest.fn((col: string, value: unknown) => {
        call.eq = [col, value];
        return builder;
      }),
      single: jest.fn(() => {
        call.single = true;
        return builder;
      }),
      then: (
        resolve: (value: QueryResult) => unknown,
        reject?: (reason: unknown) => unknown,
      ) => Promise.resolve(result).then(resolve, reject),
    };
    return builder;
  });
  return { from, calls };
}

function buildService(results: QueryResult[], cached?: unknown) {
  const cache = {
    get: jest.fn().mockResolvedValue(cached),
    set: jest.fn().mockResolvedValue(undefined),
  };
  const cfg = {
    get: () => undefined,
  } as unknown as ConfigService;
  const service = new InvoicesService(cfg, cache as unknown as Cache);
  const supabase = buildSupabaseStub(results);
  // @ts-expect-error remplace le client Supabase par le stub
  service['supabase'] = { from: supabase.from };
  return { service, cache, supabase };
}

describe('InvoicesService', () => {
  const env = process.env;
  beforeAll(() => {
    process.env = {
      ...env,
      SUPABASE_URL: 'http://127.0.0.1:1',
      SUPABASE_SERVICE_ROLE_KEY: 'test-key',
    };
  });
  afterAll(() => {
    process.env = env;
  });

  describe('getAllInvoices', () => {
    it('pagine : la page 3 de 20 lit les lignes 40 à 59, triées par date décroissante', async () => {
      const rows = [{ inv_id: '1' }, { inv_id: '2' }];
      const { service, supabase } = buildService([
        { data: rows, error: null },
        { count: 45 },
      ]);

      const result = await service.getAllInvoices(3, 20);

      expect(supabase.calls[0]).toMatchObject({
        table: TABLES.xtr_invoice,
        range: [40, 59],
        order: ['inv_date', { ascending: false }],
      });
      expect(result).toEqual({
        data: rows,
        pagination: { page: 3, limit: 20, total: 45, totalPages: 3 },
      });
    });

    it('met le résultat en cache 300 s sous une clé propre à la page et à la limite', async () => {
      const { service, cache } = buildService([
        { data: [], error: null },
        { count: 0 },
      ]);

      const result = await service.getAllInvoices(2, 10);

      expect(cache.get).toHaveBeenCalledWith('invoices:all:page_2:limit_10');
      expect(cache.set).toHaveBeenCalledWith(
        'invoices:all:page_2:limit_10',
        result,
        300,
      );
    });

    it('sert le cache sans interroger la base', async () => {
      const cached = { data: [{ inv_id: '9' }], pagination: { total: 1 } };
      const { service, supabase, cache } = buildService([], cached);

      await expect(service.getAllInvoices()).resolves.toBe(cached);
      expect(supabase.from).not.toHaveBeenCalled();
      expect(cache.set).not.toHaveBeenCalled();
    });

    it('lève INVOICE.FETCH_FAILED sur erreur de lecture, sans rien mettre en cache', async () => {
      const { service, cache } = buildService([
        { data: null, error: { message: 'permission denied' } },
      ]);

      const failure: unknown = await service
        .getAllInvoices()
        .catch((e: unknown) => e);

      expect(failure).toBeInstanceOf(DatabaseException);
      expect((failure as DatabaseException).code).toBe(
        ErrorCodes.INVOICE.FETCH_FAILED,
      );
      expect(cache.set).not.toHaveBeenCalled();
    });

    it('sans données ni compteur, renvoie une liste vide et 0 page', async () => {
      const { service } = buildService([
        { data: null, error: null },
        { count: null },
      ]);

      await expect(service.getAllInvoices()).resolves.toEqual({
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });
    });
  });

  describe('getInvoiceById', () => {
    it('renvoie la facture avec ses lignes, lues par inv_id puis invl_inv_id', async () => {
      const invoice = { inv_id: '42', inv_date: '2026-01-02' };
      const lines = [{ invl_id: 'a' }, { invl_id: 'b' }];
      const { service, supabase, cache } = buildService([
        { data: invoice, error: null },
        { data: lines, error: null },
      ]);

      const result = await service.getInvoiceById('42');

      expect(supabase.calls[0]).toMatchObject({
        table: TABLES.xtr_invoice,
        eq: ['inv_id', '42'],
        single: true,
      });
      expect(supabase.calls[1]).toMatchObject({
        table: TABLES.xtr_invoice_line,
        eq: ['invl_inv_id', '42'],
      });
      expect(result).toEqual({ ...invoice, lines });
      expect(cache.set).toHaveBeenCalledWith('invoice:42', result, 300);
    });

    it('renvoie null si la facture est introuvable, sans lire les lignes ni cacher', async () => {
      const { service, supabase, cache } = buildService([
        { data: null, error: { code: 'PGRST116' } },
      ]);

      await expect(service.getInvoiceById('404')).resolves.toBeNull();
      expect(supabase.from).toHaveBeenCalledTimes(1);
      expect(cache.set).not.toHaveBeenCalled();
    });

    it('renvoie des lignes vides quand la facture n’en a aucune', async () => {
      const { service } = buildService([
        { data: { inv_id: '7' }, error: null },
        { data: null, error: null },
      ]);

      await expect(service.getInvoiceById('7')).resolves.toEqual({
        inv_id: '7',
        lines: [],
      });
    });

    it('sert le cache sans interroger la base', async () => {
      const cached = { inv_id: '42', lines: [] };
      const { service, supabase } = buildService([], cached);

      await expect(service.getInvoiceById('42')).resolves.toBe(cached);
      expect(supabase.from).not.toHaveBeenCalled();
    });
  });

  describe('getInvoiceStats', () => {
    it('compte les factures et cache le résultat 600 s', async () => {
      const { service, supabase, cache } = buildService([{ count: 1234 }]);

      const result = (await service.getInvoiceStats()) as {
        totalInvoices: number;
        lastUpdated: string;
      };

      expect(supabase.calls[0]).toMatchObject({
        table: TABLES.xtr_invoice,
        select: ['*', { count: 'exact', head: true }],
      });
      expect(result.totalInvoices).toBe(1234);
      expect(Number.isNaN(Date.parse(result.lastUpdated))).toBe(false);
      expect(cache.set).toHaveBeenCalledWith('invoices:stats', result, 600);
    });
  });
});
