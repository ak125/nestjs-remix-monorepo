import { executionOutcome } from '../../src/modules/media-factory/render/execution-outcome';

const rendered = {
  status: 'completed',
  engine_name: 'remotion',
  render_status: 'success',
  render_output_path: 's3://renders/file.mp4',
};
describe('execution outcome evidence', () => {
  it.each([
    [{ status: 'pending' }, 'pending'],
    [{ status: 'processing' }, 'processing'],
    [{ ...rendered, status: 'failed' }, 'failed'],
    [{ status: 'completed' }, 'unknown'],
    [{ ...rendered, feature_flags: { pipeline_enabled: false } }, 'disabled'],
    [
      { ...rendered, render_metadata: { executionMode: 'disabled' } },
      'disabled',
    ],
    [{ ...rendered, engine_name: 'stub' }, 'simulated'],
    [{ ...rendered, render_metadata: { stub: true } }, 'simulated'],
    [
      { ...rendered, render_metadata: { executionMode: 'simulated' } },
      'simulated',
    ],
    [{ ...rendered, engine_resolution: 'fallback_to_stub' }, 'simulated'],
    [{ ...rendered, canary_fallback: true }, 'simulated'],
    [{ ...rendered, render_metadata: { fallback: true } }, 'simulated'],
    [{ ...rendered, render_status: 'skipped' }, 'skipped'],
    [{ ...rendered, render_status: 'failed' }, 'failed'],
    [{ ...rendered, render_output_path: ' ' }, 'unknown'],
    [{ ...rendered, render_output_path: {} }, 'unknown'],
    [{ ...rendered, engine_name: 'unknown-engine' }, 'unknown'],
    [rendered, 'rendered_unverified'],
    [
      {
        ...rendered,
        render_metadata: {
          executionOutcome: 'rendered_checked',
          checked: true,
          review: { approved: true },
        },
      },
      'rendered_unverified',
    ],
    [{ ...rendered, status: 'rendered_checked' }, 'unknown'],
    [
      { ...rendered, feature_flags: [], render_metadata: 'checked' },
      'rendered_unverified',
    ],
  ])('qualifies %j as %s without inventing checks', (row, expected) => {
    expect(executionOutcome(row)).toBe(expected);
  });
});
