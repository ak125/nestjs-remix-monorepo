/**
 * Tests Zod schemas — strict + entity_id pattern + sha256.
 */
import {
  RefreshJobDataSchema,
  WriteJobDataSchema,
} from '../dto/projection-job.dto';

const BASE_WRITE = {
  projection_contract_version: '1.0.0',
  exports_snapshot_hash: 'sha256:' + 'a'.repeat(64),
  exports_snapshot_uri:
    '/opt/automecanik/object-store/exports-snapshots/abc.tar.zst',
  builder_version: '1.0.0',
  pipeline_version: '1.0.0',
  extractor_version: '1.0.0',
  wiki_commit_sha: 'b'.repeat(40),
  trigger_kind: 'cron' as const,
  replayed_from_run_id: null,
  entity_ids: ['gamme:filtre-a-huile'],
};

describe('WriteJobDataSchema', () => {
  it('accepts valid minimal payload', () => {
    expect(WriteJobDataSchema.safeParse(BASE_WRITE).success).toBe(true);
  });

  it('rejects bad sha256 in exports_snapshot_hash', () => {
    const bad = { ...BASE_WRITE, exports_snapshot_hash: 'md5:deadbeef' };
    expect(WriteJobDataSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects non-semver projection_contract_version', () => {
    const bad = { ...BASE_WRITE, projection_contract_version: '1.0' };
    expect(WriteJobDataSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects support in entity_ids (support never in SEO projection)', () => {
    const bad = { ...BASE_WRITE, entity_ids: ['support:retours'] };
    expect(WriteJobDataSchema.safeParse(bad).success).toBe(false);
  });

  it('accepts diagnostic in entity_ids', () => {
    const ok = { ...BASE_WRITE, entity_ids: ['diagnostic:bruit-freinage'] };
    expect(WriteJobDataSchema.safeParse(ok).success).toBe(true);
  });

  it('rejects empty entity_ids', () => {
    const bad = { ...BASE_WRITE, entity_ids: [] };
    expect(WriteJobDataSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects unknown trigger_kind', () => {
    const bad = { ...BASE_WRITE, trigger_kind: 'auto' };
    expect(WriteJobDataSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects extra fields (strict)', () => {
    const bad = { ...BASE_WRITE, evil_field: 'oops' };
    expect(WriteJobDataSchema.safeParse(bad).success).toBe(false);
  });

  it('accepts replay trigger with replayed_from_run_id', () => {
    const ok = {
      ...BASE_WRITE,
      trigger_kind: 'replay' as const,
      replayed_from_run_id: '00000000-0000-0000-0000-000000000000',
    };
    expect(WriteJobDataSchema.safeParse(ok).success).toBe(true);
  });
});

describe('RefreshJobDataSchema', () => {
  const BASE_REFRESH = {
    run_id: '00000000-0000-0000-0000-000000000000',
    triggered_at: '2026-05-13T20:00:00.000Z',
    triggered_by: 'seo-projection-write-worker' as const,
  };

  it('accepts valid payload', () => {
    expect(RefreshJobDataSchema.safeParse(BASE_REFRESH).success).toBe(true);
  });

  it('rejects non-uuid run_id', () => {
    const bad = { ...BASE_REFRESH, run_id: 'not-uuid' };
    expect(RefreshJobDataSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects unknown triggered_by (only write worker can enqueue refresh)', () => {
    const bad = { ...BASE_REFRESH, triggered_by: 'something-else' };
    expect(RefreshJobDataSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects extra fields', () => {
    const bad = { ...BASE_REFRESH, evil: true };
    expect(RefreshJobDataSchema.safeParse(bad).success).toBe(false);
  });
});
