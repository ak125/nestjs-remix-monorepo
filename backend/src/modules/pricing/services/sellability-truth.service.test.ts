/**
 * SellabilityTruthService — couverture orchestration (sans DB).
 *
 * Le prédicat canonique lui-même vit côté SQL (is_piece_sellable /
 * refresh_catalog_sellable_candidates) et est cross-validé LIVE (backfill runner +
 * cross-check manuel 26/26, 6/6). Ces tests épinglent l'orchestration TS : mapping
 * d'agrégat, flag `stale`, NO silent fallback (remonte l'erreur, jamais un `true`
 * optimiste), garde d'entrée.
 */
import { ConfigService } from '@nestjs/config';
import { SellabilityTruthService } from './sellability-truth.service';

type SupabaseLike = {
  rpc: jest.Mock;
  from: jest.Mock;
};

/** Chaîne minimale .select().eq()…maybeSingle() renvoyant un résultat canné. */
function fromChain(result: { data: unknown; error: unknown }) {
  const b: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'order', 'limit', 'gt']) {
    b[m] = () => b;
  }
  b.maybeSingle = () => Promise.resolve(result);
  return b;
}

function makeService(supabase: SupabaseLike): SellabilityTruthService {
  const config = {
    get: (k: string) => (k.includes('URL') ? 'http://localhost' : 'test-key'),
  } as unknown as ConfigService;
  const svc = new SellabilityTruthService(config);
  (svc as unknown as { supabase: SupabaseLike }).supabase = supabase;
  return svc;
}

describe('SellabilityTruthService', () => {
  describe('isSellablePiece', () => {
    it('returns true when is_piece_sellable RPC → true', async () => {
      const supabase = {
        rpc: jest.fn().mockResolvedValue({ data: true, error: null }),
        from: jest.fn(),
      };
      const svc = makeService(supabase);
      await expect(svc.isSellablePiece(123)).resolves.toBe(true);
      expect(supabase.rpc).toHaveBeenCalledWith('is_piece_sellable', {
        p_piece_id: 123,
      });
    });

    it('returns false when RPC → false', async () => {
      const supabase = {
        rpc: jest.fn().mockResolvedValue({ data: false, error: null }),
        from: jest.fn(),
      };
      await expect(makeService(supabase).isSellablePiece(123)).resolves.toBe(
        false,
      );
    });

    it('returns false for an invalid pieceId WITHOUT hitting the DB', async () => {
      const supabase = { rpc: jest.fn(), from: jest.fn() };
      const svc = makeService(supabase);
      await expect(svc.isSellablePiece(0)).resolves.toBe(false);
      await expect(svc.isSellablePiece(-5)).resolves.toBe(false);
      await expect(svc.isSellablePiece(1.5)).resolves.toBe(false);
      expect(supabase.rpc).not.toHaveBeenCalled();
    });

    it('THROWS on RPC error (no silent optimistic true)', async () => {
      const supabase = {
        rpc: jest
          .fn()
          .mockResolvedValue({ data: null, error: { message: 'boom' } }),
        from: jest.fn(),
      };
      await expect(makeService(supabase).isSellablePiece(123)).rejects.toEqual({
        message: 'boom',
      });
    });
  });

  describe('getAggregate', () => {
    it('maps a row and flags stale=false when refreshed_at is set', async () => {
      const supabase = {
        rpc: jest.fn(),
        from: jest.fn(() =>
          fromChain({
            data: {
              type_id_i: 1,
              pg_id: 7,
              catalog_active: true,
              sellable_count: 26,
              price_sellable_count: 26,
              min_price: 6,
              has_price: true,
              has_dispo: true,
              refreshed_at: '2026-06-13T00:00:00Z',
            },
            error: null,
          }),
        ),
      };
      const agg = await makeService(supabase).getAggregate(1, 7);
      expect(agg).toMatchObject({
        typeId: 1,
        pgId: 7,
        catalogActive: true,
        sellableCount: 26,
        minPrice: 6,
        hasPrice: true,
        hasDispo: true,
        stale: false,
      });
    });

    it('flags stale=true when refreshed_at is null', async () => {
      const supabase = {
        rpc: jest.fn(),
        from: jest.fn(() =>
          fromChain({
            data: {
              type_id_i: 2,
              pg_id: 3,
              catalog_active: false,
              sellable_count: 0,
              min_price: null,
              has_price: false,
              has_dispo: false,
              refreshed_at: null,
            },
            error: null,
          }),
        ),
      };
      const agg = await makeService(supabase).getAggregate(2, 3);
      expect(agg?.stale).toBe(true);
      expect(agg?.minPrice).toBeNull();
    });

    it('returns null when the pair is absent from the rollup', async () => {
      const supabase = {
        rpc: jest.fn(),
        from: jest.fn(() => fromChain({ data: null, error: null })),
      };
      await expect(makeService(supabase).getAggregate(9, 9)).resolves.toBeNull();
    });
  });

  describe('isReady', () => {
    it.each([
      [true, true],
      [false, false],
      [null, false],
    ])('ready=%s → %s', async (ready, expected) => {
      const supabase = {
        rpc: jest.fn(),
        from: jest.fn(() => fromChain({ data: ready === null ? null : { ready }, error: null })),
      };
      await expect(makeService(supabase).isReady()).resolves.toBe(expected);
    });
  });

  describe('refresh', () => {
    it('forwards the delta/stale/shard args and returns the pair count', async () => {
      const supabase = {
        rpc: jest.fn().mockResolvedValue({ data: 42, error: null }),
        from: jest.fn(),
      };
      const svc = makeService(supabase);
      await expect(
        svc.refresh({ pieceIds: [1, 2, 3] }),
      ).resolves.toBe(42);
      expect(supabase.rpc).toHaveBeenCalledWith(
        'refresh_catalog_sellable_candidates',
        {
          p_piece_ids: [1, 2, 3],
          p_stale_only: false,
          p_type_lo: null,
          p_type_hi: null,
          p_limit: 5000,
        },
      );
    });
  });

  describe('diagnostic', () => {
    it('returns the diagnostic RPC payload', async () => {
      const payload = { ready: false, pairs_total: 0 };
      const supabase = {
        rpc: jest.fn().mockResolvedValue({ data: payload, error: null }),
        from: jest.fn(),
      };
      await expect(makeService(supabase).diagnostic()).resolves.toEqual(
        payload,
      );
    });
  });
});
