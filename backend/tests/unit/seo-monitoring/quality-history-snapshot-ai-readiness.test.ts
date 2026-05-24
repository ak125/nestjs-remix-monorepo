import { QualityHistorySnapshotService } from '../../../src/modules/seo-monitoring/services/quality-history-snapshot.service';

describe('QualityHistorySnapshotService — AI readiness rows', () => {
  let service: QualityHistorySnapshotService;

  beforeEach(() => {
    service = new QualityHistorySnapshotService();
  });

  it('emits 3 ai_has_* metric rows with correct names', () => {
    const html =
      '<p>Une description suffisamment longue pour passer le seuil TL;DR avec quelques mots utiles ici.</p><script type="application/ld+json">{"@type":"FAQPage"}</script><a href="https://constructeur.fr">source</a>';
    const rows = service.extractAiReadinessRows(
      'R5_SYMPTOM',
      'symptome-clio-fumee-noire',
      html,
      'on_demand',
      {},
    );
    const names = rows.map((r) => r.metric_name).sort();
    expect(names).toEqual([
      'ai_has_extractable_tldr',
      'ai_has_faq_schema',
      'ai_has_visible_sources',
    ]);
    expect(rows.every((r) => r.metric_value === 1)).toBe(true);
    expect(rows.every((r) => r.role_id === 'R5_SYMPTOM')).toBe(true);
    expect(rows.every((r) => r.pg_id === 'symptome-clio-fumee-noire')).toBe(
      true,
    );
    expect(rows.every((r) => r.snapshot_kind === 'on_demand')).toBe(true);
    expect(
      rows.every((r) => (r.metadata as any).layer === 'ai-additive'),
    ).toBe(true);
  });

  it('emits all 3 rows with value 0 on empty HTML', () => {
    const rows = service.extractAiReadinessRows(
      'R0_HOME',
      'home',
      '',
      'monthly_cron',
      { batch_id: 'X' },
    );
    expect(rows.length).toBe(3);
    expect(rows.every((r) => r.metric_value === 0)).toBe(true);
    expect(rows.every((r) => (r.metadata as any).batch_id === 'X')).toBe(true);
    expect(
      rows.every((r) => (r.metadata as any).layer === 'ai-additive'),
    ).toBe(true);
  });

  it('uses default ownHostname www.automecanik.com when not provided', () => {
    const html = '<a href="https://www.automecanik.com/aide">internal</a>';
    const rows = service.extractAiReadinessRows(
      'R2_PRODUCT',
      'pieces/x',
      html,
      'on_demand',
      {},
    );
    const sources = rows.find((r) => r.metric_name === 'ai_has_visible_sources');
    expect(sources?.metric_value).toBe(0); // same hostname → not external
  });

  it('emits ai_has_visible_sources = 1 for external links not in nav/footer', () => {
    const html = '<main><a href="https://external.fr/x">ext</a></main>';
    const rows = service.extractAiReadinessRows(
      'R2_PRODUCT',
      'pieces/x',
      html,
      'on_demand',
      {},
    );
    const sources = rows.find((r) => r.metric_name === 'ai_has_visible_sources');
    expect(sources?.metric_value).toBe(1);
  });
});
