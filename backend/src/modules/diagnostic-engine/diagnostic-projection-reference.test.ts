import { ZodError } from 'zod';
import { DiagnosticEngineDataService } from './diagnostic-engine.data-service';

type Reply = {
  data: Record<string, unknown>[] | null;
  error: { message: string } | null;
  count?: number | null;
  /** Lignes servies par page au plus (max-rows serveur plus bas que la page). */
  cap?: number;
  /** Erreur renvoyée à partir de cet offset. */
  failFrom?: number;
  /** `count` renvoyé à partir de cet offset (écriture concurrente). */
  countFrom?: { offset: number; count: number };
};

const system = {
  id: 1,
  slug: 'filtration',
  label: 'Filtration',
  description: null,
  display_order: 1,
  active: true,
};
const symptom = {
  id: 10,
  system_id: 1,
  slug: 'perte_puissance_filtration',
  label: 'Perte de puissance',
  description: null,
  signal_mode: 'symptom_slugs',
  urgency: 'moyenne',
  active: true,
};
const cause = (id: number, slug: string) => ({
  id,
  system_id: 1,
  slug,
  label: slug,
  cause_type: 'maintenance_related',
  description: null,
  verification_method: null,
  urgency: 'moyenne',
  active: true,
});
const link = (id: number, symptomId: number, causeId: number) => ({
  id,
  symptom_id: symptomId,
  cause_id: causeId,
  relative_score: 50,
  evidence_for: [],
  evidence_against: [],
  requires_verification: true,
  active: true,
});

function makeService(overrides: Partial<Record<string, Reply>> = {}) {
  const tables: Record<string, Reply> = {
    __diag_system: { data: [system], error: null },
    __diag_symptom: { data: [symptom], error: null },
    __diag_cause: {
      data: [
        cause(20, 'filtre_air_colmate'),
        cause(21, 'filtre_carburant_colmate'),
      ],
      error: null,
    },
    // Un symptôme → deux causes : l'unicité porte sur la paire, pas sur cause_id.
    __diag_symptom_cause_link: {
      data: [link(113, 10, 20), link(114, 10, 21)],
      error: null,
    },
    ...overrides,
  };
  const calls: Array<{
    table: string;
    select: unknown[];
    filters: unknown[][];
    from: number;
    to: number;
  }> = [];
  const service = Object.create(
    DiagnosticEngineDataService.prototype,
  ) as DiagnosticEngineDataService;
  Object.assign(service, {
    logger: { error: jest.fn(), warn: jest.fn(), log: jest.fn() },
    supabase: {
      from: (table: string) => {
        const reply = tables[table];
        if (!reply) throw new Error(`Unexpected table: ${table}`);
        const trace = {
          table,
          select: [] as unknown[],
          filters: [] as unknown[][],
          from: 0,
          to: 0,
        };
        calls.push(trace);
        const query = {
          select: (...args: unknown[]) => {
            trace.select = args;
            return query;
          },
          eq: (...args: unknown[]) => {
            trace.filters.push(['eq', ...args]);
            return query;
          },
          order: (...args: unknown[]) => {
            trace.filters.push(['order', ...args]);
            return query;
          },
          range: (from: number, to: number) => {
            trace.filters.push(['range', from, to]);
            trace.from = from;
            trace.to = to;
            return query;
          },
          then: (resolve: (value: Reply) => unknown) => {
            const all = reply.data;
            const total =
              reply.count !== undefined
                ? reply.count
                : Array.isArray(all)
                  ? all.length
                  : null;
            const failed =
              reply.failFrom !== undefined && trace.from >= reply.failFrom;
            const end = Math.min(
              trace.to + 1,
              trace.from + (reply.cap ?? Number.POSITIVE_INFINITY),
            );
            return Promise.resolve({
              data: failed || !all ? null : all.slice(trace.from, end),
              error: failed ? { message: 'boom' } : reply.error,
              count:
                reply.countFrom && trace.from >= reply.countFrom.offset
                  ? reply.countFrom.count
                  : total,
            }).then(resolve);
          },
        };
        return query;
      },
    },
  });
  return { service, calls };
}

/** 1001 liens actifs distincts : une page pleine puis une page d'une ligne. */
const manyLinks = Array.from({ length: 1001 }, (_, i) =>
  link(1000 + i, 10, 5000 + i),
);

describe('DiagnosticEngineDataService.getProjectionReference', () => {
  it('reads the four active tables with an exact count, ordered by id, one page each', async () => {
    const { service, calls } = makeService();
    const reference = await service.getProjectionReference();

    expect(reference.links.map((row) => row.id)).toEqual([113, 114]);
    expect(reference.causes).toHaveLength(2);
    expect(calls.map((call) => call.table).sort()).toEqual([
      '__diag_cause',
      '__diag_symptom',
      '__diag_symptom_cause_link',
      '__diag_system',
    ]);
    for (const call of calls) {
      expect(call.select).toEqual(['*', { count: 'exact' }]);
      expect(call.filters).toEqual([
        ['eq', 'active', true],
        ['order', 'id', { ascending: true }],
        ['range', 0, 999],
      ]);
    }
  });

  it('reads past the 1000-row PostgREST cap, page by page', async () => {
    const { service, calls } = makeService({
      __diag_symptom_cause_link: { data: manyLinks, error: null },
    });
    const reference = await service.getProjectionReference();

    expect(reference.links).toHaveLength(1001);
    expect(reference.links[1000].id).toBe(2000);
    expect(
      calls
        .filter((call) => call.table === '__diag_symptom_cause_link')
        .map((call) => [call.from, call.to]),
    ).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
  });

  it('throws when the server serves fewer rows than the exact count', async () => {
    const { service } = makeService({
      __diag_symptom_cause_link: {
        data: [link(113, 10, 20), link(114, 10, 21), link(115, 10, 22)],
        error: null,
        cap: 2,
      },
    });
    await expect(service.getProjectionReference()).rejects.toThrow(
      '__diag_symptom_cause_link incomplete: 2 row(s) read, 3 active',
    );
  });

  it('throws when the active count changes between pages', async () => {
    const { service } = makeService({
      __diag_symptom_cause_link: {
        data: manyLinks,
        error: null,
        countFrom: { offset: 1000, count: 1002 },
      },
    });
    await expect(service.getProjectionReference()).rejects.toThrow(
      '__diag_symptom_cause_link changed during read: 1002 active, 1001 at offset 0',
    );
  });

  it('throws when a table read fails', async () => {
    const { service } = makeService({
      __diag_cause: { data: null, error: { message: 'boom' } },
    });
    await expect(service.getProjectionReference()).rejects.toThrow(
      '__diag_cause unavailable at offset 0: boom',
    );
  });

  it('throws when a later page fails', async () => {
    const { service } = makeService({
      __diag_symptom_cause_link: {
        data: manyLinks,
        error: null,
        failFrom: 1000,
      },
    });
    await expect(service.getProjectionReference()).rejects.toThrow(
      '__diag_symptom_cause_link unavailable at offset 1000: boom',
    );
  });

  it('rejects two active links for the same symptom → cause pair', async () => {
    const { service } = makeService({
      __diag_symptom_cause_link: {
        data: [link(113, 10, 20), link(999, 10, 20)],
        error: null,
      },
    });
    const error = await service.getProjectionReference().catch((e) => e);
    // Le refine d'unicité (sans message propre) porte sur le tableau entier.
    expect(error).toBeInstanceOf(ZodError);
    expect(
      (error as ZodError).issues.map((i) => [i.code, i.path, i.message]),
    ).toEqual([['custom', [], 'Invalid input']]);
  });

  it('rejects a row that is not active', async () => {
    const { service } = makeService({
      __diag_symptom: { data: [{ ...symptom, active: null }], error: null },
    });
    const error = await service.getProjectionReference().catch((e) => e);
    // z.literal(true) sur la colonne `active` de la ligne 0.
    expect(error).toBeInstanceOf(ZodError);
    expect((error as ZodError).issues.map((i) => [i.code, i.path])).toEqual([
      ['invalid_value', [0, 'active']],
    ]);
  });

  it('reads exactly one full page of 1000 links, then an empty page', async () => {
    const { service, calls } = makeService({
      __diag_symptom_cause_link: {
        data: manyLinks.slice(0, 1000),
        error: null,
      },
    });
    const reference = await service.getProjectionReference();

    expect(reference.links).toHaveLength(1000);
    expect(
      calls
        .filter((call) => call.table === '__diag_symptom_cause_link')
        .map((call) => [call.from, call.to]),
    ).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
  });
});
