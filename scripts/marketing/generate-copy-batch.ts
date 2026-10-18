#!/usr/bin/env npx ts-node
/**
 * Generate Copy Batch — CLI script
 *
 * Generates copy for all slots in an approved weekly plan.
 * Auto-runs brand + compliance gates after generation.
 *
 * Usage:
 *   npx ts-node --project backend/tsconfig.json -r tsconfig-paths/register scripts/marketing/generate-copy-batch.ts --week 2026-W09
 *   npx ts-node --project backend/tsconfig.json -r tsconfig-paths/register scripts/marketing/generate-copy-batch.ts --week 2026-W09 --dry-run
 *
 * --dry-run validates arguments only: no plan read, bootstrap or generation.
 */

import { parseArgs } from "node:util";
import type { Type } from "@nestjs/common";
import {
  DomainValidationException,
  OperationFailedException,
} from "../../backend/src/common/exceptions";
import {
  parsePipelineInput,
  pipelineCopySchema,
} from "../../backend/src/modules/marketing/dto/marketing-pipeline.dto";

export async function main(args: string[] = process.argv.slice(2)) {
  const { values, tokens } = parseArgs({
    args,
    options: { week: { type: "string" }, "dry-run": { type: "boolean" } },
    strict: true,
    allowPositionals: false,
    tokens: true,
  });
  const seen = new Set<string>();
  for (const token of tokens) {
    if (token.kind !== "option") continue;
    if (seen.has(token.name)) {
      throw new DomainValidationException({
        message: `Duplicate option: --${token.name}`,
        field: token.name,
      });
    }
    seen.add(token.name);
  }
  const { week_iso: weekIso, dry_run: dryRun } = parsePipelineInput(
    pipelineCopySchema,
    {
      week_iso: values.week,
      dry_run: values["dry-run"] ?? false,
    },
  );

  console.log(`\n--- Marketing Hub: Copy Batch Generator ---`);
  console.log(`Week: ${weekIso}`);
  console.log(`Mode: ${dryRun ? "DRY-RUN (arguments only)" : "LIVE"}`);
  console.log("");

  if (dryRun) {
    console.log(
      "Dry-run complete. Arguments validated only; no plan loaded, content generated, or data persisted.",
    );
    return;
  }

  const { NestFactory } = await import("@nestjs/core");
  // AppModule is a runtime DI root, loaded only for an execution request.
  const {
    AppModule,
  }: { AppModule: Type<unknown> } = require("../../backend/src/app.module");
  const { MarketingHubDataService } =
    await import("../../backend/src/modules/marketing/services/marketing-hub-data.service");
  const { MultiChannelCopywriterService } =
    await import("../../backend/src/modules/marketing/services/multi-channel-copywriter.service");
  const { BrandComplianceGateService } =
    await import("../../backend/src/modules/marketing/services/brand-compliance-gate.service");
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn"],
    abortOnError: false,
  });

  try {
    const hubData = app.get(MarketingHubDataService);
    const copywriter = app.get(MultiChannelCopywriterService);
    const gateService = app.get(BrandComplianceGateService);

    // 1. Load weekly plan
    const plan = await hubData.getWeeklyPlan(weekIso);
    if (!plan) {
      throw new OperationFailedException({
        message: `No plan found for ${weekIso}. Run generate-weekly-plan.ts first.`,
      });
    }

    if (plan.status !== "approved" && plan.status !== "draft") {
      console.warn(
        `Plan status is "${plan.status}". Expected "approved" or "draft".`,
      );
    }

    const slots = plan.plan_json;
    console.log(`Plan loaded: ${slots.length} slots`);
    console.log("");

    // 2. Generate copy for all slots
    console.log("Generating copy...");
    const result = await copywriter.generateBatch(slots, weekIso, false);
    console.log(`  Generated: ${result.generated}`);
    console.log(`  Errors: ${result.errors}`);
    console.log("");

    // 3. Run gates on generated posts.
    if (result.generated > 0) {
      console.log("Running brand + compliance gates...");
      const posts = await hubData.getPostsByWeek(weekIso, "generated");

      let passed = 0;
      let warned = 0;
      let failed = 0;

      for (const post of posts) {
        const summary = await gateService.evaluateAndPersist(post);
        if (
          summary.brand.level === "FAIL" ||
          summary.compliance.level === "FAIL"
        ) {
          failed++;
          console.log(
            `  FAIL: Post ${post.id} (${post.slot_label}) — ${summary.blocking_issues.join("; ")}`,
          );
        } else if (
          summary.brand.level === "WARN" ||
          summary.compliance.level === "WARN"
        ) {
          warned++;
          console.log(
            `  WARN: Post ${post.id} (${post.slot_label}) — approuvable avec avertissements`,
          );
        } else {
          passed++;
        }
      }

      console.log("");
      console.log(
        `Gate results: ${passed} PASS, ${warned} WARN, ${failed} FAIL`,
      );

      // Update plan counters
      await hubData.upsertWeeklyPlan({
        week_iso: weekIso,
        priority_gammes: plan.priority_gammes,
        calendar_rules: plan.calendar_rules,
        plan_json: plan.plan_json,
        status: "in_progress",
        posts_generated: result.generated,
      });
    }

    if (result.errors > 0) {
      throw new OperationFailedException({
        message: `Copy batch incomplete: ${result.generated} generated, ${result.errors} errors. Review existing posts before retrying.`,
      });
    }

    console.log("");
    console.log(
      `Done! Review posts in admin UI: /admin/marketing/social-hub/posts?week=${weekIso}`,
    );
  } finally {
    await app.close();
  }
}

if (require.main === module) {
  main().catch((err: unknown) => {
    console.error(
      "Fatal error:",
      err instanceof Error ? err.message : "Unknown failure",
    );
    process.exitCode = 1;
  });
}
