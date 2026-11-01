/**
 * Evidence-qualified result, independent of the legacy SQL job lifecycle.
 * D18/D19 do not yet define a trusted artifact-check writer. Consequently no
 * row or free-form engine metadata can currently produce rendered_checked.
 */
export type ExecutionOutcome =
  | 'pending'
  | 'processing'
  | 'failed'
  | 'disabled'
  | 'simulated'
  | 'skipped'
  | 'rendered_unverified'
  | 'rendered_checked'
  | 'unknown';

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function executionOutcome(
  row: Record<string, unknown>,
): ExecutionOutcome {
  if (
    row.status === 'pending' ||
    row.status === 'processing' ||
    row.status === 'failed'
  )
    return row.status;
  if (row.status !== 'completed') return 'unknown';
  const flags = record(row.feature_flags);
  const metadata = record(row.render_metadata);
  if (row.render_status === 'failed') return 'failed';
  if (flags.pipeline_enabled === false || metadata.executionMode === 'disabled')
    return 'disabled';
  if (
    row.engine_name === 'stub' ||
    metadata.stub === true ||
    metadata.executionMode === 'simulated' ||
    row.canary_fallback === true ||
    row.engine_resolution === 'fallback_to_stub' ||
    metadata.fallback === true
  )
    return 'simulated';
  if (row.render_status === 'skipped') return 'skipped';
  if (
    row.render_status === 'success' &&
    row.engine_name === 'remotion' &&
    typeof row.render_output_path === 'string' &&
    row.render_output_path.trim()
  )
    return 'rendered_unverified';
  return 'unknown';
}
