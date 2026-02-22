#!/usr/bin/env npx ts-node
/**
 * Export Publish Queue — CLI script
 *
 * Exports a JSON manifest for Meta Business Suite / YouTube Studio.
 * Idempotent: re-export does not create duplicates.
 *
 * Usage:
 *   npx ts-node scripts/marketing/export-publish-queue.ts --week 2026-W09 --channel instagram
 *   npx ts-node scripts/marketing/export-publish-queue.ts --week 2026-W09 --channel facebook
 *   npx ts-node scripts/marketing/export-publish-queue.ts --week 2026-W09 --channel youtube
 */

import { writeFileSync } from 'fs';
import { join } from 'path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../backend/src/app.module';
import { PublishQueueService } from '../../backend/src/modules/marketing/services/publish-queue.service';
import type { SocialChannel } from '../../backend/src/modules/marketing/interfaces/marketing-hub.interfaces';

const VALID_CHANNELS: SocialChannel[] = ['instagram', 'facebook', 'youtube'];

async function main() {
  const args = process.argv.slice(2);
  const weekIdx = args.indexOf('--week');
  const channelIdx = args.indexOf('--channel');

  if (weekIdx === -1 || !args[weekIdx + 1] || channelIdx === -1 || !args[channelIdx + 1]) {
    console.error('Usage: --week 2026-W09 --channel instagram|facebook|youtube');
    process.exit(1);
  }

  const weekIso = args[weekIdx + 1];
  const channel = args[channelIdx + 1] as SocialChannel;

  if (!/^\d{4}-W\d{2}$/.test(weekIso)) {
    console.error('Invalid week format. Expected: YYYY-WNN');
    process.exit(1);
  }

  if (!VALID_CHANNELS.includes(channel)) {
    console.error(`Invalid channel. Must be one of: ${VALID_CHANNELS.join(', ')}`);
    process.exit(1);
  }

  console.log(`\n--- Marketing Hub: Export Publish Queue ---`);
  console.log(`Week: ${weekIso}`);
  console.log(`Channel: ${channel}`);
  console.log('');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const publishQueue = app.get(PublishQueueService);

    const manifest = await publishQueue.exportManifest(weekIso, channel);

    if (manifest.posts.length === 0) {
      console.warn('No approved posts found for this week/channel.');
      console.warn('Make sure posts are approved in the admin UI first.');
      process.exit(0);
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

    console.log(`Next steps:`);
    console.log(`  1. Open Meta Business Suite (FB/IG) or YouTube Studio`);
    console.log(`  2. Copy captions and schedule at the specified times`);
    console.log(`  3. After publishing, mark as published via admin UI or API`);
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
