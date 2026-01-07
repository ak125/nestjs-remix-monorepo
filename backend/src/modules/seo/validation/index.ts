/**
 * SEO Validation Module
 *
 * Provides validation services for purchase guide SEO content
 */

// Constants
export {
  PURCHASE_GUIDE_VALIDATION,
  VALIDATION_ERROR_MESSAGES,
  ValidationSeverity,
} from './purchase-guide-validation.constants';

// DTOs and Schemas
export {
  FaqSchema,
  PurchaseGuideValidationSchema,
  ValidateGuideRequestSchema,
  type PurchaseGuideValidation,
  type ValidationIssue,
  type ValidationResult,
  type SeoAuditResult,
  type ValidateGuideRequest,
  type ValidateGuideResponse,
  type AuditAllResponse,
} from './purchase-guide-validation.dto';

// Services
export { PurchaseGuideValidatorService } from './purchase-guide-validator.service';
