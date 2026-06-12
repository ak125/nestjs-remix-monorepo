/**
 * Supplier Availability Truth — Truth Engine (pure, Layer 3 orchestration).
 *
 * Given the latest per-supplier observations + runtime profiles + the previous
 * projection, deterministically produce the canonical projection row:
 *   resolve freshness/TTL → confidence → effective-score source selection →
 *   graded conflict → state → anti-flap hysteresis.
 *
 * Pure & deterministic: identical inputs ⇒ identical row (incl. inputs hash),
 * so projections are replayable from the append-only snapshot log.
 */

import { createHash } from 'node:crypto';
import {
  AvailabilityState,
  ConflictKind,
  decideState,
} from './availability-state';
import { effectiveScore } from './effective-score';
import { computeAvailabilityConfidence } from './confidence';
import { classifyConflict, type SupplierClaim } from './conflict';
import { resolveTtlMinutes } from './ttl';

export enum ConnectorState {
  ACTIVE = 'ACTIVE',
  QUARANTINED = 'QUARANTINED',
  RECOVERING = 'RECOVERING',
}

export interface SupplierObservationInput {
  supplierId: string;
  available: boolean;
  delayDays: number | null;
  parseError: boolean;
  fetchedAt: Date;
  /** Portal's own reported last-sync; preferred over fetchedAt for freshness. */
  sourceVerifiedAt?: Date | null;
}

export interface SupplierProfileInput {
  supplierId: string;
  /** Operational reliability 0-100; null = cold start (no history). */
  reliabilityScore: number | null;
  supplierStability: number; // 0-1
  mismatchRate: number; // 0-1
  timeoutRate: number; // 0-1
  defaultTtlMinutes?: number | null;
  connectorState: ConnectorState;
}

export interface ProjectTruthOptions {
  gammeTtlMinutes?: number | null;
  criticality?: 'high' | 'normal' | 'low';
  /** Consecutive confirmations required before a soft downgrade from VERIFIED. */
  hysteresisDwell?: number;
}

export interface PrevProjection {
  state: AvailabilityState;
  stateCounter: number;
}

export interface TruthRow {
  state: AvailabilityState;
  confidence: number;
  delayDays: number | null;
  sourceSupplierId: string | null;
  conflictKind: ConflictKind;
  stateCounter: number;
  projectionReasonCode: string;
  projectionInputsHash: string;
}

const HYSTERESIS_DWELL_DEFAULT = 2;
const FRESHNESS_HORIZON_MINUTES = 24 * 60;

/** States that reflect hard signals — applied immediately, never dwelled. */
const IMMEDIATE_STATES = new Set<AvailabilityState>([
  AvailabilityState.UNKNOWN,
  AvailabilityState.HARD_CONFLICT,
]);

/** "Soft downgrade" targets that anti-flap protects a held VERIFIED against. */
const SOFT_DOWNGRADES = new Set<AvailabilityState>([
  AvailabilityState.SUPPLIER_PENDING,
  AvailabilityState.STALE,
  AvailabilityState.DEGRADED,
  AvailabilityState.SOFT_CONFLICT,
  AvailabilityState.DEGRADED_CONSENSUS,
]);

interface Evaluated {
  obs: SupplierObservationInput;
  confidence: number;
  stale: boolean;
  effective: number;
  quarantined: boolean;
  coldStart: boolean;
}

function stableHash(
  observations: SupplierObservationInput[],
  profiles: SupplierProfileInput[],
  options: ProjectTruthOptions,
): string {
  const norm = {
    o: observations
      .map((o) => ({
        s: o.supplierId,
        a: o.available,
        d: o.delayDays,
        p: o.parseError,
        f: o.fetchedAt.toISOString(),
        v: o.sourceVerifiedAt ? o.sourceVerifiedAt.toISOString() : null,
      }))
      .sort((x, y) => (x.s < y.s ? -1 : x.s > y.s ? 1 : x.f < y.f ? -1 : 1)),
    p: profiles
      .map((p) => ({
        s: p.supplierId,
        r: p.reliabilityScore,
        st: p.supplierStability,
        m: p.mismatchRate,
        t: p.timeoutRate,
        ttl: p.defaultTtlMinutes ?? null,
        c: p.connectorState,
      }))
      .sort((x, y) => (x.s < y.s ? -1 : x.s > y.s ? 1 : 0)),
    opt: {
      g: options.gammeTtlMinutes ?? null,
      c: options.criticality ?? 'normal',
      h: options.hysteresisDwell ?? HYSTERESIS_DWELL_DEFAULT,
    },
  };
  return createHash('sha1').update(JSON.stringify(norm)).digest('hex');
}

function applyHysteresis(
  prev: PrevProjection | null,
  target: AvailabilityState,
  immediate: boolean,
  dwell: number,
): { state: AvailabilityState; stateCounter: number; reason: string } {
  if (!prev || prev.state === target) {
    return { state: target, stateCounter: 0, reason: `STATE_${target}` };
  }
  if (immediate || IMMEDIATE_STATES.has(target)) {
    return { state: target, stateCounter: 0, reason: `IMMEDIATE_${target}` };
  }
  // Anti-flap: protect a held VERIFIED_AVAILABLE from a single soft downgrade.
  if (
    prev.state === AvailabilityState.VERIFIED_AVAILABLE &&
    SOFT_DOWNGRADES.has(target)
  ) {
    const nextCounter = prev.stateCounter + 1;
    if (nextCounter >= dwell) {
      return {
        state: target,
        stateCounter: 0,
        reason: `DOWNGRADE_CONFIRMED_${target}`,
      };
    }
    return {
      state: AvailabilityState.VERIFIED_AVAILABLE,
      stateCounter: nextCounter,
      reason: 'HELD_ANTIFLAP',
    };
  }
  return { state: target, stateCounter: 0, reason: `STATE_${target}` };
}

export function projectTruth(
  observations: SupplierObservationInput[],
  profiles: SupplierProfileInput[],
  prev: PrevProjection | null,
  now: Date,
  options: ProjectTruthOptions = {},
): TruthRow {
  const inputsHash = stableHash(observations, profiles, options);

  if (observations.length === 0) {
    return {
      state: AvailabilityState.UNKNOWN,
      confidence: 0,
      delayDays: null,
      sourceSupplierId: null,
      conflictKind: ConflictKind.NONE,
      stateCounter: 0,
      projectionReasonCode: 'NO_SNAPSHOT',
      projectionInputsHash: inputsHash,
    };
  }

  const profileMap = new Map(profiles.map((p) => [p.supplierId, p]));

  // Latest observation per supplier.
  const latest = new Map<string, SupplierObservationInput>();
  for (const o of observations) {
    const cur = latest.get(o.supplierId);
    if (!cur || o.fetchedAt > cur.fetchedAt) latest.set(o.supplierId, o);
  }

  const evals: Evaluated[] = [...latest.values()].map((obs) => {
    const profile = profileMap.get(obs.supplierId);
    const tsForFreshness = obs.sourceVerifiedAt ?? obs.fetchedAt;
    const ageMinutes = Math.max(
      0,
      (now.getTime() - tsForFreshness.getTime()) / 60000,
    );
    const ttl = resolveTtlMinutes({
      supplierDefaultTtlMinutes: profile?.defaultTtlMinutes,
      gammeTtlMinutes: options.gammeTtlMinutes,
      criticality: options.criticality,
    });
    const stale = ageMinutes > ttl;
    const confidence = computeAvailabilityConfidence({
      ageMinutes,
      supplierStability: profile?.supplierStability ?? 0,
      mismatchRate: profile?.mismatchRate ?? 0.5,
      delayVariance: 0,
      parseError: obs.parseError,
      timeoutRate: profile?.timeoutRate ?? 0,
    });
    const reliability = (profile?.reliabilityScore ?? 0) / 100;
    const freshness = Math.max(0, 1 - ageMinutes / FRESHNESS_HORIZON_MINUTES);
    const effective = effectiveScore({
      freshness,
      supplierReliability: reliability,
      parseQuality: obs.parseError ? 0 : 1,
      historicalAccuracy: reliability,
    });
    const quarantined = profile?.connectorState === ConnectorState.QUARANTINED;
    const coldStart = profile == null || profile.reliabilityScore == null;
    return { obs, confidence, stale, effective, quarantined, coldStart };
  });

  // Conflict over non-quarantined sources.
  const claims: SupplierClaim[] = evals
    .filter((e) => !e.quarantined)
    .map((e) => ({
      available: e.obs.available,
      delayDays: e.obs.delayDays,
      confidence: e.confidence,
    }));
  const conflictKind = classifyConflict(claims);

  // Pick the highest effective-score source (prefer non-quarantined).
  const nonQuarantined = evals.filter((e) => !e.quarantined);
  const pool = nonQuarantined.length > 0 ? nonQuarantined : evals;
  const best = pool.reduce((a, b) => (b.effective > a.effective ? b : a));

  const target = decideState({
    hasSnapshot: true,
    available: best.obs.available,
    stale: best.stale,
    confidence: best.confidence,
    conflict: conflictKind,
    delayDays: best.obs.delayDays,
    quarantined: best.quarantined,
    coldStart: best.coldStart,
  });

  const dwell = options.hysteresisDwell ?? HYSTERESIS_DWELL_DEFAULT;
  const immediate = best.quarantined; // connector failure degrades immediately
  const { state, stateCounter, reason } = applyHysteresis(
    prev,
    target,
    immediate,
    dwell,
  );

  return {
    state,
    confidence: best.confidence,
    delayDays: best.obs.delayDays,
    sourceSupplierId: best.obs.supplierId,
    conflictKind,
    stateCounter,
    projectionReasonCode: reason,
    projectionInputsHash: inputsHash,
  };
}
