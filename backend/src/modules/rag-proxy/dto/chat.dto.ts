import { z } from 'zod';

/**
 * Schémas Zod pour le chat RAG
 */

// Schema pour les requêtes de chat
export const ChatRequestSchema = z.object({
  message: z.string().min(1).max(2000),
  sessionId: z.string().optional(),
  context: z.record(z.unknown()).optional(),
});

// Schema pour les réponses de chat (v2 — guardrails + classification)
export const ChatResponseSchema = z.object({
  answer: z.string(),
  sources: z.array(z.string()),
  sessionId: z.string(),
  confidence: z.number().min(0).max(1),
  // V2 fields
  citations: z.array(z.string()).optional(),
  queryType: z
    .enum(['on_topic', 'off_topic', 'ambiguous'])
    .nullable()
    .optional(),
  passedGuardrails: z.boolean().optional(),
  refusalReason: z.string().nullable().optional(),
  responseMode: z.enum(['answer', 'partial', 'clarify']).optional(),
  needsClarification: z.boolean().optional(),
  clarifyQuestions: z.array(z.string()).optional(),
  sourcesCitation: z.string().optional(),
  truthMetadata: z.record(z.unknown()).optional(),
});

// Types TypeScript inférés
export type ChatRequestDto = z.infer<typeof ChatRequestSchema>;
export type ChatResponseDto = z.infer<typeof ChatResponseSchema>;
