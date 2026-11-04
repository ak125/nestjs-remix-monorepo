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
  approvalStagesOf,
} from '../../src/modules/media-factory/services/video-gates.service';
import {
  VideoClaimEntry,
  VideoBrief,
  ApprovalRecord,
  ApprovalDossierRecord,
} from '../../src/modules/media-factory/types/video.types';

describe('VideoGatesService', () => {
  let service: VideoGatesService;

  beforeEach(() => {
    service = new VideoGatesService();
  });

  // ── Helper: base fixture ──

  function makeBrief(overrides?: Partial<VideoBrief>): VideoBrief {
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

  function makeApproval(overrides?: Partial<ApprovalRecord>): ApprovalRecord {
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

  function makeClaim(overrides?: Partial<VideoClaimEntry>): VideoClaimEntry {
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

  function makeInput(overrides?: Partial<VideoGateInput>): VideoGateInput {
    return {
      brief: makeBrief(),
      claims: [makeClaim()],
      evidencePack: [],
      disclaimerPlan: { disclaimers: [] },
      approvalRecord: makeApproval(),
      ...overrides,
    };
  }

  /** Toutes les mesures présentes et propres : seul cas publiable sans revue. */
  function makeMeasuredInput(
    overrides?: Partial<VideoGateInput>,
  ): VideoGateInput {
    return makeInput({
      scriptText: 'Les plaquettes de frein assurent un freinage optimal',
      actualDurationSec: 30,
      similarityScore: 0,
      visualRoleViolations: [],
      ...overrides,
    });
  }

  function withFinalPublish(
    by: string | null = 'owner',
  ): ApprovalRecord {
    return makeApproval({
      stages: [
        ...makeApproval().stages,
        {
          stage: 'final_publish',
          status: 'approved',
          by,
          at: '2026-01-02T00:00:00Z',
        },
      ],
    });
  }

  // ── checkArtefacts ──

  describe('checkArtefacts', () => {
    it('should return canProceed=true when all 5 artefacts present', () => {
      const result = service.checkArtefacts(makeInput());
      expect(result.canProceed).toBe(true);
      expect(result.missingArtefacts).toEqual([]);
    });

    it('rejects an empty claim table as a missing required artefact', () => {
      const result = service.checkArtefacts(makeInput({ claims: [] }));
      expect(result.hasClaimTable).toBe(false);
      expect(result.canProceed).toBe(false);
      expect(result.missingArtefacts).toContain('claim_table');
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
    it('returns canPublish=true only when every measure is present and clean', () => {
      const result = service.runAllGates(makeMeasuredInput());
      expect(result.canPublish).toBe(true);
      expect(result.gates).toHaveLength(7);
      expect(result.gates.every((g) => g.verdict === 'PASS')).toBe(true);
      expect(result.flags).toEqual([]);
    });

    it('keeps an unmeasured draft unpublishable without failing it', () => {
      const result = service.runAllGates(makeInput());
      expect(result.canPublish).toBe(false);
      expect(result.gates.some((g) => g.verdict === 'FAIL')).toBe(false);
      expect(result.flags).toEqual(
        expect.arrayContaining([
          'NOT_MEASURED:brand',
          'NOT_MEASURED:platform',
          'NOT_MEASURED:reuse_risk',
          'NOT_MEASURED:visual_role',
        ]),
      );
    });

    it('does not let a final publish approval replace a missing measure', () => {
      const result = service.runAllGates(
        makeMeasuredInput({
          actualDurationSec: undefined,
          approvalRecord: withFinalPublish(),
        }),
      );
      expect(result.canPublish).toBe(false);
      expect(result.flags).toContain('NOT_MEASURED:platform');
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

    it('requires a review for a measured reuse warning', () => {
      const result = service.runAllGates(
        makeMeasuredInput({ similarityScore: 0.6 }),
      );
      expect(result.canPublish).toBe(false);
      expect(result.flags).toEqual([
        'GATE_WARN:reuse_risk',
        'REVIEW_REQUIRED:reuse_risk',
      ]);
    });

    it('accepts a measured warning once final publication is approved', () => {
      const result = service.runAllGates(
        makeMeasuredInput({
          similarityScore: 0.6,
          approvalRecord: withFinalPublish(),
        }),
      );
      expect(result.canPublish).toBe(true);
      expect(result.flags).toEqual(['GATE_WARN:reuse_risk']);
    });

    it.each([null, '', '  '])(
      'does not count a final publish approval without author (%s)',
      (by) => {
        const result = service.runAllGates(
          makeMeasuredInput({
            similarityScore: 0.6,
            approvalRecord: withFinalPublish(by),
          }),
        );
        expect(result.canPublish).toBe(false);
        expect(result.flags).toContain('REVIEW_REQUIRED:reuse_risk');
      },
    );

    it('reads final publication from the dossier publish approval', () => {
      const dossier: ApprovalDossierRecord = {
        video_id: 'fafa-test-001',
        approval: {
          content_approved: true,
          content_approved_by: 'owner',
          content_approved_at: '2026-01-01T00:00:00Z',
          render_approved: true,
          render_approved_by: 'owner',
          render_approved_at: '2026-01-02T00:00:00Z',
          publish_approved: true,
          publish_approved_by: 'owner',
          publish_approved_at: '2026-01-03T00:00:00Z',
        },
      };
      const result = service.runAllGates(
        makeMeasuredInput({ similarityScore: 0.6, approvalRecord: dossier }),
      );
      expect(result.canPublish).toBe(true);
    });
  });

  describe('file-only claim gates', () => {
    it.each(['supported', 'unsupported', 'empty', 'safety'])(
      'preserves the full pipeline truth and safety verdicts for %s claims',
      (scenario) => {
        const claims = scenario === 'empty' ? [] : [makeClaim({
          ...(scenario === 'unsupported' ? { status: 'unverified' as const } : {}),
          ...(scenario === 'safety' ? { kind: 'safety' as const, validatedBy: undefined } : {}),
        })];
        const input = makeInput({ claims });
        expect(service.runClaimGates({ claims, evidencePack: input.evidencePack }))
          .toEqual(service.runAllGates(input).gates.slice(0, 2));
      },
    );
  });

  describe('G1 Truth — support each fact', () => {
    it('rejects an empty claim table with a reason', () => {
      const result = service.runAllGates(makeInput({ claims: [] }));
      const truth = result.gates.find((g) => g.gate === 'truth')!;
      expect(truth.verdict).toBe('FAIL');
      expect(truth.measured).toBe(0);
      expect(truth.details.length).toBeGreaterThan(0);
      expect(result.canPublish).toBe(false);
      expect(result.flags).toContain('GATE_FAIL:truth');
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

    it.each([7, 4])(
      'rejects one unsupported claim among %i claims',
      (count) => {
        const claims = Array.from({ length: count }, (_, i) =>
          makeClaim({
            id: `c${i}`,
            status: i === 0 ? 'unverified' : 'verified',
          }),
        );
        const result = service.runAllGates(makeInput({ claims }));
        const truth = result.gates.find((g) => g.gate === 'truth')!;
        expect(truth.verdict).toBe('FAIL');
        expect(truth.measured).toBe(1);
        expect(truth.triggerItems).toHaveLength(1);
        expect(result.canPublish).toBe(false);
      },
    );

    it.each([
      { sourceRef: null, evidenceId: null },
      { sourceRef: '  ', evidenceId: null },
      { sourceRef: null, evidenceId: 'absent-from-pack' },
    ])('rejects verified claims without usable support: %j', (support) => {
      const result = service.runAllGates(
        makeInput({ claims: [makeClaim(support)] }),
      );
      expect(result.gates.find((g) => g.gate === 'truth')).toMatchObject({
        verdict: 'FAIL',
        measured: 1,
      });
    });

    it.each(['unverified', 'blocked'] as const)(
      'rejects a %s fact even with a source reference',
      (status) => {
        const result = service.runAllGates(
          makeInput({ claims: [makeClaim({ status })] }),
        );
        expect(result.gates.find((g) => g.gate === 'truth')).toMatchObject({
          verdict: 'FAIL',
          measured: 1,
        });
      },
    );

    it('accepts verified facts with a source reference or a matching evidence entry', () => {
      const result = service.runAllGates(
        makeMeasuredInput({
          claims: [
            makeClaim({ evidenceId: null }),
            makeClaim({ id: 'c2', sourceRef: null }),
          ],
          evidencePack: [
            {
              docId: 'ev-001',
              heading: 'Source',
              charRange: [0, 10],
              rawExcerpt: 'Evidence',
              confidence: 1,
            },
          ],
        }),
      );
      expect(result.gates.find((g) => g.gate === 'truth')).toMatchObject({
        verdict: 'PASS',
        measured: 0,
      });
      expect(result.canPublish).toBe(true);
    });

    it('does not accept an evidence reference to another entry', () => {
      const result = service.runAllGates(
        makeInput({
          claims: [makeClaim({ sourceRef: null })],
          evidencePack: [
            {
              docId: 'ev-other',
              heading: 'Other',
              charRange: [0, 10],
              rawExcerpt: 'Other',
              confidence: 1,
            },
          ],
        }),
      );
      expect(result.gates.find((g) => g.gate === 'truth')).toMatchObject({
        verdict: 'FAIL',
        measured: 1,
      });
    });

    it('excludes procedure/safety from the factual count, leaving them to G2', () => {
      const result = service.runAllGates(
        makeInput({
          claims: [
            makeClaim({
              kind: 'procedure',
              status: 'unverified',
              validatedBy: 'expert-01',
            }),
            makeClaim({
              id: 'safety',
              kind: 'safety',
              status: 'unverified',
              validatedBy: 'expert-01',
            }),
            makeClaim({ id: 'fact', status: 'unverified' }),
          ],
        }),
      );
      expect(result.gates.find((g) => g.gate === 'truth')).toMatchObject({
        verdict: 'FAIL',
        measured: 1,
      });
    });
  });

  describe('G2 Safety — validation follows kind', () => {
    it('passes when there are no safety claims (STRICT: one violation fails)', () => {
      const result = service.runAllGates(makeInput());
      expect(result.gates.find((g) => g.gate === 'safety')).toMatchObject({
        verdict: 'PASS',
        measured: 0,
      });
    });

    it.each(['safety', 'procedure'] as const)(
      'rejects unvalidated %s even when the generator flag is false',
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
        expect(result.gates.find((g) => g.gate === 'safety')).toMatchObject({
          verdict: 'FAIL',
          measured: 1,
        });
        expect(result.canPublish).toBe(false);
      },
    );

    it.each([undefined, '', '  '])(
      'rejects a missing or blank validator (%s)',
      (validatedBy) => {
        const result = service.runAllGates(
          makeInput({
            claims: [
              makeClaim({
                kind: 'safety',
                requiresHumanValidation: true,
                validatedBy,
              }),
            ],
          }),
        );
        expect(result.gates.find((g) => g.gate === 'safety')).toMatchObject({
          verdict: 'FAIL',
          measured: 1,
        });
      },
    );

    it('accepts human-validated safety and procedure claims regardless of generator flag', () => {
      const result = service.runAllGates(
        makeMeasuredInput({
          claims: [
            makeClaim({
              kind: 'safety',
              requiresHumanValidation: false,
              validatedBy: 'expert-01',
            }),
            makeClaim({
              id: 'procedure',
              kind: 'procedure',
              requiresHumanValidation: true,
              validatedBy: 'expert-02',
            }),
          ],
        }),
      );
      expect(result.gates.find((g) => g.gate === 'safety')).toMatchObject({
        verdict: 'PASS',
        measured: 0,
      });
      expect(result.canPublish).toBe(true);
    });
  });

  // ── G3: Brand Gate ──

  describe('G3 Brand', () => {
    it('reports a missing script as not measured', () => {
      const result = service.runAllGates(makeInput());
      const g3 = result.gates.find((g) => g.gate === 'brand')!;
      expect(g3).toMatchObject({ verdict: 'WARN', measured: null });
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
    it('reports missing duration as not measured, not PASS', () => {
      const result = service.runAllGates(makeInput());
      const g4 = result.gates.find((g) => g.gate === 'platform')!;
      expect(g4).toMatchObject({ verdict: 'WARN', measured: null });
    });

    it.each([0, -5, Number.NaN, Number.POSITIVE_INFINITY, '30'])(
      'fails an invalid duration (%s)',
      (actualDurationSec) => {
        const result = service.runAllGates(
          makeInput({ actualDurationSec: actualDurationSec as number }),
        );
        const g4 = result.gates.find((g) => g.gate === 'platform')!;
        expect(g4).toMatchObject({ verdict: 'FAIL', measured: null });
        expect(result.canPublish).toBe(false);
      },
    );

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
    it('should PASS with a real similarity of 0', () => {
      const input = makeInput({ similarityScore: 0 });
      const result = service.runAllGates(input);
      const g5 = result.gates.find((g) => g.gate === 'reuse_risk')!;
      expect(g5).toMatchObject({ verdict: 'PASS', measured: 0 });
    });

    it('does not read an absent score as originality', () => {
      const result = service.runAllGates(makeInput());
      const g5 = result.gates.find((g) => g.gate === 'reuse_risk')!;
      expect(g5).toMatchObject({ verdict: 'WARN', measured: null });
    });

    it.each([-0.1, 1.5, Number.NaN, '0.2'])(
      'fails an invalid or overflowing score (%s)',
      (similarityScore) => {
        const result = service.runAllGates(
          makeInput({ similarityScore: similarityScore as number }),
        );
        const g5 = result.gates.find((g) => g.gate === 'reuse_risk')!;
        expect(g5).toMatchObject({ verdict: 'FAIL', measured: null });
      },
    );

    it.each([
      [0.49, 'PASS'],
      [0.5, 'WARN'],
      [0.7, 'FAIL'],
      [1, 'FAIL'],
    ])('applies the thresholds at %s → %s', (similarityScore, verdict) => {
      const result = service.runAllGates(makeInput({ similarityScore }));
      const g5 = result.gates.find((g) => g.gate === 'reuse_risk')!;
      expect(g5).toMatchObject({ verdict, measured: similarityScore });
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
    it('passes a recorded check with no violations (STRICT)', () => {
      const result = service.runAllGates(
        makeInput({ visualRoleViolations: [] }),
      );
      const g6 = result.gates.find((g) => g.gate === 'visual_role')!;
      expect(g6).toMatchObject({ verdict: 'PASS', measured: 0 });
    });

    it('reports a missing visual check as not measured', () => {
      const result = service.runAllGates(makeInput());
      const g6 = result.gates.find((g) => g.gate === 'visual_role')!;
      expect(g6).toMatchObject({ verdict: 'WARN', measured: null });
    });

    it('fails a visual check that is not a list', () => {
      const result = service.runAllGates(
        makeInput({
          visualRoleViolations: 'none' as unknown as VideoGateInput['visualRoleViolations'],
        }),
      );
      const g6 = result.gates.find((g) => g.gate === 'visual_role')!;
      expect(g6).toMatchObject({ verdict: 'FAIL', measured: null });
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

  // ── Dossier approval.json : trois approbations du schéma ──

  describe('approval record du dossier (governance/approval-record.schema.json)', () => {
    function makeDossierApproval(
      overrides?: Partial<ApprovalDossierRecord['approval']>,
    ): ApprovalDossierRecord {
      return {
        video_id: 'test-brief',
        approval: {
          content_approved: false,
          content_approved_by: null,
          content_approved_at: null,
          render_approved: false,
          render_approved_by: null,
          render_approved_at: null,
          publish_approved: false,
          publish_approved_by: null,
          publish_approved_at: null,
          ...overrides,
        },
      };
    }

    it('compte un approval.json sans stages comme présent (étape 1)', () => {
      const result = service.checkArtefacts(
        makeInput({ approvalRecord: makeDossierApproval() }),
      );
      expect(result.hasApprovalRecord).toBe(true);
      expect(result.canProceed).toBe(true);
    });

    it('dérive script_text de content_approved pour G7', () => {
      const pending = service.runAllGates(
        makeInput({ approvalRecord: makeDossierApproval() }),
      );
      expect(pending.gates.find((g) => g.gate === 'final_qa')!.verdict).toBe(
        'FAIL',
      );

      const approved = service.runAllGates(
        makeInput({
          approvalRecord: makeDossierApproval({
            content_approved: true,
            content_approved_by: 'owner:test',
            content_approved_at: '2026-01-01T00:00:00Z',
          }),
        }),
      );
      expect(approved.gates.find((g) => g.gate === 'final_qa')!.verdict).toBe(
        'PASS',
      );
    });

    it('laisse en attente une approbation sans auteur', () => {
      expect(
        approvalStagesOf(
          makeDossierApproval({ content_approved: true }),
        )?.find((s) => s.stage === 'script_text')?.status,
      ).toBe('pending');
    });

    it('refuse un enregistrement qui porte les deux formes', () => {
      const both = {
        ...makeDossierApproval(),
        ...makeApproval(),
      };
      expect(approvalStagesOf(both)).toBeNull();
      expect(
        service.checkArtefacts(makeInput({ approvalRecord: both }))
          .missingArtefacts,
      ).toContain('approval_record');
    });
  });
});
