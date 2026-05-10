/**
 * DiagnosticContentService — lecture du contenu wiki diagnostic + support
 *
 * ADR-032 D1 + D5 (Phase 4 PR-6).
 *
 * Lit les fichiers Markdown frontmatter YAML depuis le submodule git
 * `backend/content/automecanik-wiki/wiki/{diagnostic,support}/<slug>.md`,
 * parse via gray-matter, cache LRU 5 min.
 *
 * Source unique = filesystem local (build-time injection via git submodule
 * `update --init --recursive --depth 1`). PAS de table DB, PAS de CI sync,
 * PAS d'exports JSON séparés.
 *
 * Graceful degradation : si fichier absent (submodule pas init, fichier
 * pas encore mergé sur main wiki), retourne `null` + log error sans crash.
 *
 * @see governance-vault/ledger/decisions/adr/ADR-032-diagnostic-maintenance-unification.md
 * @see automecanik-wiki/wiki/diagnostic/*.md (source canon)
 */
import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import matter from 'gray-matter';

export type DiagnosticEntityType = 'diagnostic' | 'support';

export interface DiagnosticContentEntry {
  slug: string;
  title: string;
  entity_data: Record<string, unknown>;
  body: string;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const CONTENT_ROOT = path.resolve(
  __dirname,
  '../../../../content/automecanik-wiki/wiki',
);

@Injectable()
export class DiagnosticContentService {
  private readonly logger = new Logger(DiagnosticContentService.name);
  private readonly cache = new Map<
    string,
    { entry: DiagnosticContentEntry; expiresAt: number }
  >();

  /**
   * Lit `wiki/<entityType>/<slug>.md`, parse frontmatter + body.
   * Returns `null` si fichier absent (graceful degradation).
   */
  read(
    entityType: DiagnosticEntityType,
    slug: string,
  ): DiagnosticContentEntry | null {
    const cacheKey = `${entityType}:${slug}`;
    const now = Date.now();
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.entry;
    }

    const filePath = path.join(CONTENT_ROOT, entityType, `${slug}.md`);

    if (!fs.existsSync(filePath)) {
      this.logger.warn(
        `Wiki content file not found: ${filePath} ` +
          '(submodule init? wiki PR merged?). Returning null.',
      );
      return null;
    }

    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = matter(raw);
      const fm = parsed.data as {
        slug?: string;
        title?: string;
        entity_data?: Record<string, unknown>;
      };

      const entry: DiagnosticContentEntry = {
        slug: fm.slug ?? slug,
        title: fm.title ?? slug,
        entity_data: fm.entity_data ?? {},
        body: parsed.content,
      };

      this.cache.set(cacheKey, { entry, expiresAt: now + CACHE_TTL_MS });
      return entry;
    } catch (err) {
      this.logger.error(
        `Failed to parse wiki content ${filePath}: ${(err as Error).message}`,
      );
      return null;
    }
  }

  /** Diagnostic content shortcuts (ADR-032 RG-1 wiki/diagnostic/) */
  getWizardSteps() {
    return this.read('diagnostic', 'wizard-steps');
  }
  getSafetyConfig() {
    return this.read('diagnostic', 'safety-config');
  }
  getVocabClusters() {
    return this.read('diagnostic', 'vocab-clusters');
  }
  getSigns() {
    return this.read('diagnostic', 'signs');
  }
  getFaq() {
    return this.read('diagnostic', 'faq');
  }

  /** Support content shortcuts (ADR-032 RG-1 wiki/support/) */
  getControlesMensuels() {
    return this.read('support', 'controles-mensuels');
  }

  /** For tests / cache busting */
  clearCache() {
    this.cache.clear();
  }
}
