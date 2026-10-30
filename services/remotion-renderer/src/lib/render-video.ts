import { bundle } from "@remotion/bundler";
import {
  renderMedia,
  getCompositions,
  makeCancelSignal,
} from "@remotion/renderer";
import { statSync, unlinkSync } from "fs";
import { inspectVideo, type MediaInspection } from "./media-inspection";
import { join } from "path";
import pino from "pino";
import {
  validateCompositionProps,
  type RenderRequest,
} from "../types/contract";

const logger = pino({ name: "RenderVideo" });

let bundledEntry: string | null = null;

/**
 * Bundle the Remotion compositions entry point (cached after first call).
 */
async function getBundledEntry(): Promise<string> {
  if (bundledEntry) return bundledEntry;

  logger.info("Bundling Remotion compositions (first render is slow)...");
  const entryPoint = join(__dirname, "..", "compositions", "index.tsx");

  bundledEntry = await bundle({
    entryPoint,
    onProgress: (progress: number) => {
      if (progress % 25 === 0) {
        logger.info({ progress }, "Bundle progress");
      }
    },
  });

  logger.info("Bundle complete");
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
  inspection: MediaInspection;
}

/**
 * Render a video using Remotion.
 * Returns the local file path and metadata.
 */
export async function renderVideo(
  request: RenderRequest,
  timeoutMs?: number,
): Promise<RenderVideoResult> {
  validateCompositionProps(request.composition, request.compositionProps);
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
    const available = compositions.map((c) => c.id).join(", ");
    throw Object.assign(
      new Error(
        `Composition '${request.composition}' not found. Available: ${available}`,
      ),
      { code: "COMPOSITION_NOT_FOUND" },
    );
  }

  // Timelines are authored in frames. Resizing belongs to explicit postprocessing.
  const width = request.resolution?.width ?? composition.width;
  const height = request.resolution?.height ?? composition.height;
  const fps = request.fps ?? composition.fps;
  if (
    width !== composition.width ||
    height !== composition.height ||
    fps !== composition.fps
  ) {
    throw Object.assign(
      new Error("resolution and fps must match the selected composition"),
      { code: "INVALID_REQUEST" },
    );
  }

  const outputLocation = join(
    "/tmp/renders",
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
    "Starting Remotion render",
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
      codec: "h264",
      outputLocation,
      browserExecutable: process.env.CHROMIUM_PATH || undefined,
      inputProps,
      onProgress: ({ progress }) => {
        if (Math.round(progress * 100) % 25 === 0) {
          logger.info(
            { progress: Math.round(progress * 100) },
            "Render progress",
          );
        }
      },
      cancelSignal,
    });
  } catch (err) {
    if ((err as Error).message?.includes("cancel")) {
      throw Object.assign(new Error("Render timed out"), {
        code: "RENDER_TIMEOUT",
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
    throw Object.assign(new Error("Render produced empty file (0 bytes)"), {
      code: "OUTPUT_EMPTY",
    });
  }

  let inspection: MediaInspection;
  try {
    inspection = inspectVideo(outputLocation, {
      codec: "h264",
      width,
      height,
      fps,
      frames: composition.durationInFrames,
      durationSecs: request.durationSecs ?? composition.durationInFrames / fps,
      audio: request.compositionProps?.audioUrl ? "required" : "forbidden",
      audioCodec: "aac",
    });
  } catch (err) {
    cleanupRenderFile(outputLocation);
    logger.error({ err }, "Render output validation failed");
    throw Object.assign(new Error("Render output could not be validated"), {
      code: "OUTPUT_INVALID",
      cause: err,
    });
  }

  // Read remotion version from package.json
  let remotionVersion = "unknown";
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pkg = require("remotion/package.json");
    remotionVersion = pkg.version;
  } catch {
    // ignore
  }

  return {
    localPath: outputLocation,
    codec: inspection.video.codec,
    resolution: `${inspection.video.width}x${inspection.video.height}`,
    fps: inspection.video.fps,
    fileSizeBytes: stats.size,
    compositionId: composition.id,
    remotionVersion,
    durationSecs: inspection.durationSecs,
    checksumSha256: inspection.checksumSha256,
    inspection,
  };
}

/**
 * Clean up a temporary render file.
 */
export function cleanupRenderFile(localPath: string): void {
  try {
    unlinkSync(localPath);
  } catch {
    logger.warn({ localPath }, "Failed to cleanup render file");
  }
}
