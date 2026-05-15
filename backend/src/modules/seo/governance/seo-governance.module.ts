/**
 * PR-C — SEO Governance Module
 *
 * Wires together :
 *   - OpaPolicyEngineService (WASM bundle eval, sync)
 *   - SeoContentWriteService (single write gateway for governed H1 columns)
 *   - H1DeterministicBuilderService (canonical h1 templates, no LLM)
 *
 * Exported services are consumed by :
 *   - PR-C : `seo.service.ts`, `optimized-metadata.service.ts`,
 *            `gamme-detail-enricher.service.ts` (refactor)
 *   - PR-E (future) : recovery worker injects SeoContentWriteService for
 *                     legacy_recovery writes
 */

import { Module } from '@nestjs/common';
import { OpaPolicyEngineService } from './opa-policy-engine.service';
import { SeoContentWriteService } from './seo-content-write.service';
import { H1DeterministicBuilderService } from '../builders/h1-deterministic-builder.service';

@Module({
  providers: [
    OpaPolicyEngineService,
    SeoContentWriteService,
    H1DeterministicBuilderService,
  ],
  exports: [
    OpaPolicyEngineService,
    SeoContentWriteService,
    H1DeterministicBuilderService,
  ],
})
export class SeoGovernanceModule {}
