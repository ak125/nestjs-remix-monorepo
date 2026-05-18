/**
 * RagKnowledgeBootstrapGuardService
 *
 * Implémente ADR-046 § Layer L3 RAG MIRROR read-only enforcement runtime.
 *
 * Au boot NestJS :
 *   1. Vérifie l'existence de `<RAG_KNOWLEDGE_PATH>/.last-sync.json` (manifest produit
 *      par le cron sync-wiki-exports-to-rag — livré par PR #369 / Phase 3B PR-P).
 *   2. Vérifie que ce manifest n'est pas obsolète (> 24h).
 *
 * Modes (matrice explicite) :
 *
 * | NODE_ENV     | APP_ENV / READ_ONLY  | RAG_L3_GUARD_ENFORCE | Comportement |
 * |--------------|----------------------|----------------------|--------------|
 * | production   | (other)              | true                 | fail-fast    |
 * | production   | preprod / true       | (any)                | soft-warn    |
 * | production   | (other)              | false / unset        | soft-warn    |
 * | non-prod     | (any)                | (any)                | soft-warn    |
 *
 * `RAG_L3_GUARD_ENFORCE=true` est l'**opt-in explicite** activé seulement quand
 * Phase 3B est entièrement livrée : (a) cron sync-wiki-exports-to-rag écrit le
 * manifest sur DEV VPS (PR #369 mergée), et (b) le manifest est délivré sur
 * PROD VPS via le mécanisme de mirror (git pull `automecanik-rag` ou équivalent
 * vérifié sur 49.12.233.2). Tant que ces deux préconditions ne sont pas
 * empiriquement validées, la guard reste informative (warn-only) y compris
 * en prod — pour ne pas casser les deploys avant que sa dépendance soit live.
 *
 * Précédent : PR #356 (introduction guard) déclarait dans son body « Tant que
 * Phase 3B non livrée, le bootstrap guard reste soft-warn en dev/preprod » —
 * mais activait fail-fast en prod par défaut. Conséquence empirique :
 * deploy-prod.yml du tag v2026.05.10-lcp-r3-cache (run 25636043816) a thrown
 * « manifest absent » et bloqué le rollout R3 LCP cache (PR #408). Ce flag
 * encode l'intention explicite de l'auteur en config plutôt qu'en assumption.
 *
 * Bypass d'urgence : `SKIP_RAG_BOOTSTRAP_GUARD=true` (escape hatch dev/CI,
 * NE PAS utiliser en prod — sert à débloquer perf-gates en CI ou dev local).
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
    const isReadOnlyPreprod =
      process.env.APP_ENV === 'preprod' || process.env.READ_ONLY === 'true';
    const enforceFailFast = process.env.RAG_L3_GUARD_ENFORCE === 'true';
    const shouldFailFast =
      process.env.NODE_ENV === 'production' &&
      !isReadOnlyPreprod &&
      enforceFailFast;

    if (!fs.existsSync(manifestPath)) {
      const msg = `[RagKnowledgeBootstrapGuard] manifest absent: ${manifestPath}. Le cron sync-wiki-exports-to-rag doit avoir produit ce fichier (Phase 3B PR-P / PR #369).`;
      if (shouldFailFast) {
        throw new Error(msg);
      }
      this.logger.warn(
        `${msg} (warn-only : RAG_L3_GUARD_ENFORCE absent ou Phase 3B pas encore activée)`,
      );
      return;
    }

    const stat = fs.statSync(manifestPath);
    const ageHours = (Date.now() - stat.mtimeMs) / 3_600_000;

    if (ageHours > STALE_THRESHOLD_HOURS) {
      const msg = `[RagKnowledgeBootstrapGuard] manifest stale (age=${ageHours.toFixed(1)}h > ${STALE_THRESHOLD_HOURS}h). Le cron sync est probablement en panne — investiguer avant restart.`;
      if (shouldFailFast) {
        throw new Error(msg);
      }
      this.logger.warn(
        `${msg} (warn-only : RAG_L3_GUARD_ENFORCE absent ou Phase 3B pas encore activée)`,
      );
      return;
    }

    this.logger.log(
      `✓ RAG L3 manifest fresh (age=${ageHours.toFixed(1)}h, threshold=${STALE_THRESHOLD_HOURS}h)`,
    );
  }
}
