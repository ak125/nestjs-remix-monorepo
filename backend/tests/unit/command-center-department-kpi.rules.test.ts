/**
 * KPI primaires Data / Pages & SEO / Diagnostic — règles pures
 * (department-kpi.rules.ts).
 *
 * Garanties :
 *   1. une mesure absente ou non certifiable donne UNKNOWN, jamais un zéro ;
 *   2. sans cible déclarée, le statut ne juge que zéro (CRITICAL) et contrôle
 *      en échec (WARNING) ;
 *   3. « page SEO » = un rôle connu du classificateur de pages existant ;
 *   4. une vue produit ne compte que si elle suit la visite du diagnostic.
 */
import {
  evaluateTrackingIntegrity,
  trackingWindow,
  unknownVerdict,
} from '../../src/modules/analytics/tracking-integrity/tracking-integrity.service';
import {
  countDiagnosticToProduct,
  countPagesGeneratingAtc,
  firstVisitBySession,
  toDiagnosticToProductKpi,
  toMetricReliabilityKpi,
  toPagesGeneratingAtcKpi,
} from '../../src/modules/admin/services/command-center-action-rules/department-kpi.rules';

const WINDOW = trackingWindow(new Date('2026-10-04T12:00:00.000Z'));

/** `keyed` événements sur `events` rattachés à une commande ; une commande confirmée couverte. */
function verdict(keyed: number, events: number) {
  return evaluateTrackingIntegrity({
    window: WINDOW,
    events: Array.from({ length: events }, (_, i) => ({
      id: `e${i}`,
      order_id: `o${i}`,
    })),
    confirmedOrders: [{ ord_id: 'o0' }],
    knownOrderIds: new Set(Array.from({ length: keyed }, (_, i) => `o${i}`)),
  });
}

describe('toMetricReliabilityKpi', () => {
  it('verdict CERTIFIED → tous les contrôles réussis, OK', () => {
    expect(toMetricReliabilityKpi(verdict(1, 1), 30)).toEqual({
      id: 'metric_reliability',
      label: 'Data — contrôles de la mesure des commandes réussis (30 j)',
      value: 2,
      unit: '/2',
      status: 'OK',
      source: 'db',
      certified: true,
    });
  });

  it('un contrôle en échec → WARNING', () => {
    expect(toMetricReliabilityKpi(verdict(1, 2), 30)).toMatchObject({
      value: 1,
      unit: '/2',
      status: 'WARNING',
    });
  });

  it('aucun contrôle réussi → CRITICAL', () => {
    const kpi = toMetricReliabilityKpi(
      evaluateTrackingIntegrity({
        window: WINDOW,
        events: [{ id: 'e0', order_id: 'inconnu' }],
        confirmedOrders: [{ ord_id: 'o0' }],
        knownOrderIds: new Set(),
      }),
      30,
    );
    expect(kpi).toMatchObject({ value: 0, unit: '/2', status: 'CRITICAL' });
  });

  it.each([
    ['verdict illisible', null],
    ['verdict UNKNOWN (rien à contrôler)', unknownVerdict(WINDOW, 'vide')],
  ])('%s → UNKNOWN, valeur null, non certifié', (_, v) => {
    expect(toMetricReliabilityKpi(v, 30)).toEqual({
      id: 'metric_reliability',
      label: 'Data — contrôles de la mesure des commandes réussis (30 j)',
      value: null,
      status: 'UNKNOWN',
      source: 'db',
      certified: false,
    });
  });
});

describe('countPagesGeneratingAtc + toPagesGeneratingAtcKpi', () => {
  it('compte les pages SEO distinctes, sans requête ni ancre', () => {
    expect(
      countPagesGeneratingAtc([
        { source_url: '/pieces/plaquette-de-frein-402.html' },
        { source_url: '/pieces/plaquette-de-frein-402.html?r=abc' },
        { source_url: ' /pieces/plaquette-de-frein-402.html#avis ' },
        { source_url: '/' },
      ]),
    ).toBe(2);
  });

  it.each([
    ['source absente', null],
    ['source vide', ''],
    ['URL absolue (pas un chemin)', 'https://exemple.test/pieces/x-1.html'],
    ['panier (rôle null)', '/cart'],
    ['recherche (rôle null)', '/recherche?q=filtre'],
    ['admin (rôle null)', '/admin/orders'],
  ])('%s → ne compte pas', (_, source_url) => {
    expect(countPagesGeneratingAtc([{ source_url }])).toBe(0);
  });

  it('au moins une page → OK, sans unité', () => {
    expect(toPagesGeneratingAtcKpi(48, 30)).toEqual({
      id: 'pages_generating_atc',
      label: 'Pages & SEO — pages SEO ayant généré un ajout au panier (30 j)',
      value: 48,
      status: 'OK',
      source: 'db',
      certified: true,
    });
  });

  it('zéro page → CRITICAL', () => {
    expect(toPagesGeneratingAtcKpi(0, 30).status).toBe('CRITICAL');
  });

  it('lecture illisible → UNKNOWN, pas zéro', () => {
    expect(toPagesGeneratingAtcKpi(null, 30)).toMatchObject({
      value: null,
      status: 'UNKNOWN',
      certified: false,
    });
  });
});

describe('firstVisitBySession + countDiagnosticToProduct', () => {
  const visits = firstVisitBySession([
    { session_id: 'a', created_at: '2026-09-10T10:00:00.000Z' },
    { session_id: 'a', created_at: '2026-09-10T09:00:00.000Z' },
    { session_id: 'b', created_at: '2026-09-11T10:00:00.000Z' },
    { session_id: null, created_at: '2026-09-11T10:00:00.000Z' },
    { session_id: 'c', created_at: 'pas une date' },
  ]);

  it('garde la première visite de chaque session identifiée', () => {
    expect([...visits.entries()]).toEqual([
      ['a', Date.parse('2026-09-10T09:00:00.000Z')],
      ['b', Date.parse('2026-09-11T10:00:00.000Z')],
    ]);
  });

  it('ne compte une session que si une vue produit suit sa première visite', () => {
    expect(
      countDiagnosticToProduct(visits, [
        { session_id: 'a', created_at: '2026-09-10T09:30:00.000Z' },
        { session_id: 'a', created_at: '2026-09-10T11:00:00.000Z' },
        { session_id: 'b', created_at: '2026-09-11T09:59:59.000Z' },
        { session_id: 'b', created_at: '2026-09-11T10:00:00.000Z' },
        { session_id: 'z', created_at: '2026-09-12T10:00:00.000Z' },
        { session_id: null, created_at: '2026-09-12T10:00:00.000Z' },
      ]),
    ).toEqual({ sessions: 2, reachedProduct: 1 });
  });

  it('KPI : sessions qui voient un produit, sur les sessions du diagnostic', () => {
    expect(
      toDiagnosticToProductKpi({ sessions: 72, reachedProduct: 16 }, 30),
    ).toEqual({
      id: 'diagnostic_to_product',
      label:
        'Diagnostic — sessions du diagnostic qui voient ensuite un produit (30 j)',
      value: 16,
      unit: '/72',
      status: 'OK',
      source: 'db',
      certified: true,
    });
  });

  it('aucune session ne voit de produit → CRITICAL', () => {
    expect(
      toDiagnosticToProductKpi({ sessions: 5, reachedProduct: 0 }, 30).status,
    ).toBe('CRITICAL');
  });

  it('lecture illisible → UNKNOWN, pas zéro', () => {
    expect(toDiagnosticToProductKpi(null, 30)).toMatchObject({
      value: null,
      status: 'UNKNOWN',
      certified: false,
    });
  });
});
