/**
 * Admin endpoints for the price import + activation lifecycle (IsAdminGuard).
 *   POST /api/admin/pricing/import/dry-run     → report + batchId (no writes)
 *   POST /api/admin/pricing/import/commit      → chunked atomic apply
 *   POST /api/admin/pricing/import/rollback    → LIFO restore
 *   POST /api/admin/pricing/activate/dry-run   → dispo-only projection (no writes)
 *   POST /api/admin/pricing/activate/commit    → flip pri_dispo 1/2 (confirm:true)
 *   POST /api/admin/pricing/activate/rollback  → LIFO restore of an activation batch
 *   POST /api/admin/pricing/display/dry-run     → piece_display projection (no writes)
 *   POST /api/admin/pricing/display/commit      → flip piece_display false→true (confirm:true)
 *   POST /api/admin/pricing/display/rollback    → restore piece_display for a batch
 *   POST /api/admin/pricing/display/quarantine/dry-run → non-vendable hide projection (no writes)
 *   POST /api/admin/pricing/display/quarantine/commit  → flip piece_display true→false (confirm:true)
 *   POST /api/admin/pricing/display/quarantine/rollback → restore piece_display for a quarantine batch
 *   POST /api/admin/pricing/display/gamme/dry-run  → pg_display projection, level-4 (no writes)
 *   POST /api/admin/pricing/display/gamme/commit   → flip pg_display→'1' level-4 hubs (confirm:true)
 *   POST /api/admin/pricing/display/gamme/rollback → restore pg_display for a gamme batch
 *   POST /api/admin/pricing/display/accessory-link/dry-run  → accessory→main link projection (no writes)
 *   POST /api/admin/pricing/display/accessory-link/commit   → write pg_parent_gamme_id (confirm:true)
 *   POST /api/admin/pricing/display/accessory-link/rollback → restore pg_parent_gamme_id for a batch
 */
import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { IsAdminGuard } from '@auth/is-admin.guard';
import {
  PriceImportService,
  type ImportRequest,
} from '../services/price-import.service';
import {
  PriceActivationService,
  type ActivationRequest,
} from '../services/price-activation.service';
import {
  CatalogDisplayActivationService,
  type DisplayActivationRequest,
} from '../services/catalog-display-activation.service';
import {
  CatalogDisplayQuarantineService,
  type DisplayQuarantineRequest,
} from '../services/catalog-display-quarantine.service';
import { PricingSimulationService } from '../services/pricing-simulation.service';
import { CatalogActivationPlanService } from '../services/catalog-activation-plan.service';
import type {
  CustomerType,
  PricingRule,
} from '../services/pricing-strategy.service';

@Controller('api/admin/pricing')
@UseGuards(IsAdminGuard)
export class PricingImportController {
  constructor(
    private readonly importService: PriceImportService,
    private readonly activationService: PriceActivationService,
    private readonly displayActivationService: CatalogDisplayActivationService,
    private readonly displayQuarantineService: CatalogDisplayQuarantineService,
    private readonly simulationService: PricingSimulationService,
    private readonly activationPlanService: CatalogActivationPlanService,
  ) {}

  /**
   * Read-only activation plan for a tariff batch (brand). T1 — NO writes.
   * Classifies sellable-priced pieces (visible / display-gated / accessory /
   * gamme-inactive / orphan) + proposes universal-section candidates.
   */
  @Post('activation/plan')
  activationPlan(@Body() body: { brandPmId: number }) {
    return this.activationPlanService.plan(body.brandPmId);
  }

  /** Read-only grid simulation (no write). */
  @Post('simulate')
  simulate(
    @Body()
    body: {
      customerType?: CustomerType;
      candidateRules?: PricingRule[];
    },
  ) {
    return this.simulationService.simulate(body);
  }

  @Post('import/dry-run')
  dryRun(@Body() body: ImportRequest) {
    return this.importService.dryRun(body);
  }

  @Post('import/commit')
  commit(@Body() body: ImportRequest & { batchId: string }) {
    return this.importService.commit(body.batchId, body);
  }

  @Post('import/rollback')
  rollback(@Body() body: { batchId: string; supplierId: string }) {
    return this.importService.rollback(body.batchId, body.supplierId);
  }

  /** Read-only activation projection (no writes). */
  @Post('activate/dry-run')
  activateDryRun(@Body() body: ActivationRequest) {
    return this.activationService.dryRun(body);
  }

  /** Apply the dispo-only activation — requires `confirm: true` (owner-gated). */
  @Post('activate/commit')
  activateCommit(@Body() body: ActivationRequest & { confirm?: boolean }) {
    return this.activationService.commit(body);
  }

  @Post('activate/rollback')
  activateRollback(@Body() body: { batchId: string; supplierId: string }) {
    return this.activationService.rollback(body.batchId, body.supplierId);
  }

  /** Read-only visibility projection — how many hidden-but-sellable refs (no writes). */
  @Post('display/dry-run')
  displayDryRun(@Body() body: DisplayActivationRequest) {
    return this.displayActivationService.dryRun(body.supplierId);
  }

  /** Apply piece_display false→true for sellable refs — requires `confirm:true`. */
  @Post('display/commit')
  displayCommit(
    @Body() body: DisplayActivationRequest & { confirm?: boolean },
  ) {
    return this.displayActivationService.commit(body);
  }

  @Post('display/rollback')
  displayRollback(@Body() body: { batchId: string; supplierId: string }) {
    return this.displayActivationService.rollback(
      body.batchId,
      body.supplierId,
    );
  }

  /**
   * Read-only quarantine projection — how many visible-but-non-vendable refs (no writes).
   * Optional `gammeIds` (pieces.piece_ga_id) scopes the projection to a cohort.
   */
  @Post('display/quarantine/dry-run')
  displayQuarantineDryRun(@Body() body: DisplayQuarantineRequest) {
    return this.displayQuarantineService.dryRun(body.supplierId, body.gammeIds);
  }

  /** Apply piece_display true→false for non-vendable refs — requires `confirm:true`. */
  @Post('display/quarantine/commit')
  displayQuarantineCommit(
    @Body() body: DisplayQuarantineRequest & { confirm?: boolean },
  ) {
    return this.displayQuarantineService.commit(body);
  }

  @Post('display/quarantine/rollback')
  displayQuarantineRollback(
    @Body() body: { batchId: string; supplierId: string },
  ) {
    return this.displayQuarantineService.rollback(
      body.batchId,
      body.supplierId,
    );
  }

  /**
   * Read-only GAMME visibility projection (étape B1, no writes). Returns the owner-gate
   * values eligible(gammes)/refs(pieces)/gammeIds (NK expected: 1 / 11 / {1330}).
   */
  @Post('display/gamme/dry-run')
  gammeDisplayDryRun(@Body() body: DisplayActivationRequest) {
    return this.displayActivationService.gammeDryRun(body.supplierId);
  }

  /** Apply pg_display -> '1' for masked level-4 hub gammes — requires `confirm:true`. */
  @Post('display/gamme/commit')
  gammeDisplayCommit(
    @Body() body: DisplayActivationRequest & { confirm?: boolean },
  ) {
    return this.displayActivationService.gammeCommit(body);
  }

  @Post('display/gamme/rollback')
  gammeDisplayRollback(@Body() body: { batchId: string; supplierId: string }) {
    return this.displayActivationService.gammeRollback(
      body.batchId,
      body.supplierId,
    );
  }

  /**
   * Read-only accessory→main commercial LINK projection (data layer, no writes). Returns
   * eligible/rejected accessories. Does NOT activate anything visible (no pg_display change).
   */
  @Post('display/accessory-link/dry-run')
  accessoryLinkDryRun(
    @Body() body: { mainPgId: number; accessoryPgIds: number[] },
  ) {
    return this.displayActivationService.accessoryLinkDryRun(
      body.mainPgId,
      body.accessoryPgIds,
    );
  }

  /** Apply the accessory→main link (pg_parent_gamme_id) — requires `confirm:true`. */
  @Post('display/accessory-link/commit')
  accessoryLinkCommit(
    @Body()
    body: {
      mainPgId: number;
      accessoryPgIds: number[];
      operator?: string | null;
      confirm?: boolean;
    },
  ) {
    return this.displayActivationService.accessoryLinkCommit(body);
  }

  @Post('display/accessory-link/rollback')
  accessoryLinkRollback(@Body() body: { batchId: string }) {
    return this.displayActivationService.accessoryLinkRollback(body.batchId);
  }
}
