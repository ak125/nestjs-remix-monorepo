import { z } from "zod";
import { mediaInspectionSchema } from "../lib/media-inspection";

// ── Request schema (POST /render) ──

export const renderRequestSchema = z.object({
  schemaVersion: z.string().default("1.0.0"),
  briefId: z.string().min(1, "briefId is required"),
  executionLogId: z.number().int().min(0, "executionLogId must be >= 0"),
  videoType: z.enum(["film_socle", "film_gamme", "short"]),
  vertical: z.string().min(1, "vertical is required"),
  templateId: z.string().nullish().default(null),
  composition: z.string().min(1),
  compositionProps: z.record(z.unknown()).nullish().default(null), // P8
  outputFormat: z.literal("mp4").default("mp4"),
  resolution: z
    .object({
      width: z.number().int().positive(),
      height: z.number().int().positive(),
    })
    .optional(),
  fps: z.number().int().min(1).max(60).optional(),
  durationSecs: z.number().positive().nullish().default(null),
});

// Production requests must supply content; Studio demo defaults are not evidence.
export function validateCompositionProps(
  composition: string,
  props: unknown,
): void {
  const text = z.string().trim().min(1);
  const common = { cta: text, disclaimer: text };
  let schema: z.ZodTypeAny | undefined;
  switch (composition) {
    case "NeChangePasTropVite":
      schema = z.object({
        ...common,
        hook: text,
        symptom: text,
        pieceWrong: text,
        advice: text,
        causes: z
          .array(z.object({ cause: text, check_suggestion: text.optional() }))
          .length(3),
      });
      break;
    case "SymptomeTroisCauses":
      schema = z.object({
        ...common,
        symptom: text,
        causes: z
          .array(
            z.object({
              cause: text,
              sign: text.optional(),
              check: text.optional(),
            }),
          )
          .length(3),
      });
      break;
    case "PieceExpliquee":
      schema = z.object({
        ...common,
        piece: text,
        pieceFunction: text,
        location: text,
        whenToChange: text,
        wearSigns: z
          .array(
            z.object({
              sign: text,
              severity: z.enum(["low", "medium", "high"]).optional(),
            }),
          )
          .min(1)
          .max(3),
      });
      break;
    case "ShortBrakingFact":
      schema = z.object({
        factText: text,
        factValue: text,
        factUnit: text,
        sourceRef: text,
      });
      break;
  }
  if (!schema) return; // Composition existence is checked against Remotion itself.
  const result = schema.safeParse(props);
  if (!result.success) {
    throw Object.assign(
      new Error(
        result.error.issues
          .map(
            (issue) =>
              `compositionProps.${issue.path.join(".")}: ${issue.message}`,
          )
          .join("; "),
      ),
      { code: "INVALID_REQUEST" },
    );
  }
}

export type RenderRequest = z.infer<typeof renderRequestSchema>;

// ── Response schema ──

export const renderResponseSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  status: z.enum(["success", "failed"]),
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
      inspection: mediaInspectionSchema,
    })
    .nullable(),
  errorMessage: z.string().nullable(),
  errorCode: z
    .enum([
      "INVALID_REQUEST",
      "COMPOSITION_NOT_FOUND",
      "RENDER_PROCESS_FAILED",
      "RENDER_TIMEOUT",
      "S3_UPLOAD_FAILED",
      "OUTPUT_EMPTY",
      "OUTPUT_INVALID",
    ])
    .nullable(),
});

export type RenderResponse = z.infer<typeof renderResponseSchema>;

// ── Error codes ──

export type RenderErrorCode = NonNullable<RenderResponse["errorCode"]>;

// ── Health response ──

export interface HealthResponse {
  status: "ok" | "degraded" | "error";
  schemaVersion: "1.0.0";
  ffmpegAvailable: boolean;
  chromiumAvailable: boolean;
  s3Connected: boolean;
  timestamp: string;
}
