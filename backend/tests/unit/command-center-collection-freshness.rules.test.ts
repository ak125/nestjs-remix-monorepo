/**
 * Règle pure de fraîcheur des collectes Search Console / GA4 (mandat AT, point 3).
 * Le service qui la nourrit est couvert par command-center-actions.service.test.ts.
 */
import {
  buildCollectionFreshnessActions,
  collectionLagDays,
  crossCheckGap,
  FRESHNESS_ALERT_DAYS,
} from '../../src/modules/admin/services/command-center-action-rules/collection-freshness-action.rules';

describe('collectionLagDays — jours entiers depuis la fin du dernier jour collecté', () => {
  const lastDate = '2026-11-13';
  it.each([
    // passage quotidien 04:00 UTC, collecte de J-3
    ['2026-11-16T03:59:00Z', 2],
    ['2026-11-16T08:00:00Z', 2],
    ['2026-11-17T03:59:00Z', 3],
    ['2026-11-18T00:00:00Z', 4],
  ])('à %s → %i j', (now, lag) => {
    expect(collectionLagDays(lastDate, new Date(now))).toBe(lag);
  });

  it('date absente ou invalide → null', () => {
    const now = new Date('2026-11-16T08:00:00Z');
    expect(collectionLagDays(null, now)).toBeNull();
    expect(collectionLagDays('pas-une-date', now)).toBeNull();
  });
});

describe('buildCollectionFreshnessActions', () => {
  const now = new Date('2026-11-16T08:00:00Z');
  const fresh = { gsc: '2026-11-13', ga4: '2026-11-13' };
  const days = ['2026-11-07', '2026-11-13'];

  it('seuil à 3 j : 3 j = pas d’alerte, 4 j = réparation', () => {
    expect(FRESHNESS_ALERT_DAYS).toBe(3);
    const at = (iso: string) =>
      buildCollectionFreshnessActions({
        now: new Date(iso),
        lastDate: fresh,
        crossCheck: null,
      }).map((a) => a.id);
    expect(at('2026-11-17T12:00:00Z')).toEqual([]);
    expect(at('2026-11-18T00:00:00Z')).toEqual([
      'data:collection-freshness:gsc',
      'data:collection-freshness:ga4',
    ]);
  });

  it('écart exactement 20 % : pas signalé ; 21 % : signalé', () => {
    const run = (ga4: number) =>
      buildCollectionFreshnessActions({
        now,
        lastDate: fresh,
        crossCheck: { days, gscClicks: 100, ga4OrganicSessions: ga4 },
      }).map((a) => a.id);
    expect(run(120)).toEqual([]);
    expect(run(80)).toEqual([]);
    expect(run(121)).toEqual(['data:collection-crosscheck:ga4-gsc']);
    expect(run(79)).toEqual(['data:collection-crosscheck:ga4-gsc']);
  });

  it('Search Console à zéro clic : écart non calculable, jamais signalé', () => {
    const crossCheck = { days, gscClicks: 0, ga4OrganicSessions: 40 };
    expect(crossCheckGap(crossCheck)).toBeNull();
    const actions = buildCollectionFreshnessActions({
      now,
      lastDate: { gsc: '2026-11-08', ga4: '2026-11-13' },
      crossCheck,
    });
    expect(actions.map((a) => a.id)).toEqual(['data:collection-freshness:gsc']);
    expect(actions[0].evidence[2]).toMatch(/écart non calculable/);
  });

  it('actions conformes au contrat : Data, sans accord owner, preuves sans donnée client', () => {
    const actions = buildCollectionFreshnessActions({
      now,
      lastDate: { gsc: null, ga4: '2026-11-01' },
      crossCheck: { days, gscClicks: 10, ga4OrganicSessions: 30 },
    });
    expect(actions.map((a) => [a.id, a.action_type])).toEqual([
      ['data:collection-freshness:gsc', 'certification'],
      ['data:collection-freshness:ga4', 'repair'],
      ['data:collection-crosscheck:ga4-gsc', 'certification'],
    ]);
    for (const a of actions) {
      expect(a).toMatchObject({
        department: 'data',
        source: 'data',
        owner_go_required: false,
      });
      expect(a.evidence).toHaveLength(3);
    }
  });
});
