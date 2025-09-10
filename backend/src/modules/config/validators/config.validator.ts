import { Injectable } from '@nestjs/common';
import * as Joi from 'joi';
import { CreateConfigDto, UpdateConfigDto, ConfigType } from '../dto/config.dto';

export interface ValidationResult {
  isValid: boolean;
  errors?: string[];
}

@Injectable()
export class ConfigValidator {
  private readonly createConfigSchema = Joi.object({
    key: Joi.string()
      .pattern(/^[a-zA-Z][a-zA-Z0-9_.-]*$/)
      .min(2)
      .max(100)
      .required()
      .messages({
        'string.pattern.base': 'La clé doit commencer par une lettre et contenir uniquement des lettres, chiffres, _, . et -',
        'string.min': 'La clé doit contenir au moins 2 caractères',
        'string.max': 'La clé ne peut pas dépasser 100 caractères',
        'any.required': 'La clé est obligatoire',
      }),

    value: Joi.any().required().messages({
      'any.required': 'La valeur est obligatoire',
    }),

    type: Joi.string()
      .valid(...Object.values(ConfigType))
      .required()
      .messages({
        'any.only': 'Le type doit être: string, number, boolean, json ou array',
        'any.required': 'Le type est obligatoire',
      }),

    description: Joi.string()
      .max(500)
      .optional()
      .messages({
        'string.max': 'La description ne peut pas dépasser 500 caractères',
      }),

    category: Joi.string()
      .pattern(/^[a-zA-Z][a-zA-Z0-9_-]*$/)
      .max(50)
      .optional()
      .messages({
        'string.pattern.base': 'La catégorie doit commencer par une lettre et contenir uniquement des lettres, chiffres, _ et -',
        'string.max': 'La catégorie ne peut pas dépasser 50 caractères',
      }),

    isPublic: Joi.boolean().optional(),
    isReadOnly: Joi.boolean().optional(),
  });

  private readonly updateConfigSchema = Joi.object({
    value: Joi.any().optional(),

    type: Joi.string()
      .valid(...Object.values(ConfigType))
      .optional()
      .messages({
        'any.only': 'Le type doit être: string, number, boolean, json ou array',
      }),

    description: Joi.string()
      .max(500)
      .allow('')
      .optional()
      .messages({
        'string.max': 'La description ne peut pas dépasser 500 caractères',
      }),

    category: Joi.string()
      .pattern(/^[a-zA-Z][a-zA-Z0-9_-]*$/)
      .max(50)
      .allow('')
      .optional()
      .messages({
        'string.pattern.base': 'La catégorie doit commencer par une lettre et contenir uniquement des lettres, chiffres, _ et -',
        'string.max': 'La catégorie ne peut pas dépasser 50 caractères',
      }),

    isPublic: Joi.boolean().optional(),
    isReadOnly: Joi.boolean().optional(),
  }).min(1).messages({
    'object.min': 'Au moins un champ doit être fourni pour la mise à jour',
  });

  async validateCreateConfig(dto: CreateConfigDto): Promise<ValidationResult> {
    try {
      await this.createConfigSchema.validateAsync(dto, { abortEarly: false });

      // Validation spécifique selon le type
      const typeValidation = this.validateValueByType(dto.value, dto.type);
      if (!typeValidation.isValid) {
        return typeValidation;
      }

      return { isValid: true };
    } catch (error) {
      if (error.isJoi) {
        const errors = error.details.map((detail: any) => detail.message);
        return { isValid: false, errors };
      }
      return { isValid: false, errors: ['Erreur de validation inconnue'] };
    }
  }

  async validateUpdateConfig(dto: UpdateConfigDto): Promise<ValidationResult> {
    try {
      await this.updateConfigSchema.validateAsync(dto, { abortEarly: false });

      // Validation spécifique selon le type si fourni
      if (dto.type && dto.value !== undefined) {
        const typeValidation = this.validateValueByType(dto.value, dto.type);
        if (!typeValidation.isValid) {
          return typeValidation;
        }
      }

      return { isValid: true };
    } catch (error) {
      if (error.isJoi) {
        const errors = error.details.map((detail: any) => detail.message);
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
        if (typeof value !== 'boolean' && 
            value !== 'true' && 
            value !== 'false' && 
            value !== true && 
            value !== false) {
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
        } catch (error) {
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
        } catch (error) {
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
    const keySchema = Joi.string()
      .pattern(/^[a-zA-Z][a-zA-Z0-9_.-]*$/)
      .min(2)
      .max(100)
      .required();

    try {
      keySchema.validateSync(key);
      return { isValid: true };
    } catch (error) {
      if (error.isJoi) {
        return {
          isValid: false,
          errors: [error.details[0].message],
        };
      }
      return { isValid: false, errors: ['Clé invalide'] };
    }
  }

  validateConfigCategory(category: string): ValidationResult {
    const categorySchema = Joi.string()
      .pattern(/^[a-zA-Z][a-zA-Z0-9_-]*$/)
      .max(50);

    try {
      categorySchema.validateSync(category);
      return { isValid: true };
    } catch (error) {
      if (error.isJoi) {
        return {
          isValid: false,
          errors: [error.details[0].message],
        };
      }
      return { isValid: false, errors: ['Catégorie invalide'] };
    }
  }
}
