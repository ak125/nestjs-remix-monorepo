import { z } from 'zod';

/**
 * Enum pour les types de configuration
 */
export enum ConfigType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  JSON = 'json',
  ARRAY = 'array',
}

/**
 * Schéma Zod pour la création d'une configuration
 */
export const CreateConfigSchema = z.object({
  key: z
    .string()
    .min(2, 'La clé doit contenir au moins 2 caractères')
    .max(100, 'La clé ne peut pas dépasser 100 caractères')
    .regex(
      /^[a-zA-Z][a-zA-Z0-9_.-]*$/,
      'La clé doit commencer par une lettre et contenir uniquement des lettres, chiffres, _, . et -',
    ),

  value: z.any(),

  type: z.nativeEnum(ConfigType),

  description: z
    .string()
    .max(500, 'La description ne peut pas dépasser 500 caractères')
    .optional(),

  category: z
    .string()
    .regex(
      /^[a-zA-Z][a-zA-Z0-9_-]*$/,
      'La catégorie doit commencer par une lettre et contenir uniquement des lettres, chiffres, _ et -',
    )
    .max(50, 'La catégorie ne peut pas dépasser 50 caractères')
    .optional(),

  isPublic: z.boolean().default(false),
  isReadOnly: z.boolean().default(false),
});

/**
 * Schéma Zod pour la mise à jour d'une configuration
 */
export const UpdateConfigSchema = z
  .object({
    value: z.any().optional(),

    type: z.nativeEnum(ConfigType).optional(),

    description: z
      .string()
      .max(500, 'La description ne peut pas dépasser 500 caractères')
      .optional(),

    category: z
      .string()
      .regex(
        /^[a-zA-Z][a-zA-Z0-9_-]*$/,
        'La catégorie doit commencer par une lettre et contenir uniquement des lettres, chiffres, _ et -',
      )
      .max(50, 'La catégorie ne peut pas dépasser 50 caractères')
      .optional(),

    isPublic: z.boolean().optional(),
    isReadOnly: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Au moins un champ doit être fourni pour la mise à jour',
  });

/**
 * Schéma Zod pour les paramètres de requête de configuration
 */
export const ConfigQuerySchema = z.object({
  category: z.string().optional(),
  type: z.nativeEnum(ConfigType).optional(),
  publicOnly: z
    .union([z.boolean(), z.string()])
    .transform((val) => {
      if (typeof val === 'string') {
        return val === 'true';
      }
      return val;
    })
    .optional(),
  search: z.string().optional(),
  limit: z
    .union([z.number(), z.string()])
    .transform((val) => {
      const num = typeof val === 'string' ? parseInt(val, 10) : val;
      return isNaN(num) ? 20 : Math.min(Math.max(num, 1), 100);
    })
    .optional(),
  offset: z
    .union([z.number(), z.string()])
    .transform((val) => {
      const num = typeof val === 'string' ? parseInt(val, 10) : val;
      return isNaN(num) ? 0 : Math.max(num, 0);
    })
    .optional(),
});

/**
 * Schéma pour un élément de configuration complet
 */
export const ConfigItemSchema = z.object({
  key: z.string(),
  value: z.any(),
  type: z.nativeEnum(ConfigType),
  description: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  isPublic: z.boolean(),
  isReadOnly: z.boolean(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

// Types TypeScript dérivés des schémas Zod
export type CreateConfigDto = z.infer<typeof CreateConfigSchema>;
export type UpdateConfigDto = z.infer<typeof UpdateConfigSchema>;
export type ConfigQueryDto = z.infer<typeof ConfigQuerySchema>;
export type ConfigItemDto = z.infer<typeof ConfigItemSchema>;

// Export des schémas pour utilisation dans les pipes de validation
export {
  CreateConfigSchema as CreateConfigDtoSchema,
  UpdateConfigSchema as UpdateConfigDtoSchema,
  ConfigQuerySchema as ConfigQueryDtoSchema,
  ConfigItemSchema as ConfigItemDtoSchema,
};
