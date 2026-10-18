import { execFileSync } from "child_process";
import { readFileSync, statSync } from "fs";
import { createHash } from "crypto";
import { z } from "zod";

export interface MediaExpectation {
  codec?: "h264" | "h265";
  width?: number;
  height?: number;
  fps?: number;
  durationSecs?: number;
  frames?: number;
  audio?: "required" | "forbidden" | "optional";
  audioCodec?: "aac";
}

export const mediaInspectionSchema = z.object({
  checksumSha256: z.string().regex(/^[a-f0-9]{64}$/),
  fileSizeBytes: z.number().int().positive(),
  durationSecs: z.number().finite().positive(),
  video: z.object({
    codec: z.enum(["h264", "h265"]),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    fps: z.number().finite().positive(),
    frames: z.number().int().positive(),
    durationSecs: z.number().finite().positive(),
  }),
  audio: z.array(
    z.object({
      codec: z.string().min(1),
      channels: z.number().int().positive(),
      sampleRate: z.number().int().positive(),
      durationSecs: z.number().finite().positive(),
    }),
  ),
});
export type MediaInspection = z.infer<typeof mediaInspectionSchema>;

const streamSchema = z.object({
  codec_type: z.string(),
  codec_name: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  avg_frame_rate: z.string().optional(),
  nb_frames: z.unknown(),
  duration: z.unknown(),
  start_time: z.unknown(),
  channels: z.number().optional(),
  sample_rate: z.unknown(),
  disposition: z.object({ attached_pic: z.number().optional() }).optional(),
});
const probeSchema = z.object({
  format: z.object({ format_name: z.string(), duration: z.unknown() }),
  streams: z.array(streamSchema),
});

function numeric(value: unknown): number {
  const result =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^-?\d+(?:\.\d+)?$/.test(value)
        ? Number(value)
        : NaN;
  if (!Number.isFinite(result))
    throw new Error("Missing or invalid media measurement");
  return result;
}

function positiveInteger(value: unknown): number {
  const n = numeric(value);
  if (!Number.isSafeInteger(n) || n <= 0)
    throw new Error("Invalid media integer");
  return n;
}

function frameRate(value: string | undefined): number {
  if (!value || !/^\d+\/\d+$/.test(value))
    throw new Error("Invalid frame rate");
  const [numerator, denominator] = value.split("/").map(Number);
  const fps = numerator / denominator;
  if (!Number.isFinite(fps) || fps <= 0) throw new Error("Invalid frame rate");
  return fps;
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Inspect the local MP4, then bind measurements to unchanged file bytes. */
export function inspectVideo(
  path: string,
  expected: MediaExpectation = {},
): MediaInspection {
  const bytes = readFileSync(path);
  if (bytes.length === 0 || bytes.length !== statSync(path).size)
    throw new Error("Empty or changing media file");
  const checksumSha256 = sha256(bytes);
  const probe = probeSchema.parse(
    JSON.parse(
      execFileSync(
        "ffprobe",
        [
          "-v",
          "error",
          "-print_format",
          "json",
          "-show_format",
          "-show_streams",
          path,
        ],
        { timeout: 10_000, encoding: "utf8" },
      ),
    ),
  );
  if (!probe.format.format_name.split(",").includes("mp4"))
    throw new Error("Expected MP4 container");
  const videos = probe.streams.filter((s) => s.codec_type === "video");
  const audios = probe.streams.filter((s) => s.codec_type === "audio");
  if (
    videos.length !== 1 ||
    videos[0].disposition?.attached_pic === 1 ||
    audios.length > 1 ||
    probe.streams.length !== videos.length + audios.length
  )
    throw new Error("Unexpected media streams");
  const v = videos[0];
  const codec = v.codec_name === "hevc" ? "h265" : v.codec_name;
  if (codec !== "h264" && codec !== "h265")
    throw new Error("Unsupported video codec");
  const fps = frameRate(v.avg_frame_rate);
  const width = positiveInteger(v.width);
  const height = positiveInteger(v.height);
  const frames = positiveInteger(v.nb_frames);
  const durationSecs = numeric(probe.format.duration);
  const videoDuration = numeric(v.duration);
  const frameTolerance = 1 / fps + 0.000001;
  // Allow AAC packet padding, but reject materially missing or delayed tracks.
  const audioTolerance = Math.max(0.1, 2 / fps);
  if (
    durationSecs < 0.5 ||
    videoDuration < 0.5 ||
    Math.abs(videoDuration - durationSecs) > audioTolerance ||
    Math.abs(frames / fps - videoDuration) > frameTolerance ||
    Math.abs(numeric(v.start_time)) > frameTolerance
  )
    throw new Error("Inconsistent video timing");
  if (
    (expected.codec !== undefined && codec !== expected.codec) ||
    (expected.width !== undefined && width !== expected.width) ||
    (expected.height !== undefined && height !== expected.height) ||
    (expected.fps !== undefined && Math.abs(fps - expected.fps) > 0.000001) ||
    (expected.frames !== undefined && frames !== expected.frames) ||
    (expected.durationSecs !== undefined &&
      Math.abs(videoDuration - expected.durationSecs) > frameTolerance)
  ) {
    throw new Error("Video does not match the expected render");
  }
  if (
    (expected.audio === "required" && audios.length !== 1) ||
    (expected.audio === "forbidden" && audios.length !== 0)
  )
    throw new Error("Unexpected audio presence");
  const audio = audios.map((a) => {
    if (
      !a.codec_name ||
      a.codec_name === "unknown" ||
      (expected.audioCodec !== undefined &&
        a.codec_name !== expected.audioCodec)
    )
      throw new Error("Unexpected audio codec");
    const duration = numeric(a.duration);
    if (
      duration <= 0 ||
      Math.abs(duration - videoDuration) > audioTolerance ||
      Math.abs(numeric(a.start_time)) > audioTolerance
    )
      throw new Error("Inconsistent audio timing");
    return {
      codec: a.codec_name,
      channels: positiveInteger(a.channels),
      sampleRate: positiveInteger(a.sample_rate),
      durationSecs: duration,
    };
  });
  if (sha256(readFileSync(path)) !== checksumSha256)
    throw new Error("Media changed during inspection");
  return {
    checksumSha256,
    fileSizeBytes: bytes.length,
    durationSecs,
    video: { codec, width, height, fps, frames, durationSecs: videoDuration },
    audio,
  };
}
