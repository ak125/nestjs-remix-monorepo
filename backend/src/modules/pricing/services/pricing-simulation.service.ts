/**
 * Simulation service (read-only). Estimates the impact of a candidate pricing
 * grid on sales-weighted revenue, without a file and without ANY write.
 *
 * READ-ONLY absolute: no mutation, no cache, no persisted pre-compute. The
 * candidate rules come from the request (test a grid) or default to the active
 * pricing_rules. Reuses the L1/L4 SoT via the pure simulation core.
 */
import { Injectable, Logger } from '@nestjs/common';
import { PricingRepository } from './pricing.repository';
import {
  computeGridSimulation,
  type SimulationReport,
} from './pricing-simulation.core';
import type { CustomerType, PricingRule } from './pricing-strategy.service';

@Injectable()
export class PricingSimulationService {
  private readonly logger = new Logger(PricingSimulationService.name);

  constructor(private readonly repo: PricingRepository) {}

  async simulate(input: {
    customerType?: CustomerType;
    candidateRules?: PricingRule[];
  }): Promise<SimulationReport> {
    const customerType = input.customerType ?? 'B2C';
    const rules = input.candidateRules ?? (await this.repo.fetchRules());
    const buckets = await this.repo.fetchCostBucketAggregates();
    const report = computeGridSimulation(buckets, rules, customerType);
    this.logger.log(
      `[PRICING_SIMULATION] customerType=${customerType} rules=${rules.length} ` +
        `ΔCA_cents=${report.totalRevenueDeltaCents} unmatchedBuckets=${report.unmatchedBucketCount}`,
    );
    return report;
  }
}
