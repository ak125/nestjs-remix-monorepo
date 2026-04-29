/**
 * ADR-032 PR-3 — DiagnosticIntent breakdown extension
 *
 * Vérifie l'ajout du 7e intent `breakdown` au Zod enum (urgence routière).
 * Aucun consommateur secondaire à patcher : le seul site canonique est
 * `DiagnosticIntentEnum`. Voir mémoire `diag-intent-enum-canonical-only.md`.
 *
 * @see backend/src/modules/diagnostic-engine/types/diagnostic-contract.schema.ts
 */
// Note: jest globals (describe/it/expect) are auto-injected by ts-jest
// preset. Pattern aligned on tests/unit/rag-proxy.service.test.ts.
import { DiagnosticIntentEnum } from '../../src/modules/diagnostic-engine/types/diagnostic-contract.schema';

describe('ADR-032 PR-3 — DiagnosticIntent breakdown', () => {
  it('exposes 7 intent values including breakdown', () => {
    const options = DiagnosticIntentEnum.options;
    expect(options).toHaveLength(7);
    expect(options).toContain('breakdown');
  });

  it('parses breakdown as a valid intent', () => {
    const result = DiagnosticIntentEnum.safeParse('breakdown');
    expect(result.success).toBe(true);
  });

  it('rejects unknown intents (still strict enum)', () => {
    const result = DiagnosticIntentEnum.safeParse('panne');
    expect(result.success).toBe(false);
  });

  it('preserves the 6 legacy intents', () => {
    const expected = [
      'diagnostic_symptom',
      'warning_light_analysis',
      'dtc_analysis',
      'maintenance_check',
      'revision_check',
      'preventive_check',
    ];
    for (const intent of expected) {
      expect(DiagnosticIntentEnum.options).toContain(intent);
    }
  });
});
