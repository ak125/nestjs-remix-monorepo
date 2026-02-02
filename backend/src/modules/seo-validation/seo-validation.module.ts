/**
 * 🛡️ MODULE SEO VALIDATION
 *
 * Regroupe tous les services de validation SEO:
 * - PageRoleValidatorService: Validation rôles de pages (R1-R6)
 * - QualityValidatorService: Validation qualité (forbidden.csv, V-Level)
 * - PurchaseGuideValidatorService: Validation guides d'achat
 *
 * Ce module exporte également l'intercepteur PageRoleValidationInterceptor
 * pour la validation automatique des pages HTML.
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

// Services de validation (import depuis seo/ pour compatibilité)
import { PageRoleValidatorService } from '../seo/services/page-role-validator.service';
import { QualityValidatorService } from '../seo/services/quality-validator.service';
import { PurchaseGuideValidatorService } from '../seo/validation/purchase-guide-validator.service';

// Intercepteur de validation
import { PageRoleValidationInterceptor } from '../seo/interceptors/page-role-validation.interceptor';

@Module({
  imports: [ConfigModule],

  providers: [
    PageRoleValidatorService,
    QualityValidatorService,
    PurchaseGuideValidatorService,
    PageRoleValidationInterceptor,
  ],

  exports: [
    // Services
    PageRoleValidatorService,
    QualityValidatorService,
    PurchaseGuideValidatorService,
    // Intercepteur
    PageRoleValidationInterceptor,
  ],
})
export class SeoValidationModule {}

// Re-export types for convenience
export {
  PageRole,
  PAGE_ROLE_META,
  PAGE_ROLE_HIERARCHY,
  ALLOWED_LINKS,
  URL_ROLE_PATTERNS,
  getPageRoleFromUrl,
  isLinkAllowed,
} from '../seo/types/page-role.types';

// Re-export validation types
export {
  RoleViolationType,
  ViolationSeverity,
  RoleViolation,
  PageValidationResult,
} from '../seo/services/page-role-validator.service';

export {
  ValidationIssue,
  ValidationResult,
  VLevel,
  VLevelConfig,
} from '../seo/services/quality-validator.service';
