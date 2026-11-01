/**
 * FFmpeg Post-Processing — Resize, normalize audio, merge audio, generate SRT.
 *
 * Operations applied after Remotion render to produce format variants.
 * Uses ffmpeg/ffprobe already available in the renderer container.
 */

import { execFileSync, spawnSync } from "child_process";
import {
  existsSync,
  writeFileSync,
  unlinkSync,
  mkdtempSync,
  rmdirSync,
} from "fs";
import { join, dirname, basename } from "path";
import { tmpdir } from "os";
import pino from "pino";
import { inspectVideo, type MediaInspection } from "./media-inspection";

const logger = pino({ name: "FFmpegPostprocess" });

const TEMP_PREFIX = "automecanik-postprocess-";

export interface VariantSpec {
  name: string;
  width: number;
  height: number;
  codec: "h264" | "h265";
}

export interface PostprocessResult {
  name: string;
  localPath: string;
  codec: string;
  resolution: string;
  fileSizeBytes: number;
  durationSecs: number;
  inspection: MediaInspection;
}

/** Allocate a private directory atomically; request names cannot escape it. */
export function createPostprocessPath(filename: string): string {
  if (
    !filename ||
    /[\\/\x00]/.test(filename) ||
    filename === "." ||
    filename === ".."
  ) {
    throw new Error("Invalid postprocess filename");
  }
  return join(mkdtempSync(join(tmpdir(), TEMP_PREFIX)), filename);
}

/**
 * Resize a video to a given resolution.
 */
export function resizeVideo(
  inputPath: string,
  variant: VariantSpec,
  outputSuffix: string,
  audioRequired?: boolean,
): PostprocessResult {
  const source = inspectVideo(inputPath, {
    audio:
      audioRequired === undefined
        ? "optional"
        : audioRequired
          ? "required"
          : "forbidden",
  });
  const outputPath = createPostprocessPath(
    `${outputSuffix}-${variant.name}.mp4`,
  );

  const codecFlag = variant.codec === "h265" ? "libx265" : "libx264";

  // Scale with pad to maintain aspect ratio (letterbox/pillarbox)
  const filterComplex = `scale=${variant.width}:${variant.height}:force_original_aspect_ratio=decrease,pad=${variant.width}:${variant.height}:(ow-iw)/2:(oh-ih)/2:color=black`;

  const cmd = [
    "ffmpeg",
    "-y",
    "-i",
    inputPath,
    "-vf",
    filterComplex,
    "-c:v",
    codecFlag,
    "-preset",
    "medium",
    "-crf",
    "23",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
    outputPath,
  ];

  logger.info(
    { variant: variant.name, resolution: `${variant.width}x${variant.height}` },
    "Resizing video",
  );

  try {
    execFileSync(cmd[0], cmd.slice(1), { timeout: 300_000, stdio: "pipe" });
    const inspection = inspectVideo(outputPath, {
      codec: variant.codec,
      width: variant.width,
      height: variant.height,
      fps: source.video.fps,
      durationSecs: source.video.durationSecs,
      frames: source.video.frames,
      audio: source.audio.length ? "required" : "forbidden",
      audioCodec: "aac",
    });
    return {
      name: variant.name,
      localPath: outputPath,
      codec: inspection.video.codec,
      resolution: `${inspection.video.width}x${inspection.video.height}`,
      fileSizeBytes: inspection.fileSizeBytes,
      durationSecs: inspection.durationSecs,
      inspection,
    };
  } catch (error) {
    cleanupPostprocessFiles([outputPath]);
    throw error;
  }
}

export interface AudioNormalizationResult {
  status: "normalized" | "skipped_no_audio";
  localPath: string;
  targetLufs: number;
  measuredInputLufs: number | null;
  measuredOutputLufs: number | null;
}

function loudnormReport(args: string[]): Record<string, number> {
  const process = spawnSync("ffmpeg", args, {
    timeout: 120_000,
    encoding: "utf8",
  });
  if (process.error || process.status !== 0) {
    throw new Error(
      `Audio normalization failed: ${process.error?.message ?? process.stderr}`,
    );
  }
  const reports = process.stderr.match(/\{[^{}]*\}/g);
  if (!reports?.length) throw new Error("Missing loudnorm measurements");
  const report = JSON.parse(reports[reports.length - 1]);
  const measured: Record<string, number> = {};
  for (const key of [
    "input_i",
    "input_tp",
    "input_lra",
    "input_thresh",
    "target_offset",
    "output_i",
  ]) {
    if (
      report[key] === undefined ||
      report[key] === null ||
      report[key] === ""
    ) {
      throw new Error(`Missing loudnorm measurement: ${key}`);
    }
    measured[key] = Number(report[key]);
    if (!Number.isFinite(measured[key]))
      throw new Error(`Invalid loudnorm measurement: ${key}`);
  }
  return measured;
}

/** Normalize only measured audio; absence and failure are distinct outcomes. */
export function normalizeAudio(
  inputPath: string,
  targetLufs: number,
  outputSuffix: string,
): AudioNormalizationResult {
  if (!Number.isFinite(targetLufs) || targetLufs < -70 || targetLufs > -5) {
    throw new Error("Invalid loudness target");
  }
  const source = inspectVideo(inputPath);
  if (!source.audio.length) {
    return {
      status: "skipped_no_audio",
      localPath: inputPath,
      targetLufs,
      measuredInputLufs: null,
      measuredOutputLufs: null,
    };
  }
  const outputPath = createPostprocessPath(`${outputSuffix}-normalized.mp4`);
  try {
    const measured = loudnormReport([
      "-y",
      "-i",
      inputPath,
      "-map",
      "0:a:0",
      "-af",
      `loudnorm=I=${targetLufs}:TP=-1.5:LRA=11:print_format=json`,
      "-f",
      "null",
      "-",
    ]);
    const filter = `loudnorm=I=${targetLufs}:TP=-1.5:LRA=11:measured_I=${measured.input_i}:measured_TP=${measured.input_tp}:measured_LRA=${measured.input_lra}:measured_thresh=${measured.input_thresh}:offset=${measured.target_offset}:linear=true:print_format=json`;
    loudnormReport([
      "-y",
      "-i",
      inputPath,
      "-map",
      "0:v:0",
      "-map",
      "0:a:0",
      "-af",
      filter,
      "-c:v",
      "copy",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      outputPath,
    ]);
    inspectVideo(outputPath, {
      width: source.video.width,
      height: source.video.height,
      fps: source.video.fps,
      frames: source.video.frames,
      durationSecs: source.video.durationSecs,
      audio: "required",
      audioCodec: "aac",
    });
    // Measure the encoded result, not the requested target or pre-encoding filter estimate.
    const output = loudnormReport([
      "-y",
      "-i",
      outputPath,
      "-map",
      "0:a:0",
      "-af",
      `loudnorm=I=${targetLufs}:TP=-1.5:LRA=11:print_format=json`,
      "-f",
      "null",
      "-",
    ]);
    return {
      status: "normalized",
      localPath: outputPath,
      targetLufs,
      measuredInputLufs: measured.input_i,
      measuredOutputLufs: output.input_i,
    };
  } catch (error) {
    cleanupPostprocessFiles([outputPath]);
    throw error;
  }
}

/** Preserve the complete video and require an explicit choice of audio treatment. */
export function mergeAudio(
  videoPath: string,
  audioPath: string,
  outputSuffix: string,
  mode: "replace" | "mix",
): string {
  if (mode !== "replace" && mode !== "mix")
    throw new Error("Explicit audio merge mode required");
  const source = inspectVideo(videoPath, {
    audio: mode === "mix" ? "required" : "optional",
  });
  const outputPath = createPostprocessPath(`${outputSuffix}-merged.mp4`);
  const duration = source.video.durationSecs;
  const filter =
    mode === "mix"
      ? `[0:a:0][1:a:0]amix=inputs=2:duration=longest:normalize=0,apad,atrim=duration=${duration}[audio]`
      : `[1:a:0]apad,atrim=duration=${duration}[audio]`;
  try {
    execFileSync(
      "ffmpeg",
      [
        "-y",
        "-i",
        videoPath,
        "-i",
        audioPath,
        "-filter_complex",
        filter,
        "-map",
        "0:v:0",
        "-map",
        "[audio]",
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-t",
        String(duration),
        "-movflags",
        "+faststart",
        outputPath,
      ],
      { timeout: 120_000, stdio: "pipe" },
    );
    inspectVideo(outputPath, {
      width: source.video.width,
      height: source.video.height,
      fps: source.video.fps,
      frames: source.video.frames,
      durationSecs: duration,
      audio: "required",
      audioCodec: "aac",
    });
    return outputPath;
  } catch (error) {
    cleanupPostprocessFiles([outputPath]);
    throw error;
  }
}

/**
 * Generate SRT subtitles from text segments.
 */
export interface SubtitleSegment {
  startSecs: number;
  endSecs: number;
  text: string;
}

/** Validate a single sequential subtitle track at SRT millisecond precision. */
export function validateSubtitleSegments(
  segments: SubtitleSegment[],
  durationSecs?: number,
): void {
  if (
    durationSecs !== undefined &&
    (!Number.isFinite(durationSecs) || durationSecs <= 0)
  ) {
    throw new Error("Invalid subtitle media duration");
  }
  let previousEnd = 0;
  for (const [index, segment] of segments.entries()) {
    const startMs = Math.round(segment.startSecs * 1000);
    const endMs = Math.round(segment.endSecs * 1000);
    const text = segment.text.replace(/\r\n?/g, "\n").trim();
    if (
      !Number.isFinite(segment.startSecs) ||
      !Number.isFinite(segment.endSecs) ||
      !Number.isSafeInteger(startMs) ||
      !Number.isSafeInteger(endMs) ||
      segment.startSecs < 0 ||
      segment.endSecs <= segment.startSecs ||
      endMs <= startMs ||
      segment.startSecs < previousEnd
    ) {
      throw new Error(`Invalid subtitle interval at segment ${index + 1}`);
    }
    if (
      !text ||
      /\n[^\S\n]*\n/.test(text) ||
      /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(text)
    ) {
      throw new Error(`Invalid subtitle text at segment ${index + 1}`);
    }
    // No tolerance: even the rounded SRT endpoint must fit the measured file.
    if (
      durationSecs !== undefined &&
      (segment.endSecs > durationSecs ||
        endMs > Math.floor(durationSecs * 1000))
    ) {
      throw new Error(`Subtitle segment ${index + 1} exceeds media duration`);
    }
    previousEnd = segment.endSecs;
  }
}

export function generateSrt(segments: SubtitleSegment[]): string {
  validateSubtitleSegments(segments);
  return segments
    .map((seg, i) => {
      const start = formatSrtTime(seg.startSecs);
      const end = formatSrtTime(seg.endSecs);
      return `${i + 1}\n${start} --> ${end}\n${seg.text.replace(/\r\n?/g, "\n").trim()}\n`;
    })
    .join("\n");
}

function formatSrtTime(secs: number): string {
  // Round once before splitting units so 59.9996 becomes 00:01:00,000.
  const totalMs = Math.round(secs * 1000);
  const h = Math.floor(totalMs / 3_600_000);
  const m = Math.floor((totalMs % 3_600_000) / 60_000);
  const s = Math.floor((totalMs % 60_000) / 1000);
  const ms = totalMs % 1000;
  return `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)},${pad(ms, 3)}`;
}

function pad(n: number, width: number): string {
  return n.toString().padStart(width, "0");
}

/**
 * Write SRT to a file.
 */
export function writeSrtFile(srtContent: string, outputSuffix: string): string {
  const outputPath = createPostprocessPath(`${outputSuffix}.srt`);
  try {
    writeFileSync(outputPath, srtContent, {
      encoding: "utf-8",
      flag: "wx",
      mode: 0o600,
    });
    return outputPath;
  } catch (error) {
    cleanupPostprocessFiles([outputPath]);
    throw error;
  }
}

/**
 * Cleanup temporary files.
 */
export function cleanupPostprocessFiles(paths: string[]): void {
  for (const p of paths) {
    try {
      if (existsSync(p)) unlinkSync(p);
      const directory = dirname(p);
      // Remove only our empty, private artifact directory; never recurse.
      if (
        dirname(directory) === tmpdir() &&
        basename(directory).startsWith(TEMP_PREFIX)
      ) {
        rmdirSync(directory);
      }
    } catch {
      logger.warn({ path: p }, "Failed to cleanup postprocess file");
    }
  }
}
