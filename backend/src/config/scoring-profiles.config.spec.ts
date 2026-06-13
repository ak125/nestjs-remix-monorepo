import { CONFIDENCE_SIGNALS, SCORING_VERSION } from './scoring-profiles.config';

/**
 * v2.2 — Découplage RAG du scoring SEO.
 * RAG = chatbot only (ADR-031/046) → ne doit JAMAIS être un signal de qualité SEO.
 * Ces invariants pinnent le retrait + la cohérence des poids (somme = 100).
 */
describe('scoring-profiles config — v2.2 (RAG hors-scoring)', () => {
  it('SCORING_VERSION bumpé à v2.2 (recompute distinguable du v2.1 RAG-pollué)', () => {
    expect(SCORING_VERSION).toBe('v2.2');
  });

  it('CONFIDENCE_SIGNALS : poids somment à 100', () => {
    const sum = CONFIDENCE_SIGNALS.reduce((acc, s) => acc + s.weight, 0);
    expect(sum).toBe(100);
  });

  it('CONFIDENCE_SIGNALS : AUCUN signal RAG (chatbot only)', () => {
    const ids = CONFIDENCE_SIGNALS.map((s) => s.id);
    expect(ids).not.toContain('rag_available');
    expect(ids).not.toContain('truth_level_high');
    expect(ids.some((id) => /rag|truth_level/i.test(id))).toBe(false);
  });

  it('CONFIDENCE_SIGNALS : ne garde que des signaux RÉELS de la page', () => {
    const ids = CONFIDENCE_SIGNALS.map((s) => s.id).sort();
    expect(ids).toEqual([
      'data_completeness',
      'pipeline_recent',
      'source_verified',
    ]);
  });
});
