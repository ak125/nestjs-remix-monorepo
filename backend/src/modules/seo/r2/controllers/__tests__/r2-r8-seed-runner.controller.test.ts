/**
 * ADR-072 PR 2D-3 — R2R8SeedRunnerController unit tests.
 *
 * Validates payload parsing (Zod), idempotency key shape, runId UUID guard,
 * actor extraction from req.user, and orchestrator delegation.
 */

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { R2R8SeedRunnerController } from '../r2-r8-seed-runner.controller';

function makeController() {
  const acceptMock = jest.fn();
  const getRunMock = jest.fn();
  const orchestrator = {
    accept: acceptMock,
    getRun: getRunMock,
  };
  const controller = new R2R8SeedRunnerController(orchestrator as never);
  return { controller, acceptMock, getRunMock };
}

const validIdempotencyKey = 'pr-2e-seed-20260516-abc123';
const validRunId = '550e8400-e29b-41d4-a716-446655440000';

describe('R2R8SeedRunnerController', () => {
  describe('POST /run', () => {
    it('delegates to orchestrator and returns 202 payload', async () => {
      const { controller, acceptMock } = makeController();
      acceptMock.mockResolvedValueOnce({
        runId: validRunId,
        status: 'pending',
        idempotentHit: false,
        acceptedAt: '2026-05-16T14:00:00Z',
        dryRun: false,
      });
      const req = {
        user: { id_utilisateur: 1, email: 'alice@example.com' },
      } as never;
      const response = await controller.run(
        { idempotencyKey: validIdempotencyKey, dryRun: false },
        req,
      );
      expect(response.runId).toBe(validRunId);
      expect(acceptMock).toHaveBeenCalledTimes(1);
      expect(acceptMock.mock.calls[0][0]).toMatchObject({
        idempotencyKey: validIdempotencyKey,
        dryRun: false,
      });
      expect(acceptMock.mock.calls[0][1]).toBe('alice@example.com');
    });

    it('rejects missing idempotencyKey', async () => {
      const { controller } = makeController();
      const req = {
        user: { id_utilisateur: 1, email: 'alice@example.com' },
      } as never;
      await expect(
        controller.run({ dryRun: false }, req),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects too-short idempotencyKey', async () => {
      const { controller } = makeController();
      const req = {
        user: { id_utilisateur: 1, email: 'alice@example.com' },
      } as never;
      await expect(
        controller.run({ idempotencyKey: 'short', dryRun: false }, req),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects forbidden characters in idempotencyKey', async () => {
      const { controller } = makeController();
      const req = {
        user: { id_utilisateur: 1, email: 'alice@example.com' },
      } as never;
      await expect(
        controller.run({ idempotencyKey: 'bad key!@#', dryRun: false }, req),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects out-of-bound batchSize', async () => {
      const { controller } = makeController();
      const req = {
        user: { id_utilisateur: 1, email: 'alice@example.com' },
      } as never;
      await expect(
        controller.run(
          {
            idempotencyKey: validIdempotencyKey,
            dryRun: false,
            batchSize: 99_999,
          },
          req,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('falls back to admin:unknown when req.user empty', async () => {
      const { controller, acceptMock } = makeController();
      acceptMock.mockResolvedValueOnce({
        runId: validRunId,
        status: 'pending',
        idempotentHit: false,
        acceptedAt: '2026-05-16T14:00:00Z',
        dryRun: false,
      });
      const req = {} as never;
      await controller.run(
        { idempotencyKey: validIdempotencyKey, dryRun: false },
        req,
      );
      expect(acceptMock.mock.calls[0][1]).toBe('admin:unknown');
    });
  });

  describe('GET /run/:runId', () => {
    it('rejects non-UUID runId', async () => {
      const { controller } = makeController();
      await expect(controller.getRun('not-a-uuid')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('throws 404 when runId not found', async () => {
      const { controller, getRunMock } = makeController();
      getRunMock.mockResolvedValueOnce(null);
      await expect(controller.getRun(validRunId)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('returns the AdminJobRow when found', async () => {
      const { controller, getRunMock } = makeController();
      const fakeRow = {
        jobId: validRunId,
        jobType: 'r8_seed_run',
        idempotencyKey: validIdempotencyKey,
        status: 'completed',
        input: {},
        result: { totalSeeded: 42 },
        error: null,
        actor: 'alice@example.com',
        traceId: null,
        acceptedAt: '2026-05-16T14:00:00Z',
        startedAt: '2026-05-16T14:00:05Z',
        finishedAt: '2026-05-16T14:01:00Z',
      };
      getRunMock.mockResolvedValueOnce(fakeRow);
      const result = await controller.getRun(validRunId);
      expect(result).toBe(fakeRow);
    });
  });
});
