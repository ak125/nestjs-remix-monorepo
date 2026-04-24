/**
 * EngineProfileRagLoader
 * ----------------------
 * Runtime reader of the engine-profile mapping YAML and the gamme frontmatter
 * files. Provides the S_MOTOR_ISSUES content for R8 vehicle pages by composing
 * symptom labels extracted directly from the RAG editorial source.
 *
 * Source of truth (ADR-015, feedback_rag_vault_always_first.md) :
 *   - Mapping : /opt/automecanik/rag/knowledge/seo/engine-profile-mapping.yaml
 *   - Gammes  : /opt/automecanik/rag/knowledge/gammes/<slug>.md (frontmatter)
 *
 * No content is stored in TypeScript. Editing a gamme .md or the mapping YAML
 * affects the next R8 enrichment without rebuild/deploy (cache TTL below).
 *
 * Cache policy :
 *   - Mapping YAML : loaded once, cached until `clearCache()` or ttl expires.
 *   - Gamme files  : loaded once per slug, same TTL.
 *   - TTL default  : 5 minutes (env override via RAG_LOADER_TTL_MS).
 *
 * Tests : engine-profile-rag-loader.service.test.ts (FS mocked).
 */
import { Injectable, Logger } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as yaml from 'js-yaml';
import { RAG_KNOWLEDGE_PATH } from '../../../config/rag.config';
import type { EngineProfileKey } from '../../../config/engine-profile.config';

// ── YAML mapping shape ──────────────────────────────────────────────────────

interface ProfileEntry {
  description: string;
  gammes: string[];
}

interface EngineProfileMapping {
  schema_version: number;
  updated_at?: string;
  profiles: Record<string, ProfileEntry | undefined>;
  seo_openers: string[];
}

// ── Gamme frontmatter shape (partial) ───────────────────────────────────────

interface GammeFrontmatter {
  title?: string;
  slug?: string;
  domain?: { role?: string };
  diagnostic?: {
    symptoms?: Array<{ id?: string; label?: string; severity?: string }>;
  };
}

interface GammeSummary {
  title: string;
  role: string;
  symptomLabels: string[];
}

// ── Cache entry ─────────────────────────────────────────────────────────────

interface CacheEntry<T> {
  value: T;
  loadedAt: number;
}

// ── Safety defaults used when mapping entry has no match ────────────────────

const FALLBACK_KEY: EngineProfileKey = 'inconnu_p3_moyenne';
const FALLBACK_DESCRIPTION =
  'Motorisation spécifique à ce modèle — consulter la documentation constructeur.';
const FALLBACK_ISSUES: readonly string[] = [
  'Filtre à air à remplacer selon kilométrage constructeur',
  'Plaquettes et disques de frein à contrôler tous les 30 000 km',
  'Batterie de démarrage à tester au-delà de 4 ans',
];
const FALLBACK_OPENERS: readonly string[] = [
  "Points techniques sensibles pour la motorisation {type} {power} ch — vérifiez ces éléments à l'entretien.",
];

@Injectable()
export class EngineProfileRagLoader {
  private readonly logger = new Logger(EngineProfileRagLoader.name);
  private readonly mappingPath = join(
    RAG_KNOWLEDGE_PATH,
    'seo',
    'engine-profile-mapping.yaml',
  );
  private readonly gammesDir = join(RAG_KNOWLEDGE_PATH, 'gammes');
  private readonly ttlMs = Number(
    process.env.RAG_LOADER_TTL_MS ?? 5 * 60 * 1000,
  );

  private mappingCache: CacheEntry<EngineProfileMapping> | null = null;
  private gammeCache = new Map<string, CacheEntry<GammeSummary | null>>();

  /**
   * Returns the S_MOTOR_ISSUES content lines for a given profile.
   * Each line is composed as `<gamme title> : <symptom1>, <symptom2>`.
   *
   * Falls back cascade :
   *   1. profile key exact match in mapping
   *   2. cascade ethanol/gpl/hybride_essence → essence same tier
   *   3. cascade hybride_diesel → diesel same tier
   *   4. FALLBACK_KEY (inconnu_p3_moyenne)
   *   5. hardcoded FALLBACK_ISSUES (only if RAG unreachable)
   */
  getIssues(profile: EngineProfileKey): string[] {
    const entry = this.resolveProfile(profile);
    if (!entry) return [...FALLBACK_ISSUES];

    const lines: string[] = [];
    for (const slug of entry.gammes) {
      const gamme = this.loadGamme(slug);
      if (!gamme) continue;
      const labels = gamme.symptomLabels.slice(0, 2);
      if (labels.length === 0) {
        if (gamme.role) {
          lines.push(
            `${gamme.title} : à vérifier lors de l'entretien (${gamme.role.toLowerCase()})`,
          );
        }
        continue;
      }
      const joined = labels.join(', ');
      const sentence =
        joined.length > 0 ? joined[0].toUpperCase() + joined.slice(1) : joined;
      lines.push(`${gamme.title} : ${sentence}`);
    }
    return lines.length > 0 ? lines : [...FALLBACK_ISSUES];
  }

  /**
   * Returns the technical description paragraph for a given profile.
   * Same cascade as getIssues.
   */
  getDescription(profile: EngineProfileKey): string {
    const entry = this.resolveProfile(profile);
    if (!entry) return FALLBACK_DESCRIPTION;
    return (entry.description || FALLBACK_DESCRIPTION).trim();
  }

  /**
   * Returns the list of SEO opener variants (to be rotated per typeId by
   * the enricher using `selectVariation`). Loaded from the YAML.
   */
  getSeoOpeners(): readonly string[] {
    const mapping = this.loadMapping();
    if (
      !mapping ||
      !Array.isArray(mapping.seo_openers) ||
      mapping.seo_openers.length === 0
    ) {
      return FALLBACK_OPENERS;
    }
    return mapping.seo_openers;
  }

  /**
   * Invalidate caches. Used in tests and on explicit admin reload.
   */
  clearCache(): void {
    this.mappingCache = null;
    this.gammeCache.clear();
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private resolveProfile(profile: EngineProfileKey): ProfileEntry | null {
    const mapping = this.loadMapping();
    if (!mapping) return null;
    const direct = mapping.profiles[profile];
    if (direct) return direct;

    // Cascade. The fuel prefix may contain an underscore
    // (hybride_essence / hybride_diesel) so we match the tier suffix
    // explicitly rather than splitting on the first `_`.
    const tierMatch = profile.match(/_(p[1-6]_[a-z_]+?)$/);
    const tier = tierMatch ? tierMatch[1] : 'p3_moyenne';
    const fuel = tierMatch
      ? profile.slice(0, profile.length - tier.length - 1)
      : 'inconnu';

    let fallbackFuel: string;
    if (fuel === 'ethanol' || fuel === 'gpl' || fuel === 'hybride_essence') {
      fallbackFuel = 'essence';
    } else if (fuel === 'hybride_diesel') {
      fallbackFuel = 'diesel';
    } else {
      fallbackFuel = 'inconnu';
    }
    const cascade = mapping.profiles[`${fallbackFuel}_${tier}`];
    if (cascade) return cascade;
    return mapping.profiles[FALLBACK_KEY] ?? null;
  }

  private loadMapping(): EngineProfileMapping | null {
    const now = Date.now();
    if (this.mappingCache && now - this.mappingCache.loadedAt < this.ttlMs) {
      return this.mappingCache.value;
    }
    if (!existsSync(this.mappingPath)) {
      this.logger.warn(
        `engine-profile-mapping.yaml not found at ${this.mappingPath}`,
      );
      return null;
    }
    try {
      const raw = readFileSync(this.mappingPath, 'utf-8');
      // YAML file starts with a comment block then a `---` doc marker.
      // yaml.load handles both cases ; loadAll would be needed only for
      // multi-doc streams.
      const parsed = yaml.load(raw) as EngineProfileMapping;
      if (
        !parsed ||
        typeof parsed !== 'object' ||
        !parsed.profiles ||
        typeof parsed.profiles !== 'object'
      ) {
        this.logger.error(
          `Invalid mapping YAML at ${this.mappingPath} : missing profiles`,
        );
        return null;
      }
      this.mappingCache = { value: parsed, loadedAt: now };
      return parsed;
    } catch (error) {
      this.logger.error(
        `Failed to parse ${this.mappingPath}: ${(error as Error).message}`,
      );
      return null;
    }
  }

  private loadGamme(slug: string): GammeSummary | null {
    const now = Date.now();
    const cached = this.gammeCache.get(slug);
    if (cached && now - cached.loadedAt < this.ttlMs) {
      return cached.value;
    }

    const path = join(this.gammesDir, `${slug}.md`);
    if (!existsSync(path)) {
      this.logger.warn(`gamme RAG missing : ${path}`);
      this.gammeCache.set(slug, { value: null, loadedAt: now });
      return null;
    }
    try {
      const raw = readFileSync(path, 'utf-8');
      const match = raw.match(/^---\n([\s\S]*?)\n---/);
      if (!match) {
        this.gammeCache.set(slug, { value: null, loadedAt: now });
        return null;
      }
      const fm = yaml.load(match[1]) as GammeFrontmatter | null;
      if (!fm || typeof fm !== 'object') {
        this.gammeCache.set(slug, { value: null, loadedAt: now });
        return null;
      }
      const title =
        fm.title?.trim() ||
        slug
          .split('-')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ');
      const role = fm.domain?.role?.trim() || '';
      const symptomLabels = Array.isArray(fm.diagnostic?.symptoms)
        ? fm
            .diagnostic!.symptoms!.map((s) =>
              s && typeof s.label === 'string' ? s.label.trim() : '',
            )
            .filter((s): s is string => s.length > 0)
        : [];
      const summary: GammeSummary = { title, role, symptomLabels };
      this.gammeCache.set(slug, { value: summary, loadedAt: now });
      return summary;
    } catch (error) {
      this.logger.error(
        `Failed to read gamme ${slug}: ${(error as Error).message}`,
      );
      this.gammeCache.set(slug, { value: null, loadedAt: now });
      return null;
    }
  }
}
