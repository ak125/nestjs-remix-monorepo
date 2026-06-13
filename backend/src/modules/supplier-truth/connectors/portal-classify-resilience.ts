/**
 * Resilient batch scheduler for portal classification.
 *
 * Converges over a flaky, rate-limited, SINGLE-SESSION portal (inoshop) without ever
 * emitting a false terminal. This is the canonical resilient-batch pattern — explicit
 * and testable — replacing the earlier ad-hoc `hadSuccess && consecutiveFails===0`
 * heuristic:
 *
 *  - BISECT on group failure. A failing multi-ref group is split in half and each half
 *    retried. A poison ref is isolated in ~log2(n) fetches instead of n (fewer portal
 *    hits = anti-ban friendly), and clean sub-groups classify in bulk.
 *  - PER-REF ATTEMPT BUDGET. A ref is "charged" an attempt ONLY when it fails ALONE
 *    (size-1 fetch) — never as an innocent neighbour in a multi-ref batch. At
 *    `maxRefAttempts` it is dead-lettered (terminal REVIEW_PORTAL_TIMEOUT). This
 *    guarantees the run CONVERGES (every ref ends classified or dead-lettered) instead
 *    of looping forever on a persistently-504 ref. The counter is injected (persisted by
 *    the caller) so attempts also accumulate across resumes.
 *  - CIRCUIT BREAKER (rolling window). When the recent attempt window is entirely failure
 *    the circuit OPENS → STOP (resumable). NO ref is dead-lettered while OPEN, so a portal
 *    outage NEVER produces a false terminal — the un-classified refs are simply absent
 *    from the checkpoint and retried on the next resume. Any success keeps it CLOSED.
 *
 * PURE: no fs, no network, no `Date.now`/`Math.random`. The caller injects `fetchGroup`,
 * the verdict sinks, the per-ref attempt store and a `sleep`. Deterministic →
 * unit-testable (poison-ref isolation, outage-no-terminal, resume via seeded attempts).
 */

export interface ResilienceOptions {
  /** initial group size (the caller's BATCH). */
  batchSize: number;
  /** isolated-failure attempts before a ref is dead-lettered (terminal). */
  maxRefAttempts: number;
  /** rolling window of recent group-attempt outcomes feeding the breaker. */
  breakerWindow: number;
}

export interface ResilienceHooks<T extends { ref: string }> {
  /** Fetch+classify a group. Resolves the result on success, or `null` when the group
   *  failed after its own internal retries. MUST NOT throw. */
  fetchGroup(items: T[]): Promise<boolean>;
  /** A ref persistently failed ALONE and exhausted its budget → terminal verdict sink. */
  onRefDeadLettered(item: T): Promise<void> | void;
  /** Persist + return the new isolated-attempt count for a ref (resume-safe). */
  recordRefAttempt(ref: string): number;
  /** Anti-ban pacing between portal attempts. */
  sleepBetween(): Promise<void>;
  /** Progress / diagnostics. */
  log(msg: string): void;
}

export interface ResilienceResult {
  /** groups that classified successfully (incl. bisected sub-groups). */
  classifiedGroups: number;
  /** refs terminally dead-lettered (REVIEW_PORTAL_TIMEOUT). */
  deadLettered: string[];
  /** true when stopped by an OPEN circuit (portal outage) — resumable, no false terminals. */
  outage: boolean;
}

/**
 * Run the resilient classification. `fetchGroup` success/failure drives bisection, the
 * per-ref budget and the breaker; the caller's `fetchGroup` is responsible for the actual
 * portal call, the HTML cache and checkpointing the resulting verdicts on success.
 */
export async function runResilientClassify<T extends { ref: string }>(
  todo: readonly T[],
  opts: ResilienceOptions,
  hooks: ResilienceHooks<T>,
): Promise<ResilienceResult> {
  // LIFO work stack of groups. Seed in reverse so popping yields feed order.
  const stack: T[][] = [];
  for (let i = todo.length; i > 0; i -= opts.batchSize) {
    stack.push(todo.slice(Math.max(0, i - opts.batchSize), i) as T[]);
  }

  // The breaker measures PORTAL health, so it is fed only by "fresh" evidence: every
  // success, and every failure EXCEPT a re-attempt of an already-known-bad isolated ref
  // (grinding a ref we already know is problematic tells us nothing about the portal, and
  // would otherwise let the tail of known-bad refs falsely trip the outage breaker).
  const window: boolean[] = [];
  const charged = new Set<string>();
  const pushOutcome = (ok: boolean): void => {
    window.push(ok);
    if (window.length > opts.breakerWindow) window.shift();
  };
  // OPEN only once the window is full AND every outcome in it is a failure: a sustained
  // outage, never a single flaky group. One success in the window keeps it CLOSED.
  const circuitOpen = (): boolean =>
    window.length >= opts.breakerWindow && !window.some(Boolean);

  let classifiedGroups = 0;
  const deadLettered: string[] = [];

  while (stack.length > 0) {
    const group = stack.pop() as T[];
    const ok = await hooks.fetchGroup(group);
    const knownBadRetry =
      !ok && group.length === 1 && charged.has(group[0].ref);
    if (!knownBadRetry) pushOutcome(ok);

    if (ok) {
      classifiedGroups++;
      await hooks.sleepBetween();
      continue;
    }

    if (circuitOpen()) {
      hooks.log(
        'CIRCUIT OPEN — sustained portal failure; STOP resumable, no refs dead-lettered',
      );
      return { classifiedGroups, deadLettered, outage: true };
    }

    if (group.length > 1) {
      // bisect: push 2nd half then 1st so the 1st half pops first (keeps feed order)
      const mid = Math.ceil(group.length / 2);
      stack.push(group.slice(mid) as T[]);
      stack.push(group.slice(0, mid) as T[]);
      await hooks.sleepBetween();
      continue;
    }

    // size-1 failure (portal healthy enough — circuit is CLOSED) → charge an attempt.
    const item = group[0];
    charged.add(item.ref);
    const attempts = hooks.recordRefAttempt(item.ref);
    if (attempts >= opts.maxRefAttempts) {
      await hooks.onRefDeadLettered(item);
      deadLettered.push(item.ref);
      hooks.log(
        `${item.ref} dead-lettered REVIEW_PORTAL_TIMEOUT after ${attempts} isolated attempts`,
      );
    } else {
      // not exhausted — re-queue at the BOTTOM so its retries spread out (interleaved
      // with other work → the breaker window never fills with one bad ref's failures).
      stack.unshift(group);
    }
    await hooks.sleepBetween();
  }

  return { classifiedGroups, deadLettered, outage: false };
}
