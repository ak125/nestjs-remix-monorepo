/**
 * StaffDataService.getStats() — fail-loud on the PostgREST resolved-error contract.
 *
 * supabase-js RESOLVES a failed query with `{ data: null, count: null, error }`;
 * it does NOT reject. So a `try/catch` around the awaited queries is NOT enough:
 * the previous getStats destructured only `count`/`data`, dropped `error`, and
 * silently coerced a failed COUNT into 0 (a governed no-silent-fallback
 * violation). These tests pin the fix at the DATA-service level — the mock
 * Supabase client RESOLVES `{ error }` (it never rejects), which the earlier
 * StaffService-level mock (a `mockRejectedValue`) could not exercise.
 *
 * The service is instantiated with a stub ConfigService (mirroring
 * accessory-products.service.test.ts) so the SupabaseBaseService constructor
 * gets a URL + key without touching the real environment, then `this.supabase`
 * is swapped for a sequence-driven query stub.
 */
import type { ConfigService } from '@nestjs/config';
import { StaffDataService } from './staff-data.service';

type PgResponse = { count?: number | null; data?: unknown; error: unknown };

/**
 * A chainable, thenable PostgREST query stub that RESOLVES to `response`
 * (mirroring supabase-js: a failed query resolves with `{ error }`, never
 * rejects). `.select`/`.eq`/`.order`/`.range` all return the same builder.
 */
function queryStub(response: PgResponse) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  builder.select = jest.fn(chain);
  builder.eq = jest.fn(chain);
  builder.order = jest.fn(chain);
  builder.range = jest.fn(chain);
  builder.then = (
    resolve: (v: PgResponse) => unknown,
    reject?: (e: unknown) => unknown,
  ) => Promise.resolve(response).then(resolve, reject);
  return builder;
}

/**
 * Mock `supabase` whose successive `.from()` calls return stubs bound to the
 * given responses IN ORDER. getStats issues its three reads inside a single
 * `Promise.all([...])`, so `.from()` fires in array order: [total, active, dept].
 */
function mockSupabaseSequence(responses: PgResponse[]) {
  let i = 0;
  return { from: jest.fn(() => queryStub(responses[i++])) };
}

function makeService() {
  // Stub ConfigService so SupabaseBaseService's constructor resolves a URL + key
  // without the real env (createClient is synchronous — no network on construct).
  const config = {
    get: jest.fn().mockReturnValue('https://example.supabase.co'),
  } as unknown as ConfigService;
  const svc = new StaffDataService(config);
  return svc;
}

function withSupabase(svc: StaffDataService, client: { from: unknown }) {
  (svc as unknown as { supabase: unknown }).supabase = client;
  return svc;
}

describe('StaffDataService.getStats — fail-loud on resolved { error }', () => {
  it('rejects when the FIRST (total COUNT) query resolves with { error } — no silent zeros', async () => {
    const svc = makeService();
    const pgError = {
      message: 'permission denied for table ___config_admin',
      code: '42501',
    };
    withSupabase(
      svc,
      mockSupabaseSequence([
        { count: null, data: null, error: pgError }, // total → resolved error
        { count: 5, data: null, error: null }, // active
        { data: [{ cnfa_job: 'Ventes' }], error: null }, // departments
      ]),
    );

    await expect(svc.getStats()).rejects.toBe(pgError);
  });

  it('rejects when the THIRD (departments) query resolves with { error } — every query is checked', async () => {
    const svc = makeService();
    const pgError = { message: 'canceling statement: timeout', code: '57014' };
    withSupabase(
      svc,
      mockSupabaseSequence([
        { count: 10, data: null, error: null }, // total
        { count: 7, data: null, error: null }, // active
        { data: null, error: pgError }, // departments → resolved error
      ]),
    );

    await expect(svc.getStats()).rejects.toBe(pgError);
  });

  it('returns computed stats (total/active/inactive + unique department names) on success', async () => {
    const svc = makeService();
    withSupabase(
      svc,
      mockSupabaseSequence([
        { count: 10, data: null, error: null },
        { count: 7, data: null, error: null },
        {
          data: [
            { cnfa_job: 'Ventes' },
            { cnfa_job: 'Support' },
            { cnfa_job: 'Ventes' }, // duplicate → deduped
            { cnfa_job: null }, // falsy → dropped
          ],
          error: null,
        },
      ]),
    );

    await expect(svc.getStats()).resolves.toEqual({
      total: 10,
      active: 7,
      inactive: 3,
      departments: ['Ventes', 'Support'],
    });
  });
});
