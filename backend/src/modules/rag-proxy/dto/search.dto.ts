import { z } from 'zod';

/**
 * Schémas Zod pour la recherche RAG
 */

// Schema pour les requêtes de recherche
export const SearchRequestSchema = z.object({
  query: z.string().min(1).max(500),
  limit: z.number().int().min(1).max(50).optional().default(10),
  filters: z.record(z.unknown()).optional(),
});

// Schema pour un résultat de recherche
export const SearchResultSchema = z.object({
  title: z.string(),
  content: z.string(),
  sourcePath: z.string(),
  sourceType: z.string(),
  category: z.string(),
  score: z.number(),
});

// Schema pour les réponses de recherche
export const SearchResponseSchema = z.object({
  results: z.array(SearchResultSchema),
  query: z.string(),
  total: z.number().int(),
});

// Types TypeScript inférés
export type SearchRequestDto = z.infer<typeof SearchRequestSchema>;
export type SearchResultDto = z.infer<typeof SearchResultSchema>;
export type SearchResponseDto = z.infer<typeof SearchResponseSchema>;
