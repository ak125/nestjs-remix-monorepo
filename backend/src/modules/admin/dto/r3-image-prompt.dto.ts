import { z } from 'zod';

const SLOT_IDS = [
  'HERO_IMAGE',
  'S2_SYMPTOM_IMAGE',
  'S3_SCHEMA_IMAGE',
  'S4D_SCHEMA_IMAGE',
] as const;

export const GenerateImagePromptsDto = z.object({
  pgAliases: z.array(z.string().min(1)).min(1).max(50),
  force: z.boolean().optional().default(false),
  slotsFilter: z.array(z.enum(SLOT_IDS)).optional(),
});

export type GenerateImagePromptsInput = z.infer<typeof GenerateImagePromptsDto>;

export const ImagePromptQueryDto = z.object({
  status: z.enum(['pending', 'approved', 'exported', 'superseded']).optional(),
  slot_id: z.enum(SLOT_IDS).optional(),
  pg_alias: z.string().optional(),
  selected_only: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ImagePromptQuery = z.infer<typeof ImagePromptQueryDto>;
