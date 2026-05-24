/**
 * DiagnosticResolutionPipelineService — V1A.0
 *
 * COMPOSITION PURE STRICTE. ≤50 LOC. Aucune règle métier inline.
 * Délègue à services dédiés, asserte invariants, émet canonical event.
 *
 * Garde mécanique : `.ast-grep/rules/diagnostic-pipeline-composition-only.yml`
 * flag tout `if`/`switch`/`for` dans ce fichier (sauf invariant assert delegation).
 *
 * Source de vérité : ADR vault "Pipeline Composition-Only Principle".
 */
import { Injectable } from '@nestjs/common';
import type { EvidencePack } from '../types/evidence-pack.schema';
import type { AnalyzeResponseV1A0 } from '../types/analyze-response.schema';
import { IntentClassifierService } from './intent-classifier.service';
import { ActionRecommenderService } from './action-recommender.service';
import { HumanEscalationBuilderService } from './human-escalation-builder.service';
import { InvariantAsserterService } from './invariant-asserter.service';
import { OutcomeEmitterService } from './outcome-emitter.service';
import { PIPELINE_VERSION } from './version-registry';

export interface ResolveInput {
  sessionId: string | null;
  pack: EvidencePack['evidence_pack'];
  vehicleContextPresent: boolean;
  symptomSlug?: string;
}

@Injectable()
export class DiagnosticResolutionPipelineService {
  constructor(
    private readonly intentClassifier: IntentClassifierService,
    private readonly actionRecommender: ActionRecommenderService,
    private readonly humanEscalationBuilder: HumanEscalationBuilderService,
    private readonly invariantAsserter: InvariantAsserterService,
    private readonly outcomeEmitter: OutcomeEmitterService,
  ) {}

  /**
   * Pure composition. Delegate, compose, assert, emit. No business logic here.
   */
  async resolve(input: ResolveInput): Promise<AnalyzeResponseV1A0> {
    const intent = this.intentClassifier.classify(
      input.pack,
      input.vehicleContextPresent,
    );
    const recommended_actions = this.actionRecommender.recommend(
      intent,
      input.pack,
      input.vehicleContextPresent,
    );
    const human_escalation = this.humanEscalationBuilder.build(intent);

    const response: AnalyzeResponseV1A0 = {
      session_id: input.sessionId,
      mode: 'reactive',
      versions: { pipeline_version: PIPELINE_VERSION },
      intent,
      recommended_actions,
      human_escalation,
    };

    this.invariantAsserter.assert(response, input.vehicleContextPresent);

    // Fire-and-forget emission ; ne block pas le response path
    void this.outcomeEmitter.emitResolution(
      response,
      input.vehicleContextPresent,
      input.symptomSlug,
    );

    return response;
  }
}
