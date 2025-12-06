import { z } from 'zod';

export const ContentTypeSchema = z.enum([
  'generic',
  'product_description',
  'seo_meta',
  'marketing_copy',
  'blog_article',
  'social_media',
  'email_campaign',
]);

export type ContentType = z.infer<typeof ContentTypeSchema>;

export const ToneSchema = z.enum([
  'professional',
  'casual',
  'friendly',
  'technical',
  'persuasive',
  'informative',
]);

export type Tone = z.infer<typeof ToneSchema>;

export const GenerateContentSchema = z.object({
  type: ContentTypeSchema,
  prompt: z.string().min(10).max(2000),
  tone: ToneSchema.optional().default('professional'),
  language: z.string().optional().default('fr'),
  maxLength: z.number().min(50).max(5000).optional().default(500),
  context: z.record(z.any()).optional(),
  temperature: z.number().min(0).max(2).optional().default(0.7),
  useCache: z.boolean().optional().default(true),
});

export type GenerateContentDto = z.infer<typeof GenerateContentSchema>;

export const GenerateProductDescriptionSchema = z.object({
  productName: z.string().min(1),
  category: z.string().optional(),
  features: z.array(z.string()).optional(),
  specifications: z.record(z.any()).optional(),
  targetAudience: z.string().optional(),
  tone: ToneSchema.optional().default('professional'),
  language: z.string().optional().default('fr'),
  length: z.enum(['short', 'medium', 'long']).optional().default('medium'),
});

export type GenerateProductDescriptionDto = z.infer<
  typeof GenerateProductDescriptionSchema
>;

export const GenerateSEOMetaSchema = z.object({
  pageTitle: z.string().min(1),
  pageUrl: z.string().url().optional(),
  keywords: z.array(z.string()).optional(),
  targetKeyword: z.string().optional(),
  businessType: z.string().optional(),
  language: z.string().optional().default('fr'),
});

export type GenerateSEOMetaDto = z.infer<typeof GenerateSEOMetaSchema>;

export const ContentResponseSchema = z.object({
  id: z.string(),
  type: ContentTypeSchema,
  content: z.string(),
  metadata: z.object({
    generatedAt: z.date(),
    cached: z.boolean(),
    tokens: z.number().optional(),
    model: z.string(),
    language: z.string(),
  }),
});

export type ContentResponse = z.infer<typeof ContentResponseSchema>;

export const BatchGenerateContentSchema = z.object({
  requests: z.array(GenerateContentSchema).min(1).max(10),
});

export type BatchGenerateContentDto = z.infer<
  typeof BatchGenerateContentSchema
>;
