/**
 * Supplier → connector registry (Layer 1, data-driven, multi-supplier).
 *
 * `___xtr_supplier` mixes real distributor portals with brand/equipementier names.
 * Only genuine distributor portals are "connectable"; everything else is sourced
 * THROUGH a distributor and has no portal to log into. This registry maps the few
 * connectable suppliers (by `spl_id`) to their platform + base URL + credential env
 * keys. Adding another inoshop distributor = one entry, no code.
 *
 * Credentials are never stored here — only the ENV var NAMES (`feedback_verify_existing_first`,
 * no hardcoded secrets). Values live in backend `.env`.
 */

export type SupplierPlatform = 'inoshop';

export interface SupplierConnectorConfig {
  /** `___xtr_supplier.spl_id`. */
  supplierId: string;
  supplierName: string;
  platform: SupplierPlatform;
  baseUrl: string;
  credEnv: { userKey: string; passKey: string };
}

/**
 * Seeded from the live catalogue audit (2026-05-20). DistriCash (DCA) is the
 * connectable distributor portal on inoshop; the other ~69 `___xtr_supplier`
 * rows are brands/equipementiers (no portal) and are intentionally absent.
 */
const REGISTRY: readonly SupplierConnectorConfig[] = [
  {
    // RÉCONCILIATION 2026-06-01 : identité opérationnelle DistriCash = spl_id 71 ("DCA"), PAS 26.
    // `___xtr_supplier` contient 26 "DISTRICASH (DCA)" (0 lien marque, 0 commande = fantôme) ET
    // 71 "DCA" (8 liens `___xtr_supplier_link_pm` + 17 `___xtr_order_line`). Le runner scope via
    // getSupplierLinkedBrands(supplierId) → 26 → 0 ref → skip silencieux (sentinelle no-op).
    // LIVE_VERIFY : confirmer que 71 porte bien les marques du portail au 1er run authentifié.
    supplierId: '71', // ___xtr_supplier "DCA" (= DistriCash opérationnel)
    supplierName: 'DISTRICASH (DCA)',
    platform: 'inoshop',
    baseUrl: 'https://districashv2.inoshop.net',
    credEnv: {
      userKey: 'SUPPLIER_INOSHOP_DISTRICASH_USER',
      passKey: 'SUPPLIER_INOSHOP_DISTRICASH_PASSWORD',
    },
  },
];

const BY_ID = new Map(REGISTRY.map((c) => [c.supplierId, c]));

/** Config for a supplier, or undefined when the supplier has no connectable portal. */
export function getSupplierConnectorConfig(
  supplierId: string,
): SupplierConnectorConfig | undefined {
  return BY_ID.get(supplierId);
}

/** All suppliers we can actually connect to (have a portal connector). */
export function listConnectableSuppliers(): readonly SupplierConnectorConfig[] {
  return REGISTRY;
}

/** Whether a given supplier id is connectable. */
export function isConnectable(supplierId: string): boolean {
  return BY_ID.has(supplierId);
}
