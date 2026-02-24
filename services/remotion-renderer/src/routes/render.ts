import type { FastifyInstance } from 'fastify';
import { renderRequestSchema } from '../types/contract';
import type { RenderResponse, RenderErrorCode } from '../types/contract';
import { renderVideo, cleanupRenderFile } from '../lib/render-video';
import { uploadToS3 } from '../lib/s3-upload';
import { checkFfmpeg } from '../lib/ffmpeg-check';
import pino from 'pino';

const logger = pino({ name: 'RenderRoute' });

const TIMEOUT_MS = parseInt(process.env.VIDEO_REMOTION_TIMEOUT_MS ?? '120000', 10);
const MAX_CONCURRENT_RENDERS = parseInt(process.env.VIDEO_MAX_CONCURRENT_RENDERS ?? '1', 10);
let activeRenders = 0;

export async function renderRoute(app: FastifyInstance): Promise<void> {
  app.post('/render', async (request, reply) => {
    // P7e: Concurrency semaphore
    if (activeRenders >= MAX_CONCURRENT_RENDERS) {
      const busyResponse: RenderResponse = {
        schemaVersion: '1.0.0',
        status: 'failed',
        outputPath: null,
        durationMs: 0,
        metadata: null,
        errorMessage: `Renderer busy (${activeRenders}/${MAX_CONCURRENT_RENDERS} active)`,
        errorCode: 'RENDER_PROCESS_FAILED',
      };
      return reply.status(503).send(busyResponse);
    }
    activeRenders++;

    const startMs = Date.now();

    // ── Validate request ──
    const parsed = renderRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      const errorMessage = `Validation error: ${parsed.error.errors.map((e) => e.message).join(', ')}`;
      activeRenders--;
      const response: RenderResponse = {
        schemaVersion: '1.0.0',
        status: 'failed',
        outputPath: null,
        durationMs: Date.now() - startMs,
        metadata: null,
        errorMessage,
        errorCode: 'INVALID_REQUEST',
      };
      return reply.status(400).send(response);
    }

    const req = parsed.data;

    logger.info(
      {
        briefId: req.briefId,
        executionLogId: req.executionLogId,
        videoType: req.videoType,
        composition: req.composition,
      },
      'Render request received',
    );

    let localPath: string | null = null;

    try {
      // ── Render video (timeout managed inside via Remotion cancelSignal) ──
      const result = await renderVideo(req, TIMEOUT_MS);
      localPath = result.localPath;

      // ── Upload to S3 ──
      const { s3Path, fileSizeBytes } = await uploadToS3(
        localPath,
        req.briefId,
        req.executionLogId,
      );

      // ── FFmpeg version for metadata ──
      const ffmpeg = checkFfmpeg();

      const response: RenderResponse = {
        schemaVersion: '1.0.0',
        status: 'success',
        outputPath: s3Path,
        durationMs: Date.now() - startMs,
        metadata: {
          codec: result.codec,
          resolution: result.resolution,
          fps: result.fps,
          fileSizeBytes,
          remotionVersion: result.remotionVersion,
          ffmpegVersion: ffmpeg.version ?? 'unknown',
          compositionId: result.compositionId,
          durationSecs: result.durationSecs,
          checksumSha256: result.checksumSha256,
        },
        errorMessage: null,
        errorCode: null,
      };

      logger.info(
        {
          briefId: req.briefId,
          durationMs: response.durationMs,
          s3Path,
          fileSizeBytes,
        },
        'Render success',
      );

      return reply.status(200).send(response);
    } catch (err: unknown) {
      const error = err as Error & { code?: string };

      // ── Classify error ──
      let errorCode: RenderErrorCode = 'RENDER_PROCESS_FAILED';
      let httpStatus = 500;

      if (error.code === 'COMPOSITION_NOT_FOUND') {
        errorCode = 'COMPOSITION_NOT_FOUND';
        httpStatus = 400;
      } else if (error.code === 'RENDER_TIMEOUT' || error.name === 'AbortError') {
        errorCode = 'RENDER_TIMEOUT';
      } else if (error.code === 'OUTPUT_EMPTY') {
        errorCode = 'OUTPUT_EMPTY';
      } else if (error.code === 'OUTPUT_INVALID') {
        errorCode = 'OUTPUT_INVALID';
      } else if (
        error.message?.includes('S3') ||
        error.message?.includes('upload') ||
        error.message?.includes('PutObject')
      ) {
        errorCode = 'S3_UPLOAD_FAILED';
      }

      logger.error(
        {
          briefId: req.briefId,
          errorCode,
          message: error.message,
        },
        'Render failed',
      );

      const response: RenderResponse = {
        schemaVersion: '1.0.0',
        status: 'failed',
        outputPath: null,
        durationMs: Date.now() - startMs,
        metadata: null,
        errorMessage: error.message ?? 'Unknown error',
        errorCode,
      };

      return reply.status(httpStatus).send(response);
    } finally {
      activeRenders--;
      if (localPath) {
        cleanupRenderFile(localPath);
      }
    }
  });
}
