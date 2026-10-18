import { bundle } from '@remotion/bundler';
import {
  renderMedia,
  getCompositions,
  makeCancelSignal,
} from '@remotion/renderer';
import { statSync, unlinkSync, readFileSync } from 'fs';
import { execFileSync } from 'child_process';
import { createHash } from 'crypto';
import { join } from 'path';
import pino from 'pino';
import type { RenderRequest } from '../types/contract';

const logger = pino({ name: 'RenderVideo' });

let bundledEntry: string | null = null;

/**
 * Bundle the Remotion compositions entry point (cached after first call).
 */
async function getBundledEntry(): Promise<string> {
  if (bundledEntry) return bundledEntry;

  logger.info('Bundling Remotion compositions (first render is slow)...');
  const entryPoint = join(__dirname, '..', 'compositions', 'index.tsx');

  bundledEntry = await bundle({
    entryPoint,
    onProgress: (progress: number) => {
      if (progress % 25 === 0) {
        logger.info({ progress }, 'Bundle progress');
      }
    },
  });

  logger.info('Bundle complete');
  return bundledEntry;
}

export interface RenderVideoResult {
  localPath: string;
  codec: string;
  resolution: string;
  fps: number;
  fileSizeBytes: number;
  compositionId: string;
  remotionVersion: string;
  durationSecs: number | null;
  checksumSha256: string;
}

/**
 * Render a video using Remotion.
 * Returns the local file path and metadata.
 */
export async function renderVideo(
  request: RenderRequest,
  timeoutMs?: number,
): Promise<RenderVideoResult> {
  const serveUrl = await getBundledEntry();

  // P8: Merge base props with enriched compositionProps
  const inputProps = {
    briefId: request.briefId,
    executionLogId: request.executionLogId,
    videoType: request.videoType,
    vertical: request.vertical,
    ...(request.compositionProps ?? {}),
  };

  // Find the composition
  const compositions = await getCompositions(serveUrl, {
    inputProps,
  });

  const composition = compositions.find((c) => c.id === request.composition);
  if (!composition) {
    const available = compositions.map((c) => c.id).join(', ');
    throw Object.assign(
      new Error(
        `Composition '${request.composition}' not found. Available: ${available}`,
      ),
      { code: 'COMPOSITION_NOT_FOUND' },
    );
  }

  // Override resolution/fps if requested
  const width = request.resolution.width;
  const height = request.resolution.height;
  const fps = request.fps;

  const outputLocation = join(
    '/tmp/renders',
    `render-${request.executionLogId}-${Date.now()}.mp4`,
  );

  logger.info(
    {
      executionLogId: request.executionLogId,
      compositionId: composition.id,
      width,
      height,
      fps,
      outputLocation,
    },
    'Starting Remotion render',
  );

  // Setup Remotion cancel signal for timeout
  const { cancelSignal, cancel } = makeCancelSignal();
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  if (timeoutMs) {
    timeoutId = setTimeout(() => {
      cancel();
    }, timeoutMs);
  }

  try {
    await renderMedia({
      composition: {
        ...composition,
        width,
        height,
        fps,
      },
      serveUrl,
      codec: 'h264',
      outputLocation,
      browserExecutable: process.env.CHROMIUM_PATH || undefined,
      inputProps,
      onProgress: ({ progress }) => {
        if (Math.round(progress * 100) % 25 === 0) {
          logger.info({ progress: Math.round(progress * 100) }, 'Render progress');
        }
      },
      cancelSignal,
    });
  } catch (err) {
    if ((err as Error).message?.includes('cancel')) {
      throw Object.assign(new Error('Render timed out'), {
        code: 'RENDER_TIMEOUT',
      });
    }
    throw err;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }

  // Verify output
  const stats = statSync(outputLocation);
  if (stats.size === 0) {
    unlinkSync(outputLocation);
    throw Object.assign(new Error('Render produced empty file (0 bytes)'), {
      code: 'OUTPUT_EMPTY',
    });
  }

  // A probe failure must not turn an unverified output into a successful render.
  let durationSecs: number;
  try {
    const probeOut = execFileSync(
      'ffprobe',
      ['-v', 'error', '-print_format', 'json', '-show_format', outputLocation],
      { timeout: 10_000, encoding: 'utf8' },
    );
    const probeData = JSON.parse(probeOut);
    const rawDuration: unknown = probeData?.format?.duration;
    durationSecs =
      typeof rawDuration === 'number'
        ? rawDuration
        : typeof rawDuration === 'string' && /^\d+(\.\d+)?$/.test(rawDuration)
          ? Number(rawDuration)
          : NaN;
    if (!Number.isFinite(durationSecs) || durationSecs < 0.5) {
      throw new Error('Render duration is missing, invalid or below 0.5 seconds');
    }
  } catch (err) {
    // The route has no localPath until this function returns. Clean up here.
    cleanupRenderFile(outputLocation);
    logger.error({ err }, 'Render output validation failed');
    throw Object.assign(new Error('Render output could not be validated'), {
      code: 'OUTPUT_INVALID',
      cause: err,
    });
  }

  // P7b: Compute SHA256 checksum
  const checksumSha256 = createHash('sha256')
    .update(readFileSync(outputLocation))
    .digest('hex');

  // Read remotion version from package.json
  let remotionVersion = 'unknown';
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pkg = require('remotion/package.json');
    remotionVersion = pkg.version;
  } catch {
    // ignore
  }

  return {
    localPath: outputLocation,
    codec: 'h264',
    resolution: `${width}x${height}`,
    fps,
    fileSizeBytes: stats.size,
    compositionId: composition.id,
    remotionVersion,
    durationSecs,
    checksumSha256,
  };
}

/**
 * Clean up a temporary render file.
 */
export function cleanupRenderFile(localPath: string): void {
  try {
    unlinkSync(localPath);
  } catch {
    logger.warn({ localPath }, 'Failed to cleanup render file');
  }
}
