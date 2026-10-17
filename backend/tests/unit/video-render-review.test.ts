import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import { VideoJobService } from '../../src/modules/media-factory/services/video-job.service';

const version = '2026-10-14T10:00:00.000Z';
const hash = 'a'.repeat(64);
const body = {
  action: 'add',
  expectedReviewRevision: 0,
  expectedRenderHash: hash,
  expectedProductionVersion: version,
  startFrame: 900,
  endFrame: 990,
  target: 'CTA',
  preserve: 'Logo et avertissement',
  request: 'Allonger la lecture',
};
describe('render review persistence contract (offline PostgREST)', () => {
  let rows: Record<number, any>;
  let service: VideoJobService;
  let client: ReturnType<typeof createClient>;
  let failWrite: boolean;
  const makeService = () => {
    const instance = new VideoJobService(
      {
        get: (k: string) =>
          k === 'SUPABASE_URL' ? 'https://unit.invalid' : 'unit-key',
      } as ConfigService,
      {} as never,
      {} as never,
      {} as never,
    );
    Object.defineProperty(instance, 'client', { get: () => client });
    return instance;
  };
  beforeEach(() => {
    rows = {
      1: {
        id: 1,
        brief_id: 'pilot',
        status: 'completed',
        engine_name: 'remotion',
        render_status: 'success',
        render_output_path: 'local/pilot.mp4',
        render_metadata: {
          checksumSha256: hash,
          productionVersion: version,
          fps: 30,
          durationSecs: 38,
          unrelated: 'preserved',
        },
      },
    };
    failWrite = false;
    client = createClient('https://unit.invalid', 'unit-key', {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: async (url, init) => {
          const query = new URL(String(url)).searchParams;
          const writing = init?.method === 'PATCH';
          if (writing && failWrite)
            return new Response(JSON.stringify({ code: '42703' }), {
              status: 400,
            });
          const row = rows[Number(query.get('id')?.slice(3))];
          const matches =
            row &&
            [...query].every(([key, filter]) => {
              if (key === 'select') return true;
              const value = key
                .split(/->>?/)
                .reduce((value, key) => value?.[key], row);
              return filter === 'is.null'
                ? value == null
                : String(value) === filter.slice(3);
            });
          if (writing && matches)
            Object.assign(row, JSON.parse(String(init!.body)));
          return new Response(JSON.stringify(matches ? [row] : []), {
            status: 200,
          });
        },
      },
    });
    service = makeService();
    jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('Network forbidden'));
  });
  afterEach(() => jest.restoreAllMocks());

  it('persists exact binding and session author across a new service instance', async () => {
    await service.mutateRenderReview(1, body, 'session-user');
    const review = await makeService().getRenderReview(1);
    expect(review.revision).toBe(1);
    expect(review.comments[0]).toMatchObject({
      authorId: 'session-user',
      status: 'open',
      binding: {
        executionLogId: 1,
        renderHash: hash,
        productionVersion: version,
      },
      startFrame: 900,
      endFrame: 990,
      target: 'CTA',
    });
    expect(rows[1].render_metadata.unrelated).toBe('preserved');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
  it.each([
    { expectedRenderHash: 'b'.repeat(64) },
    { expectedProductionVersion: '2026-10-14T11:00:00Z' },
    { expectedReviewRevision: 1 },
  ])('rejects stale binding %p', async (change) => {
    await expect(
      service.mutateRenderReview(1, { ...body, ...change }, 'session-user'),
    ).rejects.toMatchObject({ status: 409 });
    expect(rows[1].render_metadata.review).toBeUndefined();
  });
  it.each([
    { authorId: 'forged' },
    { startFrame: -1 },
    { endFrame: 1141 },
    { startFrame: 1.5 },
    { endFrame: 900 },
    { request: '' },
  ])('rejects invalid feedback %p', async (change) => {
    await expect(
      service.mutateRenderReview(1, { ...body, ...change }, 'session-user'),
    ).rejects.toMatchObject({ status: 400 });
  });
  it('requires a real session identity', async () => {
    await expect(service.mutateRenderReview(1, body, '')).rejects.toMatchObject(
      { status: 403 },
    );
  });
  it('rejects historical media with no known production version', async () => {
    delete rows[1].render_metadata.productionVersion;
    await expect(
      service.mutateRenderReview(1, body, 'session-user'),
    ).rejects.toMatchObject({ status: 409 });
  });
  it('does not lose a concurrent comment', async () => {
    const results = await Promise.allSettled([
      service.mutateRenderReview(1, body, 'one'),
      service.mutateRenderReview(1, body, 'two'),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toEqual([
      expect.objectContaining({
        reason: expect.objectContaining({ status: 409 }),
      }),
    ]);
    expect(rows[1].render_metadata.review.comments).toHaveLength(1);
  });
  it('keeps the old interval after cuts and explicitly repositions to a new render', async () => {
    const original = await service.mutateRenderReview(1, body, 'one');
    rows[2] = {
      ...structuredClone(rows[1]),
      id: 2,
      render_output_path: 'local/cut.mp4',
      render_metadata: {
        checksumSha256: 'b'.repeat(64),
        productionVersion: '2026-10-14T11:00:00Z',
        fps: 30,
        durationSecs: 5,
      },
    };
    const moved = await service.mutateRenderReview(
      2,
      {
        ...body,
        expectedRenderHash: 'b'.repeat(64),
        expectedProductionVersion: '2026-10-14T11:00:00Z',
        sourceExecutionId: 1,
        sourceCommentId: original.comments[0].id,
        startFrame: 30,
        endFrame: 90,
      },
      'two',
    );
    expect(moved.comments[0].source).toMatchObject({
      executionLogId: 1,
      commentId: original.comments[0].id,
      startFrame: 900,
      endFrame: 990,
    });
    expect((await service.getRenderReview(1)).comments[0]).toEqual(
      original.comments[0],
    );
    expect(moved.comments[0].status).toBe('open');
  });
  it('rejects cross-production repositioning', async () => {
    const old = await service.mutateRenderReview(1, body, 'one');
    rows[2] = {
      ...structuredClone(rows[1]),
      id: 2,
      brief_id: 'other',
      render_metadata: { ...rows[1].render_metadata, review: undefined },
    };
    await expect(
      service.mutateRenderReview(
        2,
        { ...body, sourceExecutionId: 1, sourceCommentId: old.comments[0].id },
        'two',
      ),
    ).rejects.toMatchObject({ status: 409 });
  });
  it('only resolves explicitly with the current review revision', async () => {
    const added = await service.mutateRenderReview(1, body, 'one');
    const resolved = await service.mutateRenderReview(
      1,
      {
        action: 'resolve',
        expectedReviewRevision: 1,
        expectedRenderHash: hash,
        expectedProductionVersion: version,
        commentId: added.comments[0].id,
      },
      'two',
    );
    expect(resolved.comments[0]).toMatchObject({
      status: 'resolved',
      updatedBy: 'two',
    });
    expect(rows[1].status).toBe('completed');
  });
  it('reports storage failure without claiming persistence', async () => {
    failWrite = true;
    await expect(
      service.mutateRenderReview(1, body, 'one'),
    ).rejects.toMatchObject({ status: 503 });
    expect(rows[1].render_metadata.review).toBeUndefined();
  });
});
