#!/usr/bin/env npx ts-node
/**
 * Generate Copy Batch — CLI script
 *
 * Generates copy for all slots in an approved weekly plan.
 * Auto-runs brand + compliance gates after generation.
 *
 * Usage:
 *   npx ts-node scripts/marketing/generate-copy-batch.ts --week 2026-W09
 *   npx ts-node scripts/marketing/generate-copy-batch.ts --week 2026-W09 --dry-run
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../backend/src/app.module';
import { MarketingHubDataService } from '../../backend/src/modules/marketing/services/marketing-hub-data.service';
import { MultiChannelCopywriterService } from '../../backend/src/modules/marketing/services/multi-channel-copywriter.service';
import { BrandComplianceGateService } from '../../backend/src/modules/marketing/services/brand-compliance-gate.service';

async function main() {
  const args = process.argv.slice(2);
  const weekIdx = args.indexOf('--week');
  const dryRun = args.includes('--dry-run');

  if (weekIdx === -1 || !args[weekIdx + 1]) {
    console.error('Usage: --week 2026-W09 [--dry-run]');
    process.exit(1);
  }

  const weekIso = args[weekIdx + 1];

  if (!/^\d{4}-W\d{2}$/.test(weekIso)) {
    console.error('Invalid week format. Expected: YYYY-WNN');
    process.exit(1);
  }

  console.log(`\n--- Marketing Hub: Copy Batch Generator ---`);
  console.log(`Week: ${weekIso}`);
  console.log(`Mode: ${dryRun ? 'DRY-RUN (no persist)' : 'LIVE'}`);
  console.log('');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const hubData = app.get(MarketingHubDataService);
    const copywriter = app.get(MultiChannelCopywriterService);
    const gateService = app.get(BrandComplianceGateService);

    // 1. Load weekly plan
    const plan = await hubData.getWeeklyPlan(weekIso);
    if (!plan) {
      console.error(`No plan found for ${weekIso}. Run generate-weekly-plan.ts first.`);
      process.exit(1);
    }

    if (plan.status !== 'approved' && plan.status !== 'draft') {
      console.warn(`Plan status is "${plan.status}". Expected "approved" or "draft".`);
    }

    const slots = plan.plan_json as any[];
    console.log(`Plan loaded: ${slots.length} slots`);
    console.log('');

    // 2. Generate copy for all slots
    console.log('Generating copy...');
    const result = await copywriter.generateBatch(slots, weekIso, dryRun);
    console.log(`  Generated: ${result.generated}`);
    console.log(`  Errors: ${result.errors}`);
    console.log('');

    // 3. Run gates on generated posts (skip in dry-run)
    if (!dryRun && result.generated > 0) {
      console.log('Running brand + compliance gates...');
      const posts = await hubData.getPostsByWeek(weekIso, 'generated');

      let passed = 0;
      let warned = 0;
      let failed = 0;

      for (const post of posts) {
        const summary = await gateService.evaluateAndPersist(post);
        if (summary.brand.level === 'FAIL' || summary.compliance.level === 'FAIL') {
          failed++;
          console.log(
            `  FAIL: Post ${post.id} (${post.slot_label}) — ${summary.blocking_issues.join('; ')}`,
          );
        } else if (summary.brand.level === 'WARN' || summary.compliance.level === 'WARN') {
          warned++;
          console.log(
            `  WARN: Post ${post.id} (${post.slot_label}) — approuvable avec avertissements`,
          );
        } else {
          passed++;
        }
      }

      console.log('');
      console.log(`Gate results: ${passed} PASS, ${warned} WARN, ${failed} FAIL`);

      // Update plan counters
      await hubData.upsertWeeklyPlan({
        week_iso: weekIso,
        priority_gammes: plan.priority_gammes as any,
        calendar_rules: plan.calendar_rules as any,
        plan_json: plan.plan_json as any,
        status: 'in_progress',
        posts_generated: result.generated,
      });
    }

    console.log('');
    console.log(
      dryRun
        ? 'Dry-run complete. No changes persisted.'
        : `Done! Review posts in admin UI: /admin/marketing/social-hub/posts?week=${weekIso}`,
    );
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
