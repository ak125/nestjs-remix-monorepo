import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { readdirSync, statSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  RAG_INGESTION_COMPLETED,
  type RagIngestionCompletedEvent,
} from '../events/rag-ingestion.events';
import { FrontmatterValidatorService } from './frontmatter-validator.service';
import { RagKnowledgeService } from './rag-knowledge.service';

/** Candidate match from any detection strategy, with confidence score 0-100. */
interface CandidateMatch {
  alias: string;
  score: number;
  strategy:
    | '2a-gamme'
    | '2b-category'
    | '3-title'
    | '4-web-combined'
    | '5-url'
    | '6-weaviate';
}

@Injectable()
export class RagGammeDetectionService {
  private readonly logger = new Logger(RagGammeDetectionService.name);

  /** Cached list of known gamme aliases from gammes/ directory. */
  private knownGammeAliasesCache: string[] | null = null;

  /** Cached category → gamme aliases index (built from gammes/ frontmatter). */
  private categoryToAliasesCache: Map<string, string[]> | null = null;

  /** Guard against duplicate event emission for the same jobId (poll + webhook race). */
  private readonly emittedJobIds = new Set<string>();

  /**
   * Explicit URL path segment → gamme alias mapping for foreign-language domains.
   * Covers cases where title/category matching fails (e.g., English product names).
   */
  private static readonly URL_SEGMENT_TO_GAMME: Record<string, string> = {
    'ac-compressor': 'compresseur-de-climatisation',
    'ac-condenser': 'condenseur-de-climatisation',
    'expansion-valve': 'detendeur-de-climatisation',
    evaporator: 'evaporateur-de-climatisation',
    'wiper-blade': 'balais-d-essuie-glace',
    'wiper-blades': 'balais-d-essuie-glace',
    'balais-standards': 'balais-d-essuie-glace',
    'balais-plates': 'balais-d-essuie-glace',
    'spark-plug': 'bougie-d-allumage',
    'spark-plugs': 'bougie-d-allumage',
    'oil-filter': 'filtre-a-huile',
    'oil-filters': 'filtre-a-huile',
    'air-filter': 'filtre-a-air',
    'air-filters': 'filtre-a-air',
    'cabin-filter': 'filtre-d-habitacle',
    'fuel-filter': 'filtre-a-carburant',
    'brake-pad': 'plaquette-de-frein',
    'brake-pads': 'plaquette-de-frein',
    'brake-disc': 'disque-de-frein',
    'brake-discs': 'disque-de-frein',
    alternator: 'alternateur',
    alternators: 'alternateur',
    'starter-motor': 'demarreur',
    'starter-motors': 'demarreur',
    thermostats: 'thermostat-d-eau',
    thermostat: 'thermostat-d-eau',
    'lambda-sensor': 'sonde-lambda',
    'oxygen-sensor': 'sonde-lambda',
    // DENSO A/C product pages (French slugs)
    'soupapes-dexpansion': 'detendeur-de-climatisation',
    'condenseur-a-c': 'condenseur-de-climatisation',
    'ac-compressor-oil': 'compresseur-de-climatisation',
    evaporateurs: 'evaporateur-de-climatisation',
    intercoolers: 'intercooler',
    radiateurs: 'radiateur-de-refroidissement',
    'groupes-moto-ventilateurs': 'ventilateur-de-refroidissement',
    'pressostats-et-capteurs': 'capteur-pression-et-temperature-d-huile',
    'ventilateurs-de-la-cabine': 'ventilateur-de-refroidissement',
    'noyaux-de-chauffage': 'radiateur-de-chauffage',
    'secheurs-de-recepteurs': 'bouteille-deshydratante',
    // DENSO wiper pages (French slugs)
    'balais-dessuie-glace': 'balais-d-essuie-glace',
    'balais-hybrides': 'balais-d-essuie-glace',
    'balais-pour-lunette-arriere': 'balais-d-essuie-glace',
    // Common French URL slugs (plural/variant forms)
    'etriers-de-frein': 'etrier-de-frein',
    'etrier-de-frein': 'etrier-de-frein',
    'plaquettes-de-frein': 'plaquette-de-frein',
    'disques-frein': 'disque-de-frein',
    'disques-de-frein': 'disque-de-frein',
    'filtres-a-air': 'filtre-a-air',
    'filtre-air': 'filtre-a-air',
    'filtre-huile': 'filtre-a-huile',
    'filtre-habitacle': 'filtre-d-habitacle',
    'filtre-carburant': 'filtre-a-carburant',
    'bobines-allumage': 'bobine-d-allumage',
    'bougies-allumage': 'bougie-d-allumage',
    'compresseur-climatisation': 'compresseur-de-climatisation',
  };

  constructor(
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    @Inject(forwardRef(() => FrontmatterValidatorService))
    private readonly frontmatterValidator: FrontmatterValidatorService,
    @Inject(forwardRef(() => RagKnowledgeService))
    private readonly ragKnowledgeService: RagKnowledgeService,
  ) {}

  /** Clear all caches (call after adding new gamme files). */
  public clearCaches(): void {
    this.knownGammeAliasesCache = null;
    this.categoryToAliasesCache = null;
  }

  /**
   * Build a category → gamme aliases index by scanning gammes/ frontmatter.
   * E.g. "climatisation" → ["compresseur-de-climatisation", "condenseur-de-climatisation", ...]
   */
  private buildCategoryIndex(knowledgePath: string): Map<string, string[]> {
    if (this.categoryToAliasesCache) return this.categoryToAliasesCache;
    const gammeDir = path.join(knowledgePath, 'gammes');
    const index = new Map<string, string[]>();
    try {
      for (const f of readdirSync(gammeDir)) {
        if (!f.endsWith('.md')) continue;
        const alias = f.replace('.md', '');
        const head = readFileSync(path.join(gammeDir, f), 'utf-8').slice(
          0,
          300,
        );
        const catMatch = head.match(/^category:\s*(.+)$/m);
        if (catMatch) {
          const cat = catMatch[1].trim().toLowerCase();
          const existing = index.get(cat) || [];
          existing.push(alias);
          index.set(cat, existing);
        }
      }
    } catch {
      /* gammes dir may not exist */
    }
    this.categoryToAliasesCache = index;
    return index;
  }

  /**
   * Normalize a title string into a slug for alias matching.
   * Shared between resolveGammesFromFiles and detectAffectedGammes.
   */
  private static normalizeTitle(raw: string): {
    slug: string;
    deplural: string;
  } {
    const slug = raw
      .trim()
      .replace(/\\x([0-9a-fA-F]{2})/g, (_, hex: string) =>
        String.fromCharCode(parseInt(hex, 16)),
      )
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s*[|–-]\s+[a-z][\w\s]*$/i, '')
      .replace(/ - section.*$/i, '')
      .replace(/^(?:des|les|le|la|l'|un|une)\s+/i, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const deplural = slug.replace(/s(-|$)/g, '$1');
    return { slug, deplural };
  }

  /**
   * Score how well a gamme alias matches a title slug.
   * Returns 0 (no match) to 100 (exact match).
   */
  private static scoreAliasMatch(
    titleSlug: string,
    titleSlugDePlural: string,
    alias: string,
  ): number {
    if (alias.length < 4) return 0;

    // Exact match
    if (titleSlug === alias || titleSlugDePlural === alias) return 100;

    // Full alias substring in title — score by specificity ratio
    if (titleSlug.includes(alias) || titleSlugDePlural.includes(alias)) {
      const ratio = alias.length / Math.max(titleSlug.length, 1);
      return Math.round(40 + ratio * 50); // 40-90
    }

    // Word-level overlap (Jaccard-like)
    const titleWords = new Set(
      titleSlugDePlural.split('-').filter((w) => w.length >= 4),
    );
    const aliasWords = alias.split('-').filter((w) => w.length >= 4);
    if (aliasWords.length === 0 || titleWords.size === 0) return 0;

    let overlap = 0;
    for (const aw of aliasWords) {
      if (titleWords.has(aw)) overlap++;
    }
    if (overlap === 0) return 0;

    // Require: overlap >= 2, or all alias words match, or single long word (>=8 chars)
    const hasLongWordMatch = aliasWords.some(
      (w) => w.length >= 8 && titleWords.has(w),
    );
    if (overlap < 2 && overlap < aliasWords.length && !hasLongWordMatch) {
      return 0;
    }

    const overlapRatio = overlap / aliasWords.length;
    return Math.round(20 + overlapRatio * 40); // 20-60
  }

  /**
   * Collect all candidate matches for a file's frontmatter head.
   * Returns sorted candidates (best first). Does NOT include Strategy 6 (Weaviate).
   */
  private collectCandidates(
    head: string,
    knownAliases: string[],
    knowledgePath: string,
  ): CandidateMatch[] {
    const candidates: CandidateMatch[] = [];

    // Strategy 2a: explicit gamme: field
    const gammeMatch = head.match(/^gamme:\s*(.+)$/m);
    if (gammeMatch) {
      const val = gammeMatch[1].trim();
      if (knownAliases.includes(val)) {
        candidates.push({ alias: val, score: 95, strategy: '2a-gamme' });
      } else {
        this.logger.debug(
          `Strategy 2a: gamme: "${val}" not in knownAliases — ignored`,
        );
      }
    }

    // Strategy 2b: category → lookup category index
    const categoryMatch = head.match(/^category:\s*(.+)$/m);
    if (categoryMatch) {
      const catVal = categoryMatch[1].trim().toLowerCase();
      if (
        catVal !== 'catalog' &&
        catVal !== 'knowledge' &&
        catVal !== 'guide'
      ) {
        const slug = catVal
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');

        if (slug.length > 3) {
          // Direct alias match?
          if (knownAliases.includes(slug)) {
            candidates.push({
              alias: slug,
              score: 85,
              strategy: '2b-category',
            });
          } else {
            // Category domain lookup: score each alias in this category against the title
            const categoryIndex = this.buildCategoryIndex(knowledgePath);
            const categoryAliases = categoryIndex.get(catVal);
            if (categoryAliases) {
              const titleMatch = head.match(/^title:\s*"?(.+?)"?\s*$/m);
              if (titleMatch) {
                const { slug: tSlug, deplural } =
                  RagGammeDetectionService.normalizeTitle(titleMatch[1]);
                for (const alias of categoryAliases) {
                  const score = RagGammeDetectionService.scoreAliasMatch(
                    tSlug,
                    deplural,
                    alias,
                  );
                  if (score > 0) {
                    // Boost by 10 because category confirms the domain
                    candidates.push({
                      alias,
                      score: Math.min(score + 10, 90),
                      strategy: '2b-category',
                    });
                  }
                }
              }
              // If no title-based score, add all category aliases with low score
              if (!titleMatch && categoryAliases.length === 1) {
                candidates.push({
                  alias: categoryAliases[0],
                  score: 35,
                  strategy: '2b-category',
                });
              }
            }
          }
        }
      }
    }

    // Strategy 3: title scoring against all known aliases
    const titleMatch = head.match(/^title:\s*"?(.+?)"?\s*$/m);
    if (titleMatch && knownAliases.length > 0) {
      const { slug: titleSlug, deplural: titleSlugDePlural } =
        RagGammeDetectionService.normalizeTitle(titleMatch[1]);

      for (const alias of knownAliases) {
        const score = RagGammeDetectionService.scoreAliasMatch(
          titleSlug,
          titleSlugDePlural,
          alias,
        );
        if (score > 0) {
          candidates.push({ alias, score, strategy: '3-title' });
        }
      }
    }

    // Strategy 4: combined title + URL for web-ingested guide files
    const sourceTypeMatch = head.match(/^source_type:\s*(.+)$/m);
    const sourceUrlMatch4 = head.match(/^source_url:\s*"?(.+?)"?\s*$/m);
    if (
      sourceTypeMatch &&
      sourceTypeMatch[1].trim().toLowerCase() === 'guide' &&
      sourceUrlMatch4 &&
      titleMatch
    ) {
      try {
        const urlPath = new URL(sourceUrlMatch4[1].trim()).pathname;
        const urlWords = new Set(
          urlPath.split('/').flatMap((s) =>
            s
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .split(/[^a-z0-9]+/)
              .filter((w) => w.length >= 4),
          ),
        );
        // Merge title words + URL words
        const { deplural: titleDeplural } =
          RagGammeDetectionService.normalizeTitle(titleMatch[1]);
        const combinedWords = new Set([
          ...titleDeplural.split('-').filter((w) => w.length >= 4),
          ...urlWords,
        ]);

        for (const alias of knownAliases) {
          if (alias.length < 4) continue;
          const aliasWords = alias.split('-').filter((w) => w.length >= 4);
          if (aliasWords.length === 0) continue;

          let overlap = 0;
          for (const aw of aliasWords) {
            if (combinedWords.has(aw)) overlap++;
          }
          if (overlap < 2) continue;

          const ratio = overlap / aliasWords.length;
          if (ratio >= 1) {
            candidates.push({ alias, score: 80, strategy: '4-web-combined' });
          } else if (ratio >= 0.5) {
            candidates.push({ alias, score: 65, strategy: '4-web-combined' });
          }
        }
      } catch {
        // Invalid URL — skip Strategy 4
      }
    }

    // Strategy 5: source_url path segment matching
    const urlAlias = this.matchBySourceUrl(head, knownAliases);
    if (urlAlias) {
      candidates.push({ alias: urlAlias, score: 70, strategy: '5-url' });
    }

    // Sort by score descending, then by alias length descending (prefer more specific)
    candidates.sort(
      (a, b) => b.score - a.score || b.alias.length - a.alias.length,
    );
    return candidates;
  }

  /**
   * Strategy 5: Match source_url path segments against known gamme aliases.
   * Two-level matching:
   *   5a. Explicit URL_SEGMENT_TO_GAMME map (handles translations)
   *   5b. Word-level overlap between URL segments and alias keywords (≥2 shared words)
   */
  private matchBySourceUrl(
    head: string,
    knownAliases: string[],
  ): string | null {
    const sourceUrlMatch = head.match(/^source_url:\s*"?(.+?)"?\s*$/m);
    if (!sourceUrlMatch) return null;

    let urlPath: string;
    try {
      urlPath = new URL(sourceUrlMatch[1].trim()).pathname;
    } catch {
      return null;
    }

    const segments = urlPath
      .split('/')
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length > 3);

    // 5a. Explicit mapping lookup
    for (const seg of segments) {
      const mapped = RagGammeDetectionService.URL_SEGMENT_TO_GAMME[seg];
      if (mapped && knownAliases.includes(mapped)) {
        return mapped;
      }
    }

    // 5b. Word-level overlap: extract words from URL segments, match against alias words
    const urlWords = new Set(
      segments.flatMap((s) =>
        s
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .split(/[^a-z0-9]+/)
          .filter((w) => w.length >= 4),
      ),
    );
    if (urlWords.size === 0) return null;

    let bestAlias: string | null = null;
    let bestScore = 0;

    for (const alias of knownAliases) {
      if (alias.length < 4) continue;
      const aliasWords = alias.split('-').filter((w) => w.length >= 4);
      if (aliasWords.length === 0) continue;

      let overlap = 0;
      for (const aw of aliasWords) {
        if (urlWords.has(aw)) overlap++;
      }

      // Require ≥2 matching words, or 1 if the word is long (≥8 chars, e.g. "climatisation")
      const threshold = aliasWords.some((w) => w.length >= 8 && urlWords.has(w))
        ? 1
        : 2;
      if (overlap >= threshold && overlap > bestScore) {
        bestScore = overlap;
        bestAlias = alias;
      }
    }

    return bestAlias;
  }

  /**
   * Resolve gamme aliases from an explicit list of validated file paths.
   * Uses scoring system: collects all candidate matches, picks best.
   */
  public async resolveGammesFromFiles(
    filePaths: string[],
  ): Promise<Map<string, string[]>> {
    const knowledgePath =
      this.configService.get<string>('RAG_KNOWLEDGE_PATH') ||
      '/opt/automecanik/rag/knowledge';
    const results = new Map<string, string[]>();

    const addResult = (alias: string, filePath: string): void => {
      const existing = results.get(alias) || [];
      existing.push(filePath);
      results.set(alias, existing);
    };

    const knownAliases = this.getKnownGammeAliases(knowledgePath);
    const gammeDir = path.join(knowledgePath, 'gammes');

    this.logger.debug(
      `[resolveGammesFromFiles] knowledgePath=${knowledgePath}, gammeDir=${gammeDir}, ` +
        `knownAliases=${knownAliases.length}, filePaths=${filePaths.length}`,
    );

    for (const fullPath of filePaths) {
      if (!fullPath.endsWith('.md')) continue;

      // Strategy 1: gammes/ directory -> filename = alias (always 100%)
      if (fullPath.startsWith(gammeDir)) {
        const filename = path.basename(fullPath, '.md');
        addResult(filename, fullPath);
        continue;
      }

      try {
        const head = readFileSync(fullPath, 'utf-8').slice(0, 500);

        // Collect all candidates with scores (strategies 2a, 2b, 3, 5)
        const candidates = this.collectCandidates(
          head,
          knownAliases,
          knowledgePath,
        );

        if (candidates.length > 0 && candidates[0].score >= 20) {
          const best = candidates[0];
          this.logger.debug(
            `[resolveGammesFromFiles] Best: "${best.alias}" (score=${best.score}, strategy=${best.strategy}) for ${path.basename(fullPath)}` +
              (candidates.length > 1
                ? ` | runner-up: "${candidates[1].alias}" (${candidates[1].score})`
                : ''),
          );
          addResult(best.alias, fullPath);
          continue;
        }

        // Strategy 6: Weaviate search fallback (async, only when no good candidate)
        // Skip for catalog pages — their technical content mentions many products
        const categoryForS6 = head
          .match(/^category:\s*(.+)$/m)?.[1]
          ?.trim()
          .toLowerCase();
        const snippet = head
          .replace(/^---[\s\S]*?---/, '')
          .trim()
          .slice(0, 200);
        if (snippet.length > 20 && categoryForS6 !== 'catalog') {
          try {
            const searchResult = await this.ragKnowledgeService.search({
              query: snippet,
              limit: 3,
              filters: { truth_levels: ['L1', 'L2'] },
            });
            const gammeDoc = searchResult?.results?.find((r) =>
              (r.sourcePath || '').startsWith('gammes/'),
            );
            if (gammeDoc) {
              const alias = path.basename(gammeDoc.sourcePath || '', '.md');
              if (knownAliases.includes(alias)) {
                this.logger.debug(
                  `[resolveGammesFromFiles] Strategy 6 (Weaviate): "${alias}" for ${path.basename(fullPath)}`,
                );
                addResult(alias, fullPath);
              }
            }
          } catch {
            /* Weaviate fallback non-bloquant */
          }
        }
      } catch {
        // Skip unreadable files
      }
    }

    this.logger.log(
      `Resolved ${results.size} gamme(s) from ${filePaths.length} validated file(s)`,
    );
    return results;
  }

  /**
   * Scan knowledge directories for recently modified .md files.
   * Uses scoring system for strategies 2a, 2b, 3, 5.
   *
   * @deprecated Fallback: scan filesystem with mtime window. Prefer resolveGammesFromFiles().
   */
  public detectAffectedGammes(): Map<string, string[]> {
    const knowledgePath =
      this.configService.get<string>('RAG_KNOWLEDGE_PATH') ||
      '/opt/automecanik/rag/knowledge';
    const cutoff = Date.now() - 30 * 60 * 1000;
    const results = new Map<string, string[]>();

    const addResult = (alias: string, filePath: string): void => {
      const existing = results.get(alias) || [];
      existing.push(filePath);
      results.set(alias, existing);
    };

    // 1. Scan gammes/ directory (filename = alias)
    const gammeDir = path.join(knowledgePath, 'gammes');
    try {
      for (const f of readdirSync(gammeDir)) {
        if (!f.endsWith('.md')) continue;
        const fullPath = path.join(gammeDir, f);
        if (statSync(fullPath).mtimeMs > cutoff) {
          addResult(f.replace('.md', ''), fullPath);
        }
      }
    } catch {
      this.logger.warn(`Could not scan gamme knowledge dir: ${gammeDir}`);
    }

    const knownAliases = this.getKnownGammeAliases(knowledgePath);

    // 2+3+5. Scan ALL knowledge subdirectories (excluding gammes/)
    const EXCLUDED_DIRS = new Set(['gammes', '_quarantine', '__pycache__']);
    let allSubDirs: string[] = [];
    try {
      allSubDirs = readdirSync(knowledgePath, { withFileTypes: true })
        .filter(
          (d) =>
            d.isDirectory() &&
            !EXCLUDED_DIRS.has(d.name) &&
            !d.name.startsWith('.'),
        )
        .map((d) => d.name);
    } catch {
      this.logger.warn(`Could not list knowledge subdirs: ${knowledgePath}`);
    }
    for (const subDir of allSubDirs) {
      const dir = path.join(knowledgePath, subDir);
      try {
        for (const f of readdirSync(dir)) {
          if (!f.endsWith('.md')) continue;
          const fullPath = path.join(dir, f);
          if (statSync(fullPath).mtimeMs <= cutoff) continue;

          try {
            const quickCheck = this.frontmatterValidator.validateFile(fullPath);
            if (!quickCheck.valid) continue;

            const head = readFileSync(fullPath, 'utf-8').slice(0, 500);
            const candidates = this.collectCandidates(
              head,
              knownAliases,
              knowledgePath,
            );

            if (candidates.length > 0 && candidates[0].score >= 20) {
              addResult(candidates[0].alias, fullPath);
            }
          } catch {
            // Skip unreadable files
          }
        }
      } catch {
        // Directory may not exist
      }
    }

    return results;
  }

  /** Get known gamme aliases from gammes/ directory filenames (cached). */
  public getKnownGammeAliases(knowledgePath: string): string[] {
    if (this.knownGammeAliasesCache) return this.knownGammeAliasesCache;
    const gammeDir = path.join(knowledgePath, 'gammes');
    try {
      this.knownGammeAliasesCache = readdirSync(gammeDir)
        .filter((f) => f.endsWith('.md'))
        .map((f) => f.replace('.md', ''))
        .sort((a, b) => b.length - a.length); // longest first for best match
      return this.knownGammeAliasesCache;
    } catch {
      return [];
    }
  }

  /**
   * Scan diagnostic/ directory for recently modified .md files.
   * Returns array of diagnostic slugs from __seo_observable whose
   * cluster_id matches a modified RAG diagnostic file.
   */
  public detectAffectedDiagnostics(): string[] {
    const knowledgePath =
      this.configService.get<string>('RAG_KNOWLEDGE_PATH') ||
      '/opt/automecanik/rag/knowledge';
    const diagDir = path.join(knowledgePath, 'diagnostic');
    const cutoff = Date.now() - 30 * 60 * 1000;
    const results: string[] = [];

    try {
      const files = readdirSync(diagDir).filter(
        (f) => f.endsWith('.md') && !f.includes('.backup'),
      );

      for (const file of files) {
        try {
          const fullPath = path.join(diagDir, file);
          if (statSync(fullPath).mtimeMs <= cutoff) continue;

          // File name without .md = potential cluster_id match
          const baseName = file.replace('.md', '');
          results.push(baseName);
        } catch {
          // Skip unreadable files
        }
      }
    } catch {
      // Directory may not exist
    }

    return results;
  }

  /**
   * Re-run gamme detection on all files in specified subdirectories.
   * Returns detection results; persists to DB if dryRun=false.
   */
  public async rerunDetection(options: {
    dryRun?: boolean;
    subDir?: string;
  }): Promise<{
    total: number;
    matched: number;
    orphan: number;
    results: Array<{
      file: string;
      alias: string;
      score: number;
      strategy: string;
    }>;
  }> {
    const knowledgePath =
      this.configService.get<string>('RAG_KNOWLEDGE_PATH') ||
      '/opt/automecanik/rag/knowledge';

    // Clear caches to pick up any new gamme files
    this.clearCaches();

    const dirs = options.subDir
      ? [options.subDir]
      : ['web', 'web-catalog', 'guides', 'diagnostic', 'vehicles', 'reference'];

    const filePaths: string[] = [];
    for (const dir of dirs) {
      const fullDir = path.join(knowledgePath, dir);
      try {
        for (const f of readdirSync(fullDir)) {
          if (f.endsWith('.md')) filePaths.push(path.join(fullDir, f));
        }
      } catch {
        /* dir may not exist */
      }
    }

    const gammesMap = await this.resolveGammesFromFiles(filePaths);

    if (!options.dryRun && gammesMap.size > 0) {
      try {
        const persisted = await this.ragKnowledgeService.persistGammeAliases(
          Object.fromEntries(gammesMap),
        );
        this.logger.log(
          `[rerunDetection] Persisted ${persisted} gamme alias(es)`,
        );
      } catch (err) {
        this.logger.warn(
          `[rerunDetection] Failed to persist: ${(err as Error).message}`,
        );
      }
    }

    // Build detailed report
    const matchedFiles = new Set(Array.from(gammesMap.values()).flat());
    const detailResults: Array<{
      file: string;
      alias: string;
      score: number;
      strategy: string;
    }> = [];

    const knownAliases = this.getKnownGammeAliases(knowledgePath);
    for (const [alias, files] of gammesMap) {
      for (const fp of files) {
        // Re-score for the report
        let score = 0;
        let strategy = 'unknown';
        try {
          const head = readFileSync(fp, 'utf-8').slice(0, 500);
          const candidates = this.collectCandidates(
            head,
            knownAliases,
            knowledgePath,
          );
          const best = candidates.find((c) => c.alias === alias);
          if (best) {
            score = best.score;
            strategy = best.strategy;
          }
        } catch {
          /* skip */
        }
        detailResults.push({
          file: path.basename(fp),
          alias,
          score,
          strategy,
        });
      }
    }

    return {
      total: filePaths.length,
      matched: matchedFiles.size,
      orphan: filePaths.length - matchedFiles.size,
      results: detailResults,
    };
  }

  /**
   * Domain keyword → gamme aliases mapping for transversal content (diagnostics, guides).
   * Each keyword is matched against orphan titles/sources to assign multi-gamme aliases.
   */
  private static readonly TRANSVERSAL_DOMAIN_MAP: Record<string, string[]> = {
    // Freinage
    freinage: [
      'plaquette-de-frein',
      'disque-de-frein',
      'etrier-de-frein',
      'kit-de-freins-arriere',
      'machoires-de-frein',
      'maitre-cylindre-de-frein',
      'flexible-de-frein',
      'cable-de-frein-a-main',
      'tambour-de-frein',
      'cylindre-de-roue',
      'servo-frein',
      'temoin-d-usure',
      'liquide-de-frein',
    ],
    plaquette: ['plaquette-de-frein'],
    'disque-frein': ['disque-de-frein'],
    'disques-de-frein': ['disque-de-frein'],
    'plaquettes-de-frein': ['plaquette-de-frein'],
    vibration: ['disque-de-frein', 'plaquette-de-frein', 'roulement-de-roue'],
    // Suspension / Amortisseurs
    amortisseur: [
      'amortisseur',
      'ressort-de-suspension',
      'kit-de-butee-de-suspension',
      'butee-elastique-d-amortisseur',
      'bras-de-suspension',
      'rotule-de-suspension',
      'biellette-de-barre-stabilisatrice',
    ],
    suspension: [
      'amortisseur',
      'ressort-de-suspension',
      'rotule-de-suspension',
      'bras-de-suspension',
      'biellette-de-barre-stabilisatrice',
      'barre-stabilisatrice',
    ],
    // Climatisation
    climatisation: [
      'compresseur-de-climatisation',
      'condenseur-de-climatisation',
      'evaporateur-de-climatisation',
      'detendeur-de-climatisation',
      'bouteille-deshydratante',
      'pressostat-de-climatisation',
      'filtre-d-habitacle',
      'pulseur-d-air-d-habitacle',
    ],
    chauffage: [
      'radiateur-de-chauffage',
      'pulseur-d-air-d-habitacle',
      'filtre-d-habitacle',
    ],
    // Demarrage / Electrique
    demarrage: [
      'demarreur',
      'alternateur',
      'bougie-d-allumage',
      'bobine-d-allumage',
    ],
    batterie: ['demarreur', 'alternateur'],
    alternateur: ['alternateur', 'poulie-d-alternateur'],
    // Direction
    direction: [
      'cremailliere-de-direction',
      'rotule-de-direction',
      'barre-de-direction',
      'pompe-de-direction-assistee',
      'soufflet-de-direction',
      'colonne-de-direction',
    ],
    cremaillere: ['cremailliere-de-direction', 'soufflet-de-direction'],
    // Distribution
    distribution: [
      'kit-de-distribution',
      'courroie-de-distribution',
      'galet-tendeur-de-courroie-de-distribution',
      'galet-enrouleur-de-courroie-de-distribution',
      'chaine-de-distribution',
      'kit-de-chaine-de-distribution',
      'pompe-a-eau',
    ],
    courroie: [
      'courroie-de-distribution',
      'courroie-d-accessoire',
      'kit-de-distribution',
    ],
    // Echappement
    echappement: [
      'catalyseur',
      'silencieux',
      'tube-d-echappement',
      'collecteur-d-echappement',
      'fap',
      'sonde-lambda',
      'vanne-egr',
    ],
    catalyseur: ['catalyseur', 'fap', 'sonde-lambda'],
    // Eclairage
    eclairage: [
      'feu-avant',
      'feu-arriere',
      'feu-clignotant',
      'ampoule-feu-avant',
      'ampoule-feu-arriere',
      'phares-antibrouillard',
    ],
    signalisation: [
      'feu-clignotant',
      'relais-de-clignotant',
      'ampoule-feu-clignotant',
      'ampoule-feu-stop',
    ],
    voyant: [
      'capteur-abs',
      'sonde-lambda',
      'pressostat-d-huile',
      'sonde-de-refroidissement',
    ],
    // Embrayage
    embrayage: [
      'kit-d-embrayage',
      'butee-d-embrayage',
      'emetteur-d-embrayage',
      'recepteur-d-embrayage',
      'cable-d-embrayage',
      'volant-moteur',
    ],
    // Injection
    injecteur: [
      'injecteur',
      'pompe-a-injection',
      'pompe-a-haute-pression',
      'rampe-commune-d-injection',
    ],
    injection: [
      'injecteur',
      'pompe-a-injection',
      'pompe-a-haute-pression',
      'debitmetre-d-air',
      'corps-papillon',
    ],
    // Refroidissement
    refroidissement: [
      'radiateur-de-refroidissement',
      'thermostat',
      'pompe-a-eau',
      'vase-d-expansion',
      'durite-de-refroidissement',
      'ventilateur-de-refroidissement',
      'sonde-de-refroidissement',
    ],
    // Transmission
    transmission: [
      'cardan',
      'soufflet-de-cardan',
      'kit-d-embrayage',
      'volant-moteur',
      'filtre-de-boite-auto',
    ],
    boite: [
      'filtre-de-boite-auto',
      'support-de-boite-vitesse',
      'mecatronique-boite-automatique',
    ],
    // Filtration
    'filtre-air': ['filtre-a-air'],
    'filtre-huile': ['filtre-a-huile'],
    'filtre-a-air': ['filtre-a-air'],
    'filtre-a-huile': ['filtre-a-huile'],
    // Pompe a eau
    'pompe-eau': ['pompe-a-eau'],
    'pompe-a-eau': ['pompe-a-eau'],
    // ECE R90
    'ece-r90': [
      'plaquette-de-frein',
      'disque-de-frein',
      'machoires-de-frein',
      'tambour-de-frein',
    ],
    // Tableau de bord (transversal)
    'tableau-bord': [
      'capteur-abs',
      'sonde-lambda',
      'pressostat-d-huile',
      'sonde-de-refroidissement',
      'capteur-pression-turbo',
      'vanne-egr',
    ],
  };

  /**
   * Map transversal orphan files (diagnostic, guides, canonical, reference)
   * to their relevant gamme aliases using domain keyword matching.
   * Returns mapping: source → gamme_aliases[].
   */
  public async mapTransversalOrphans(options: { dryRun?: boolean }): Promise<{
    mapped: number;
    skipped: number;
    details: Array<{
      source: string;
      title: string;
      aliases: string[];
      matchedKeywords: string[];
    }>;
  }> {
    // 1. Get all orphans from DB
    const { data: orphans, error } =
      await this.ragKnowledgeService.getOrphans();
    if (error || !orphans) {
      this.logger.warn(
        `[mapTransversalOrphans] Failed to get orphans: ${error}`,
      );
      return { mapped: 0, skipped: 0, details: [] };
    }

    // 2. Filter to mappable categories (diagnostic, guides, canonical, reference)
    const mappableOrphans = orphans.filter((o: { source: string }) => {
      const src = o.source || '';
      return (
        src.startsWith('diagnostic/') ||
        src.startsWith('guides/') ||
        src.startsWith('canonical/') ||
        src.startsWith('reference/')
      );
    });

    const details: Array<{
      source: string;
      title: string;
      aliases: string[];
      matchedKeywords: string[];
    }> = [];

    // 3. For each orphan, match domain keywords against title + source
    for (const orphan of mappableOrphans) {
      const src = (orphan.source || '') as string;
      const title = (orphan.title || '') as string;
      // Build search text from source path + title
      const { slug: srcSlug } = RagGammeDetectionService.normalizeTitle(src);
      const { slug: titleSlug } =
        RagGammeDetectionService.normalizeTitle(title);
      const searchText = `${srcSlug} ${titleSlug}`;

      const aliasSet = new Set<string>();
      const matchedKeywords: string[] = [];

      for (const [keyword, aliases] of Object.entries(
        RagGammeDetectionService.TRANSVERSAL_DOMAIN_MAP,
      )) {
        if (searchText.includes(keyword)) {
          matchedKeywords.push(keyword);
          for (const a of aliases) aliasSet.add(a);
        }
      }

      if (aliasSet.size > 0) {
        details.push({
          source: src,
          title,
          aliases: [...aliasSet],
          matchedKeywords,
        });
      }
    }

    // 4. Persist if not dry run
    let mapped = 0;
    if (!options.dryRun && details.length > 0) {
      for (const entry of details) {
        const ok = await this.ragKnowledgeService.setGammeAliases(
          entry.source,
          entry.aliases,
        );
        if (ok) mapped++;
      }
      this.logger.log(
        `[mapTransversalOrphans] Persisted ${mapped}/${details.length} orphan mappings`,
      );
    }

    return {
      mapped: options.dryRun ? 0 : mapped,
      skipped: mappableOrphans.length - details.length,
      details,
    };
  }

  /**
   * Emit RAG_INGESTION_COMPLETED event after ingestion finishes.
   * Uses explicit file list when available; falls back to mtime scan.
   *
   * Orchestrates: resolve gammes from files -> detect affected gammes ->
   * detect affected diagnostics -> emit event.
   */
  public async emitIngestionCompleted(
    jobId: string,
    source: 'pdf' | 'web',
    validationResult?: {
      valid: string[];
      quarantined: Array<{ filename: string; reason: string }>;
    },
    dbSyncOk?: boolean,
  ): Promise<{ affectedGammes: string[] }> {
    // Idempotency guard: skip if event already emitted for this jobId
    if (this.emittedJobIds.has(jobId)) {
      this.logger.warn(
        `[emitIngestionCompleted] Skipping duplicate emission for jobId=${jobId}`,
      );
      return { affectedGammes: [] };
    }
    this.emittedJobIds.add(jobId);
    // Auto-cleanup after 10 min to avoid unbounded growth
    setTimeout(() => this.emittedJobIds.delete(jobId), 600_000);

    // Prefer explicit file list from validation (no mtime dependency)
    const validFiles = validationResult?.valid ?? [];
    const affectedGammesMap =
      validFiles.length > 0
        ? await this.resolveGammesFromFiles(validFiles)
        : this.detectAffectedGammes();
    const affectedGammes = Array.from(affectedGammesMap.keys());
    const affectedDiagnostics = this.detectAffectedDiagnostics();

    // Persist gamme→file mapping in __rag_knowledge.gamme_aliases (for DB-based discovery)
    if (affectedGammes.length > 0) {
      try {
        const persisted = await this.ragKnowledgeService.persistGammeAliases(
          Object.fromEntries(affectedGammesMap),
        );
        this.logger.log(
          `[emitIngestionCompleted] Persisted ${persisted} gamme alias(es) in __rag_knowledge`,
        );
      } catch (err) {
        this.logger.warn(
          `[emitIngestionCompleted] Failed to persist gamme aliases: ${(err as Error).message}`,
        );
      }
    }

    // Debug: trace resolution path
    this.logger.log(
      `[emitIngestionCompleted] jobId=${jobId}, source=${source}, ` +
        `validFiles=${validFiles.length}, affectedGammes=[${affectedGammes.join(', ')}]`,
    );
    if (affectedGammes.length === 0 && validFiles.length > 0) {
      this.logger.warn(
        `[emitIngestionCompleted] No gammes detected from ${validFiles.length} files: ` +
          validFiles.slice(0, 5).join(', '),
      );
    }

    const event: RagIngestionCompletedEvent = {
      jobId,
      source,
      status: 'done',
      completedAt: Math.floor(Date.now() / 1000),
      affectedGammes,
      affectedGammesMap: Object.fromEntries(affectedGammesMap),
      ...(affectedDiagnostics.length > 0 ? { affectedDiagnostics } : {}),
      ...(dbSyncOk !== undefined ? { dbSyncOk } : {}),
    };

    if (validationResult) {
      event.validationSummary = {
        totalFiles:
          validationResult.valid.length + validationResult.quarantined.length,
        validFiles: validationResult.valid.length,
        quarantinedFiles: validationResult.quarantined.length,
        quarantined: validationResult.quarantined.map((q) => ({
          filename: q.filename,
          reason: q.reason,
        })),
      };
    }

    this.eventEmitter.emit(RAG_INGESTION_COMPLETED, event);
    this.logger.log(
      `Emitted ${RAG_INGESTION_COMPLETED}: jobId=${jobId}, source=${source}, gammes=[${affectedGammes.join(', ')}]` +
        (affectedDiagnostics.length > 0
          ? `, diagnostics=[${affectedDiagnostics.join(', ')}]`
          : '') +
        (event.validationSummary
          ? `, validated=${event.validationSummary.validFiles}, quarantined=${event.validationSummary.quarantinedFiles}`
          : ''),
    );

    return { affectedGammes };
  }
}
