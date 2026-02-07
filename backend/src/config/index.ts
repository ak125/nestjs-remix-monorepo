// App configuration
export {
  AppConfig,
  createAppConfig,
  getAppConfig,
  resetAppConfig,
} from './app.config';

// Cache TTL configuration
export {
  CacheTTL,
  CACHE_STRATEGIES,
  AdaptiveTTL,
  getCacheKey,
  getTTLMs,
} from './cache-ttl.config';
export type { CacheStrategy } from './cache-ttl.config';

// CSP configuration
export {
  IMAGE_DOMAINS,
  CSP_DIRECTIVES,
  getConnectSrcWithHMR,
  buildCSPDirectives,
} from './csp.config';

// Logger configuration
export { loggerConfig } from './logger.config';

// Environment validation
export {
  validateRequiredEnvVars,
  getRequiredEnvVars,
  getOptionalEnvVarsWithDefaults,
} from './env-validation';

// SEO link limits
export {
  SEO_LINK_LIMITS,
  SEO_AB_TESTING_CONFIG,
  SEO_SWITCH_TYPES,
  SEO_LINK_TYPES,
  SEO_LINK_POSITIONS,
} from './seo-link-limits.config';
export type {
  SeoLinkLimits,
  SeoLinkType,
  SeoLinkPosition,
} from './seo-link-limits.config';

// SEO variations
export {
  SEO_PRICE_VARIATIONS,
  SEO_PROPOSE_VARIATIONS,
  selectVariation,
  selectVariationWithIndex,
} from './seo-variations.config';
export type { PriceVariation, ProposeVariation } from './seo-variations.config';

// SEO switch aliases
export {
  SEO_SWITCH_ALIASES,
  getSwitchAliasConfig,
  getSwitchAliasesByType,
  SWITCH_ALIAS_NAMES,
} from './seo-switch-aliases.config';
export type { SwitchAliasConfig } from './seo-switch-aliases.config';

// NOTE: payment.config.ts excluded (uses registerAs() default export)
// NOTE: swagger.config.ts excluded (only used in main.ts)
