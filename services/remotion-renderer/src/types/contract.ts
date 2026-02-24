import { z } from 'zod';

// ── Request schema (POST /render) ──

export const renderRequestSchema = z.object({
  schemaVersion: z.string().default('1.0.0'),
  briefId: z.string().min(1, 'briefId is required'),
  executionLogId: z.number().int().min(0, 'executionLogId must be >= 0'),
  videoType: z.enum(['film_socle', 'film_gamme', 'short']),
  vertical: z.string().min(1, 'vertical is required'),
  templateId: z.string().nullish().default(null),
  composition: z.string().default('TestCard'),
  outputFormat: z.enum(['mp4', 'webm']).default('mp4'),
  resolution: z
    .object({
      width: z.number().int().positive(),
      height: z.number().int().positive(),
    })
    .default({ width: 1920, height: 1080 }),
  fps: z.number().int().min(1).max(60).default(30),
  durationSecs: z.number().positive().nullish().default(null),
});

export type RenderRequest = z.infer<typeof renderRequestSchema>;

// ── Response schema ──

export const renderResponseSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  status: z.enum(['success', 'failed']),
  outputPath: z.string().nullable(),
  durationMs: z.number().int().min(0),
  metadata: z
    .object({
      codec: z.string(),
      resolution: z.string(),
      fps: z.number(),
      fileSizeBytes: z.number(),
      remotionVersion: z.string(),
      ffmpegVersion: z.string(),
      compositionId: z.string(),
      durationSecs: z.number().nullable(),
      checksumSha256: z.string(),
    })
    .nullable(),
  errorMessage: z.string().nullable(),
  errorCode: z
    .enum([
      'INVALID_REQUEST',
      'COMPOSITION_NOT_FOUND',
      'RENDER_PROCESS_FAILED',
      'RENDER_TIMEOUT',
      'S3_UPLOAD_FAILED',
      'OUTPUT_EMPTY',
      'OUTPUT_INVALID',
    ])
    .nullable(),
});

export type RenderResponse = z.infer<typeof renderResponseSchema>;

// ── Error codes ──

export type RenderErrorCode = NonNullable<RenderResponse['errorCode']>;

// ── Health response ──

export interface HealthResponse {
  status: 'ok' | 'degraded' | 'error';
  schemaVersion: '1.0.0';
  ffmpegAvailable: boolean;
  chromiumAvailable: boolean;
  s3Connected: boolean;
  timestamp: string;
}
