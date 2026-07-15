/**
 * Tests de `mapExportBlockToDbBlock` (PR-0, ADR-059/090) — l'adaptateur FLAT (builder wiki) → DB.
 * Fonction pure, déterministe, sans I/O : on vérifie l'absence de perte, l'unicité de block_kind,
 * la copie verbatim de la provenance (truth_level/source_ids + D3) et la stabilité du content_hash.
 */
import { mapExportBlockToDbBlock } from './seo-projection-writer.service';
import { type SeoProjectionBlock } from './seo-projection.types';

const baseBlock = (
  over: Partial<SeoProjectionBlock> = {},
): SeoProjectionBlock => ({
  role: 'R3_CONSEILS',
  content_md: 'Sur Golf 5 1.9 TDI BXE, vérifier le filtre avant remplacement.',
  source_ids: ['oem:bosch-123', 'web:evidence-7'],
  truth_level: 'sourced',
  section: 'Diagnostic',
  ...over,
});

describe('mapExportBlockToDbBlock', () => {
  it('mappe un bloc FLAT vers la forme DB sans perte de provenance', () => {
    const row = mapExportBlockToDbBlock('gamme:filtre-a-air', baseBlock(), 0);

    expect(row.blockKind).toBe('diagnostic');
    expect(row.blockId).toBe('gamme:filtre-a-air#R3_CONSEILS#diagnostic');
    expect(row.kindFallback).toBe(false);
    expect(row.sourceType).toBe('sourced');
    expect(row.content).toMatchObject({
      content_md: baseBlock().content_md,
      source_ids: ['oem:bosch-123', 'web:evidence-7'],
      truth_level: 'sourced',
      section: 'Diagnostic',
    });
    // content jsonb NOT NULL : jamais vide (le bug PR-0 stockait {}).
    expect(Object.keys(row.content).length).toBeGreaterThan(0);
  });

  it('dérive un block_kind positionnel observable quand section absente (jamais de collision)', () => {
    const a = mapExportBlockToDbBlock(
      'gamme:x',
      baseBlock({ section: null }),
      0,
    );
    const b = mapExportBlockToDbBlock(
      'gamme:x',
      baseBlock({ section: undefined }),
      1,
    );

    expect(a.kindFallback).toBe(true);
    expect(a.blockKind).toBe('b0');
    expect(b.blockKind).toBe('b1');
    expect(a.blockId).not.toBe(b.blockId);
  });

  it('deux blocs même rôle / sections distinctes → block_id distincts (pas de collision)', () => {
    const a = mapExportBlockToDbBlock(
      'gamme:x',
      baseBlock({ section: 'Symptômes' }),
      0,
    );
    const b = mapExportBlockToDbBlock(
      'gamme:x',
      baseBlock({ section: 'Compatibilité' }),
      1,
    );

    expect(a.blockId).toBe('gamme:x#R3_CONSEILS#symptomes');
    expect(b.blockId).toBe('gamme:x#R3_CONSEILS#compatibilite');
    expect(a.blockId).not.toBe(b.blockId);
  });

  it('copie la provenance citable D3 verbatim si présente, l’omet sinon (jamais fabriquée)', () => {
    const withD3 = mapExportBlockToDbBlock(
      'vehicle:golf-5-1-9-tdi',
      baseBlock({
        evidence_type: 'oem',
        applies_to: { scope: 'motorization', key: 'engine:BXE' },
        last_verified_at: '2026-06-20T00:00:00Z',
        consumer_pages: ['R8_VEHICLE', 'R3_CONSEILS'],
      }),
      0,
    );
    expect(withD3.content.evidence_type).toBe('oem');
    expect(withD3.content.applies_to).toEqual({
      scope: 'motorization',
      key: 'engine:BXE',
    });
    expect(withD3.content.consumer_pages).toEqual([
      'R8_VEHICLE',
      'R3_CONSEILS',
    ]);

    const withoutD3 = mapExportBlockToDbBlock('vehicle:x', baseBlock(), 0);
    expect(withoutD3.content).not.toHaveProperty('evidence_type');
    expect(withoutD3.content).not.toHaveProperty('applies_to');
    expect(withoutD3.content).not.toHaveProperty('consumer_pages');
  });

  it('content_hash : stable pour un contenu identique, distinct sinon (no-op detection par bloc)', () => {
    const h1 = mapExportBlockToDbBlock('gamme:x', baseBlock(), 0).contentHash;
    const h2 = mapExportBlockToDbBlock('gamme:x', baseBlock(), 0).contentHash;
    const h3 = mapExportBlockToDbBlock(
      'gamme:x',
      baseBlock({ content_md: 'texte différent' }),
      0,
    ).contentHash;

    expect(h1).toBe(h2);
    expect(h1).not.toBe(h3);
    expect(h1).toHaveLength(64); // sha256 hex (fast-json-stable-stringify → déterministe, ex-md5)
  });

  it('respecte un content_hash autoritaire fourni par le builder', () => {
    const row = mapExportBlockToDbBlock(
      'gamme:x',
      baseBlock({ content_hash: 'authoritative-hash' }),
      0,
    );
    expect(row.contentHash).toBe('authoritative-hash');
  });

  it('passe confidence_base si numérique, sinon null', () => {
    expect(
      mapExportBlockToDbBlock('e', baseBlock({ confidence_base: 0.84 }), 0)
        .confidenceBase,
    ).toBe(0.84);
    expect(
      mapExportBlockToDbBlock('e', baseBlock(), 0).confidenceBase,
    ).toBeNull();
  });
});
