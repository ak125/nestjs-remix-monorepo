import { Injectable, Logger } from '@nestjs/common';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  CanonicalRegistrySchema,
  PlanningRegistrySchema,
  type CanonicalRegistry,
} from '@repo/registry';
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
    const planning = this.readJson<unknown>('planning.json');

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
    const parsed = CanonicalRegistrySchema.safeParse(canonical);
    if (!parsed.success) {
      this.logger.warn('[control-plane] invalid canonical registry schema');
      return null;
    }
    // Keep Layer 2 ownership/domain annotations: not every Layer 1 entry schema
    // declares them. Use schema defaults only for omitted sections.
    const sections = {
      files: canonical.files ?? parsed.data.files,
      db: canonical.db?.tables ?? parsed.data.db.tables,
      rpc: canonical.db?.rpc ?? parsed.data.db.rpc,
      deps: canonical.deps ?? parsed.data.deps,
      runtime: canonical.runtime ?? parsed.data.runtime,
    };
    const counts: Record<string, number> = {};
    const domains = new Set<string>();
    let ownershipGaps = 0;

    for (const [s, entries] of Object.entries(sections)) {
      counts[s] = entries.length;
      for (const e of entries) {
        const { domain, owner } = e as CanonicalAnnotation;
        if (domain) domains.add(domain);
        if (!owner || owner === '__unassigned__') ownershipGaps += 1;
      }
    }

    return {
      counts,
      domainCount: domains.size,
      ownershipGaps,
      sotFingerprint: canonical.meta?.sotFingerprint ?? null,
    };
  }

  private aggregateWip(planning: unknown): WipSummary {
    const parsed = PlanningRegistrySchema.safeParse(planning);
    if (!parsed.success || parsed.data.meta.degraded) {
      if (planning !== null && !parsed.success) {
        this.logger.warn('[control-plane] invalid planning registry schema');
      }
      return {
        degraded: true,
        generatedAt: parsed.success ? parsed.data.meta.generatedAt : null,
        prCount: null,
        byStatus: {},
        byWorkType: {},
        stacks: null,
        zombies: null,
        topStale: [],
      };
    }

    const entries = parsed.data.entries;
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
      generatedAt: parsed.data.meta.generatedAt,
      prCount: entries.length,
      byStatus,
      byWorkType,
      stacks,
      zombies,
      topStale,
    };
  }
}

// The builder adds this fingerprint to the shared canonical metadata contract.
type CanonicalDoc = CanonicalRegistry & {
  meta: CanonicalRegistry['meta'] & { sotFingerprint?: string };
};
type CanonicalAnnotation = Partial<
  Pick<CanonicalRegistry['files'][number], 'domain' | 'owner'>
>;

export interface RepoSummary {
  counts: Record<string, number>;
  domainCount: number;
  ownershipGaps: number;
  sotFingerprint: string | null;
}
export interface WipSummary {
  degraded: boolean;
  generatedAt: string | null;
  prCount: number | null;
  byStatus: Record<string, number>;
  byWorkType: Record<string, number>;
  stacks: number | null;
  zombies: number | null;
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
