/**
 * Jest mock for @repo/database-types
 *
 * The real package emits ESM (export *) which Jest can't parse.
 * This mock provides the TABLES constant used by PaymentDataService
 * and other services so that module resolution succeeds.
 */
export const TABLES = {
  xtr_order: 'xtr_order',
  xtr_customer: 'xtr_customer',
  xtr_product: 'xtr_product',
  ic_postback: 'ic_postback',
} as Record<string, string>;

// Re-export empty placeholders for other named exports
export const COLUMNS = {} as Record<string, Record<string, string>>;
