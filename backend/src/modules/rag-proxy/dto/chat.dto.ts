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

// Schema pour les réponses de chat
export const ChatResponseSchema = z.object({
  answer: z.string(),
  sources: z.array(z.string()),
  sessionId: z.string(),
  confidence: z.number().min(0).max(1),
});

// Types TypeScript inférés
export type ChatRequestDto = z.infer<typeof ChatRequestSchema>;
export type ChatResponseDto = z.infer<typeof ChatResponseSchema>;
