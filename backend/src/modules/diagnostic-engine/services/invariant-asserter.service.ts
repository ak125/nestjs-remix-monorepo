/**
 * InvariantAsserter — V1A.0 5 invariants core
 *
 * Fail-loud : violation = throw `ResolutionInvariantViolationError`.
 * Aucun fallback silencieux (doctrine `feedback_no_silent_fallback`).
 *
 * Invariants V1A.0 :
 *  1. recommended_actions ordonné par priority ascending strict
 *  2. safety_rail = true → actions[0].type ∈ {appel, assistant_diagnostic, human_resolution}
 *  3. vehicle_ctx.absent → no `piece` en priority ≤ 2
 *  4. intent.reason_codes non-vide, tous ∈ DiagnosticReasonCodeEnum
 *  5. intent.confidence ∈ [0,1] ET human_escalation.available = true (toujours)
 *
 * V1B ajoutera 3 invariants supplémentaires (resolution_payload structural, stable IDs).
 */
import { Injectable } from '@nestjs/common';
import type { AnalyzeResponseV1A0 } from '../types/analyze-response.schema';
import { ALL_DIAGNOSTIC_REASON_CODES } from '../types/diagnostic-reason-code';

export class ResolutionInvariantViolationError extends Error {
  constructor(
    public readonly invariantId: number,
    public readonly description: string,
    public readonly response: Partial<AnalyzeResponseV1A0>,
  ) {
    super(
      `Invariant #${invariantId} violated: ${description} (session=${response.session_id ?? 'unknown'})`,
    );
    this.name = 'ResolutionInvariantViolationError';
  }
}

@Injectable()
export class InvariantAsserterService {
  /**
   * Assert tous les invariants V1A.0. Throw au premier échec.
   */
  assert(
    response: AnalyzeResponseV1A0,
    vehicleContextPresent: boolean,
  ): void {
    this.assertPrioritiesAscending(response);
    this.assertSafetyRailTopAction(response);
    this.assertNoPieceTopWhenVehicleAbsent(response, vehicleContextPresent);
    this.assertReasonCodesValid(response);
    this.assertConfidenceAndEscalation(response);
  }

  // ── Invariant #1 ────────────────────────────────────────────
  private assertPrioritiesAscending(response: AnalyzeResponseV1A0): void {
    const actions = response.recommended_actions;
    if (actions.length === 0) {
      throw new ResolutionInvariantViolationError(
        1,
        'recommended_actions empty',
        response,
      );
    }
    for (let i = 0; i < actions.length; i++) {
      if (actions[i].priority !== i + 1) {
        throw new ResolutionInvariantViolationError(
          1,
          `priority at index ${i} = ${actions[i].priority}, expected ${i + 1} (strict ascending 1..N)`,
          response,
        );
      }
    }
  }

  // ── Invariant #2 ────────────────────────────────────────────
  private assertSafetyRailTopAction(response: AnalyzeResponseV1A0): void {
    if (!response.intent.safety_rail) return;
    const topType = response.recommended_actions[0]?.type;
    const allowed = ['appel', 'assistant_diagnostic', 'human_resolution'];
    if (!allowed.includes(topType)) {
      throw new ResolutionInvariantViolationError(
        2,
        `safety_rail=true but top action type='${topType}' (allowed: ${allowed.join(', ')})`,
        response,
      );
    }
  }

  // ── Invariant #3 ────────────────────────────────────────────
  private assertNoPieceTopWhenVehicleAbsent(
    response: AnalyzeResponseV1A0,
    vehicleContextPresent: boolean,
  ): void {
    if (vehicleContextPresent) return;
    const topTwo = response.recommended_actions.slice(0, 2);
    const piece = topTwo.find((a) => a.type === 'piece');
    if (piece) {
      throw new ResolutionInvariantViolationError(
        3,
        `vehicle_ctx absent but 'piece' action at priority=${piece.priority} (must be ≥ 3)`,
        response,
      );
    }
  }

  // ── Invariant #4 ────────────────────────────────────────────
  private assertReasonCodesValid(response: AnalyzeResponseV1A0): void {
    const codes = response.intent.reason_codes;
    if (codes.length === 0) {
      throw new ResolutionInvariantViolationError(
        4,
        'intent.reason_codes is empty',
        response,
      );
    }
    const validSet = new Set<string>(ALL_DIAGNOSTIC_REASON_CODES);
    for (const c of codes) {
      if (!validSet.has(c)) {
        throw new ResolutionInvariantViolationError(
          4,
          `intent.reason_code '${c}' not in canonical enum`,
          response,
        );
      }
    }
  }

  // ── Invariant #5 ────────────────────────────────────────────
  private assertConfidenceAndEscalation(
    response: AnalyzeResponseV1A0,
  ): void {
    const conf = response.intent.confidence;
    if (!Number.isFinite(conf) || conf < 0 || conf > 1) {
      throw new ResolutionInvariantViolationError(
        5,
        `intent.confidence=${conf} out of [0,1]`,
        response,
      );
    }
    if (response.human_escalation.available !== true) {
      throw new ResolutionInvariantViolationError(
        5,
        `human_escalation.available must be true V1A.0 (got ${response.human_escalation.available})`,
        response,
      );
    }
  }
}
