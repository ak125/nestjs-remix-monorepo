/**
 * POST /postprocess — FFmpeg post-processing route.
 *
 * Takes a rendered video S3 key, applies variants (resize, loudnorm, audio merge).
 * Uploads each variant back to S3. Returns variant metadata.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createReadStream, statSync, existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import pino from 'pino';
import {
  resizeVideo,
  normalizeAudio,
  mergeAudio,
  generateSrt,
  writeSrtFile,
  cleanupPostprocessFiles,
  type VariantSpec,
  type SubtitleSegment,
} from '../lib/ffmpeg-postprocess';
import { uploadToS3Generic } from '../lib/s3-upload';

const logger = pino({ name: 'PostprocessRoute' });

const TIMEOUT_MS = parseInt(process.env.POSTPROCESS_TIMEOUT_MS ?? '300000', 10);

// ── Request schema ──

const variantSpecSchema = z.object({
  name: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  codec: z.enum(['h264', 'h265']).default('h264'),
});

const subtitleSegmentSchema = z.object({
  startSecs: z.number().min(0),
  endSecs: z.number().min(0),
  text: z.string(),
});

const postprocessRequestSchema = z.object({
  briefId: z.string().min(1),
  executionLogId: z.number().int().min(0),
  inputS3Key: z.string().min(1),
  audioS3Key: z.string().nullish(),
  variants: z.array(variantSpecSchema).min(1),
  normalizeLoudness: z.boolean().default(true),
  loudnessTarget: z.number().default(-14),
  subtitleSegments: z.array(subtitleSegmentSchema).nullish(),
});

type PostprocessRequest = z.infer<typeof postprocessRequestSchema>;

// ── Response ──

interface VariantResult {
  name: string;
  s3Path: string;
  codec: string;
  resolution: string;
  fileSizeBytes: number;
  durationSecs: number | null;
}

interface PostprocessResponse {
  status: 'success' | 'failed';
  variants: VariantResult[];
  srtS3Path: string | null;
  totalDurationMs: number;
  errorMessage: string | null;
}

export async function postprocessRoute(app: FastifyInstance): Promise<void> {
  app.post('/postprocess', async (request, reply) => {
    const startMs = Date.now();

    // Validate
    const parsed = postprocessRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      const response: PostprocessResponse = {
        status: 'failed',
        variants: [],
        srtS3Path: null,
        totalDurationMs: Date.now() - startMs,
        errorMessage: `Validation error: ${parsed.error.errors.map((e) => e.message).join(', ')}`,
      };
      return reply.status(400).send(response);
    }

    const req = parsed.data;
    const filesToCleanup: string[] = [];

    try {
      // Download source video from S3
      const inputLocalPath = await downloadFromS3(req.inputS3Key, `input-${req.executionLogId}`);
      filesToCleanup.push(inputLocalPath);

      // Download audio if provided (for film_socle/film_gamme audio merge)
      let mergedPath = inputLocalPath;
      if (req.audioS3Key) {
        const audioLocalPath = await downloadFromS3(req.audioS3Key, `audio-${req.executionLogId}`);
        filesToCleanup.push(audioLocalPath);
        mergedPath = mergeAudio(inputLocalPath, audioLocalPath, `exec-${req.executionLogId}`);
        filesToCleanup.push(mergedPath);
      }

      // Normalize loudness if requested
      let processedPath = mergedPath;
      if (req.normalizeLoudness) {
        processedPath = normalizeAudio(mergedPath, req.loudnessTarget, `exec-${req.executionLogId}`);
        if (processedPath !== mergedPath) {
          filesToCleanup.push(processedPath);
        }
      }

      // Generate variants
      const variants: VariantResult[] = [];

      for (const variantSpec of req.variants) {
        const result = resizeVideo(processedPath, variantSpec, `exec-${req.executionLogId}`);
        filesToCleanup.push(result.localPath);

        // Upload variant to S3
        const s3Path = await uploadVariant(
          result.localPath,
          req.briefId,
          req.executionLogId,
          variantSpec.name,
        );

        variants.push({
          name: result.name,
          s3Path,
          codec: result.codec,
          resolution: result.resolution,
          fileSizeBytes: result.fileSizeBytes,
          durationSecs: result.durationSecs,
        });
      }

      // Generate SRT if subtitle segments provided
      let srtS3Path: string | null = null;
      if (req.subtitleSegments && req.subtitleSegments.length > 0) {
        const srtContent = generateSrt(req.subtitleSegments);
        const srtLocalPath = writeSrtFile(srtContent, `exec-${req.executionLogId}`);
        filesToCleanup.push(srtLocalPath);
        srtS3Path = await uploadSrt(srtLocalPath, req.briefId, req.executionLogId);
      }

      const response: PostprocessResponse = {
        status: 'success',
        variants,
        srtS3Path,
        totalDurationMs: Date.now() - startMs,
        errorMessage: null,
      };

      logger.info(
        {
          briefId: req.briefId,
          variantCount: variants.length,
          totalDurationMs: response.totalDurationMs,
        },
        'Postprocess success',
      );

      return reply.status(200).send(response);
    } catch (err) {
      const error = err as Error;

      logger.error(
        { briefId: req.briefId, error: error.message },
        'Postprocess failed',
      );

      const response: PostprocessResponse = {
        status: 'failed',
        variants: [],
        srtS3Path: null,
        totalDurationMs: Date.now() - startMs,
        errorMessage: error.message ?? 'Unknown postprocess error',
      };

      return reply.status(500).send(response);
    } finally {
      cleanupPostprocessFiles(filesToCleanup);
    }
  });
}

// ── S3 helpers ──

async function downloadFromS3(s3Key: string, prefix: string): Promise<string> {
  // Extract bucket and key from s3://bucket/key format
  const match = s3Key.match(/^s3:\/\/([^/]+)\/(.+)$/);
  if (!match) {
    throw new Error(`Invalid S3 key format: ${s3Key}`);
  }

  const bucket = match[1];
  const key = match[2];
  const ext = key.endsWith('.mp3') ? '.mp3' : '.mp4';
  const localPath = join('/tmp/postprocess', `${prefix}${ext}`);

  execSync(`mkdir -p /tmp/postprocess`);

  // Use AWS CLI or MinIO client to download
  const endpoint = process.env.S3_ENDPOINT;
  const endpointFlag = endpoint ? `--endpoint-url ${endpoint}` : '';

  execSync(
    `aws s3 cp "s3://${bucket}/${key}" "${localPath}" ${endpointFlag}`,
    { timeout: 60_000, stdio: 'pipe' },
  );

  if (!existsSync(localPath) || statSync(localPath).size === 0) {
    throw new Error(`Failed to download from S3: ${s3Key}`);
  }

  return localPath;
}

async function uploadVariant(
  localPath: string,
  briefId: string,
  executionLogId: number,
  variantName: string,
): Promise<string> {
  return uploadToS3Generic(
    localPath,
    `renders/${briefId}/${executionLogId}/variants/${variantName}.mp4`,
    'video/mp4',
  );
}

async function uploadSrt(
  localPath: string,
  briefId: string,
  executionLogId: number,
): Promise<string> {
  return uploadToS3Generic(
    localPath,
    `renders/${briefId}/${executionLogId}/subtitles.srt`,
    'text/plain',
  );
}
