/**
 * VerifierService — Phase VERIFYING stub
 *
 * Runs hard/soft gates on the winning branch output.
 * Pattern: inspired by HardGatesService (9 gates, makeResult).
 * Phase 3: will implement real gate checks.
 */
import { Injectable, Logger } from '@nestjs/common';
import { AgenticDataService } from './agentic-data.service';
import { EvidenceLedgerService } from './evidence-ledger.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AGENTIC_EVENTS } from '../events/agentic.events';
import type { SafeToApply } from '../types/run-state.schema';

@Injectable()
export class VerifierService {
  private readonly logger = new Logger(VerifierService.name);

  constructor(
    private readonly dataService: AgenticDataService,
    private readonly evidenceLedger: EvidenceLedgerService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Run verification gates on the run output.
   * Stub: all gates pass, returns safe_to_apply.
   */
  async verify(runId: string): Promise<SafeToApply> {
    this.logger.log(`Verifying run ${runId} (stub mode)`);

    const gates = [
      { name: 'budget_within_limit', type: 'hard' as const, verdict: 'PASS' as const },
      { name: 'output_valid', type: 'hard' as const, verdict: 'PASS' as const },
      { name: 'no_forbidden_mutations', type: 'hard' as const, verdict: 'PASS' as const },
    ];

    // Record gate results
    for (const gate of gates) {
      await this.dataService.insertGateResult({
        run_id: runId,
        gate_name: gate.name,
        gate_type: gate.type,
        verdict: gate.verdict,
        reason: 'Stub verification: auto-pass',
      });

      await this.evidenceLedger.recordGateCheck(
        runId,
        gate.name,
        gate.verdict,
        'Stub verification: auto-pass',
      );

      this.eventEmitter.emit(AGENTIC_EVENTS.GATE_CHECKED, {
        runId,
        gateName: gate.name,
        gateType: gate.type,
        verdict: gate.verdict,
        reason: 'Stub verification: auto-pass',
      });
    }

    const result: SafeToApply = {
      decision: 'apply',
      hard_gates_passed: true,
      soft_warn_count: 0,
      reason: 'All gates passed (stub mode)',
    };

    return result;
  }
}
