/**
 * SeoProjectionReaderService (C0) — propriétaire unique de la lecture `get_active_seo_projection`.
 * Vérifie :
 *  1. logique readActiveProjection : mapping (entityId, role) → params RPC {p_entity_id, p_role} +
 *     context {source:'api'} + les 3 dégradations OBSERVABLES + le happy-path (via Object.create,
 *     bypass du constructeur SupabaseBaseService lourd ; callRpc stubbé) ;
 *  2. **gate RPC obligatoire** : le constructeur assigne systématiquement `RpcGateService` (mock
 *     explicite) — jamais optionnel ;
 *  3. **fail-closed DI** : sans `RpcGateService` disponible, le boot Nest du module de lecture est
 *     REFUSÉ ; avec `RpcGateModule` global (comme l'AppModule réel), le boot est VERT. Preuve
 *     qu'une mauvaise composition ne peut plus se transformer silencieusement en
 *     `GATE_NOT_INJECTED → ALLOW`.
 */
import { Test } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RpcGateModule } from '@security/rpc-gate/rpc-gate.module';
import { RpcGateService } from '@security/rpc-gate/rpc-gate.service';
import { SeoProjectionReadModule } from './seo-projection-read.module';
import {
  SeoProjectionReaderService,
  type ProjectionEnvelope,
} from './seo-projection-reader.service';

/** Env minimal pour que SupabaseBaseService.createClient réussisse (pas de connexion réelle). */
const SUPABASE_TEST_ENV = {
  SUPABASE_URL: 'http://localhost:54321',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key-not-a-real-secret',
};

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

describe('SeoProjectionReaderService — gate RPC obligatoire (constructeur)', () => {
  const mockConfig = {
    get: (k: string) => (SUPABASE_TEST_ENV as Record<string, string>)[k],
  } as unknown as ConfigService;

  it('assigne systématiquement le RpcGateService fourni (jamais optionnel)', () => {
    const mockGate = {
      evaluate: () => ({ decision: 'ALLOW', reason: 'test' }),
      log: () => {},
    } as unknown as RpcGateService;
    const svc = new SeoProjectionReaderService(mockConfig, mockGate);
    // rpcGate est protected sur SupabaseBaseService → accès via cast pour la preuve.
    expect((svc as unknown as { rpcGate?: RpcGateService }).rpcGate).toBe(
      mockGate,
    );
  });
});

/**
 * Fail-closed DI : le module de lecture ne peut PAS booter sans RpcGateService.
 * (Preuve qu'une mauvaise composition Nest échoue au boot au lieu d'exécuter la RPC sans gate.)
 */
describe('SeoProjectionReadModule — fail-closed DI sur RpcGateService', () => {
  it('SANS RpcGateModule global → boot Nest REFUSÉ (dépendance RpcGateService non résolue)', async () => {
    await expect(
      Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            isGlobal: true,
            ignoreEnvFile: true,
            load: [() => SUPABASE_TEST_ENV],
          }),
          // RpcGateModule volontairement ABSENT → RpcGateService non fourni.
          SeoProjectionReadModule,
        ],
      }).compile(),
    ).rejects.toThrow(/RpcGateService/);
  });

  it('AVEC RpcGateModule global (comme l’AppModule réel) → boot VERT + reader résolu avec gate', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => SUPABASE_TEST_ENV],
        }),
        RpcGateModule, // @Global — fournit RpcGateService à toute l'app (parité AppModule)
        SeoProjectionReadModule,
      ],
    }).compile();

    const reader = moduleRef.get(SeoProjectionReaderService);
    expect(reader).toBeInstanceOf(SeoProjectionReaderService);
    expect(
      (reader as unknown as { rpcGate?: RpcGateService }).rpcGate,
    ).toBeDefined();
    await moduleRef.close();
  });
});
