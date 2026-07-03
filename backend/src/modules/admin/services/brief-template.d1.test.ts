/**
 * Tests D1 — helpers PURES d'intégration brief-template (toBriefRole + wikiOverridesFromBundle).
 * Le câblage DB (bulkGenerateFromTemplate) n'est pas testé ici (I/O) ; on couvre la logique déterministe.
 */
import { toBriefRole, wikiOverridesFromBundle } from './brief-template.service';
import { type BriefEvidenceBundle } from './seo-brief.service';

describe('toBriefRole', () => {
  it('mappe les rôles composables WIKI', () => {
    expect(toBriefRole('R3')).toBe('R3_CONSEILS');
    expect(toBriefRole('r3_conseils')).toBe('R3_CONSEILS');
    expect(toBriefRole('R6')).toBe('R3_GUIDE');
    expect(toBriefRole('R6_GUIDE_ACHAT')).toBe('R3_GUIDE');
    expect(toBriefRole('R8')).toBe('R8_VEHICLE');
    expect(toBriefRole('R8_VEHICLE')).toBe('R8_VEHICLE');
  });

  it('retourne null pour R2 et rôles non composés (→ keyword-first conservé)', () => {
    expect(toBriefRole('R2')).toBeNull();
    expect(toBriefRole('R2_PRODUCT')).toBeNull();
    expect(toBriefRole('R1')).toBeNull();
    expect(toBriefRole('')).toBeNull();
  });
});

describe('wikiOverridesFromBundle', () => {
  it('mappe les champs du bundle vers BriefOverrides (preuves = source_ids, jamais de texte inventé)', () => {
    const bundle: BriefEvidenceBundle = {
      entity_id: 'gamme:filtre-a-air',
      page_role: 'R3_CONSEILS',
      wiki_available: true,
      proprietary_count: 5,
      substance_gate: { pass: true, count: 5, floor: 5, reasons: [] },
      brief_source: 'wiki_evidence',
      brief_fields: {
        angles_obligatoires: ['diagnostic', 'symptomes'],
        preuves: ['oem:bosch-1', 'web:vroomly-2'],
        termes_techniques: ['debitmetre'],
      },
      substance_elements: [],
      evidence_source_mix: {
        db_owned: 1,
        sourced: 4,
        inferred: 0,
        editorial: 0,
      },
      demand_signal: {},
    };
    const ov = wikiOverridesFromBundle(bundle);
    expect(ov.angles_obligatoires).toEqual(['diagnostic', 'symptomes']);
    expect(ov.preuves).toEqual(['oem:bosch-1', 'web:vroomly-2']);
    expect(ov.termes_techniques).toEqual(['debitmetre']);
  });
});
