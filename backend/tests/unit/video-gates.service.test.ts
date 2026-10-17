/**
 * VideoGatesService Unit Tests (P13a)
 *
 * Tests the 7 governance gates + checkArtefacts + runAllGates.
 * Pure logic service — no DI mocks needed (direct instantiation).
 *
 * @see backend/src/modules/media-factory/services/video-gates.service.ts
 * @see backend/src/config/video-quality.constants.ts
 */
import {
  VideoGatesService,
  VideoGateInput,
} from '../../src/modules/media-factory/services/video-gates.service';
import {
  VideoClaimEntry,
  VideoBrief,
  ApprovalRecord,
} from '../../src/modules/media-factory/types/video.types';

describe('VideoGatesService', () => {
  let service: VideoGatesService;

  beforeEach(() => {
    service = new VideoGatesService();
  });

  // ── Helper: base fixture ──

  function makeBrief(
    overrides?: Partial<VideoBrief>,
  ): VideoBrief {
    return {
      briefId: 'test-brief',
      type: 'short',
      mode: 'short',
      vertical: 'freinage',
      targetPlatforms: ['youtube_short'],
      targetDurationSec: { min: 15, max: 60 },
      knowledgeContractId: 'kc-001',
      templateId: 'short-product-highlight',
      createdBy: 'admin',
      createdAt: '2026-01-01T00:00:00Z',
      ...overrides,
    };
  }

  function makeApproval(
    overrides?: Partial<ApprovalRecord>,
  ): ApprovalRecord {
    return {
      briefId: 'test-brief',
      stages: [
        {
          stage: 'script_text',
          status: 'approved',
          by: 'admin',
          at: '2026-01-01T00:00:00Z',
        },
      ],
      ...overrides,
    };
  }

  function makeClaim(
    overrides?: Partial<VideoClaimEntry>,
  ): VideoClaimEntry {
    return {
      id: 'claim-1',
      kind: 'mileage',
      rawText: 'Durée de vie 60 000 km',
      value: '60000',
      unit: 'km',
      sectionKey: 'specs',
      sourceRef: 'doc-001',
      evidenceId: 'ev-001',
      status: 'verified',
      requiresHumanValidation: false,
      ...overrides,
    };
  }

  function makeInput(
    overrides?: Partial<VideoGateInput>,
  ): VideoGateInput {
    return {
      brief: makeBrief(),
      claims: [makeClaim()],
      evidencePack: [],
      disclaimerPlan: { disclaimers: [] },
      approvalRecord: makeApproval(),
      ...overrides,
    };
  }

  // ── checkArtefacts ──

  describe('checkArtefacts', () => {
    it('should return canProceed=true when all 5 artefacts present', () => {
      const result = service.checkArtefacts(makeInput());
      expect(result.canProceed).toBe(true);
      expect(result.missingArtefacts).toEqual([]);
    });

    it('should detect missing brief', () => {
      const result = service.checkArtefacts({
        claims: [],
        evidencePack: [],
        disclaimerPlan: { disclaimers: [] },
        approvalRecord: makeApproval(),
      });
      expect(result.canProceed).toBe(false);
      expect(result.missingArtefacts).toContain('video_brief');
    });

    it('should detect missing disclaimerPlan', () => {
      const result = service.checkArtefacts({
        brief: makeBrief(),
        claims: [],
        evidencePack: [],
        approvalRecord: makeApproval(),
      });
      expect(result.canProceed).toBe(false);
      expect(result.missingArtefacts).toContain('disclaimer_plan');
    });

    it('should detect missing approvalRecord', () => {
      const result = service.checkArtefacts({
        brief: makeBrief(),
        claims: [],
        evidencePack: [],
        disclaimerPlan: { disclaimers: [] },
      });
      expect(result.canProceed).toBe(false);
      expect(result.missingArtefacts).toContain('approval_record');
    });

    it('should return all 5 missing for empty input', () => {
      const result = service.checkArtefacts({});
      expect(result.canProceed).toBe(false);
      expect(result.missingArtefacts).toHaveLength(5);
    });
  });

  // ── runAllGates ──

  describe('runAllGates', () => {
    it('should return canPublish=true when all gates pass or warn', () => {
      const result = service.runAllGates(makeInput());
      expect(result.canPublish).toBe(true);
      expect(result.gates).toHaveLength(7);
      // G2 safety and G6 visual_role have warn=0 threshold, so 0 measured → WARN
      expect(result.gates.every((g) => g.verdict !== 'FAIL')).toBe(true);
    });

    it('should return canPublish=false when one gate FAILs', () => {
      // G2 Safety: 1 unvalidated safety claim → FAIL
      const result = service.runAllGates(
        makeInput({
          claims: [
            makeClaim({
              kind: 'safety',
              status: 'unverified',
              requiresHumanValidation: true,
            }),
          ],
        }),
      );
      expect(result.canPublish).toBe(false);
      expect(result.flags).toContain('GATE_FAIL:safety');
    });

    it.each([4, 7])('blocks one unsupported claim among %i claims', (count) => {
      const supported = Array.from({ length: count - 1 }, (_, i) =>
        makeClaim({ id: `supported-${i}` }),
      );
      const result = service.runAllGates(
        makeInput({
          claims: [makeClaim({ status: 'unverified' }), ...supported],
        }),
      );
      expect(result.canPublish).toBe(false);
      expect(result.flags).toContain('GATE_FAIL:truth');
      expect(result.gates.find((g) => g.gate === 'truth')!.measured).toBe(1);
    });
  });

  // ── G1: Truth Gate ──

  describe('G1 Truth', () => {
    it('should FAIL with a reason when the claim table is empty', () => {
      const result = service.runAllGates(makeInput({ claims: [] }));
      const g1 = result.gates.find((g) => g.gate === 'truth')!;
      expect(g1.verdict).toBe('FAIL');
      expect(result.canPublish).toBe(false);
      expect(g1.details.join(' ')).toMatch(/empty|missing/i);
    });

    it('should PASS when all claims are verified', () => {
      const claims = [
        makeClaim({ status: 'verified' }),
        makeClaim({ id: 'claim-2', status: 'verified' }),
      ];
      const result = service.runAllGates(makeInput({ claims }));
      const g1 = result.gates.find((g) => g.gate === 'truth')!;
      expect(g1.verdict).toBe('PASS');
      expect(g1.measured).toBe(0);
    });

    it('counts every unsupported claim separately', () => {
      const claims = [
        makeClaim({ id: 'c1', status: 'unverified' }),
        makeClaim({ id: 'c2', status: 'unverified' }),
        makeClaim({ id: 'c3', status: 'verified' }),
        makeClaim({ id: 'c4', status: 'verified' }),
      ];
      const result = service.runAllGates(makeInput({ claims }));
      const g1 = result.gates.find((g) => g.gate === 'truth')!;
      expect(g1.verdict).toBe('FAIL');
      expect(g1.measured).toBe(2);
      expect(g1.triggerItems?.map((item) => item.location)).toEqual([
        'claim:c1',
        'claim:c2',
      ]);
    });

    it('should FAIL even when only one of five claims is unsupported', () => {
      const claims = Array.from({ length: 5 }, (_, i) =>
        makeClaim({ id: `c${i}`, status: i === 0 ? 'unverified' : 'verified' }),
      );
      const result = service.runAllGates(makeInput({ claims }));
      const g1 = result.gates.find((g) => g.gate === 'truth')!;
      expect(g1.verdict).toBe('FAIL');
      expect(g1.measured).toBe(1);
    });

    it('should exclude procedure/safety claims from unsourced count', () => {
      // 1 unverified procedure + 1 unverified mileage out of 2
      // Only mileage counts here; G2 independently checks the procedure.
      const claims = [
        makeClaim({ id: 'c1', kind: 'procedure', status: 'unverified' }),
        makeClaim({ id: 'c2', kind: 'mileage', status: 'unverified' }),
      ];
      const result = service.runAllGates(makeInput({ claims }));
      const g1 = result.gates.find((g) => g.gate === 'truth')!;
      // G1 reports a count; procedure and safety remain the responsibility of G2.
      expect(g1.measured).toBe(1);
    });

    it.each([
      { sourceRef: null, evidenceId: null },
      { sourceRef: '  ', evidenceId: null },
      { sourceRef: null, evidenceId: 'missing-document' },
      { sourceRef: null, evidenceId: '   ' },
      { status: 'blocked' as const },
    ])('rejects a claim without support: %j', (overrides) => {
      const result = service.runAllGates(
        makeInput({ claims: [makeClaim(overrides)] }),
      );
      const truth = result.gates.find((g) => g.gate === 'truth')!;
      expect(truth.verdict).toBe('FAIL');
      expect(truth.measured).toBe(1);
      expect(truth.triggerItems).toHaveLength(1);
      expect(result.canPublish).toBe(false);
    });

    it('accepts verified evidence only when its exact docId is in the pack', () => {
      const evidence = {
        docId: 'ev-001',
        heading: 'Synthetic fixture',
        charRange: [0, 20] as [number, number],
        rawExcerpt: 'Synthetic unit test evidence.',
        confidence: 1,
      };
      const claims = [makeClaim({ sourceRef: null })];
      const matching = service.runAllGates(
        makeInput({ claims, evidencePack: [evidence] }),
      );
      expect(matching.gates.find((g) => g.gate === 'truth')!.verdict).toBe(
        'PASS',
      );
      expect(matching.canPublish).toBe(true);
      const foreign = service.runAllGates(
        makeInput({
          claims,
          evidencePack: [{ ...evidence, docId: 'other-document' }],
        }),
      );
      expect(foreign.gates.find((g) => g.gate === 'truth')!.verdict).toBe(
        'FAIL',
      );
      expect(foreign.canPublish).toBe(false);
    });

    it('does not promote an unverified claim even with a matching evidence entry', () => {
      const result = service.runAllGates(
        makeInput({
          claims: [makeClaim({ sourceRef: null, status: 'unverified' })],
          evidencePack: [
            {
              docId: 'ev-001',
              heading: 'Fixture',
              charRange: [0, 10],
              rawExcerpt: 'Test only.',
              confidence: 1,
            },
          ],
        }),
      );
      expect(result.gates.find((g) => g.gate === 'truth')!.verdict).toBe(
        'FAIL',
      );
    });
  });

  // ── G2: Safety Gate ──

  describe('G2 Safety', () => {
    it.each(['procedure', 'safety'] as const)(
      'requires a validator for %s even when the model flag is false',
      (kind) => {
        const result = service.runAllGates(
          makeInput({
            claims: [
              makeClaim({
                kind,
                status: 'unverified',
                requiresHumanValidation: false,
              }),
            ],
          }),
        );
        expect(result.gates.find((g) => g.gate === 'safety')!.verdict).toBe(
          'FAIL',
        );
        expect(result.canPublish).toBe(false);
      },
    );

    it('rejects a blank validator identity', () => {
      const result = service.runAllGates(
        makeInput({
          claims: [
            makeClaim({
              kind: 'safety',
              requiresHumanValidation: true,
              validatedBy: '   ',
            }),
          ],
        }),
      );
      expect(result.gates.find((g) => g.gate === 'safety')!.verdict).toBe(
        'FAIL',
      );
    });
    it('should WARN when no safety/procedure claims (warn=0 threshold)', () => {
      const result = service.runAllGates(
        makeInput({ claims: [makeClaim({ kind: 'mileage' })] }),
      );
      const g2 = result.gates.find((g) => g.gate === 'safety')!;
      // safety_unvalidated threshold: warn=0, fail=1 → 0 unvalidated → WARN
      expect(g2.verdict).toBe('WARN');
      expect(g2.measured).toBe(0);
    });

    it('should FAIL with 1 unvalidated safety claim (strict)', () => {
      const claims = [
        makeClaim({
          kind: 'safety',
          requiresHumanValidation: true,
          validatedBy: undefined,
        }),
      ];
      const result = service.runAllGates(makeInput({ claims }));
      const g2 = result.gates.find((g) => g.gate === 'safety')!;
      expect(g2.verdict).toBe('FAIL');
    });

    it('should WARN (not FAIL) when safety claim is validated', () => {
      const claims = [
        makeClaim({
          kind: 'safety',
          requiresHumanValidation: true,
          validatedBy: 'expert-01',
        }),
      ];
      const result = service.runAllGates(makeInput({ claims }));
      const g2 = result.gates.find((g) => g.gate === 'safety')!;
      // validated → unvalidated=0 → warn=0 threshold → WARN (not FAIL)
      expect(g2.verdict).toBe('WARN');
      expect(g2.measured).toBe(0);
    });
  });

  // ── G3: Brand Gate ──

  describe('G3 Brand', () => {
    it('should PASS when no script text', () => {
      const result = service.runAllGates(makeInput());
      const g3 = result.gates.find((g) => g.gate === 'brand')!;
      expect(g3.verdict).toBe('PASS');
    });

    it('should detect forbidden patterns in socle mode', () => {
      const input = makeInput({
        brief: makeBrief({ mode: 'socle', type: 'film_socle' }),
        scriptText: 'Achetez vos plaquettes de frein maintenant',
      });
      const result = service.runAllGates(input);
      const g3 = result.gates.find((g) => g.gate === 'brand')!;
      expect(g3.measured).toBeGreaterThan(0);
    });

    it('should PASS with clean script in short mode', () => {
      const input = makeInput({
        scriptText: 'Les plaquettes de frein assurent un freinage optimal',
      });
      const result = service.runAllGates(input);
      const g3 = result.gates.find((g) => g.gate === 'brand')!;
      expect(g3.verdict).toBe('PASS');
    });

    it('should detect CTA in socle mode', () => {
      const input = makeInput({
        brief: makeBrief({ mode: 'socle', type: 'film_socle' }),
        scriptText: 'Cliquez ici pour en savoir plus',
      });
      const result = service.runAllGates(input);
      const g3 = result.gates.find((g) => g.gate === 'brand')!;
      expect(g3.measured).toBeGreaterThan(0);
    });
  });

  // ── G4: Platform Gate ──

  describe('G4 Platform', () => {
    it('should PASS when no duration data', () => {
      const result = service.runAllGates(makeInput());
      const g4 = result.gates.find((g) => g.gate === 'platform')!;
      expect(g4.verdict).toBe('PASS');
    });

    it('should PASS when duration is within range (short 30s)', () => {
      const input = makeInput({ actualDurationSec: 30 });
      const result = service.runAllGates(input);
      const g4 = result.gates.find((g) => g.gate === 'platform')!;
      expect(g4.verdict).toBe('PASS');
    });

    it('should FAIL when duration is outside range (short 90s)', () => {
      const input = makeInput({ actualDurationSec: 90 });
      const result = service.runAllGates(input);
      const g4 = result.gates.find((g) => g.gate === 'platform')!;
      expect(g4.verdict).toBe('FAIL');
    });
  });

  // ── G5: Reuse Risk ──

  describe('G5 Reuse Risk', () => {
    it('should PASS with similarity 0', () => {
      const input = makeInput({ similarityScore: 0 });
      const result = service.runAllGates(input);
      const g5 = result.gates.find((g) => g.gate === 'reuse_risk')!;
      expect(g5.verdict).toBe('PASS');
    });

    it('should FAIL with similarity > 0.7', () => {
      const input = makeInput({ similarityScore: 0.8 });
      const result = service.runAllGates(input);
      const g5 = result.gates.find((g) => g.gate === 'reuse_risk')!;
      expect(g5.verdict).toBe('FAIL');
    });
  });

  // ── G6: Visual Role ──

  describe('G6 Visual Role', () => {
    it('should WARN with no violations (warn=0 threshold)', () => {
      const result = service.runAllGates(makeInput());
      const g6 = result.gates.find((g) => g.gate === 'visual_role')!;
      // visual_role_violations threshold: warn=0, fail=1 → 0 violations → WARN
      expect(g6.verdict).toBe('WARN');
      expect(g6.measured).toBe(0);
    });

    it('should FAIL with 1 violation (strict)', () => {
      const input = makeInput({
        visualRoleViolations: [
          { assetKey: 'img-001', visualType: 'schema', usedAs: 'proof' },
        ],
      });
      const result = service.runAllGates(input);
      const g6 = result.gates.find((g) => g.gate === 'visual_role')!;
      expect(g6.verdict).toBe('FAIL');
    });
  });

  // ── G7: Final QA ──

  describe('G7 Final QA', () => {
    it('should PASS with all artefacts + script approved', () => {
      const result = service.runAllGates(makeInput());
      const g7 = result.gates.find((g) => g.gate === 'final_qa')!;
      expect(g7.verdict).toBe('PASS');
    });

    it('should FAIL when script not approved', () => {
      const input = makeInput({
        approvalRecord: {
          briefId: 'test-brief',
          stages: [
            { stage: 'script_text', status: 'pending', by: null, at: null },
          ],
        },
      });
      const result = service.runAllGates(input);
      const g7 = result.gates.find((g) => g.gate === 'final_qa')!;
      expect(g7.verdict).toBe('FAIL');
    });
  });
});
