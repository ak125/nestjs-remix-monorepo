/**
 * Pricing Control Plane V1 module.
 *
 * Pure layers (formula/invariants/strategy/profiles) are dependency-free and
 * exported for reuse (e.g. products-admin margin). L3 lifecycle + repository
 * own the Supabase I/O. Simulation + baseline refresh are a focused follow-up.
 */
import { Module } from '@nestjs/common';
import { PricingFormulaService } from './services/pricing-formula.service';
import { PricingInvariantsService } from './services/pricing-invariants.service';
import { PricingStrategyService } from './services/pricing-strategy.service';
import { SupplierProfileService } from './services/supplier-profile.service';
import { PricingRepository } from './services/pricing.repository';
import { PriceImportService } from './services/price-import.service';
import { PriceActivationService } from './services/price-activation.service';
import { CatalogDisplayActivationService } from './services/catalog-display-activation.service';
import { CatalogDisplayQuarantineService } from './services/catalog-display-quarantine.service';
import { PricingSimulationService } from './services/pricing-simulation.service';
import { CatalogActivationPlanService } from './services/catalog-activation-plan.service';
import { PricingImportController } from './controllers/pricing-import.controller';

@Module({
  controllers: [PricingImportController],
  providers: [
    PricingFormulaService,
    PricingInvariantsService,
    PricingStrategyService,
    SupplierProfileService,
    PricingRepository,
    PriceImportService,
    PriceActivationService,
    CatalogDisplayActivationService,
    CatalogDisplayQuarantineService,
    PricingSimulationService,
    CatalogActivationPlanService,
  ],
  exports: [
    PricingFormulaService,
    PricingInvariantsService,
    PricingStrategyService,
    SupplierProfileService,
  ],
})
export class PricingModule {}
