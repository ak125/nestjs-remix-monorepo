import { Test } from '@nestjs/testing';
import { DiagnosticEngineOrchestrator } from './diagnostic-engine.orchestrator';
import {
  DiagnosticEngineDataService,
  type DiagSafetyRule,
} from './diagnostic-engine.data-service';
import {
  SignalInterpretationEngine,
  type SignalInterpretation,
} from './engines/signal-interpretation.engine';
import { HypothesisScoringEngine } from './engines/hypothesis-scoring.engine';
import { RiskSafetyEngine } from './engines/risk-safety.engine';
import { CatalogOrientationEngine } from './engines/catalog-orientation.engine';
import { MaintenanceIntelligenceEngine } from './engines/maintenance-intelligence.engine';
import { KgShadowService } from './services/kg-shadow.service';
import { EvidencePackSchema } from './types/evidence-pack.schema';

const input = {
  intent_type: 'diagnostic_symptom',
  system_scope: 'freinage',
  vehicle_context: {},
  signal_input: { primary_signal: 'bruit', signal_mode: 'symptom_slugs' },
};

// Only the existing business dependencies are available: no RAG provider,
// network service or index can contribute diagnostic evidence (ADR-031).
describe('Diagnostic without RAG content authority', () => {
  // A diagnostic without safety-rule coverage is refused, so the fixture
  // provides one active rule for the analysed system.
  const safetyRule: DiagSafetyRule = {
    id: 1,
    system_id: 1,
    rule_slug: 'brake_rule_fixture',
    condition_description: 'Controle',
    risk_flag: 'Risque de freinage',
    urgency: 'haute',
    blocks_catalog: true,
    active: true,
  };
  const data = {
    getScoredCausesForSymptoms: jest.fn().mockResolvedValue([]),
    getSafetyRules: jest.fn().mockResolvedValue([safetyRule]),
    getCostRanges: jest.fn().mockResolvedValue(new Map()),
    saveSession: jest.fn().mockResolvedValue('session-fixture'),
  };
  const hypothesis = {
    hypothesis_id: 'cause-fixture',
    label: 'Hypothese documentee en base',
    cause_type: 'wear_related',
    total_score: 60,
    urgency: 'haute',
    evidence_for: ['Signal reconnu'],
    evidence_against: [],
    requires_verification: true,
    verification_method: 'Controle professionnel',
    related_gamme_slugs: [],
  };
  let orchestrator: DiagnosticEngineOrchestrator;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        DiagnosticEngineOrchestrator,
        { provide: DiagnosticEngineDataService, useValue: data },
        {
          provide: SignalInterpretationEngine,
          useValue: {
            interpret: jest.fn().mockResolvedValue({
              system_confirmed: true,
              system_slug: 'freinage',
              system_label: 'Freinage',
              resolved_symptom_slugs: ['bruit'],
              symptom_labels: { bruit: 'Bruit au freinage' },
              unresolved_signals: [],
              signal_quality: 'high',
            } satisfies SignalInterpretation),
          },
        },
        {
          provide: HypothesisScoringEngine,
          useValue: {
            score: jest.fn().mockReturnValue([hypothesis]),
          },
        },
        {
          provide: RiskSafetyEngine,
          useValue: {
            assess: jest.fn().mockReturnValue({
              risk_level: 'critical',
              risk_flags: ['Risque de freinage'],
              safety_alert: 'Arreter le vehicule',
              requires_immediate_action: true,
            }),
          },
        },
        {
          provide: CatalogOrientationEngine,
          useValue: {
            evaluate: jest.fn().mockReturnValue({
              ready_for_catalog: false,
              confidence_before_purchase: 'insufficient',
              allowed_output_mode: 'none',
              reason: 'Controle requis',
              suggested_gammes: [],
            }),
          },
        },
        {
          provide: MaintenanceIntelligenceEngine,
          useValue: {
            assess: jest.fn().mockResolvedValue({
              maintenance_links: ['operation-fixture'],
              recommendations: [],
              preventive_schedule: [],
              overdue_count: 0,
            }),
          },
        },
        { provide: KgShadowService, useValue: { shadowCompare: jest.fn() } },
      ],
    }).compile();
    orchestrator = module.get(DiagnosticEngineOrchestrator);
  });

  it('returns and persists business evidence without requiring RAG', async () => {
    const result = await orchestrator.analyze(input);
    expect(result.success).toBe(true);
    const evidence = result.data!.evidence;
    expect(EvidencePackSchema.safeParse(evidence).success).toBe(true);
    expect(evidence.evidence_pack).not.toHaveProperty('rag_facts');
    expect(evidence.evidence_pack.candidate_hypotheses[0]).toMatchObject({
      hypothesis_id: hypothesis.hypothesis_id,
      relative_score: 60,
      requires_verification: true,
    });
    expect(evidence.evidence_pack).toMatchObject({
      risk_level: 'critical',
      safety_alert: 'Arreter le vehicule',
      maintenance_links: ['operation-fixture'],
      catalog_guard: { ready_for_catalog: false, allowed_output_mode: 'none' },
    });
    expect(data.saveSession).toHaveBeenCalledWith(
      expect.objectContaining({ result: evidence }),
    );
    expect(result.data!.session_id).toBe('session-fixture');
  });

  it('strips obsolete RAG facts when parsing a historical evidence pack', async () => {
    const result = await orchestrator.analyze(input);
    const parsed = EvidencePackSchema.parse({
      evidence_pack: {
        ...result.data!.evidence.evidence_pack,
        rag_facts: [
          {
            evidence_type: 'repair_tip',
            content: 'Legacy unapproved text',
            truth_level: 'L1',
          },
        ],
      },
    });
    expect(parsed.evidence_pack).not.toHaveProperty('rag_facts');
    expect(parsed.evidence_pack.risk_flags).toEqual(['Risque de freinage']);
  });

  it('still rejects invalid input before any database access', async () => {
    const result = await orchestrator.analyze({});
    expect(result.success).toBe(false);
    expect(data.getScoredCausesForSymptoms).not.toHaveBeenCalled();
    expect(data.saveSession).not.toHaveBeenCalled();
  });
});
