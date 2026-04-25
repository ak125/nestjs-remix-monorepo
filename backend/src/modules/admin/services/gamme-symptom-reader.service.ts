/**
 * GammeSymptomReader
 * ------------------
 * Reads gamme RAG frontmatter at runtime and composes one human-readable
 * issue line per gamme, in the form `<title> : <S1 label>, <S2 label>`.
 *
 * Single source of truth (ADR-015) :
 *   - `/opt/automecanik/rag/knowledge/gammes/<slug>.md`
 *     frontmatter : `title`, `domain.role`, `diagnostic.symptoms[].label`
 *
 * The set of slugs to compose is supplied by the caller (typically the R8
 * enricher's A1 wear-parts query on `pieces_relation_type`, filtered per
 * `type_id`), so motorisation-specificity is enforced upstream by DB
 * compatibility — not by any editorial mapping in this service.
 *
 * No content is stored in TypeScript. Editing a gamme `.md` propagates to
 * the next R8 enrichment after the cache TTL (5 min default, env override
 * via `GAMME_SYMPTOM_TTL_MS`).
 *
 * Pattern aligned with the existing `loadGammeRag()` in r8-vehicle-enricher
 * (same fs read + frontmatter regex + yaml.load), but :
 *   - reads the v5 schema (`diagnostic.symptoms[]`) instead of legacy
 *     `page_contract.symptoms[]`,
 *   - is injectable so the cache is shared across enrichments.
 */
import { Injectable, Logger } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as yaml from 'js-yaml';
import { RAG_KNOWLEDGE_PATH } from '../../../config/rag.config';

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

interface CacheEntry {
  value: GammeSummary | null;
  loadedAt: number;
}

@Injectable()
export class GammeSymptomReader {
  private readonly logger = new Logger(GammeSymptomReader.name);
  private readonly gammesDir = join(RAG_KNOWLEDGE_PATH, 'gammes');
  private readonly ttlMs = Number(
    process.env.GAMME_SYMPTOM_TTL_MS ?? 5 * 60 * 1000,
  );

  private cache = new Map<string, CacheEntry>();

  /**
   * Compose `<gamme title> : <symptom1>, <symptom2>` lines for each slug
   * that resolves to a readable RAG file with at least one symptom.
   * Slugs that don't resolve are silently skipped.
   *
   * @param slugs gamme aliases (e.g. `turbo`, `vanne-egr`, `bougie-d-allumage`)
   * @param maxSymptomsPerGamme top-N labels per gamme (default 2)
   */
  compose(slugs: readonly string[], maxSymptomsPerGamme = 2): string[] {
    const lines: string[] = [];
    for (const slug of slugs) {
      const gamme = this.read(slug);
      if (!gamme) continue;

      if (gamme.symptomLabels.length === 0) {
        if (gamme.role) {
          lines.push(
            `${gamme.title} : à vérifier lors de l'entretien (${gamme.role.toLowerCase()})`,
          );
        }
        continue;
      }

      const labels = gamme.symptomLabels.slice(0, maxSymptomsPerGamme);
      const joined = labels.join(', ');
      const sentence =
        joined.length > 0 ? joined[0].toUpperCase() + joined.slice(1) : joined;
      lines.push(`${gamme.title} : ${sentence}`);
    }
    return lines;
  }

  /**
   * Invalidate cache. For tests + admin reload.
   */
  clearCache(): void {
    this.cache.clear();
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private read(slug: string): GammeSummary | null {
    const now = Date.now();
    const cached = this.cache.get(slug);
    if (cached && now - cached.loadedAt < this.ttlMs) {
      return cached.value;
    }

    const path = join(this.gammesDir, `${slug}.md`);
    if (!existsSync(path)) {
      this.cache.set(slug, { value: null, loadedAt: now });
      return null;
    }
    try {
      const raw = readFileSync(path, 'utf-8');
      const match = raw.match(/^---\n([\s\S]*?)\n---/);
      if (!match) {
        this.cache.set(slug, { value: null, loadedAt: now });
        return null;
      }
      const fm = yaml.load(match[1]) as GammeFrontmatter | null;
      if (!fm || typeof fm !== 'object') {
        this.cache.set(slug, { value: null, loadedAt: now });
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
      this.cache.set(slug, { value: summary, loadedAt: now });
      return summary;
    } catch (error) {
      this.logger.warn(
        `Failed to read gamme ${slug}: ${(error as Error).message}`,
      );
      this.cache.set(slug, { value: null, loadedAt: now });
      return null;
    }
  }
}
