import { z } from 'zod';

export const PdfIngestSingleRequestSchema = z.object({
  pdfPath: z.string().min(1).max(2048),
  truthLevel: z.enum(['L1', 'L2', 'L3', 'L4']).optional().default('L2'),
  maxRetries: z.number().int().min(0).max(5).optional().default(1),
  timeoutSeconds: z.number().int().min(60).max(86400).optional().default(1800),
});

export const PdfIngestRunResponseSchema = z.object({
  jobId: z.string(),
  status: z.string(),
  pid: z.number().int().nullable().optional(),
  logPath: z.string().optional(),
  inputDir: z.string(),
  stagedPdfPath: z.string(),
});

export const PdfIngestJobStatusResponseSchema = z.object({
  jobId: z.string(),
  status: z.string(),
  pid: z.number().int().nullable().optional(),
  startedAt: z.number().int().nullable().optional(),
  finishedAt: z.number().int().nullable().optional(),
  returnCode: z.number().int().nullable().optional(),
  logPath: z.string().optional(),
  logTail: z.array(z.string()).optional(),
});

export type PdfIngestSingleRequestDto = z.infer<
  typeof PdfIngestSingleRequestSchema
>;
export type PdfIngestRunResponseDto = z.infer<
  typeof PdfIngestRunResponseSchema
>;
export type PdfIngestJobStatusResponseDto = z.infer<
  typeof PdfIngestJobStatusResponseSchema
>;
