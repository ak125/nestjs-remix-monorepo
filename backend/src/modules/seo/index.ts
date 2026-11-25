export { SeoModule } from './seo.module';
export { SeoService } from './seo.service';
export { SeoController } from './seo.controller';
export { SitemapV10Service } from './services/sitemap-v10.service';

// Consolidation R4 → R3 (mandat ER) : point d'entrée public des modules blog et gamme-rest.
export {
  R4ConsolidationPolicyService,
  R4_CONSOLIDATION_CACHE_SUFFIXES,
  R4_CONSOLIDATION_OFF,
  applyReferenceLinkRuleToHtml,
  referenceLinkPath,
  type R4ConsolidationSnapshot,
} from './services/r4-consolidation-policy.service';
export {
  InternalLinkingService,
  unlinkGammeAliasLinks,
} from './internal-linking.service';

// Validation SEO Guides d'Achat
export { PurchaseGuideValidatorService } from './validation/purchase-guide-validator.service';
export * from './validation/purchase-guide-validation.constants';
export * from './validation/purchase-guide-validation.dto';
