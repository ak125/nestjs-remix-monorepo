// backend/src/workers/processors/__tests__/seo-monitor.processor.test.ts

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
process.env.SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY || 'test-service-key';
process.env.SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';

import { SeoMonitorProcessor } from '../seo-monitor.processor';

/**
 * Contrat de la sonde `checkUrl` (A1, plan massdoc 2026-09-02).
 *
 * Avant : `.select('rtp_piece_id', { count: 'exact', head: true })` filtré sur
 * `rtp_type_id` + `rtp_ga_id`. Mesuré en PROD (pg_stat_statements) : 110 663
 * appels, 1 167 ms de moyenne, 2 705 blocs lus par appel ≈ 2,3 To de churn du
 * buffer pool — comptage complet sur 368 M lignes, et `rtp_ga_id` n'est pas
 * indexé.
 *
 * Et la colonne était la mauvaise : `rtp_ga_id` est la gamme ARTICLE (sous-
 * gamme TecDoc : « Accessoires de plaquette », « Tête de cardan »…), pas la
 * gamme de la page. Toutes les RPC de la page R2 filtrent `rtp_pg_id`, et sur
 * les 8 couples critiques le comptage via `rtp_ga_id` sous-compte de 1 à 12 %
 * (ex. 893 contre 1 010 pour disques 82 × 29991) — preuve SQL dans la PR.
 *
 * Après : sonde BORNÉE — au plus `WARNING_THRESHOLD` (5) lignes lues via
 * l'index composite `(rtp_type_id, rtp_pg_id)`, sans comptage. La frontière
 * de décision est intacte : 0 → error, 1..4 → warning avec le compte exact,
 * ≥ 5 → ok (piecesCount rapporté = 5, borne de la sonde).
 */

type QueryResult = {
  data?: unknown[] | null;
  error?: { message: string } | null;
  count?: number | null;
};

function supabaseMock(result: QueryResult) {
  const builder: Record<string, jest.Mock> & { then?: unknown } = {};
  for (const m of ['select', 'eq', 'limit']) {
    builder[m] = jest.fn(() => builder);
  }
  // Les query builders Supabase sont des thenables : `await builder` résout.
  builder.then = (
    resolve: (v: QueryResult) => unknown,
    reject: (e: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject);
  const from = jest.fn(() => builder);
  return { client: { from }, from, builder };
}

function buildProcessor(result: QueryResult) {
  const configService = { get: (k: string) => process.env[k] } as never;
  const rpcGate = {} as never;
  const jobHealth = { recordSuccess: jest.fn().mockResolvedValue(undefined) };
  const processor = new SeoMonitorProcessor(
    configService,
    rpcGate,
    jobHealth as never,
  );
  const mock = supabaseMock(result);
  (processor as unknown as { supabase: unknown }).supabase = mock.client;
  type CheckResult = {
    status: 'ok' | 'warning' | 'error';
    piecesCount: number;
    message?: string;
  };
  const checkUrl = (url: string, typeId: number, gammeId: number) =>
    (
      processor as unknown as {
        checkUrl: (u: string, t: number, g: number) => Promise<CheckResult>;
      }
    ).checkUrl(url, typeId, gammeId);
  return { processor, mock, checkUrl };
}

const rows = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ rtp_piece_id: i + 1 }));

describe('SeoMonitorProcessor.checkUrl — sonde de présence bornée (A1)', () => {
  it('filtre rtp_type_id + rtp_pg_id (jamais rtp_ga_id), sans count exact, borné à 5 lignes', async () => {
    const { mock, checkUrl } = buildProcessor({ data: rows(5), error: null });

    await checkUrl('/pieces/filtre-a-huile-7/x/y/z-8217.html', 8217, 7);

    expect(mock.from).toHaveBeenCalledWith('pieces_relation_type');
    // Sélection plate : ni `{ count: 'exact' }` ni `head: true`.
    expect(mock.builder.select).toHaveBeenCalledWith('rtp_piece_id');
    expect(mock.builder.eq).toHaveBeenCalledWith('rtp_type_id', 8217);
    expect(mock.builder.eq).toHaveBeenCalledWith('rtp_pg_id', 7);
    expect(mock.builder.eq).not.toHaveBeenCalledWith(
      'rtp_ga_id',
      expect.anything(),
    );
    expect(mock.builder.limit).toHaveBeenCalledWith(5);
  });

  it('0 ligne → status error (risque désindexation), piecesCount 0', async () => {
    const { checkUrl } = buildProcessor({ data: [], error: null });

    const result = await checkUrl('/pieces/x', 8217, 7);

    expect(result.status).toBe('error');
    expect(result.piecesCount).toBe(0);
    expect(result.message).toMatch(/0 pièce/);
  });

  it('1..4 lignes → status warning avec le compte exact', async () => {
    const { checkUrl } = buildProcessor({ data: rows(3), error: null });

    const result = await checkUrl('/pieces/x', 8217, 7);

    expect(result.status).toBe('warning');
    expect(result.piecesCount).toBe(3);
  });

  it('5 lignes (borne de la sonde) → status ok, piecesCount = 5 (≥ 5)', async () => {
    const { checkUrl } = buildProcessor({ data: rows(5), error: null });

    const result = await checkUrl('/pieces/x', 8217, 7);

    expect(result.status).toBe('ok');
    expect(result.piecesCount).toBe(5);
  });

  it('erreur DB → status error, piecesCount -1, message explicite', async () => {
    const { checkUrl } = buildProcessor({
      data: null,
      error: { message: 'connection reset' },
    });

    const result = await checkUrl('/pieces/x', 8217, 7);

    expect(result.status).toBe('error');
    expect(result.piecesCount).toBe(-1);
    expect(result.message).toMatch(/Erreur DB: connection reset/);
  });
});
