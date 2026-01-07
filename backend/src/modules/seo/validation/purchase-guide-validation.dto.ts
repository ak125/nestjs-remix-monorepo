import { z } from 'zod';
import {
  PURCHASE_GUIDE_VALIDATION,
  VALIDATION_ERROR_MESSAGES,
  ValidationSeverity,
} from './purchase-guide-validation.constants';

/**
 * Schema Zod pour une FAQ
 */
export const FaqSchema = z.object({
  question: z
    .string()
    .min(
      PURCHASE_GUIDE_VALIDATION.MIN_FAQ_QUESTION_LENGTH,
      VALIDATION_ERROR_MESSAGES.FAQ_QUESTION_TOO_SHORT,
    ),
  answer: z
    .string()
    .min(
      PURCHASE_GUIDE_VALIDATION.MIN_FAQ_ANSWER_LENGTH,
      VALIDATION_ERROR_MESSAGES.FAQ_ANSWER_TOO_SHORT,
    ),
});

/**
 * Schema Zod pour valider un guide d'achat complet
 */
export const PurchaseGuideValidationSchema = z.object({
  sgpg_id: z.number(),
  sgpg_pg_id: z.string(),
  sgpg_intro_title: z
    .string()
    .min(
      PURCHASE_GUIDE_VALIDATION.MIN_TITLE_LENGTH,
      VALIDATION_ERROR_MESSAGES.TITLE_TOO_SHORT,
    ),
  sgpg_intro_role: z
    .string()
    .min(
      PURCHASE_GUIDE_VALIDATION.MIN_DESC_LENGTH,
      VALIDATION_ERROR_MESSAGES.DESC_TOO_SHORT,
    )
    .max(
      PURCHASE_GUIDE_VALIDATION.MAX_DESC_LENGTH,
      VALIDATION_ERROR_MESSAGES.DESC_TOO_LONG,
    ),
  sgpg_symptoms: z
    .array(z.string())
    .min(
      PURCHASE_GUIDE_VALIDATION.MIN_SYMPTOMS,
      VALIDATION_ERROR_MESSAGES.INSUFFICIENT_SYMPTOMS,
    ),
  sgpg_faq: z
    .array(FaqSchema)
    .min(
      PURCHASE_GUIDE_VALIDATION.MIN_FAQS,
      VALIDATION_ERROR_MESSAGES.INSUFFICIENT_FAQS,
    ),
});

export type PurchaseGuideValidation = z.infer<
  typeof PurchaseGuideValidationSchema
>;

/**
 * Interface pour un problème de validation individuel
 */
export interface ValidationIssue {
  field: string;
  message: string;
  severity: ValidationSeverity;
  current?: string | number | null;
  expected?: string | number | null;
}

/**
 * Résultat de la validation d'un guide d'achat
 */
export interface ValidationResult {
  sgpg_id: number;
  sgpg_pg_id: string;
  isValid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

/**
 * Résultat d'un audit SEO complet (tous les guides)
 */
export interface SeoAuditResult {
  timestamp: string;
  totalGuides: number;
  validGuides: number;
  invalidGuides: number;
  issues: {
    descriptionTooShort: number;
    descriptionTooLong: number;
    insufficientSymptoms: number;
    insufficientFaqs: number;
    titleCannibalization: number;
  };
  details: ValidationResult[];
}

/**
 * DTO pour la requête de validation d'un guide
 */
export const ValidateGuideRequestSchema = z.object({
  pgId: z.string().regex(/^\d+$/, 'pgId doit être un nombre'),
});

export type ValidateGuideRequest = z.infer<typeof ValidateGuideRequestSchema>;

/**
 * DTO pour la réponse de validation
 */
export interface ValidateGuideResponse {
  success: boolean;
  data: ValidationResult;
}

/**
 * DTO pour la réponse d'audit complet
 */
export interface AuditAllResponse {
  success: boolean;
  data: SeoAuditResult;
}
