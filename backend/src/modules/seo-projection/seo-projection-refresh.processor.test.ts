import Bull from 'bull';
import type { Job, Queue } from 'bull';
import { SeoProjectionRefreshProcessor } from './seo-projection-refresh.processor';
import { SeoProjectionWriterService } from './seo-projection-writer.service';
import {
  PROJECTION_REFRESH_JOB,
  type ProjectionRefreshJobData,
} from './seo-projection.types';

const complete = [
  { view_name: 'mv_seo_entity_facts_current', refreshed: true },
  { view_name: 'mv_seo_content_blocks_current', refreshed: true },
];

function makeWriter(
  data: unknown,
  error: { message: string } | null = null,
  readOnly = false,
) {
  const callRpc = jest.fn().mockResolvedValue({ data, error });
  const writer = Object.assign(
    Object.create(SeoProjectionWriterService.prototype),
    {
      callRpc,
      readOnly,
      log: { log: jest.fn(), error: jest.fn() },
    },
  ) as SeoProjectionWriterService;
  return { writer, callRpc };
}

const job = {
  data: { triggeredBy: 'test', runId: 'refresh-run' },
} as Job<ProjectionRefreshJobData>;

describe('refreshViews — confirmation des deux vues du contrat RPC', () => {
  it.each([complete, [...complete].reverse()])(
    'confirme les deux vues quel que soit leur ordre (%j)',
    async (...rows) => {
      const { writer, callRpc } = makeWriter(rows);
      await expect(writer.refreshViews()).resolves.toEqual({ refreshed: true });
      expect(callRpc).toHaveBeenCalledWith(
        'refresh_seo_projection_mvs',
        {},
        { source: 'internal' },
      );
    },
  );

  it.each([
    ['vide', []],
    ['absent', null],
    ['une seule vue', [complete[0]]],
    ['doublon', [complete[0], complete[0]]],
    ['vue inconnue', [complete[0], { view_name: 'unknown', refreshed: true }]],
    ['echec partiel', [complete[0], { ...complete[1], refreshed: false }]],
    ['booleen invalide', [complete[0], { ...complete[1], refreshed: 'true' }]],
    ['ligne nulle', [complete[0], null]],
  ])('refuse une confirmation %s', async (_label, data) => {
    const { writer } = makeWriter(data);
    await expect(writer.refreshViews()).resolves.toEqual({
      refreshed: false,
      error: 'incomplete projection refresh response',
    });
  });

  it('conserve une erreur RPC et respecte READ_ONLY sans appeler la DB', async () => {
    const failed = makeWriter(null, { message: 'RPC unavailable' });
    await expect(failed.writer.refreshViews()).resolves.toEqual({
      refreshed: false,
      error: 'RPC unavailable',
    });
    const skipped = makeWriter(null, null, true);
    await expect(skipped.writer.refreshViews()).resolves.toEqual({
      refreshed: false,
      error: 'READ_ONLY',
    });
    expect(skipped.callRpc).not.toHaveBeenCalled();
  });
});

describe('refresh processor — echec transmis a la file', () => {
  it('rejette une panne puis accepte un rejeu reussi', async () => {
    const refreshViews = jest
      .fn()
      .mockResolvedValueOnce({ refreshed: false, error: 'RPC unavailable' })
      .mockResolvedValueOnce({ refreshed: true });
    const processor = new SeoProjectionRefreshProcessor(
      {
        refreshViews,
      } as unknown as SeoProjectionWriterService,
      {} as Queue,
    );
    await expect(processor.handle(job)).rejects.toThrow('RPC unavailable');
    await expect(processor.handle(job)).resolves.toEqual({ refreshed: true });
    expect(refreshViews).toHaveBeenCalledTimes(2);
  });

  it('READ_ONLY reste un skip observable, sans retry de mutation', async () => {
    const { writer, callRpc } = makeWriter(null, null, true);
    await expect(
      new SeoProjectionRefreshProcessor(writer, {} as Queue).handle(job),
    ).resolves.toEqual({ refreshed: false, error: 'READ_ONLY' });
    expect(callRpc).not.toHaveBeenCalled();
  });

  it('le moteur Bull natif classe une confirmation partielle en failed, jamais completed', async () => {
    const { writer } = makeWriter([complete[0]]);
    const processor = new SeoProjectionRefreshProcessor(writer, {} as Queue);
    const moveToCompleted = jest.fn().mockResolvedValue(null);
    const moveToFailed = jest.fn().mockResolvedValue(null);
    // Exercices du moteur installe, sans Redis : seules les transitions/horloges
    // sont simulees. Ce test ne pretend pas valider la persistance Redis.
    const queue = Object.assign(Object.create(Bull.prototype), {
      handlers: {
        [PROJECTION_REFRESH_JOB]: (input: Job<ProjectionRefreshJobData>) =>
          processor.handle(input),
      },
      timers: { set: jest.fn(), clear: jest.fn() },
      settings: { lockRenewTime: 1000 },
      emit: jest.fn(),
    });
    await queue.processJob(
      {
        ...job,
        name: PROJECTION_REFRESH_JOB,
        opts: {},
        moveToCompleted,
        moveToFailed,
      },
      true,
    );
    expect(moveToCompleted).not.toHaveBeenCalled();
    expect(moveToFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining(
          'incomplete projection refresh response',
        ),
      }),
    );
  });
});
