/**
 * 🛠️ UTILITAIRES ZOD RÉUTILISABLES
 * 
 * Collection d'utilitaires pour simplifier l'utilisation de Zod
 * dans l'ensemble de l'application
 * 
 * @author GitHub Copilot
 * @version 2.0.0
 */

import { z } from 'zod';

// 🎯 TYPES GÉNÉRIQUES

/**
 * Type pour les résultats de validation avec erreurs formatées
 */
export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: FormattedError[];
}

/**
 * Type pour les erreurs formatées
 */
export interface FormattedError {
  field: string;
  message: string;
  code: string;
}

// 🛠️ UTILITAIRES DE VALIDATION

/**
 * Valide des données avec un schéma Zod et retourne un résultat formaté
 */
export function validateWithSchema<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): ValidationResult<T> {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return {
      success: true,
      data: result.data,
    };
  }
  
  return {
    success: false,
    errors: formatZodErrors(result.error),
  };
}

/**
 * Formate les erreurs Zod pour un affichage convivial
 */
export function formatZodErrors(error: z.ZodError): FormattedError[] {
  return error.errors.map(err => ({
    field: err.path.join('.') || 'root',
    message: err.message,
    code: err.code,
  }));
}

/**
 * Extrait les messages d'erreur d'un ZodError
 */
export function extractErrorMessages(error: z.ZodError): string[] {
  return error.errors.map(err => {
    const field = err.path.length > 0 ? `${err.path.join('.')}: ` : '';
    return `${field}${err.message}`;
  });
}

/**
 * Combine plusieurs schémas Zod avec validation conditionnelle
 */
export function createConditionalSchema<T>(
  baseSchema: z.ZodSchema<T>,
  conditions: Record<string, z.ZodSchema<any>>
) {
  return z.union([baseSchema, ...Object.values(conditions)]);
}

// 🎨 DÉCORATEURS ET WRAPPERS

/**
 * Wrapper pour validation automatique avec gestion d'erreurs
 */
export function withValidation<T, R>(
  schema: z.ZodSchema<T>,
  fn: (data: T) => R | Promise<R>
) {
  return async (data: unknown): Promise<ValidationResult<R>> => {
    try {
      const validation = validateWithSchema(schema, data);
      
      if (!validation.success) {
        return validation as ValidationResult<R>;
      }
      
      const result = await fn(validation.data!);
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        errors: [{
          field: 'execution',
          message: error instanceof Error ? error.message : 'Erreur inconnue',
          code: 'execution_error',
        }],
      };
    }
  };
}

/**
 * Créateur de hook React pour validation de formulaire
 */
export function createValidationHook<T>(schema: z.ZodSchema<T>) {
  return function useValidation() {
    const [errors, setErrors] = useState<FormattedError[]>([]);
    const [isValid, setIsValid] = useState(false);
    
    const validate = useCallback((data: unknown): ValidationResult<T> => {
      const result = validateWithSchema(schema, data);
      setErrors(result.errors || []);
      setIsValid(result.success);
      return result;
    }, []);
    
    const clearErrors = useCallback(() => {
      setErrors([]);
      setIsValid(false);
    }, []);
    
    return {
      validate,
      clearErrors,
      errors,
      isValid,
      hasErrors: errors.length > 0,
    };
  };
}

// 📋 SCHÉMAS COMMUNS RÉUTILISABLES

/**
 * Schéma pour les identifiants UUID
 */
export const UuidSchema = z.string().uuid("Doit être un UUID valide");

/**
 * Schéma pour les emails
 */
export const EmailSchema = z.string()
  .email("Doit être une adresse email valide")
  .toLowerCase()
  .trim();

/**
 * Schéma pour les mots de passe
 */
export const PasswordSchema = z.string()
  .min(8, "Le mot de passe doit contenir au moins 8 caractères")
  .regex(/[A-Z]/, "Doit contenir au moins une majuscule")
  .regex(/[a-z]/, "Doit contenir au moins une minuscule")
  .regex(/\d/, "Doit contenir au moins un chiffre");

/**
 * Schéma pour les numéros de téléphone
 */
export const PhoneSchema = z.string()
  .regex(/^\+?[\d\s\-\(\)]+$/, "Format de téléphone invalide")
  .min(10, "Le numéro doit contenir au moins 10 chiffres");

/**
 * Schéma pour les codes postaux
 */
export const PostalCodeSchema = z.string()
  .regex(/^\d{5}$/, "Le code postal doit contenir 5 chiffres");

/**
 * Schéma pour les URLs
 */
export const UrlSchema = z.string()
  .url("Doit être une URL valide")
  .refine(url => {
    try {
      const parsed = new URL(url);
      return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  }, "Doit être une URL HTTP ou HTTPS valide");

/**
 * Schéma pour les dates
 */
export const DateSchema = z.string()
  .datetime("Doit être une date valide au format ISO")
  .or(z.date())
  .transform(val => typeof val === 'string' ? new Date(val) : val);

/**
 * Schéma pour les montants monétaires
 */
export const MoneySchema = z.number()
  .min(0, "Le montant ne peut pas être négatif")
  .max(999999.99, "Le montant ne peut pas dépasser 999,999.99")
  .multipleOf(0.01, "Le montant doit avoir au maximum 2 décimales");

// 🔄 TRANSFORMATIONS COMMUNES

/**
 * Transforme une chaîne en nombre
 */
export const StringToNumber = z.string().transform(val => {
  const num = parseFloat(val);
  if (isNaN(num)) {
    throw new Error("Doit être un nombre valide");
  }
  return num;
});

/**
 * Transforme une chaîne en boolean
 */
export const StringToBoolean = z.string().transform(val => {
  const lower = val.toLowerCase();
  if (['true', '1', 'yes', 'oui'].includes(lower)) return true;
  if (['false', '0', 'no', 'non'].includes(lower)) return false;
  throw new Error("Doit être un booléen valide");
});

/**
 * Normalise une chaîne (trim + minuscules)
 */
export const NormalizedString = z.string()
  .trim()
  .toLowerCase()
  .min(1, "Ne peut pas être vide");

// 🎯 UTILITAIRES POUR FORMULAIRES

/**
 * Valide un objet FormData avec un schéma Zod
 */
export function validateFormData<T>(
  schema: z.ZodSchema<T>,
  formData: FormData
): ValidationResult<T> {
  const data: Record<string, any> = {};
  
  // Convertir FormData en objet
  for (const [key, value] of formData.entries()) {
    if (data[key]) {
      // Si la clé existe déjà, créer un tableau
      if (!Array.isArray(data[key])) {
        data[key] = [data[key]];
      }
      data[key].push(value);
    } else {
      data[key] = value;
    }
  }
  
  return validateWithSchema(schema, data);
}

/**
 * Valide les paramètres d'URL avec un schéma Zod
 */
export function validateSearchParams<T>(
  schema: z.ZodSchema<T>,
  searchParams: URLSearchParams
): ValidationResult<T> {
  const data: Record<string, any> = {};
  
  for (const [key, value] of searchParams.entries()) {
    data[key] = value;
  }
  
  return validateWithSchema(schema, data);
}

// 📊 UTILITAIRES DE DÉBOGAGE

/**
 * Log les erreurs de validation pour le débogage
 */
export function logValidationErrors(errors: FormattedError[], context?: string) {
  const prefix = context ? `[${context}] ` : '';
  console.group(`${prefix}Erreurs de validation:`);
  errors.forEach(error => {
    console.error(`• ${error.field}: ${error.message} (${error.code})`);
  });
  console.groupEnd();
}

/**
 * Crée un résumé des erreurs de validation
 */
export function createErrorSummary(errors: FormattedError[]): string {
  const errorCount = errors.length;
  const fields = errors.map(e => e.field).join(', ');
  return `${errorCount} erreur${errorCount > 1 ? 's' : ''} sur: ${fields}`;
}

// Nécessaire pour le hook
import { useState, useCallback } from 'react';

// Export du hook créé
export { createValidationHook };

// 🎁 EXPORTS DE CONVENANCE
export {
  z,
  type ZodSchema,
  type ZodError,
  type ZodIssue,
} from 'zod';