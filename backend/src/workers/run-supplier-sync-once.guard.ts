/**
 * Explicit owner-gate for the REAL one-shot supplier sync.
 *
 * A real run performs actual CAL/DCA portal logins (real credentials) and writes
 * to the shared production DB observation tables — that is a real supplier
 * activation (even capped), so it is REFUSED unless an operator explicitly sets
 * `SUPPLIER_SYNC_ONESHOT_CONFIRM=true`. Strict `=== 'true'`: any other value
 * (unset, `'1'`, `'TRUE'`, `'yes'`) stays refused — fail-safe.
 *
 * Kept in its own tiny module so the guard can be unit-tested without importing
 * the heavy `WorkerModule` graph the ops entrypoint boots.
 */
export const ONESHOT_CONFIRM_ENV = 'SUPPLIER_SYNC_ONESHOT_CONFIRM';

export function isOneshotConfirmed(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env[ONESHOT_CONFIRM_ENV] === 'true';
}

export const ONESHOT_REFUSAL =
  `REFUSING real supplier sync — set ${ONESHOT_CONFIRM_ENV}=true for an explicit, ` +
  'owner-gated one-shot run (real CAL/DCA portal logins + writes to ' +
  'supplier_inventory_snapshots / supplier_truth_projection on the shared prod DB). ' +
  'Exiting now with NO portal login and NO DB write.';
