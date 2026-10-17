import { EvidencePackSchema } from './types/evidence-pack.schema';

// A pack as persisted before the provenance existed: every stored session
// (__diag_session.result) must keep parsing once the fields are added.
function historicalPack() {
  return {
    evidence_pack: {
      factual_inputs_confirmed: ['Bruit au freinage'],
      factual_inputs_missing: [],
      system_suspects: ['freinage'],
      candidate_hypotheses: [
        {
          hypothesis_id: 'plaquettes-usees',
          label: 'Plaquettes usées',
          cause_type: 'wear_related',
          relative_score: 62,
          urgency: 'haute',
          evidence_for: ['Bruit au freinage'],
          evidence_against: [],
          requires_verification: true,
        },
      ],
      maintenance_links: [],
      risk_flags: [],
      catalog_guard: {
        ready_for_catalog: false,
        confidence_before_purchase: 'low',
        allowed_output_mode: 'none',
        reason: 'Vérification requise',
      },
      allowed_claims: [],
      ui_block_inputs: {},
    },
  };
}

const provenance = {
  state: 'partial',
  links: [
    {
      link_id: 11,
      symptom_slug: 'bruit-freinage',
      documented: true,
      wiki_refs: [
        {
          wiki_path: 'gammes/plaquette-de-frein.md',
          gamme_slug: 'plaquette-de-frein',
          relation_to_part: 'direct_cause',
          diagnostic_safe: false,
        },
      ],
    },
    {
      link_id: 12,
      symptom_slug: 'vibration-pedale',
      documented: false,
      wiki_refs: [],
    },
  ],
};

// `undefined` leaves the key out, as the orchestrator does when the provenance
// is not exposed or could not be read.
function withProvenance(summary: unknown, hypothesisProvenance: unknown) {
  const pack = historicalPack();
  const hypothesis = pack.evidence_pack.candidate_hypotheses[0];
  return {
    evidence_pack: {
      ...pack.evidence_pack,
      candidate_hypotheses: [
        hypothesisProvenance === undefined
          ? hypothesis
          : { ...hypothesis, provenance: hypothesisProvenance },
      ],
      ...(summary === undefined ? {} : { provenance_summary: summary }),
    },
  };
}

describe('EvidencePackSchema — WIKI provenance', () => {
  it('still parses a pack stored before the provenance existed', () => {
    const parsed = EvidencePackSchema.parse(historicalPack());
    expect(parsed.evidence_pack.provenance_summary).toBeUndefined();
    expect(
      parsed.evidence_pack.candidate_hypotheses[0].provenance,
    ).toBeUndefined();
  });

  it('keeps the provenance and an available summary through the parse', () => {
    const summary = {
      status: 'available',
      counts: { sourced: 0, partial: 1, unsourced: 0 },
    };
    const parsed = EvidencePackSchema.parse(
      withProvenance(summary, provenance),
    );
    // The schema strips unknown keys: a field missing from it would vanish from
    // the API response and from the stored session without any error.
    expect(parsed.evidence_pack.provenance_summary).toEqual(summary);
    expect(parsed.evidence_pack.candidate_hypotheses[0].provenance).toEqual(
      provenance,
    );
  });

  it('keeps an unavailable summary, which carries no counts', () => {
    const parsed = EvidencePackSchema.parse(
      withProvenance({ status: 'unavailable' }, undefined),
    );
    expect(parsed.evidence_pack.provenance_summary).toEqual({
      status: 'unavailable',
    });
  });

  const ref = provenance.links[0].wiki_refs[0];
  const available = (sourced: number, partial: number, unsourced: number) => ({
    status: 'available',
    counts: { sourced, partial, unsourced },
  });
  // Each case must fail for its own reason, not for a neighbouring one.
  const invalid: Array<[string, unknown, unknown, RegExp]> = [
    // One hypothesis
    [
      'an unknown state',
      available(0, 1, 0),
      { ...provenance, state: 'unknown' },
      /"invalid_value"[^}]*"state"/,
    ],
    [
      'a state that does not follow from the links',
      available(1, 0, 0),
      { ...provenance, state: 'sourced' },
      /state must follow from the documented links/,
    ],
    [
      'a provenance without any link',
      available(1, 0, 0),
      { state: 'sourced', links: [] },
      /too_small/,
    ],
    [
      'a documented link without a WIKI reference',
      available(1, 0, 0),
      {
        state: 'sourced',
        links: [
          {
            link_id: 11,
            symptom_slug: 'bruit-freinage',
            documented: true,
            wiki_refs: [],
          },
        ],
      },
      /documented must say/,
    ],
    [
      'an undocumented link carrying a WIKI reference',
      available(0, 0, 1),
      {
        state: 'unsourced',
        links: [
          {
            link_id: 11,
            symptom_slug: 'bruit-freinage',
            documented: false,
            wiki_refs: [ref],
          },
        ],
      },
      /documented must say/,
    ],
    [
      'a WIKI reference without its path',
      available(1, 0, 0),
      {
        state: 'sourced',
        links: [
          {
            link_id: 11,
            symptom_slug: 'bruit-freinage',
            documented: true,
            wiki_refs: [{ ...ref, wiki_path: '' }],
          },
        ],
      },
      /wiki_path/,
    ],
    // The summary
    [
      'an unknown summary status',
      { status: 'degraded' },
      undefined,
      /No matching discriminator/,
    ],
    [
      'counts on an unavailable summary',
      {
        status: 'unavailable',
        counts: { sourced: 1, partial: 0, unsourced: 0 },
      },
      undefined,
      /unrecognized_keys/,
    ],
    [
      'an available summary without counts',
      { status: 'available' },
      undefined,
      /counts/,
    ],
    ['a negative count', available(-1, 1, 0), provenance, /too_small/],
    // Summary and states together
    [
      'a state without a summary',
      undefined,
      provenance,
      /requires an available provenance_summary/,
    ],
    [
      'a state under an unavailable summary',
      { status: 'unavailable' },
      provenance,
      /requires an available provenance_summary/,
    ],
    [
      'an available summary with a hypothesis left without state',
      available(0, 0, 0),
      undefined,
      /requires a state on every hypothesis/,
    ],
    [
      'counts that do not tally the states',
      available(1, 0, 0),
      provenance,
      /counts must tally/,
    ],
  ];
  it.each(invalid)(
    'rejects %s',
    (_name, summary, hypothesisProvenance, reason) => {
      const result = EvidencePackSchema.safeParse(
        withProvenance(summary, hypothesisProvenance),
      );
      expect(result.success).toBe(false);
      expect(JSON.stringify(result.error?.issues)).toMatch(reason);
    },
  );
});
