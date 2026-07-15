import { z } from 'zod';

const SLOT_IDS = [
  'HERO_IMAGE',
  'S2_SYMPTOM_IMAGE',
  'S3_SCHEMA_IMAGE',
  'S4D_SCHEMA_IMAGE',
] as const;

// B5 (ADR-059 §Fermeture) — GenerateImagePromptsDto removed with the R3 image-prompt
// generation endpoints. Only the curation query DTO remains.
export const ImagePromptQueryDto = z.object({
  status: z.enum(['pending', 'approved', 'exported', 'superseded']).optional(),
  slot_id: z.enum(SLOT_IDS).optional(),
  pg_alias: z.string().optional(),
  selected_only: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ImagePromptQuery = z.infer<typeof ImagePromptQueryDto>;
