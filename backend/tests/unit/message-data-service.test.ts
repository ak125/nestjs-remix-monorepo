/**
 * `MessageDataService` — queries sent to `___xtr_msg` and their reading.
 *
 * `msg_close` and `msg_open` are text columns: the database answers '0' or
 * '1'. Figures are counted by the database, never read from returned rows
 * (a response carries a bounded number of rows).
 *
 * The database client is replaced by a recorder: each test asserts the query
 * that leaves the service, and what the service makes of the answer.
 */
import { MessageDataService } from '../../src/modules/messages/repositories/message-data.service';

// ─── Database double ────────────────────────────────────────────────────────

interface RecordedQuery {
  select: unknown[];
  eq: Array<[string, unknown]>;
  or: string[];
  range?: [number, number];
}

/** Flag filter of a query, as `column=value`, or `none`. */
const flagOf = (query: RecordedQuery): string => {
  const flag = query.eq.find(([column]) => column !== 'msg_cst_id');
  return flag ? `${flag[0]}=${String(flag[1])}` : 'none';
};

function build(answer: (query: RecordedQuery) => unknown) {
  const queries: RecordedQuery[] = [];
  const from = jest.fn(() => {
    const query: RecordedQuery = { select: [], eq: [], or: [] };
    queries.push(query);
    const builder: Record<string, unknown> = {
      select: (...args: unknown[]) => {
        query.select = args;
        return builder;
      },
      eq: (column: string, value: unknown) => {
        query.eq.push([column, value]);
        return builder;
      },
      or: (filter: string) => {
        query.or.push(filter);
        return builder;
      },
      range: (start: number, end: number) => {
        query.range = [start, end];
        return builder;
      },
      order: () => builder,
      then: (
        resolve: (value: unknown) => unknown,
        reject: (reason: unknown) => unknown,
      ) => Promise.resolve(answer(query)).then(resolve, reject),
    };
    return builder;
  });

  const service = Object.create(MessageDataService.prototype);
  Object.assign(service, {
    supabase: { from },
    tableName: '___xtr_msg',
    logger: { log: jest.fn(), error: jest.fn() },
  });
  return { service: service as MessageDataService, queries, from };
}

/** Answers each count by its flag filter. */
const counts =
  (byFlag: Record<string, number | null>) => (query: RecordedQuery) => ({
    count: byFlag[flagOf(query)],
    error: null,
  });

const row = (overrides: Record<string, unknown> = {}) => ({
  msg_id: 'm1',
  msg_cst_id: '42',
  msg_cnfa_id: '1',
  msg_ord_id: null,
  msg_subject: 'Sujet',
  msg_content: 'Contenu',
  msg_close: '0',
  msg_open: '0',
  msg_date: '2026-01-02T03:04:05.000Z',
  ...overrides,
});

const listAnswer =
  (rows: unknown[], count = rows.length) =>
  () => ({
    data: rows,
    count,
    error: null,
  });

// ─── Statistics ─────────────────────────────────────────────────────────────

describe('MessageDataService.getStatistics', () => {
  it('reports the figures the database counted, flags compared as text', async () => {
    const { service, queries } = build(
      counts({ none: 2500, 'msg_close=1': 300, 'msg_open=0': 40 }),
    );

    expect(await service.getStatistics()).toEqual({
      total: 2500,
      open: 2200,
      closed: 300,
      unread: 40,
    });
    expect(queries.map(flagOf).sort()).toEqual([
      'msg_close=1',
      'msg_open=0',
      'none',
    ]);
  });

  it('counts without reading rows', async () => {
    const { service, queries } = build(
      counts({ none: 0, 'msg_close=1': 0, 'msg_open=0': 0 }),
    );

    await service.getStatistics();

    for (const query of queries) {
      expect(query.select).toEqual([
        'msg_id',
        { count: 'estimated', head: true },
      ]);
      expect(query.range).toBeUndefined();
    }
  });

  it('filters every count on the customer column the table declares', async () => {
    const { service, queries } = build(
      counts({ none: 3, 'msg_close=1': 1, 'msg_open=0': 2 }),
    );

    expect(await service.getStatistics('42')).toEqual({
      total: 3,
      open: 2,
      closed: 1,
      unread: 2,
    });
    expect(queries).toHaveLength(3);
    for (const query of queries) {
      expect(query.eq).toContainEqual(['msg_cst_id', '42']);
    }
  });

  it('does not filter on a customer when none is named', async () => {
    const { service, queries } = build(
      counts({ none: 1, 'msg_close=1': 0, 'msg_open=0': 0 }),
    );

    await service.getStatistics();

    for (const query of queries) {
      expect(query.eq.map(([column]) => column)).not.toContain('msg_cst_id');
    }
  });

  it('fails when the database refuses a count', async () => {
    const { service } = build(() => ({
      count: null,
      error: { message: 'canceling statement due to statement timeout' },
    }));

    await expect(service.getStatistics()).rejects.toThrow(/statement timeout/);
  });

  it('fails when a count is missing, instead of reporting zero', async () => {
    const { service } = build(
      counts({ none: 10, 'msg_close=1': null, 'msg_open=0': 0 }),
    );

    await expect(service.getStatistics()).rejects.toThrow(/count missing/);
  });
});

// ─── List ───────────────────────────────────────────────────────────────────

describe('MessageDataService.getMessages', () => {
  it('reads the text flags: closed and read', async () => {
    const { service } = build(
      listAnswer([
        row({ msg_id: 'a', msg_close: '1', msg_open: '1' }),
        row({ msg_id: 'b', msg_close: '0', msg_open: '0' }),
        row({ msg_id: 'c', msg_close: null, msg_open: null }),
      ]),
    );

    const { messages } = await service.getMessages();

    expect(
      messages.map(({ id, status, isRead }) => ({ id, status, isRead })),
    ).toEqual([
      { id: 'a', status: 'closed', isRead: true },
      { id: 'b', status: 'open', isRead: false },
      { id: 'c', status: 'open', isRead: false },
    ]);
  });

  it('returns the total the database counted', async () => {
    const { service, queries } = build(listAnswer([row()], 15_000_000));

    const result = await service.getMessages({ page: 3, limit: 20 });

    expect(result.total).toBe(15_000_000);
    expect(queries[0].select[1]).toEqual({ count: 'estimated' });
    expect(queries[0].range).toEqual([40, 59]);
  });

  it.each([
    ['closed', 'msg_close=1'],
    ['open', 'msg_close=0'],
    ['unread', 'msg_open=0'],
    ['all', 'none'],
  ] as const)('status %s filters on %s', async (status, expected) => {
    const { service, queries } = build(listAnswer([]));

    await service.getMessages({ status });

    expect(flagOf(queries[0])).toBe(expected);
  });

  it('sends flag filters as text', async () => {
    const { service, queries } = build(listAnswer([]));

    await service.getMessages({ status: 'closed' });

    expect(queries[0].eq).toEqual([['msg_close', '1']]);
  });

  describe('search', () => {
    const filterFor = async (search: string): Promise<string> => {
      const { service, queries } = build(listAnswer([]));
      await service.getMessages({ search });
      expect(queries[0].or).toHaveLength(1);
      return queries[0].or[0];
    };

    it('quotes the searched text', async () => {
      expect(await filterFor('pompe')).toBe(
        'msg_subject.ilike."%pompe%",msg_content.ilike."%pompe%"',
      );
    });

    it('keeps filter syntax inside the quoted value', async () => {
      const injected = 'x%,msg_cst_id.neq.0),or(msg_id.not.is.null';

      expect(await filterFor(injected)).toBe(
        String.raw`msg_subject.ilike."%x\\%,msg\\_cst\\_id.neq.0),or(msg\\_id.not.is.null%",` +
          String.raw`msg_content.ilike."%x\\%,msg\\_cst\\_id.neq.0),or(msg\\_id.not.is.null%"`,
      );
    });

    it('escapes quotes and backslashes', async () => {
      expect(await filterFor(String.raw`a"b\c`)).toBe(
        String.raw`msg_subject.ilike."%a\"b\\\\c%",msg_content.ilike."%a\"b\\\\c%"`,
      );
    });

    it('sends no search filter without a searched text', async () => {
      const { service, queries } = build(listAnswer([]));

      await service.getMessages({ search: '' });

      expect(queries[0].or).toEqual([]);
    });
  });
});
