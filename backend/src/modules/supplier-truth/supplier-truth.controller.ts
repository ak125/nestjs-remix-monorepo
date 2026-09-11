import { Controller, Get, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IsAdminGuard } from '@auth/is-admin.guard';
import { isSupplierSyncEnabled } from './supplier-sync.flag';
import {
  listConnectableSuppliers,
  type SupplierPlatform,
} from './connectors/supplier-registry';

/**
 * Read-only observability surface for the supplier-truth sentinel (admin-only).
 *
 * Strictly READ: `status` reflects the activation flag + the connectable-supplier
 * registry (no portal hit, no DB access). No endpoint triggers a sync, mutates
 * pricing/orders, or writes anything. There is intentionally NO trigger route —
 * activation stays an env-flag decision, not an HTTP action.
 *
 * `projection/:pieceId` was removed on 2026-09-10 together with the never-applied
 * `20260520_supplier_truth_v1` migration: it read `supplier_truth_projection`, a
 * table that has never existed, so any admin call that reached the handler threw
 * on PostgREST 42P01 and left as a 500 through `GlobalErrorFilter`.
 * The availability-consensus projection is deferred to H3, which must bring its
 * own migration; `supplier_offer_snapshot` is the canonical observation store.
 */
@Controller('api/admin/supplier-truth')
@UseGuards(IsAdminGuard)
export class SupplierTruthController {
  constructor(private readonly config: ConfigService) {}

  /** Activation + wiring status. Read-only; no connector login, no DB access. */
  @Get('status')
  status(): {
    mode: 'ACTIVE' | 'OBSERVABLE_DORMANT';
    syncEnabled: boolean;
    connectableSuppliers: Array<{
      supplierId: string;
      supplierName: string;
      platform: SupplierPlatform;
    }>;
  } {
    const syncEnabled = isSupplierSyncEnabled(this.config);
    return {
      mode: syncEnabled ? 'ACTIVE' : 'OBSERVABLE_DORMANT',
      syncEnabled,
      connectableSuppliers: listConnectableSuppliers().map((c) => ({
        supplierId: c.supplierId,
        supplierName: c.supplierName,
        platform: c.platform,
      })),
    };
  }
}
