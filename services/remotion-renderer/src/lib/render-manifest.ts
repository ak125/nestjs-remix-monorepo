import { z } from "zod";
import { inspectVideo } from "./media-inspection";

const manifestSchema = z.object({
  manifestVersion: z.literal("1.0.0"),
  briefId: z.string().min(1),
  voice: z.boolean(),
  composition: z.object({
    id: z.string().min(1),
    engine: z.literal("remotion"),
    resolution: z.object({
      width: z.number().int().positive(),
      height: z.number().int().positive(),
    }),
    fps: z.number().finite().positive(),
    durationFrames: z.number().int().positive(),
    durationSecs: z.number().finite().positive(),
    codec: z.enum(["h264", "h265"]),
    muted: z.boolean(),
  }),
  artifact: z.object({
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    bytes: z.number().int().positive(),
  }),
  approvalBinding: z
    .object({ boundSha256: z.string().regex(/^[a-f0-9]{64}$/) })
    .optional(),
});

/** Read-only technical binding. Never grants content/render/publication approval. */
export function verifyRenderManifest(manifest: unknown, mediaPath: string) {
  const m = manifestSchema.parse(manifest);
  const c = m.composition;
  if (
    (m.voice && c.muted) ||
    Math.abs(c.durationFrames / c.fps - c.durationSecs) > 0.000001
  ) {
    throw new Error("Inconsistent manifest composition");
  }
  const inspection = inspectVideo(mediaPath, {
    codec: c.codec,
    width: c.resolution.width,
    height: c.resolution.height,
    fps: c.fps,
    frames: c.durationFrames,
    durationSecs: c.durationSecs,
    audio: c.muted ? "forbidden" : "required",
    audioCodec: "aac",
  });
  if (
    inspection.checksumSha256 !== m.artifact.sha256 ||
    inspection.fileSizeBytes !== m.artifact.bytes ||
    (m.approvalBinding &&
      m.approvalBinding.boundSha256 !== inspection.checksumSha256)
  ) {
    throw new Error("Manifest does not bind this exact media file");
  }
  return {
    status: "TECHNICAL_MATCH" as const,
    briefId: m.briefId,
    compositionId: c.id,
    inspection,
    humanReview: "NOT_ASSESSED" as const,
  };
}
