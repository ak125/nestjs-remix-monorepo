/**
 * RagKnowledgeBootstrapGuardService
 *
 * Implémente ADR-046 § Layer L3 RAG MIRROR read-only enforcement runtime.
 *
 * Au boot NestJS :
 *   1. Vérifie l'existence de `<RAG_KNOWLEDGE_PATH>/.last-sync.json` (manifest produit
 *      par le cron sync-wiki-exports-to-rag).
 *   2. Vérifie que ce manifest n'est pas obsolète (> 24h).
 *
 * En production (NODE_ENV=production), fail-fast si manifest absent ou obsolète :
 * un L3 stale signale soit un cron mort, soit une migration incomplète, et le
 * service ne doit pas démarrer dans cet état (mémoire incident-images-2026-04-11).
 *
 * En dev/preprod, soft-warn (le manifest peut ne pas exister tant que Phase 3B
 * PR-P n'a pas livré le sync canon).
 *
 * Bypass : `SKIP_RAG_BOOTSTRAP_GUARD=true` (escape hatch dev/CI). À documenter
 * dans tout usage en preprod si activé.
 *
 * Performance : 1 fs.statSync local au boot, < 5ms. Synchrone (memory backend.md
 * "Aucun await d'I/O distante dans onModuleInit" — fs sync local OK).
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

const MANIFEST_FILENAME = '.last-sync.json';
const STALE_THRESHOLD_HOURS = 24;

@Injectable()
export class RagKnowledgeBootstrapGuardService implements OnModuleInit {
  private readonly logger = new Logger(RagKnowledgeBootstrapGuardService.name);

  onModuleInit(): void {
    if (process.env.SKIP_RAG_BOOTSTRAP_GUARD === 'true') {
      this.logger.warn(
        'RAG L3 bootstrap guard SKIPPED via SKIP_RAG_BOOTSTRAP_GUARD=true',
      );
      return;
    }

    const ragDir =
      process.env.RAG_KNOWLEDGE_PATH ?? '/opt/automecanik/rag/knowledge';
    const manifestPath = path.join(ragDir, MANIFEST_FILENAME);
    const isProd = process.env.NODE_ENV === 'production';

    if (!fs.existsSync(manifestPath)) {
      const msg = `[RagKnowledgeBootstrapGuard] manifest absent: ${manifestPath}. Le cron sync-wiki-exports-to-rag doit avoir produit ce fichier (Phase 3B PR-P du plan refondation R-stack).`;
      if (isProd) {
        throw new Error(msg);
      }
      this.logger.warn(
        `${msg} (dev/preprod : soft-warn — Phase 3B livre le sync)`,
      );
      return;
    }

    const stat = fs.statSync(manifestPath);
    const ageHours = (Date.now() - stat.mtimeMs) / 3_600_000;

    if (ageHours > STALE_THRESHOLD_HOURS) {
      const msg = `[RagKnowledgeBootstrapGuard] manifest stale (age=${ageHours.toFixed(1)}h > ${STALE_THRESHOLD_HOURS}h). Le cron sync est probablement en panne — investiguer avant restart.`;
      if (isProd) {
        throw new Error(msg);
      }
      this.logger.warn(`${msg} (dev/preprod : soft-warn)`);
      return;
    }

    this.logger.log(
      `✓ RAG L3 manifest fresh (age=${ageHours.toFixed(1)}h, threshold=${STALE_THRESHOLD_HOURS}h)`,
    );
  }
}
