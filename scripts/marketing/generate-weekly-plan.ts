#!/usr/bin/env npx ts-node
/**
 * Generate Weekly Plan — CLI script
 *
 * Usage:
 *   npx ts-node --project backend/tsconfig.json -r tsconfig-paths/register scripts/marketing/generate-weekly-plan.ts --week 2026-W09
 *   npx ts-node --project backend/tsconfig.json -r tsconfig-paths/register scripts/marketing/generate-weekly-plan.ts --week 2026-W09 --gammes disque-frein,plaquette-frein
 *
 * UPSERT via week_iso unique key (idempotent).
 */

import { parseArgs } from "node:util";
import type { Type } from "@nestjs/common";
import {
  DomainValidationException,
  OperationFailedException,
} from "../../backend/src/common/exceptions";
import {
  parsePipelineInput,
  pipelinePlanSchema,
} from "../../backend/src/modules/marketing/dto/marketing-pipeline.dto";
import type {
  DaySlot,
  PriorityGamme,
} from "../../backend/src/modules/marketing/interfaces/marketing-hub.interfaces";

export async function main(args: string[] = process.argv.slice(2)) {
  const { values, tokens } = parseArgs({
    args,
    options: { week: { type: "string" }, gammes: { type: "string" } },
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
  const input = parsePipelineInput(pipelinePlanSchema, {
    week_iso: values.week,
    ...(values.gammes !== undefined
      ? { gamme_aliases: values.gammes.split(",") }
      : {}),
  });
  const weekIso = input.week_iso;

  console.log(`\n--- Marketing Hub: Weekly Plan Generator ---`);
  console.log(`Week: ${weekIso}`);
  if (input.gamme_aliases) {
    console.log(`Gammes: ${input.gamme_aliases.join(", ")}`);
  }
  console.log("");

  // Load the application only after validating all arguments.
  const { NestFactory } = await import("@nestjs/core");
  // AppModule is a runtime DI root. Keep its full application graph out of
  // CLI argument typechecking; Nest validates/initializes it during bootstrap.
  const {
    AppModule,
  }: { AppModule: Type<unknown> } = require("../../backend/src/app.module");
  const { WeeklyPlanGeneratorService } =
    await import("../../backend/src/modules/marketing/services/weekly-plan-generator.service");
  const { MarketingHubDataService } =
    await import("../../backend/src/modules/marketing/services/marketing-hub-data.service");
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn"],
    abortOnError: false,
  });

  try {
    const planGenerator = app.get(WeeklyPlanGeneratorService);
    let priorityGammes: PriorityGamme[] | undefined;
    if (input.gamme_aliases?.length) {
      const hubData = app.get(MarketingHubDataService);
      priorityGammes = [];
      for (const alias of input.gamme_aliases) {
        const gamme = await hubData.resolveGammeAlias(alias);
        if (!gamme) {
          throw new DomainValidationException({
            message: `Unknown gamme alias: ${alias}`,
            field: "gamme_aliases",
          });
        }
        priorityGammes.push(gamme);
      }
    }

    const plan = await planGenerator.generatePlan({
      week_iso: weekIso,
      priority_gammes: priorityGammes,
    });

    if (plan) {
      console.log(`Plan generated successfully!`);
      console.log(`  Status: ${plan.status}`);
      console.log(`  Slots: ${(plan.plan_json as DaySlot[]).length}`);
      console.log(
        `  Gammes: ${(plan.priority_gammes as PriorityGamme[]).length}`,
      );
      console.log("");
      console.log("Slots:");
      for (const slot of plan.plan_json as DaySlot[]) {
        console.log(
          `  Day ${slot.day_of_week} (${slot.date_iso}) — ${slot.pillar} — ${slot.brief.topic}`,
        );
      }
      console.log("");
      console.log(`Next: review in admin UI, then run generate-copy-batch.ts`);
    } else {
      throw new OperationFailedException({
        message: "Failed to generate plan.",
      });
    }
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
