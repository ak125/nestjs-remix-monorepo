/**
 * Tests SeoProjectionGateService — les 2 portes fail-closed (ADR-090 §C4).
 * Pures (aucune DI / DB) : on instancie le service directement.
 */
import { SeoProjectionGateService } from './seo-projection-gate.service';
import type { SeoProjectionExport } from './seo-projection.types';

const validExport = (): SeoProjectionExport => ({
  entity_id: 'gamme:plaquette-de-frein',
  entity_type: 'gamme',
  schema_version: '2.0.0',
  projection_contract_version: '1.0.0',
  source_wiki_commit: 'abc1234',
  wiki_path: 'wiki/gamme/plaquette-de-frein.md',
  content_hash: 'deadbeef',
  generated_at: '2026-06-19T00:00:00Z',
  facts: [{ k: 'v' }],
  sources: [{ url: 'https://x' }],
  blocks: [
    {
      role: 'R1',
      content_md: 'x',
      source_ids: [],
      truth_level: 'editorial',
      section: 'quality_tiers',
    },
  ],
  roles_allowed: ['R1'],
  consumers_allowed: ['seo'],
});

describe('SeoProjectionGateService', () => {
  const gate = new SeoProjectionGateService();

  it('passe les 2 portes sur un export valide', () => {
    const r = gate.evaluate(validExport());
    expect(r.ok).toBe(true);
    expect(r.verdicts.every((v) => v.ok)).toBe(true);
  });

  it('CanonGate KO si roles_allowed vide (fail-closed)', () => {
    const v = gate.canonGate({ ...validExport(), roles_allowed: [] });
    expect(v.ok).toBe(false);
    expect(v.reasons.some((r) => r.includes('roles_allowed'))).toBe(true);
  });

  it('CanonGate KO si un block a un rôle hors roles_allowed (impureté)', () => {
    const exp = validExport();
    // R8 absent de roles_allowed=[R1] (bloc FLAT valide ; le gate ne lit que role).
    exp.blocks = [
      { role: 'R8', content_md: 'k', source_ids: [], truth_level: 'editorial' },
    ];
    const v = gate.canonGate(exp);
    expect(v.ok).toBe(false);
    expect(v.reasons.some((r) => r.includes('R8'))).toBe(true);
  });

  it('CanonGate KO si entity_type hors canon', () => {
    const v = gate.canonGate({
      ...validExport(),
      entity_type: 'bogus' as never,
    });
    expect(v.ok).toBe(false);
  });

  it('QualityGate KO si un champ requis du contrat manque', () => {
    // content_hash absent du contrat → qualityGate doit lever "champ requis absent" (fail-closed).
    const broken = {
      ...validExport(),
      content_hash: undefined,
    } as unknown as SeoProjectionExport;
    const v = gate.qualityGate(broken);
    expect(v.ok).toBe(false);
    expect(v.reasons.some((r) => r.includes('content_hash'))).toBe(true);
  });

  it('evaluate() est fail-closed : KO si une seule porte échoue', () => {
    const exp = validExport();
    exp.consumers_allowed = [];
    expect(gate.evaluate(exp).ok).toBe(false);
  });
});
