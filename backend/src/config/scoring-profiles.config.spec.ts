import { CONFIDENCE_SIGNALS, SCORING_VERSION } from './scoring-profiles.config';

/**
 * v2.3 — Diagnostic de structure, sans certification editoriale.
 * RAG = chatbot only (ADR-031/046) → ne doit JAMAIS être un signal de qualité SEO.
 * Ces invariants pinnent le retrait + la cohérence des poids (somme = 100).
 */
describe('scoring-profiles config — v2.3 (preuves non transferees)', () => {
  it('SCORING_VERSION v2.3 distingue le diagnostic sans preuves pipeline historiques', () => {
    expect(SCORING_VERSION).toBe('v2.3');
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

  it('CONFIDENCE_SIGNALS : contrat nominal preserve, pipeline reserve non attribue', () => {
    const ids = CONFIDENCE_SIGNALS.map((s) => s.id).sort();
    expect(ids).toEqual([
      'data_completeness',
      'pipeline_recent',
      'source_verified',
    ]);
  });
});
