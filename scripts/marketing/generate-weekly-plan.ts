#!/usr/bin/env npx ts-node
/**
 * Generate Weekly Plan — CLI script
 *
 * Usage:
 *   npx ts-node scripts/marketing/generate-weekly-plan.ts --week 2026-W09
 *   npx ts-node scripts/marketing/generate-weekly-plan.ts --week 2026-W09 --gammes disque-frein,plaquette-frein
 *
 * UPSERT via week_iso unique key (idempotent).
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../backend/src/app.module';
import { WeeklyPlanGeneratorService } from '../../backend/src/modules/marketing/services/weekly-plan-generator.service';
import type { PriorityGamme } from '../../backend/src/modules/marketing/interfaces/marketing-hub.interfaces';

async function main() {
  const args = process.argv.slice(2);
  const weekIdx = args.indexOf('--week');
  const gammesIdx = args.indexOf('--gammes');

  if (weekIdx === -1 || !args[weekIdx + 1]) {
    console.error('Usage: --week 2026-W09 [--gammes alias1,alias2]');
    process.exit(1);
  }

  const weekIso = args[weekIdx + 1];

  // Validate week format
  if (!/^\d{4}-W\d{2}$/.test(weekIso)) {
    console.error('Invalid week format. Expected: YYYY-WNN (e.g. 2026-W09)');
    process.exit(1);
  }

  // Parse optional gammes
  let priorityGammes: PriorityGamme[] | undefined;
  if (gammesIdx !== -1 && args[gammesIdx + 1]) {
    const aliases = args[gammesIdx + 1].split(',');
    priorityGammes = aliases.map((alias, i) => ({
      pg_id: i + 1, // Will be resolved from DB in production
      pg_alias: alias.trim(),
      pg_name: alias.trim().replace(/-/g, ' '),
      reason: 'manual' as const,
    }));
  }

  console.log(`\n--- Marketing Hub: Weekly Plan Generator ---`);
  console.log(`Week: ${weekIso}`);
  if (priorityGammes) {
    console.log(`Gammes: ${priorityGammes.map((g) => g.pg_alias).join(', ')}`);
  }
  console.log('');

  // Bootstrap NestJS app (minimal, no HTTP listener)
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const planGenerator = app.get(WeeklyPlanGeneratorService);

    const plan = await planGenerator.generatePlan({
      week_iso: weekIso,
      priority_gammes: priorityGammes,
    });

    if (plan) {
      console.log(`Plan generated successfully!`);
      console.log(`  Status: ${plan.status}`);
      console.log(`  Slots: ${(plan.plan_json as any[]).length}`);
      console.log(`  Gammes: ${(plan.priority_gammes as any[]).length}`);
      console.log('');
      console.log('Slots:');
      for (const slot of plan.plan_json as any[]) {
        console.log(
          `  Day ${slot.day_of_week} (${slot.date_iso}) — ${slot.pillar} — ${slot.brief.topic}`,
        );
      }
      console.log('');
      console.log(`Next: review in admin UI, then run generate-copy-batch.ts`);
    } else {
      console.error('Failed to generate plan.');
      process.exit(1);
    }
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
