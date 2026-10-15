#!/usr/bin/env npx ts-node
/**
 * Export Publish Queue — CLI script
 *
 * Exports editorial preparation only; no account or publication authorization.
 * Stable entry IDs support comparison, not remote publication deduplication.
 *
 * From the repository root, set TS_NODE_PROJECT=backend/tsconfig.json, then:
 *   node -r ts-node/register/transpile-only -r tsconfig-paths/register scripts/marketing/export-publish-queue.ts --week 2026-W09 --channel instagram
 * Channels: instagram | facebook | youtube. Existing DB environment required.
 */

import { writeFileSync } from 'fs';
import { join } from 'path';
import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { PublishQueueService } from '../../backend/src/modules/marketing/services/publish-queue.service';
import { MarketingHubDataService } from '../../backend/src/modules/marketing/services/marketing-hub-data.service';
import { UTMBuilderService } from '../../backend/src/modules/marketing/services/utm-builder.service';
import { parseSocialExport } from '../../backend/src/modules/marketing/dto/social-export.dto';

// Deliberately excludes AppModule: no scheduler, worker or startup write.
@Module({
  providers: [PublishQueueService, MarketingHubDataService, UTMBuilderService],
})
export class MarketingExportModule {}

async function main() {
  const args = process.argv.slice(2);
  const weekIdx = args.indexOf('--week');
  const channelIdx = args.indexOf('--channel');

  if (
    weekIdx === -1 ||
    !args[weekIdx + 1] ||
    channelIdx === -1 ||
    !args[channelIdx + 1]
  ) {
    console.error(
      'Usage: --week 2026-W09 --channel instagram|facebook|youtube',
    );
    process.exitCode = 1;
    return;
  }

  const { week: weekIso, channel } = parseSocialExport({
    week: args[weekIdx + 1],
    channel: args[channelIdx + 1],
  });

  console.log(`\n--- Marketing Hub: Export Publish Queue ---`);
  console.log(`Week: ${weekIso}`);
  console.log(`Channel: ${channel}`);
  console.log('');

  const app = await NestFactory.createApplicationContext(
    MarketingExportModule,
    {
      logger: ['error', 'warn'],
    },
  );

  try {
    const publishQueue = app.get(PublishQueueService);

    const manifest = await publishQueue.exportManifest(weekIso, channel);

    if (manifest.posts.length === 0) {
      console.warn('No approved posts found for this week/channel.');
      console.warn('Make sure posts are approved in the admin UI first.');
      return;
    }

    // Write manifest to file
    const filename = `manifest_${weekIso}_${channel}.json`;
    const filepath = join(process.cwd(), filename);
    writeFileSync(filepath, JSON.stringify(manifest, null, 2), 'utf-8');

    console.log(`Manifest exported: ${filename}`);
    console.log(`  Posts: ${manifest.posts.length}`);
    console.log('');
    console.log('Posts in manifest:');
    for (const post of manifest.posts) {
      console.log(
        `  #${post.post_id} — ${post.scheduled_date} ${post.scheduled_time} — ${post.format}`,
      );
      console.log(`    Caption: ${post.caption.substring(0, 80)}...`);
      console.log(`    Link: ${post.link}`);
      console.log('');
    }

    console.log(
      'Editorial preparation only — publication is not authorized by this export.',
    );
    console.log(
      'Next: bind the intended account, final media where required, and a separate publication approval.',
    );
    console.log(
      'Keep the exported version and checksum; remote publication evidence remains a separate step.',
    );
  } finally {
    await app.close();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Fatal error:', err.message);
    process.exitCode = 1;
  });
}
