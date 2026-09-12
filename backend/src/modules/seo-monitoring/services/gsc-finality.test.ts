/**
 * Tests purs — finalité des jours GSC (sonde `dataState: 'all'`).
 */
import { parseFinalityProbe, resolveGscDayDecision } from './gsc-finality';

const probeWithMeta = parseFinalityProbe(
  {
    rows: [
      { keys: ['2026-09-05'], impressions: 5100 },
      { keys: ['2026-09-06'], impressions: 4800 },
      { keys: ['2026-09-08'], impressions: 3900 },
      { keys: ['2026-09-09'], impressions: 1200 },
      { keys: ['2026-09-04'], impressions: 0 },
    ],
    metadata: { firstIncompleteDate: '2026-09-08' },
  },
  '2026-09-10',
);

describe('parseFinalityProbe', () => {
  it('ne retient que les jours avec impressions ; métadonnée reprise', () => {
    expect([...probeWithMeta.datesWithData].sort()).toEqual([
      '2026-09-05',
      '2026-09-06',
      '2026-09-08',
      '2026-09-09',
    ]);
    expect(probeWithMeta.firstIncompleteDate).toBe('2026-09-08');
  });

  it('métadonnée absente → null (jamais devinée)', () => {
    const p = parseFinalityProbe({ rows: [] }, '2026-09-10');
    expect(p.firstIncompleteDate).toBeNull();
    expect(p.datesWithData.size).toBe(0);
  });
});

describe('resolveGscDayDecision', () => {
  it('jour final avec données → fetch (preuve metadata)', () => {
    expect(resolveGscDayDecision('2026-09-05', probeWithMeta)).toEqual({
      kind: 'fetch',
      finalityProof: 'metadata',
    });
  });

  it('jour final sans aucune impression → vrai zéro explicite', () => {
    expect(resolveGscDayDecision('2026-09-07', probeWithMeta)).toEqual({
      kind: 'real_zero',
    });
    expect(resolveGscDayDecision('2026-09-04', probeWithMeta)).toEqual({
      kind: 'real_zero',
    });
  });

  it('jour >= firstIncompleteDate ou > fin de sonde → non finalisé, même avec données', () => {
    expect(resolveGscDayDecision('2026-09-08', probeWithMeta).kind).toBe(
      'skip_not_final',
    );
    expect(resolveGscDayDecision('2026-09-09', probeWithMeta).kind).toBe(
      'skip_not_final',
    );
    expect(resolveGscDayDecision('2026-09-11', probeWithMeta).kind).toBe(
      'skip_not_final',
    );
  });

  it('métadonnée absente : données → fetch sous condition ; aucune donnée → finalité inconnue (jamais un zéro)', () => {
    const p = parseFinalityProbe(
      { rows: [{ keys: ['2026-09-05'], impressions: 10 }] },
      '2026-09-10',
    );
    expect(resolveGscDayDecision('2026-09-05', p)).toEqual({
      kind: 'fetch',
      finalityProof: 'final_rows_required',
    });
    expect(resolveGscDayDecision('2026-09-06', p)).toEqual({
      kind: 'skip_finality_unknown',
    });
  });
});
