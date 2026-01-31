/**
 * SeoValidationModule
 *
 * Sous-module dédié à la validation SEO :
 * - Validation des rôles de pages (R1-R6)
 * - Validation des guides d'achat
 * - Règles de contenu par rôle (word count, forbidden keywords, etc.)
 *
 * @see .spec/00-canon/architecture.md - SEO Module refactoring
 * @see page-role.types.ts - Définitions des rôles et règles
 */
import { Module } from '@nestjs/common';

// =====================================================
// SERVICES - Validation SEO
// =====================================================

import { PageRoleValidatorService } from '../services/page-role-validator.service';
import { PurchaseGuideValidatorService } from '../validation/purchase-guide-validator.service';

@Module({
  providers: [
    PageRoleValidatorService, // Validation règles par rôle (R1-R6)
    PurchaseGuideValidatorService, // Validation guides d'achat
  ],

  exports: [PageRoleValidatorService, PurchaseGuideValidatorService],
})
export class SeoValidationModule {}
