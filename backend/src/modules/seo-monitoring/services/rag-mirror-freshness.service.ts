/**
 * RAG Mirror Freshness Service
 *
 * Lit le manifest `.last-sync.json` produit par le cron canon
 * `sync-wiki-exports-to-rag.py` (PR-E.2) et expose un statut de
 * fraîcheur de la mirror L3 RAG (ADR-046 § Layer L3 RAG MIRROR
 * read-only).
 *
 * Le manifest a le schema suivant (cf. `scripts/rag-sync/sync-wiki-exports-to-rag.py`) :
 *   {
 *     "schema_version": "1.0.0",
 *     "synced_at": "2026-05-07T13:25:00Z",
 *     "source": "/opt/automecanik-wiki/exports/rag",
 *     "stats": { "exports_total": N, "written": N, "skipped": N, "failed": 0 },
 *     "topic_counts": { "constructeurs": 36, "gammes": 0, "vehicles": 0 }
 *   }
 *
 * Refs :
 * - ADR-046 § Layer L3 RAG MIRROR read-only (vault PR #183)
 * - Plan SEO 2026 § Phase 1 PR-E (runtime guard)
 * - Couplé à `scripts/ops/lock-rag-knowledge.sh` (PR-E.1) et ast-grep
 *   `no-direct-rag-knowledge-write.yml` (PR-A)
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

const DEFAULT_RAG_KNOWLEDGE_PATH = '/opt/automecanik/rag/knowledge';
const STALE_THRESHOLD_HOURS_DEFAULT = 36; // J-3 nominal + 12h tolérance

export type MirrorStatus = 'healthy' | 'stale' | 'unknown' | 'manifest_missing';

export interface MirrorFreshnessResult {
  status: MirrorStatus;
  manifestPath: string;
  syncedAt: string | null;
  ageHours: number | null;
  staleThresholdHours: number;
  schemaVersion: string | null;
  topicCounts: Record<string, number> | null;
  source: string | null;
  lastSyncStats: {
    exportsTotal: number;
    written: number;
    skipped: number;
    failed: number;
  } | null;
  message?: string;
}

@Injectable()
export class RagMirrorFreshnessService {
  private readonly logger = new Logger(RagMirrorFreshnessService.name);
  private readonly ragKnowledgePath: string;
  private readonly staleThresholdHours: number;

  constructor(configService: ConfigService) {
    this.ragKnowledgePath =
      configService.get<string>('RAG_KNOWLEDGE_PATH') ||
      DEFAULT_RAG_KNOWLEDGE_PATH;
    this.staleThresholdHours =
      Number(configService.get<string>('RAG_MIRROR_STALE_THRESHOLD_HOURS')) ||
      STALE_THRESHOLD_HOURS_DEFAULT;
  }

  /**
   * Read `.last-sync.json` and return freshness status.
   *
   * Never throws — returns `{status: 'unknown'}` or `'manifest_missing'`
   * with a `message` if I/O or parse fails. Health endpoint can decide
   * whether to alert based on environment (DEV tolerates, PROD alerts).
   */
  async checkFreshness(): Promise<MirrorFreshnessResult> {
    const manifestPath = path.join(this.ragKnowledgePath, '.last-sync.json');
    const baseResult: MirrorFreshnessResult = {
      status: 'unknown',
      manifestPath,
      syncedAt: null,
      ageHours: null,
      staleThresholdHours: this.staleThresholdHours,
      schemaVersion: null,
      topicCounts: null,
      source: null,
      lastSyncStats: null,
    };

    let raw: string;
    try {
      raw = await fs.readFile(manifestPath, 'utf8');
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') {
        return {
          ...baseResult,
          status: 'manifest_missing',
          message: `Manifest absent (cron sync-wiki-exports-to-rag.py n'a jamais tourné ?). Path: ${manifestPath}`,
        };
      }
      return {
        ...baseResult,
        status: 'unknown',
        message: `I/O error reading manifest: ${(e as Error).message}`,
      };
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch (e) {
      return {
        ...baseResult,
        status: 'unknown',
        message: `Manifest JSON parse error: ${(e as Error).message}`,
      };
    }

    const syncedAtStr =
      typeof parsed.synced_at === 'string' ? parsed.synced_at : null;
    if (!syncedAtStr) {
      return {
        ...baseResult,
        status: 'unknown',
        message: 'Manifest missing required field `synced_at`',
      };
    }

    const syncedAt = new Date(syncedAtStr);
    if (Number.isNaN(syncedAt.getTime())) {
      return {
        ...baseResult,
        status: 'unknown',
        message: `Manifest \`synced_at\` is not parseable: ${syncedAtStr}`,
      };
    }

    const ageMs = Date.now() - syncedAt.getTime();
    const ageHours = Math.round((ageMs / 3_600_000) * 100) / 100;
    const isStale = ageHours > this.staleThresholdHours;

    const stats = parsed.stats as Record<string, number> | undefined;

    return {
      manifestPath,
      status: isStale ? 'stale' : 'healthy',
      syncedAt: syncedAtStr,
      ageHours,
      staleThresholdHours: this.staleThresholdHours,
      schemaVersion:
        typeof parsed.schema_version === 'string'
          ? parsed.schema_version
          : null,
      topicCounts:
        parsed.topic_counts && typeof parsed.topic_counts === 'object'
          ? (parsed.topic_counts as Record<string, number>)
          : null,
      source: typeof parsed.source === 'string' ? parsed.source : null,
      lastSyncStats: stats
        ? {
            exportsTotal: Number(stats.exports_total) || 0,
            written: Number(stats.written) || 0,
            skipped: Number(stats.skipped) || 0,
            failed: Number(stats.failed) || 0,
          }
        : null,
    };
  }
}
