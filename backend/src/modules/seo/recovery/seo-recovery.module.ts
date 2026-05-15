/**
 * PR-E — SEO Recovery Module
 *
 * Wires :
 *   - SeoRolloutGateService     (GrowthBook-compatible flag gate)
 *   - SeoRevertSelectorService  (safe revert target picker)
 *   - H1RecoveryApplyService    (proposed → gateway → applied orchestrator)
 *
 * Depends on : SeoGovernanceModule (PR-C/PR-D) for SeoContentWriteService.
 */

import { Module } from '@nestjs/common';
import { SeoGovernanceModule } from '../governance/seo-governance.module';
import { SeoRolloutGateService } from './seo-rollout-gate.service';
import { SeoRevertSelectorService } from './seo-revert-selector.service';
import { H1RecoveryApplyService } from './h1-recovery-apply.service';

@Module({
  imports: [SeoGovernanceModule],
  providers: [
    SeoRolloutGateService,
    SeoRevertSelectorService,
    H1RecoveryApplyService,
  ],
  exports: [
    SeoRolloutGateService,
    SeoRevertSelectorService,
    H1RecoveryApplyService,
  ],
})
export class SeoRecoveryModule {}
