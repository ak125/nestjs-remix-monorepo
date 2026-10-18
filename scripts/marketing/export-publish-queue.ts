#!/usr/bin/env npx ts-node
/**
 * Export Publish Queue — CLI script
 *
 * Exports a JSON manifest for Meta Business Suite / YouTube Studio.
 * Idempotent: re-export does not create duplicates.
 *
 * Usage:
 *   npx ts-node --project backend/tsconfig.json -r tsconfig-paths/register scripts/marketing/export-publish-queue.ts --week 2026-W09 --channel instagram
 *
 * A successful export replaces the current manifest even when the queue is empty.
 * It is an editorial snapshot, not a publication or a permanent authorization.
 */

import { writeFileSync } from "fs";
import { join } from "path";
import { parseArgs } from "node:util";
import type { Type } from "@nestjs/common";
import { DomainValidationException } from "../../backend/src/common/exceptions";
import { parseSocialExport } from "../../backend/src/modules/marketing/dto/social-export.dto";

export async function main(args: string[] = process.argv.slice(2)) {
  const { values, tokens } = parseArgs({
    args,
    options: { week: { type: "string" }, channel: { type: "string" } },
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
  const { week: weekIso, channel } = parseSocialExport(values);

  console.log(`\n--- Marketing Hub: Export Publish Queue ---`);
  console.log(`Week: ${weekIso}`);
  console.log(`Channel: ${channel}`);
  console.log("");

  const { NestFactory } = await import("@nestjs/core");
  // Keep the application DI root outside argument validation and import-only use.
  const {
    AppModule,
  }: { AppModule: Type<unknown> } = require("../../backend/src/app.module");
  const { PublishQueueService } =
    await import("../../backend/src/modules/marketing/services/publish-queue.service");
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn"],
    abortOnError: false,
  });

  try {
    const publishQueue = app.get(PublishQueueService);

    const manifest = await publishQueue.exportManifest(weekIso, channel);

    // Also replace an earlier export after approvals are revoked or published.
    const filename = `manifest_${weekIso}_${channel}.json`;
    const filepath = join(process.cwd(), filename);
    writeFileSync(filepath, JSON.stringify(manifest, null, 2), "utf-8");

    console.log(`Manifest exported: ${filename}`);
    console.log(`  Posts: ${manifest.posts.length}`);
    if (manifest.posts.length === 0) {
      console.warn(
        "No approved unpublished posts for this week/channel. Empty manifest saved.",
      );
      return;
    }
    console.log("");
    console.log("Posts in manifest:");
    for (const post of manifest.posts) {
      console.log(
        `  #${post.post_id} — ${post.scheduled_date} ${post.scheduled_time} — ${post.format}`,
      );
      console.log(`    Caption: ${post.caption.substring(0, 80)}...`);
      console.log(`    Link: ${post.link}`);
      console.log("");
    }

    console.log(`Next steps:`);
    console.log(`  1. Open Meta Business Suite (FB/IG) or YouTube Studio`);
    console.log(`  2. Copy captions and schedule at the specified times`);
    console.log(`  3. After publishing, mark as published via admin UI or API`);
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
