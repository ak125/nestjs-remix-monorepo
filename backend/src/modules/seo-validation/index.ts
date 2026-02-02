/**
 * 🛡️ SEO VALIDATION MODULE - Public API
 */

export { SeoValidationModule } from './seo-validation.module';

// Re-export all types and services for convenience
export {
  PageRole,
  PAGE_ROLE_META,
  PAGE_ROLE_HIERARCHY,
  ALLOWED_LINKS,
  URL_ROLE_PATTERNS,
  getPageRoleFromUrl,
  isLinkAllowed,
  RoleViolationType,
  ViolationSeverity,
  RoleViolation,
  PageValidationResult,
  ValidationIssue,
  ValidationResult,
  VLevel,
  VLevelConfig,
} from './seo-validation.module';
