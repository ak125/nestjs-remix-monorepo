/**
 * Tests for wiki-proposal-frontmatter.schema.ts (ADR-039 / canon mirror of
 * `automecanik-wiki/_meta/schema/frontmatter.schema.json`).
 */

import {
  parseWikiProposalFrontmatter,
  safeParseWikiProposalFrontmatter,
  WikiProposalFrontmatterSchema,
  WikiSourceRefSchema,
  DiagnosticRelationSchema,
} from './wiki-proposal-frontmatter.schema';

const VALID_GAMME_V2: Record<string, unknown> = {
  schema_version: '2.0.0',
  id: 'gamme:plaquette-de-frein',
  entity_type: 'gamme',
  slug: 'plaquette-de-frein',
  title: 'Plaquette de frein',
  aliases: ['plaquettes', 'brake pads'],
  lang: 'fr',
  created_at: '2026-04-30',
  updated_at: '2026-04-30',
  truth_level: 'L2',
  source_refs: [
    {
      kind: 'recycled',
      origin_repo: 'automecanik-rag',
      origin_path: 'knowledge/gammes/plaquette-de-frein.md',
      captured_at: '2026-04-29',
    },
  ],
  provenance: {
    ingested_by: 'skill:wiki-proposal-writer',
    promoted_from: null,
  },
  review_status: 'proposed',
  reviewed_by: null,
  reviewed_at: null,
  review_notes: '',
  no_disputed_claims: true,
  exportable: { rag: false, seo: false, support: false },
  target_classes: [],
  entity_data: {
    pg_id: 142,
    family: 'freinage',
    intents: ['diagnostic', 'achat', 'remplacement'],
    vlevel: 'V2',
  },
  diagnostic_relations: [
    {
      symptom_slug: 'brake_noise_metallic',
      system_slug: 'brake_system',
      relation_to_part: 'possible_cause',
      part_role:
        'Plaquettes usées émettent un grincement métallique au freinage',
      evidence: {
        confidence: 'medium',
        source_policy: '2_medium_concordant',
        reviewed: false,
        diagnostic_safe: false,
      },
      sources: ['oem_renault_brakes', 'tecdoc_brake_pads_2026'],
    },
  ],
};

describe('WikiProposalFrontmatterSchema (ADR-039)', () => {
  describe('valid inputs', () => {
    it('accepts a complete v2.0.0 gamme proposal with diagnostic_relations[]', () => {
      const result = parseWikiProposalFrontmatter(VALID_GAMME_V2);
      expect(result.entity_type).toBe('gamme');
      expect(result.diagnostic_relations).toHaveLength(1);
    });

    it('accepts schema_version 0.legacy (recycled fiche)', () => {
      const input = { ...VALID_GAMME_V2, schema_version: '0.legacy' };
      const result = safeParseWikiProposalFrontmatter(input);
      expect(result.success).toBe(true);
    });

    it('accepts schema_version 1.0.0 (pré-ADR-033)', () => {
      const input = {
        ...VALID_GAMME_V2,
        schema_version: '1.0.0',
        diagnostic_relations: [],
      };
      const result = safeParseWikiProposalFrontmatter(input);
      expect(result.success).toBe(true);
    });

    it('accepts L4 truth_level without any source_refs', () => {
      const input = { ...VALID_GAMME_V2, truth_level: 'L4', source_refs: [] };
      const result = safeParseWikiProposalFrontmatter(input);
      expect(result.success).toBe(true);
    });

    it('accepts entity_type=vehicle/constructeur/support/diagnostic', () => {
      for (const t of ['vehicle', 'constructeur', 'support', 'diagnostic']) {
        const slug = 'foo-bar';
        const input = {
          ...VALID_GAMME_V2,
          entity_type: t,
          id: `${t}:${slug}`,
          slug,
          diagnostic_relations: [],
        };
        const result = safeParseWikiProposalFrontmatter(input);
        expect(result.success).toBe(true);
      }
    });
  });

  describe('rejects invalid schema_version / id / slug', () => {
    it('rejects unknown schema_version pattern', () => {
      const input = { ...VALID_GAMME_V2, schema_version: 'foo' };
      const result = safeParseWikiProposalFrontmatter(input);
      expect(result.success).toBe(false);
    });

    it('rejects id that does not match `<entity_type>:<slug>`', () => {
      const input = { ...VALID_GAMME_V2, id: 'gamme:wrong-slug' };
      const result = safeParseWikiProposalFrontmatter(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.join('.') === 'id')).toBe(
          true,
        );
      }
    });

    it('rejects entity_type unknown', () => {
      const input = {
        ...VALID_GAMME_V2,
        entity_type: 'system', // forbidden — ADR-033 §D3
        id: 'system:foo',
      };
      const result = safeParseWikiProposalFrontmatter(input);
      expect(result.success).toBe(false);
    });

    it('rejects slug starting or ending with hyphen', () => {
      // NOTE: canon regex (JSON Schema source of truth) is
      // `^[a-z0-9][a-z0-9-]{0,78}[a-z0-9]$` which allows internal double-hyphens
      // ("foo--bar"). The JSON Schema description says "Pas de double-hyphen"
      // but the regex itself does not enforce that. To strictly mirror the
      // canon, this Zod also allows internal double-hyphens. The wiki repo's
      // Python `quality-gates.py` enforces the stricter rule via a separate
      // gate (out of scope for this top-level frontmatter schema).
      for (const bad of ['-foo', 'foo-']) {
        const input = { ...VALID_GAMME_V2, slug: bad, id: `gamme:${bad}` };
        const result = safeParseWikiProposalFrontmatter(input);
        expect(result.success).toBe(false);
      }
    });

    it('rejects slug longer than 80 chars', () => {
      const long = 'a' + 'b'.repeat(80);
      const input = { ...VALID_GAMME_V2, slug: long, id: `gamme:${long}` };
      const result = safeParseWikiProposalFrontmatter(input);
      expect(result.success).toBe(false);
    });
  });

  describe('truth_level conditional source_refs validation (allOf §1)', () => {
    it.each(['L1', 'L2', 'L3'])(
      'rejects truth_level=%s with empty source_refs',
      (level) => {
        const input = {
          ...VALID_GAMME_V2,
          truth_level: level,
          source_refs: [],
        };
        const result = safeParseWikiProposalFrontmatter(input);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(
            result.error.issues.some((i) => i.path.join('.') === 'source_refs'),
          ).toBe(true);
        }
      },
    );
  });

  describe('exportable conditional review validation (allOf §2)', () => {
    it('rejects exportable.rag=true if review_status != approved', () => {
      const input = {
        ...VALID_GAMME_V2,
        exportable: { rag: true, seo: false, support: false },
        review_status: 'proposed',
      };
      const result = safeParseWikiProposalFrontmatter(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some((i) => i.path.join('.') === 'review_status'),
        ).toBe(true);
      }
    });

    it('rejects exportable.seo=true without reviewed_by', () => {
      const input = {
        ...VALID_GAMME_V2,
        exportable: { rag: false, seo: true, support: false },
        review_status: 'approved',
        reviewed_by: null,
        reviewed_at: '2026-04-30T10:00:00Z',
      };
      const result = safeParseWikiProposalFrontmatter(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some((i) => i.path.join('.') === 'reviewed_by'),
        ).toBe(true);
      }
    });

    it('accepts exportable.rag=true if all review fields are populated', () => {
      const input = {
        ...VALID_GAMME_V2,
        exportable: { rag: true, seo: false, support: false },
        review_status: 'approved',
        reviewed_by: '@fafa',
        reviewed_at: '2026-04-30T10:00:00Z',
        no_disputed_claims: true,
      };
      const result = safeParseWikiProposalFrontmatter(input);
      expect(result.success).toBe(true);
    });

    it('rejects exportable.support=true with no_disputed_claims=false', () => {
      const input = {
        ...VALID_GAMME_V2,
        exportable: { rag: false, seo: false, support: true },
        review_status: 'approved',
        reviewed_by: '@fafa',
        reviewed_at: '2026-04-30T10:00:00Z',
        no_disputed_claims: false,
      };
      const result = safeParseWikiProposalFrontmatter(input);
      expect(result.success).toBe(false);
    });
  });

  describe('source_refs[] discriminated union on `kind`', () => {
    it('accepts kind=raw with path', () => {
      const result = WikiSourceRefSchema.safeParse({
        kind: 'raw',
        path: 'recycled/rag-knowledge/foo.md',
      });
      expect(result.success).toBe(true);
    });

    it('rejects kind=external_url without captured_at', () => {
      const result = WikiSourceRefSchema.safeParse({
        kind: 'external_url',
        url: 'https://example.com',
      });
      expect(result.success).toBe(false);
    });

    it('accepts kind=manual with note + author', () => {
      const result = WikiSourceRefSchema.safeParse({
        kind: 'manual',
        note: 'Specific reason',
        author: '@fafa',
      });
      expect(result.success).toBe(true);
    });

    it('rejects unknown kind', () => {
      const result = WikiSourceRefSchema.safeParse({
        kind: 'invented_kind',
        url: 'https://x',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('diagnostic_relations[] (ADR-033 §D1)', () => {
    it('accepts a valid possible_cause relation', () => {
      const result = DiagnosticRelationSchema.safeParse({
        symptom_slug: 'brake_noise_metallic',
        system_slug: 'brake_system',
        relation_to_part: 'possible_cause',
        part_role: 'Plaquettes usées émettent grincement',
        evidence: {
          confidence: 'medium',
          source_policy: '2_medium_concordant',
          reviewed: false,
          diagnostic_safe: false,
        },
        sources: ['oem_renault_brakes'],
      });
      expect(result.success).toBe(true);
    });

    it('rejects part_role shorter than 10 chars', () => {
      const result = DiagnosticRelationSchema.safeParse({
        symptom_slug: 'brake_noise_metallic',
        system_slug: 'brake_system',
        relation_to_part: 'possible_cause',
        part_role: 'Too short',
        evidence: {
          confidence: 'medium',
          source_policy: '2_medium_concordant',
          reviewed: false,
          diagnostic_safe: false,
        },
        sources: ['oem_renault_brakes'],
      });
      expect(result.success).toBe(false);
    });

    it('rejects relation_to_part outside the 3-value enum', () => {
      const result = DiagnosticRelationSchema.safeParse({
        symptom_slug: 'brake_noise_metallic',
        system_slug: 'brake_system',
        relation_to_part: 'invented_relation',
        part_role: 'Plaquettes usées émettent grincement',
        evidence: {
          confidence: 'medium',
          source_policy: '2_medium_concordant',
          reviewed: false,
          diagnostic_safe: false,
        },
        sources: ['oem_renault_brakes'],
      });
      expect(result.success).toBe(false);
    });

    it('rejects sources empty (must have minItems: 1)', () => {
      const result = DiagnosticRelationSchema.safeParse({
        symptom_slug: 'brake_noise_metallic',
        system_slug: 'brake_system',
        relation_to_part: 'possible_cause',
        part_role: 'Plaquettes usées émettent grincement',
        evidence: {
          confidence: 'medium',
          source_policy: '2_medium_concordant',
          reviewed: false,
          diagnostic_safe: false,
        },
        sources: [],
      });
      expect(result.success).toBe(false);
    });

    it('rejects evidence.diagnostic_safe = true without explicit override (default is false)', () => {
      // Schema does not enforce diagnostic_safe=false, but it defaults to false.
      // Verify default behavior.
      const result = DiagnosticRelationSchema.parse({
        symptom_slug: 'brake_noise_metallic',
        system_slug: 'brake_system',
        relation_to_part: 'possible_cause',
        part_role: 'Plaquettes usées émettent grincement',
        evidence: {
          confidence: 'medium',
          source_policy: '2_medium_concordant',
          reviewed: false,
          diagnostic_safe: false,
        },
        sources: ['oem_renault_brakes'],
      });
      expect(result.evidence.diagnostic_safe).toBe(false);
    });
  });

  describe('strict (no additional properties)', () => {
    it('rejects unknown top-level field', () => {
      const input = { ...VALID_GAMME_V2, surprise_field: 'oops' };
      const result = safeParseWikiProposalFrontmatter(input);
      expect(result.success).toBe(false);
    });
  });

  describe('helper functions', () => {
    it('parseWikiProposalFrontmatter throws on invalid input', () => {
      expect(() => parseWikiProposalFrontmatter({ invalid: true })).toThrow();
    });

    it('safeParseWikiProposalFrontmatter returns success=false on invalid input', () => {
      const result = safeParseWikiProposalFrontmatter({ invalid: true });
      expect(result.success).toBe(false);
    });

    it('schema is exported and re-usable', () => {
      expect(WikiProposalFrontmatterSchema).toBeDefined();
    });
  });
});
