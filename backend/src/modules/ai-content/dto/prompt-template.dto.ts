import { z } from 'zod';

export const CreatePromptTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  category: z.string().optional(),
  systemPrompt: z.string().min(10),
  userPromptTemplate: z.string().min(10),
  variables: z
    .array(
      z.object({
        name: z.string(),
        type: z.enum(['string', 'number', 'boolean', 'array', 'object']),
        required: z.boolean().default(false),
        defaultValue: z.any().optional(),
        description: z.string().optional(),
      }),
    )
    .optional(),
  defaultSettings: z
    .object({
      temperature: z.number().min(0).max(2).optional(),
      maxLength: z.number().optional(),
      tone: z.string().optional(),
    })
    .optional(),
  tags: z.array(z.string()).optional(),
});

export type CreatePromptTemplateDto = z.infer<
  typeof CreatePromptTemplateSchema
>;

export const UpdatePromptTemplateSchema = CreatePromptTemplateSchema.partial();

export type UpdatePromptTemplateDto = z.infer<
  typeof UpdatePromptTemplateSchema
>;

export interface PromptTemplate {
  id: string;
  name: string;
  description?: string;
  category?: string;
  systemPrompt: string;
  userPromptTemplate: string;
  variables?: Array<{
    name: string;
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    required: boolean;
    defaultValue?: any;
    description?: string;
  }>;
  defaultSettings?: {
    temperature?: number;
    maxLength?: number;
    tone?: string;
  };
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
  usageCount?: number;
}
