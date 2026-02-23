import { z } from 'zod';

/**
 * Schémas Zod pour la recherche RAG
 */

// Schema pour les requêtes de recherche
export const SearchRequestSchema = z.object({
  query: z.string().min(1).max(500),
  limit: z.number().int().min(1).max(50).optional().default(10),
  filters: z.record(z.unknown()).optional(),
  includeFullContent: z.boolean().optional().default(false),
});

// Schema pour un résultat de recherche
export const SearchResultSchema = z.object({
  title: z.string(),
  content: z.string(),
  sourcePath: z.string().optional(),
  source_path: z.string().optional(),
  sourceType: z.string().optional(),
  source_type: z.string().optional(),
  source_uri: z.string().optional(),
  source_ref: z.string().optional(),
  doc_family: z.string().optional(),
  category: z.string().optional(),
  docId: z.string().optional(),
  fullContent: z.string().optional(),
  score: z.number(),
  truth_level: z.string().optional(),
  verification_status: z.string().optional(),
  confidence_score: z.number().optional(),
  evidence_grade: z.string().optional(),
  collection: z.string().optional(),
  chunk_id: z.string().optional(),
  canonical_weight: z.number().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

// Schema pour les réponses de recherche
export const SearchResponseSchema = z.object({
  results: z.array(SearchResultSchema),
  query: z.string(),
  total: z.number().int(),
  response_mode: z.enum(['answer', 'partial', 'clarify']).optional(),
  needs_clarification: z.boolean().optional(),
  clarify_questions: z.array(z.string()).optional(),
  sources_citation: z.string().optional(),
  truth_metadata: z.record(z.unknown()).optional(),
});

// Types TypeScript inférés
export type SearchRequestDto = z.infer<typeof SearchRequestSchema>;
export type SearchResultDto = z.infer<typeof SearchResultSchema>;
export type SearchResponseDto = z.infer<typeof SearchResponseSchema>;
