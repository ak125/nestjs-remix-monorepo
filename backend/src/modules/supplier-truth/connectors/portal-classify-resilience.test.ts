import {
  runResilientClassify,
  type ResilienceHooks,
  type ResilienceOptions,
} from './portal-classify-resilience';

type Item = { ref: string };

/** Build hooks over a fake portal: `failing` = set of refs whose ANY group 504s. */
function harness(
  failing: Set<string>,
  seedAttempts: Record<string, number> = {},
) {
  const classified: string[] = [];
  const deadLettered: string[] = [];
  const attempts: Record<string, number> = { ...seedAttempts };
  let fetchCalls = 0;
  const hooks: ResilienceHooks<Item> = {
    fetchGroup: async (items) => {
      fetchCalls++;
      const ok = !items.some((i) => failing.has(i.ref));
      if (ok) classified.push(...items.map((i) => i.ref));
      return ok;
    },
    onRefDeadLettered: (item) => {
      deadLettered.push(item.ref);
    },
    recordRefAttempt: (ref) => (attempts[ref] = (attempts[ref] ?? 0) + 1),
    sleepBetween: async () => {},
    log: () => {},
  };
  return {
    hooks,
    classified,
    deadLettered,
    attempts,
    fetchCalls: () => fetchCalls,
  };
}

const OPTS: ResilienceOptions = {
  batchSize: 4,
  maxRefAttempts: 3,
  breakerWindow: 6,
};

const items = (...refs: string[]): Item[] => refs.map((ref) => ({ ref }));

describe('runResilientClassify', () => {
  it('classifies a clean feed in feed order, no dead-letters', async () => {
    const h = harness(new Set());
    const res = await runResilientClassify(
      items('a', 'b', 'c', 'd', 'e'),
      OPTS,
      h.hooks,
    );
    expect(res.outage).toBe(false);
    expect(res.deadLettered).toEqual([]);
    expect(h.classified.sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('isolates ONE poison ref via bisection and dead-letters only it', async () => {
    const h = harness(new Set(['BAD']));
    const res = await runResilientClassify(
      items('a', 'b', 'BAD', 'd', 'e', 'f'),
      OPTS,
      h.hooks,
    );
    expect(res.outage).toBe(false);
    expect(res.deadLettered).toEqual(['BAD']);
    // every innocent ref still classified — never charged for the neighbour's failure
    expect(h.classified.sort()).toEqual(['a', 'b', 'd', 'e', 'f']);
    // BAD charged exactly up to the budget, innocents never charged
    expect(h.attempts['BAD']).toBe(OPTS.maxRefAttempts);
    expect(h.attempts['a']).toBeUndefined();
  });

  it('a portal OUTAGE opens the circuit → resumable, ZERO false terminals', async () => {
    // every ref fails (whole portal down)
    const all = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const h = harness(new Set(all));
    const res = await runResilientClassify(items(...all), OPTS, h.hooks);
    expect(res.outage).toBe(true);
    expect(res.deadLettered).toEqual([]); // critical: no ref dead-lettered during an outage
    expect(h.classified).toEqual([]);
  });

  it('resumes a seeded attempt count → dead-letters on the next isolated failure', async () => {
    // BAD already at budget-1 from a prior run → one more isolated failure exhausts it
    const h = harness(new Set(['BAD']), { BAD: OPTS.maxRefAttempts - 1 });
    const res = await runResilientClassify(
      items('a', 'BAD', 'c'),
      OPTS,
      h.hooks,
    );
    expect(res.deadLettered).toEqual(['BAD']);
    expect(h.attempts['BAD']).toBe(OPTS.maxRefAttempts);
  });

  it('keeps the circuit CLOSED when successes interleave failures (flaky, not down)', async () => {
    // two distinct poison refs spread through a long feed: lots of failures but always
    // interleaved with successes → must converge (both dead-lettered), never an outage.
    const h = harness(new Set(['X', 'Y']));
    const res = await runResilientClassify(
      items('a', 'X', 'b', 'c', 'd', 'e', 'Y', 'f', 'g', 'h'),
      OPTS,
      h.hooks,
    );
    expect(res.outage).toBe(false);
    expect(res.deadLettered.sort()).toEqual(['X', 'Y']);
    expect(h.classified.sort()).toEqual([
      'a',
      'b',
      'c',
      'd',
      'e',
      'f',
      'g',
      'h',
    ]);
  });
});
