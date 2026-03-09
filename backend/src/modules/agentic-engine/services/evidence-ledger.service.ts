/**
 * EvidenceLedgerService — Append-only audit trail
 *
 * Immutable evidence recording. Once written, evidence is never modified.
 * Each fact, decision, and output is recorded with provenance metadata.
 */
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AgenticDataService } from './agentic-data.service';
import { AGENTIC_EVENTS } from '../events/agentic.events';
import type { EvidenceType } from '../constants/agentic.constants';
import type { AgenticEvidence } from '../types/run-state.schema';

@Injectable()
export class EvidenceLedgerService {
  private readonly logger = new Logger(EvidenceLedgerService.name);

  constructor(
    private readonly dataService: AgenticDataService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Record a piece of evidence (append-only, never updated)
   */
  async record(params: {
    runId: string;
    branchId?: string;
    stepId?: string;
    evidenceType: EvidenceType;
    content: Record<string, unknown>;
    source: string;
    truthLevel?: 'L1' | 'L2' | 'L3' | 'L4';
  }): Promise<AgenticEvidence | null> {
    const evidence = await this.dataService.insertEvidence({
      run_id: params.runId,
      branch_id: params.branchId,
      step_id: params.stepId,
      evidence_type: params.evidenceType,
      content: params.content,
      provenance: {
        source: params.source,
        truth_level: params.truthLevel,
        timestamp: new Date().toISOString(),
      },
    });

    if (evidence) {
      this.eventEmitter.emit(AGENTIC_EVENTS.EVIDENCE_RECORDED, {
        runId: params.runId,
        evidenceId: evidence.id,
        evidenceType: params.evidenceType,
      });
    }

    return evidence;
  }

  /**
   * Record an LLM call output
   */
  async recordLlmOutput(
    runId: string,
    branchId: string,
    stepId: string,
    output: Record<string, unknown>,
    provider: string,
    tokensUsed: number,
  ): Promise<AgenticEvidence | null> {
    return this.record({
      runId,
      branchId,
      stepId,
      evidenceType: 'llm_output',
      content: { output, provider, tokens_used: tokensUsed },
      source: `llm:${provider}`,
      truthLevel: 'L3', // LLM output = L3 (AI-generated, not verified)
    });
  }

  /**
   * Record a gate check result
   */
  async recordGateCheck(
    runId: string,
    gateName: string,
    verdict: string,
    reason: string,
    evidenceData?: Record<string, unknown>,
  ): Promise<AgenticEvidence | null> {
    return this.record({
      runId,
      evidenceType: 'gate_check',
      content: { gate_name: gateName, verdict, reason, ...evidenceData },
      source: `gate:${gateName}`,
      truthLevel: 'L1', // Gate checks = L1 (deterministic, verified)
    });
  }

  /**
   * Record a DB query result as evidence
   */
  async recordDbResult(
    runId: string,
    branchId: string,
    stepId: string,
    queryDescription: string,
    result: Record<string, unknown>,
  ): Promise<AgenticEvidence | null> {
    return this.record({
      runId,
      branchId,
      stepId,
      evidenceType: 'db_result',
      content: { query: queryDescription, result },
      source: 'supabase',
      truthLevel: 'L1', // DB facts = L1
    });
  }

  /**
   * Get full evidence trail for a run (chronological)
   */
  async getTrail(runId: string): Promise<AgenticEvidence[]> {
    return this.dataService.getEvidenceByRun(runId);
  }
}
