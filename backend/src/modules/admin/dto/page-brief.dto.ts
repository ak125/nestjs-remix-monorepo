import { z } from 'zod';

export const PageRoleEnum = z.enum(['R1', 'R3_guide', 'R3_conseils', 'R4']);

export const CreatePageBriefDto = z.object({
  pgAlias: z.string().min(1),
  pageRole: PageRoleEnum,
  primaryIntent: z.string().min(10).max(500),
  secondaryIntents: z.array(z.string().min(5)).max(10).default([]),
  anglesObligatoires: z.array(z.string().min(5)).max(10).default([]),
  forbiddenOverlap: z.array(z.string().min(5)).max(10).default([]),
  faqPaa: z.array(z.string().min(10)).max(10).default([]),
  termesTechniques: z.array(z.string().min(2)).max(20).default([]),
  preuves: z.array(z.string().min(5)).max(10).default([]),
  keywordsPrimary: z.string().optional(),
  keywordsSecondary: z.array(z.string()).max(20).default([]),
  writingConstraints: z.array(z.string().min(5)).max(10).default([]),
});

export type CreatePageBriefInput = z.infer<typeof CreatePageBriefDto>;

export const UpdatePageBriefDto = z.object({
  primaryIntent: z.string().min(10).max(500).optional(),
  secondaryIntents: z.array(z.string().min(5)).max(10).optional(),
  anglesObligatoires: z.array(z.string().min(5)).max(10).optional(),
  forbiddenOverlap: z.array(z.string().min(5)).max(10).optional(),
  faqPaa: z.array(z.string().min(10)).max(10).optional(),
  termesTechniques: z.array(z.string().min(2)).max(20).optional(),
  preuves: z.array(z.string().min(5)).max(10).optional(),
  keywordsPrimary: z.string().optional(),
  keywordsSecondary: z.array(z.string()).max(20).optional(),
  writingConstraints: z.array(z.string().min(5)).max(10).optional(),
});

export type UpdatePageBriefInput = z.infer<typeof UpdatePageBriefDto>;

export const ValidatePageBriefsDto = z.object({
  briefIds: z.array(z.number().int().positive()).min(1).max(4),
});

export type ValidatePageBriefsInput = z.infer<typeof ValidatePageBriefsDto>;

export const ListPageBriefsQueryDto = z.object({
  pgAlias: z.string().optional(),
  pageRole: PageRoleEnum.optional(),
  status: z.enum(['draft', 'validated', 'active', 'archived']).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ListPageBriefsQuery = z.infer<typeof ListPageBriefsQueryDto>;
