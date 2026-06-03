import type { ConfigService } from '@nestjs/config';

/**
 * Single source of truth for the supplier-sync activation flag.
 *
 * The sentinel is INERT unless this env var is exactly `'true'`. Both the
 * scheduler (which arms the BullMQ repeatable job) and the read-only
 * observability controller (which reports the mode) read it through this helper,
 * so the gate semantics live in ONE place — no magic string duplicated, no risk
 * of the controller reporting "active" while the scheduler stays inert (or vice
 * versa). Strict `=== 'true'`: any other value (`'1'`, `'TRUE'`, unset) is inert.
 */
export const SUPPLIER_TRUTH_SYNC_ENABLED = 'SUPPLIER_TRUTH_SYNC_ENABLED';

export function isSupplierSyncEnabled(config: ConfigService): boolean {
  return config.get<string>(SUPPLIER_TRUTH_SYNC_ENABLED) === 'true';
}
