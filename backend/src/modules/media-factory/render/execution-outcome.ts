/** Qualify existing logs without changing their technical SQL status or history. */
export type ExecutionOutcome =
  | 'pending'
  | 'processing'
  | 'failed'
  | 'disabled'
  | 'simulated'
  | 'skipped'
  | 'rendered_unverified'
  | 'unknown';

export function executionOutcome(
  row: Record<string, unknown>,
): ExecutionOutcome {
  if (
    row.status === 'pending' ||
    row.status === 'processing' ||
    row.status === 'failed'
  ) {
    return row.status;
  }
  if (row.status !== 'completed') return 'unknown';
  const flags = row.feature_flags as Record<string, unknown> | null | undefined;
  const metadata = row.render_metadata as
    | Record<string, unknown>
    | null
    | undefined;
  if (
    flags?.pipeline_enabled === false ||
    metadata?.executionMode === 'disabled'
  )
    return 'disabled';
  if (
    row.engine_name === 'stub' ||
    metadata?.stub === true ||
    row.canary_fallback === true
  )
    return 'simulated';
  if (row.render_status === 'skipped') return 'skipped';
  if (
    row.render_status === 'success' &&
    typeof row.engine_name === 'string' &&
    row.engine_name.trim() &&
    typeof row.render_output_path === 'string' &&
    row.render_output_path.trim()
  )
    return 'rendered_unverified';
  return 'unknown';
}
