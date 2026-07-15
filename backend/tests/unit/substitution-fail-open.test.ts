/**
 * SubstitutionService — fail-OPEN on RPC infrastructure error
 *
 * Incident 2026-06-25: `get_substitution_data` RPC errored in SQL
 * (`column "pieces_gamme.pg_name" must appear in the GROUP BY clause`). The
 * service fail-CLOSED — an RPC *error* was returned as `gamme_found:false`,
 * which `determineSubstitution` maps to httpStatus 404. The R1 loader then
 * threw a 404 on a VALID page (gamme 7, whose primary data loaded fine) →
 * intermittent 404 on real R1 pages.
 *
 * Contract: an RPC INFRASTRUCTURE error is NOT "gamme not found". It must
 * fail-OPEN to httpStatus 200 'none' (substitution enrichment absent, page
 * renders normally), while a genuine not-found (RPC ok, gamme_found:false)
 * still yields 404. The RPC error remains logged → observable, not silent.
 *
 * @see backend/src/modules/substitution/services/substitution.service.ts
 */
import { SubstitutionService } from '@modules/substitution/services/substitution.service';

function makeService(callRpc: jest.Mock): SubstitutionService {
  const configService = {
    get: jest.fn((k: string) => (/URL/i.test(k) ? 'http://localhost:54321' : 'test-key')),
  };
  const intentExtractor = {
    isSuspiciousBot: jest.fn(() => false),
    extractFromPathname: jest.fn(() => ({
      gammeAlias: 'filtre-a-huile',
      gammeId: 7,
    })),
  };
  const substitutionLogger = { logAsync: jest.fn() };
  const rpcGate = {};
  const svc = new SubstitutionService(
    configService as any,
    intentExtractor as any,
    substitutionLogger as any,
    rpcGate as any,
  );
  // callRpc is the only DB seam — override it so no real Supabase call happens.
  (svc as any).callRpc = callRpc;
  return svc;
}

describe('SubstitutionService — fail-open on RPC error', () => {
  it('RPC error → 200 (fail-open), NOT 404 — valid page survives a broken RPC', async () => {
    const callRpc = jest.fn().mockResolvedValue({
      data: null,
      error: {
        message:
          'column "pieces_gamme.pg_name" must appear in the GROUP BY clause',
      },
    });
    const svc = makeService(callRpc);

    const res = await svc.checkSubstitution(
      '/pieces/filtre-a-huile-7.html',
      'Mozilla/5.0',
    );

    expect(res.httpStatus).toBe(200);
    expect(res.type).toBe('none');
  });

  it('RPC exception (throw) → 200 (fail-open), NOT 404', async () => {
    const callRpc = jest.fn().mockRejectedValue(new Error('connection reset'));
    const svc = makeService(callRpc);

    const res = await svc.checkSubstitution(
      '/pieces/filtre-a-huile-7.html',
      'Mozilla/5.0',
    );

    expect(res.httpStatus).toBe(200);
  });

  it('genuine not-found (RPC ok, gamme_found:false) → still 404 (preserved)', async () => {
    const callRpc = jest.fn().mockResolvedValue({
      data: {
        _meta: {
          gamme_found: false,
          vehicle_found: false,
          products_count: 0,
          resolved_by: 'none',
        },
      },
      error: null,
    });
    const svc = makeService(callRpc);

    const res = await svc.checkSubstitution(
      '/pieces/zzz-inexistant-999.html',
      'Mozilla/5.0',
    );

    expect(res.httpStatus).toBe(404);
    expect(res.type).toBe('unknown_slug');
  });

  it('valid gamme (RPC ok, products>0) → 200', async () => {
    const callRpc = jest.fn().mockResolvedValue({
      data: {
        _meta: {
          gamme_found: true,
          vehicle_found: false,
          products_count: 12,
          resolved_by: 'exact',
        },
        gamme: { pg_id: 7, pg_name: 'Filtre à huile', pg_alias: 'filtre-a-huile' },
      },
      error: null,
    });
    const svc = makeService(callRpc);

    const res = await svc.checkSubstitution(
      '/pieces/filtre-a-huile-7.html',
      'Mozilla/5.0',
    );

    expect(res.httpStatus).toBe(200);
  });
});
