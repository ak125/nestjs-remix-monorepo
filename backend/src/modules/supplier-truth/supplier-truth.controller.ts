import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { IsAdminGuard } from '@auth/is-admin.guard';
import {
  SupplierTruthService,
  type AvailabilityView,
} from './supplier-truth.service';
import { SupplierSyncScheduler } from './supplier-sync.scheduler';
import {
  listConnectableSuppliers,
  type SupplierPlatform,
} from './connectors/supplier-registry';

/**
 * Read-only observability surface for the supplier-truth sentinel (admin-only).
 *
 * Strictly READ: `status` reflects the activation flag + the connectable-supplier
 * registry (no portal hit); `projection/:pieceId` reads the canonical projection
 * via the service (UNKNOWN when not yet verified). No endpoint triggers a sync,
 * mutates pricing/orders, or writes anything. There is intentionally NO trigger
 * route — activation stays an env-flag decision, not an HTTP action.
 */
@Controller('api/admin/supplier-truth')
@UseGuards(IsAdminGuard)
export class SupplierTruthController {
  constructor(
    private readonly service: SupplierTruthService,
    private readonly scheduler: SupplierSyncScheduler,
  ) {}

  /** Activation + wiring status. Read-only; no connector login, no DB write. */
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
    const syncEnabled = this.scheduler.isSyncEnabled();
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

  /** Canonical availability for one piece; UNKNOWN until verified. Read-only. */
  @Get('projection/:pieceId')
  projection(
    @Param('pieceId', ParseIntPipe) pieceId: number,
  ): Promise<AvailabilityView> {
    return this.service.getProjection(pieceId);
  }
}
