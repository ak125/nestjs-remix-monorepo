/**
 * SeoProjectionReaderService (C0) — propriétaire unique de la lecture `get_active_seo_projection`.
 * Vérifie : mapping (entityId, role) → params RPC {p_entity_id, p_role} + context {source:'api'},
 * et les 3 dégradations OBSERVABLES (RPC error / exception / projection absente) + le happy-path.
 * Instancié via Object.create (bypass du constructeur SupabaseBaseService lourd) ; callRpc stubbé.
 */
import {
  SeoProjectionReaderService,
  type ProjectionEnvelope,
} from './seo-projection-reader.service';

type RpcOut = {
  data: unknown;
  error: { message: string } | null;
};

function makeReader(
  rpc: (
    name: string,
    params: Record<string, unknown>,
    ctx: unknown,
  ) => Promise<RpcOut>,
) {
  const svc = Object.create(SeoProjectionReaderService.prototype) as Record<
    string,
    unknown
  >;
  svc.logger = { warn() {}, log() {}, error() {} };
  svc.callRpc = rpc;
  return svc as unknown as {
    readActiveProjection: SeoProjectionReaderService['readActiveProjection'];
  };
}

describe('SeoProjectionReaderService.readActiveProjection', () => {
  it('mappe (entityId, role) → RPC get_active_seo_projection {p_entity_id, p_role} + source api', async () => {
    let seen: {
      name: string;
      params: Record<string, unknown>;
      ctx: unknown;
    } | null = null;
    const reader = makeReader((name, params, ctx) => {
      seen = { name, params, ctx };
      return Promise.resolve({ data: null, error: null });
    });
    await reader.readActiveProjection('gamme:filtre-a-huile', 'R3_CONSEILS');
    expect(seen!.name).toBe('get_active_seo_projection');
    expect(seen!.params).toEqual({
      p_entity_id: 'gamme:filtre-a-huile',
      p_role: 'R3_CONSEILS',
    });
    expect(seen!.ctx).toEqual({ source: 'api' });
  });

  it('RPC error → { envelope: null, degradeReason: "RPC error: <msg>" }', async () => {
    const reader = makeReader(() =>
      Promise.resolve({ data: null, error: { message: 'boom' } }),
    );
    const r = await reader.readActiveProjection('gamme:x', 'R3_CONSEILS');
    expect(r.envelope).toBeNull();
    expect(r.degradeReason).toBe('RPC error: boom');
  });

  it('RPC exception → { envelope: null, degradeReason: "RPC exception" }', async () => {
    const reader = makeReader(() => Promise.reject(new Error('kaboom')));
    const r = await reader.readActiveProjection('gamme:x', 'R3_CONSEILS');
    expect(r.envelope).toBeNull();
    expect(r.degradeReason).toBe('RPC exception');
  });

  it('projection absente (data null, error null) → degradeReason "projection absente"', async () => {
    const reader = makeReader(() =>
      Promise.resolve({ data: null, error: null }),
    );
    const r = await reader.readActiveProjection('gamme:x', 'R3_CONSEILS');
    expect(r.envelope).toBeNull();
    expect(r.degradeReason).toBe('projection absente');
  });

  it('projection présente → { envelope, degradeReason: null }', async () => {
    const env: ProjectionEnvelope = {
      entity_id: 'gamme:filtre-a-huile',
      entity_type: 'gamme',
      slug: 'filtre-a-huile',
      facts: [],
      blocks: [{ role: 'R3_CONSEILS', content: { content_md: 'x' } }],
    };
    const reader = makeReader(() =>
      Promise.resolve({ data: env, error: null }),
    );
    const r = await reader.readActiveProjection(
      'gamme:filtre-a-huile',
      'R3_CONSEILS',
    );
    expect(r.degradeReason).toBeNull();
    expect(r.envelope).toEqual(env);
  });
});
