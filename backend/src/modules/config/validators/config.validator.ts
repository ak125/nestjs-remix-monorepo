import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import {
  CreateConfigDto,
  UpdateConfigDto,
  ConfigType,
} from '../dto/config.dto';

export interface ValidationResult {
  isValid: boolean;
  errors?: string[];
  data?: any;
}

@Injectable()
export class ConfigValidator {
  // Schémas Zod pour la validation
  private readonly createConfigSchema = z.object({
    key: z
      .string()
      .regex(/^[a-zA-Z][a-zA-Z0-9_.-]*$/, {
        message:
          'La clé doit commencer par une lettre et contenir uniquement des lettres, chiffres, _, . et -',
      })
      .min(2, 'La clé doit contenir au moins 2 caractères')
      .max(100, 'La clé ne peut pas dépasser 100 caractères'),

    value: z.any(),

    type: z.nativeEnum(ConfigType),

    description: z
      .string()
      .max(500, 'La description ne peut pas dépasser 500 caractères')
      .optional(),

    category: z
      .string()
      .regex(/^[a-zA-Z][a-zA-Z0-9_-]*$/, {
        message:
          'La catégorie doit commencer par une lettre et contenir uniquement des lettres, chiffres, _ et -',
      })
      .max(50, 'La catégorie ne peut pas dépasser 50 caractères')
      .optional(),

    isPublic: z.boolean().optional(),
    isReadOnly: z.boolean().optional(),
  });

  private readonly updateConfigSchema = z
    .object({
      value: z.any().optional(),

      type: z.nativeEnum(ConfigType).optional(),

      description: z
        .string()
        .max(500, 'La description ne peut pas dépasser 500 caractères')
        .optional(),

      category: z
        .string()
        .regex(/^[a-zA-Z][a-zA-Z0-9_-]*$/, {
          message:
            'La catégorie doit commencer par une lettre et contenir uniquement des lettres, chiffres, _ et -',
        })
        .max(50, 'La catégorie ne peut pas dépasser 50 caractères')
        .optional(),

      isPublic: z.boolean().optional(),
      isReadOnly: z.boolean().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'Au moins un champ doit être fourni pour la mise à jour',
    });

  async validateCreateConfig(dto: CreateConfigDto): Promise<ValidationResult> {
    try {
      const validatedData = this.createConfigSchema.parse(dto);

      // Validation spécifique selon le type
      const typeValidation = this.validateValueByType(dto.value, dto.type);
      if (!typeValidation.isValid) {
        return typeValidation;
      }

      return { isValid: true, data: validatedData };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.issues.map((issue) => issue.message);
        return { isValid: false, errors };
      }
      return { isValid: false, errors: ['Erreur de validation inconnue'] };
    }
  }

  async validateUpdateConfig(dto: UpdateConfigDto): Promise<ValidationResult> {
    try {
      const validatedData = this.updateConfigSchema.parse(dto);

      // Validation spécifique selon le type si fourni
      if (dto.type && dto.value !== undefined) {
        const typeValidation = this.validateValueByType(dto.value, dto.type);
        if (!typeValidation.isValid) {
          return typeValidation;
        }
      }

      return { isValid: true, data: validatedData };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.issues.map((issue) => issue.message);
        return { isValid: false, errors };
      }
      return { isValid: false, errors: ['Erreur de validation inconnue'] };
    }
  }

  validateValueByType(value: any, type: ConfigType): ValidationResult {
    switch (type) {
      case ConfigType.STRING:
        if (typeof value !== 'string') {
          return {
            isValid: false,
            errors: ['La valeur doit être une chaîne de caractères'],
          };
        }
        if (value.length > 10000) {
          return {
            isValid: false,
            errors: ['La valeur string ne peut pas dépasser 10000 caractères'],
          };
        }
        break;

      case ConfigType.NUMBER:
        const numValue = Number(value);
        if (isNaN(numValue) || !isFinite(numValue)) {
          return {
            isValid: false,
            errors: ['La valeur doit être un nombre valide'],
          };
        }
        break;

      case ConfigType.BOOLEAN:
        if (
          typeof value !== 'boolean' &&
          value !== 'true' &&
          value !== 'false' &&
          value !== true &&
          value !== false
        ) {
          return {
            isValid: false,
            errors: ['La valeur doit être un booléen (true/false)'],
          };
        }
        break;

      case ConfigType.JSON:
        try {
          if (typeof value === 'string') {
            JSON.parse(value);
          } else if (typeof value !== 'object') {
            return {
              isValid: false,
              errors: ['La valeur doit être un JSON valide'],
            };
          }
        } catch {
          return {
            isValid: false,
            errors: ['La valeur doit être un JSON valide'],
          };
        }
        break;

      case ConfigType.ARRAY:
        try {
          let arrayValue = value;
          if (typeof value === 'string') {
            arrayValue = JSON.parse(value);
          }
          if (!Array.isArray(arrayValue)) {
            return {
              isValid: false,
              errors: ['La valeur doit être un tableau'],
            };
          }
        } catch {
          return {
            isValid: false,
            errors: ['La valeur doit être un tableau valide'],
          };
        }
        break;

      default:
        return {
          isValid: false,
          errors: ['Type de configuration non supporté'],
        };
    }

    return { isValid: true };
  }

  validateConfigKey(key: string): ValidationResult {
    const keySchema = z
      .string()
      .regex(/^[a-zA-Z][a-zA-Z0-9_.-]*$/)
      .min(2)
      .max(100);

    try {
      keySchema.parse(key);
      return { isValid: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          isValid: false,
          errors: [error.issues[0]?.message || 'Clé invalide'],
        };
      }
      return { isValid: false, errors: ['Clé invalide'] };
    }
  }

  validateConfigCategory(category: string): ValidationResult {
    const categorySchema = z
      .string()
      .regex(/^[a-zA-Z][a-zA-Z0-9_-]*$/)
      .max(50);

    try {
      categorySchema.parse(category);
      return { isValid: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          isValid: false,
          errors: [error.issues[0]?.message || 'Catégorie invalide'],
        };
      }
      return { isValid: false, errors: ['Catégorie invalide'] };
    }
  }
}
