import { Injectable, Logger } from '@nestjs/common';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { CacheService } from '../../../cache/cache.service';

/**
 * Read-only aggregator for the Repository Control Plane registries (ADR-058)
 * + the planning PR-projection (ADR-053). Powers the `/admin/control-plane`
 * dashboard (PR-CP-3).
 *
 * Reads the committed `canonical.json` (always present in the image) and the
 * gitignored `planning.json` (present only where the builder has run, e.g. DEV).
 * Both reads degrade gracefully — a missing/invalid file yields a degraded
 * summary, never a thrown error.
 *
 * Path is env-overridable (`REGISTRY_DIR`); default resolves from the runtime
 * CWD (monorepo root in DEV, app workdir in the container). No hardcoded /opt.
 */
@Injectable()
export class RegistryReaderService {
  private readonly logger = new Logger(RegistryReaderService.name);
  private readonly registryDir =
    process.env.REGISTRY_DIR || join(process.cwd(), 'audit', 'registry');

  private static readonly CACHE_KEY = 'admin:control-plane:summary';
  private static readonly TTL_OK = 60; // valid aggregate
  private static readonly TTL_DEGRADED = 15; // empty/degraded path — short TTL per cache-poisoning guard

  constructor(private readonly cacheService: CacheService) {}

  private readJson<T>(file: string): T | null {
    const filePath = join(this.registryDir, file);
    try {
      if (!existsSync(filePath)) return null;
      return JSON.parse(readFileSync(filePath, 'utf-8')) as T;
    } catch (e) {
      this.logger.warn(`[control-plane] failed reading ${file}: ${e}`);
      return null;
    }
  }

  /** Cache-aside aggregate. Degraded results get a short TTL (poisoning guard). */
  async getControlPlaneSummary(): Promise<ControlPlaneSummary> {
    const cached = await this.cacheService.get<ControlPlaneSummary>(
      RegistryReaderService.CACHE_KEY,
    );
    if (cached) return cached;

    const summary = this.buildSummary();
    await this.cacheService.set(
      RegistryReaderService.CACHE_KEY,
      summary,
      summary.degraded
        ? RegistryReaderService.TTL_DEGRADED
        : RegistryReaderService.TTL_OK,
    );
    return summary;
  }

  /** Pure aggregation (no I/O beyond the two file reads). */
  private buildSummary(): ControlPlaneSummary {
    const canonical = this.readJson<CanonicalDoc>('canonical.json');
    const planning = this.readJson<PlanningDoc>('planning.json');

    const repo = this.aggregateRepo(canonical);
    const wip = this.aggregateWip(planning);

    return {
      generatedAt: new Date().toISOString(),
      degraded: repo === null || wip.degraded,
      repo,
      wip,
    };
  }

  private aggregateRepo(canonical: CanonicalDoc | null): RepoSummary | null {
    if (!canonical) return null;
    const sections = ['files', 'db', 'rpc', 'deps', 'runtime'] as const;
    const counts: Record<string, number> = {};
    const domains = new Set<string>();
    let ownershipGaps = 0;

    for (const s of sections) {
      const entries = Array.isArray(canonical[s]) ? canonical[s]! : [];
      counts[s] = entries.length;
      for (const e of entries) {
        if (e?.domain) domains.add(e.domain);
        if (!e?.owner || e.owner === '__unassigned__') ownershipGaps += 1;
      }
    }

    return {
      counts,
      domainCount: domains.size,
      ownershipGaps,
      sotFingerprint: canonical.meta?.sotFingerprint ?? null,
    };
  }

  private aggregateWip(planning: PlanningDoc | null): WipSummary {
    if (
      !planning ||
      planning.meta?.degraded ||
      !Array.isArray(planning.entries)
    ) {
      return {
        degraded: true,
        generatedAt: planning?.meta?.generatedAt ?? null,
        prCount: 0,
        byStatus: {},
        byWorkType: {},
        stacks: 0,
        zombies: 0,
        topStale: [],
      };
    }

    const entries = planning.entries;
    const byStatus: Record<string, number> = {};
    const byWorkType: Record<string, number> = {};
    let stacks = 0;
    let zombies = 0;

    for (const e of entries) {
      byStatus[e.status] = (byStatus[e.status] ?? 0) + 1;
      const wt = e.workType ?? 'unlabeled';
      byWorkType[wt] = (byWorkType[wt] ?? 0) + 1;
      if (e.isStack) stacks += 1;
      if ((e.stalenessDays ?? 0) > 14) zombies += 1;
    }

    const topStale = [...entries]
      .sort((a, b) => (b.stalenessDays ?? 0) - (a.stalenessDays ?? 0))
      .slice(0, 10)
      .map((e) => ({
        number: e.number,
        title: e.title,
        url: e.url,
        status: e.status,
        priority: e.priority,
        workType: e.workType,
        stalenessDays: e.stalenessDays,
        ageDays: e.ageDays,
        isStack: e.isStack,
      }));

    return {
      degraded: false,
      generatedAt: planning.meta?.generatedAt ?? null,
      prCount: entries.length,
      byStatus,
      byWorkType,
      stacks,
      zombies,
      topStale,
    };
  }
}

// ── Shapes (loose — defensive against registry schema drift) ───────────────
interface CanonicalEntry {
  domain?: string;
  owner?: string;
}
interface CanonicalDoc {
  files?: CanonicalEntry[];
  db?: CanonicalEntry[];
  rpc?: CanonicalEntry[];
  deps?: CanonicalEntry[];
  runtime?: CanonicalEntry[];
  meta?: { sotFingerprint?: string };
}
interface PlanningPr {
  number: number;
  title: string;
  url: string;
  status: string;
  priority: string;
  workType: string | null;
  isStack: boolean;
  ageDays: number;
  stalenessDays: number;
}
interface PlanningDoc {
  meta?: { generatedAt?: string; degraded?: boolean };
  entries?: PlanningPr[];
}

export interface RepoSummary {
  counts: Record<string, number>;
  domainCount: number;
  ownershipGaps: number;
  sotFingerprint: string | null;
}
export interface WipSummary {
  degraded: boolean;
  generatedAt: string | null;
  prCount: number;
  byStatus: Record<string, number>;
  byWorkType: Record<string, number>;
  stacks: number;
  zombies: number;
  topStale: Array<{
    number: number;
    title: string;
    url: string;
    status: string;
    priority: string;
    workType: string | null;
    stalenessDays: number;
    ageDays: number;
    isStack: boolean;
  }>;
}
export interface ControlPlaneSummary {
  generatedAt: string;
  degraded: boolean;
  repo: RepoSummary | null;
  wip: WipSummary;
}
