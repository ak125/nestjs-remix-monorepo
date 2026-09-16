import { createClient } from '@supabase/supabase-js';
import { ConseilQualityScorerService } from './conseil-quality-scorer.service';

type Row = {
  sgc_id: string;
  sgc_quality_score: number | null;
  sgc_section_type: string;
  sgc_content: string;
  sgc_sources: string | null;
};
const rowsOf = (count: number): Row[] =>
  Array.from({ length: count }, (_, i) => ({
    sgc_id: `00000000-0000-0000-0000-${String(i + 1).padStart(12, '0')}`,
    sgc_quality_score: null,
    sgc_section_type: 'S1',
    sgc_content: 'Filtre.',
    sgc_sources: null,
  }));

// Real Supabase query builder, memory transport. No external request or real key.
function harness(
  rows: Row[],
  options: {
    failIds?: Set<string>;
    beforePatch?: (row: Row) => void;
    failRead?: boolean;
  } = {},
) {
  const attempts: string[] = [];
  const reads: URL[] = [];
  const transport = jest.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      const reply = (data: unknown, status = 200) =>
        new Response(JSON.stringify(data), {
          status,
          headers: { 'Content-Type': 'application/json' },
        });
      if (init?.method === 'PATCH') {
        const id = url.searchParams.get('sgc_id')?.slice(3);
        const row = rows.find((r) => r.sgc_id === id);
        if (!row) return reply([]);
        attempts.push(row.sgc_id);
        options.beforePatch?.(row);
        if (options.failIds?.has(row.sgc_id))
          return reply(
            { message: 'fixture write failure', code: 'TEST_ERROR' },
            400,
          );
        if (
          url.searchParams.get('sgc_quality_score') === 'is.null' &&
          row.sgc_quality_score !== null
        )
          return reply([]);
        const update = JSON.parse(String(init.body)) as {
          sgc_quality_score: number;
        };
        row.sgc_quality_score = update.sgc_quality_score;
        return reply([{ sgc_id: row.sgc_id }]);
      }
      reads.push(url);
      if (reads.length > 10) throw new Error('Non-terminating traversal');
      if (options.failRead)
        return reply(
          { message: 'fixture read failure', code: 'TEST_ERROR' },
          400,
        );
      let selected = rows.filter((r) => r.sgc_quality_score === null);
      const cursor = url.searchParams.get('sgc_id');
      if (cursor?.startsWith('gt.'))
        selected = selected.filter((r) => r.sgc_id > cursor.slice(3));
      if (url.searchParams.get('order') === 'sgc_id.asc')
        selected = [...selected].sort((a, b) =>
          a.sgc_id.localeCompare(b.sgc_id),
        );
      const offset = Number(url.searchParams.get('offset') ?? 0);
      const limit = Number(url.searchParams.get('limit') ?? 100);
      return reply(selected.slice(offset, offset + limit));
    },
  );
  const client = createClient('https://example.invalid', 'fixture-only-key', {
    global: { fetch: transport },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const service = Object.create(
    ConseilQualityScorerService.prototype,
  ) as ConseilQualityScorerService;
  Object.defineProperty(service, 'client', { value: client });
  Object.defineProperty(service, 'log', {
    value: { log: jest.fn(), error: jest.fn() },
  });
  return { service, reads, attempts };
}

describe('Conseil backfill traversal through real Supabase query builder', () => {
  it('visits all 250 rows even though successful writes shrink the NULL selection', async () => {
    const rows = rowsOf(250);
    const { service, attempts, reads } = harness(rows);
    expect(await service.backfillQualityScores()).toEqual({
      updated: 250,
      failed: 0,
      skipped: 0,
    });
    expect(rows.filter((r) => r.sgc_quality_score === null)).toHaveLength(0);
    expect(new Set(attempts).size).toBe(250);
    expect(
      reads.every((url) => url.searchParams.get('order') === 'sgc_id.asc'),
    ).toBe(true);
  });

  it('does not loop on failed rows and still reaches later batches', async () => {
    const rows = rowsOf(250);
    const failIds = new Set(rows.slice(0, 100).map((r) => r.sgc_id));
    const { service, attempts } = harness(rows, { failIds });
    expect(await service.backfillQualityScores()).toEqual({
      updated: 150,
      failed: 100,
      skipped: 0,
    });
    expect(new Set(attempts).size).toBe(250);
    expect(attempts).toHaveLength(250);
  });

  it('leaves a concurrently populated score untouched and does not count it as updated', async () => {
    const rows = rowsOf(1);
    const { service } = harness(rows, {
      beforePatch: (row) => {
        row.sgc_quality_score = 91;
      },
    });
    expect(await service.backfillQualityScores()).toEqual({
      updated: 0,
      failed: 0,
      skipped: 1,
    });
    expect(rows[0].sgc_quality_score).toBe(91);
  });

  it('fails explicitly on a read error instead of inventing 100 failed rows', async () => {
    const { service } = harness(rowsOf(1), { failRead: true });
    await expect(service.backfillQualityScores()).rejects.toMatchObject({
      message: 'fixture read failure',
    });
  });

  it('is idempotent on a second pass and preserves existing scores', async () => {
    const rows = rowsOf(101);
    rows[0].sgc_quality_score = 91;
    const { service } = harness(rows);
    expect(await service.backfillQualityScores()).toEqual({
      updated: 100,
      failed: 0,
      skipped: 0,
    });
    expect(await service.backfillQualityScores()).toEqual({
      updated: 0,
      failed: 0,
      skipped: 0,
    });
    expect(rows[0].sgc_quality_score).toBe(91);
  });
});
