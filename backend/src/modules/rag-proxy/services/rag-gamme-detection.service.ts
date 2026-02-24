import { Injectable, Logger } from '@nestjs/common';
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

@Injectable()
export class RagGammeDetectionService {
  private readonly logger = new Logger(RagGammeDetectionService.name);

  /** Cached list of known gamme aliases from gammes/ directory. */
  private knownGammeAliasesCache: string[] | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    private readonly frontmatterValidator: FrontmatterValidatorService,
    private readonly ragKnowledgeService: RagKnowledgeService,
  ) {}

  /**
   * Resolve gamme aliases from an explicit list of validated file paths.
   * Same resolution logic as detectAffectedGammes() but without mtime scanning.
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

      // Strategy 1: gammes/ directory -> filename = alias
      if (fullPath.startsWith(gammeDir)) {
        const filename = path.basename(fullPath, '.md');
        addResult(filename, fullPath);
        continue;
      }

      // Strategies 2+3: parse frontmatter for gamme/category/title
      try {
        const head = readFileSync(fullPath, 'utf-8').slice(0, 500);

        // Strategy 2a: explicit gamme: field
        const gammeMatch = head.match(/^gamme:\s*(.+)$/m);
        if (gammeMatch) {
          addResult(gammeMatch[1].trim(), fullPath);
          continue;
        }

        // Strategy 2b: category: field
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
              addResult(slug, fullPath);
              continue;
            }
          }
        }

        // Strategy 3: title matching against known aliases (improved)
        const titleMatch = head.match(/^title:\s*"?(.+?)"?\s*$/m);
        let matched = false;
        if (titleMatch && knownAliases.length > 0) {
          const titleSlug = titleMatch[1]
            .trim()
            .replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) =>
              String.fromCharCode(parseInt(hex, 16)),
            )
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            // Clean common suffixes: "... | Bosch", "... - Section 3"
            .replace(/\s*[|–]\s*[a-z][\w\s]*$/i, '')
            .replace(/ - section.*$/i, '')
            // Remove leading articles: "Des ", "Les ", "Le ", "La ", "L'"
            .replace(/^(?:des|les|le|la|l'|un|une)\s+/i, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');

          const titleSlugDePlural = titleSlug.replace(/s(-|$)/g, '$1');

          for (const alias of knownAliases) {
            if (alias.length < 4) continue;
            if (
              titleSlug.includes(alias) ||
              titleSlugDePlural.includes(alias)
            ) {
              this.logger.debug(
                `[resolveGammesFromFiles] Strategy 3 match: "${titleSlug}" (deplural: "${titleSlugDePlural}") → alias "${alias}" for ${path.basename(fullPath)}`,
              );
              addResult(alias, fullPath);
              matched = true;
              break;
            }
          }
          if (!matched && titleMatch) {
            this.logger.debug(
              `[resolveGammesFromFiles] Strategy 3 NO match: "${titleSlug}" (deplural: "${titleSlugDePlural}") for ${path.basename(fullPath)}`,
            );
          }
        }

        // Strategy 4: Weaviate search fallback (async)
        if (!matched) {
          const snippet = head
            .replace(/^---[\s\S]*?---/, '')
            .trim()
            .slice(0, 200);
          if (snippet.length > 20) {
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
                  addResult(alias, fullPath);
                }
              }
            } catch {
              /* Weaviate fallback non-bloquant */
            }
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
   * 1. gammes/ -> filename = pg_alias (direct match)
   * 2. web/, web-catalog/ -> frontmatter gamme: or category: field
   * 3. web/, web-catalog/ -> title: matched against known gamme aliases
   * Returns Map of pg_alias slugs -> file paths (deduplicated).
   *
   * @deprecated Fallback: scan filesystem with mtime window. Prefer resolveGammesFromFiles().
   */
  public detectAffectedGammes(): Map<string, string[]> {
    const knowledgePath =
      this.configService.get<string>('RAG_KNOWLEDGE_PATH') ||
      '/opt/automecanik/rag/knowledge';
    const cutoff = Date.now() - 30 * 60 * 1000; // 30 min window for long PDF ingestions
    const results = new Map<string, string[]>();

    /** Helper to add a file path to a gamme alias in the results map */
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

    // Load known gamme aliases for title matching (strategy 3)
    const knownAliases = this.getKnownGammeAliases(knowledgePath);

    // 2+3. Scan ALL knowledge subdirectories (excluding gammes/ handled above)
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
            // Pre-filter: skip files with invalid frontmatter
            const quickCheck = this.frontmatterValidator.validateFile(fullPath);
            if (!quickCheck.valid) {
              this.logger.debug(
                `Skipping ${subDir}/${f}: ${quickCheck.errors.join(', ')}`,
              );
              continue;
            }

            const head = readFileSync(fullPath, 'utf-8').slice(0, 500);

            // Strategy 2a: explicit gamme: field
            const gammeMatch = head.match(/^gamme:\s*(.+)$/m);
            if (gammeMatch) {
              addResult(gammeMatch[1].trim(), fullPath);
              continue;
            }

            // Strategy 2b: category: field (if it's a gamme name, not generic)
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
                  addResult(slug, fullPath);
                  continue;
                }
              }
            }

            // Strategy 3: match title: against known gamme aliases
            const titleMatch = head.match(/^title:\s*"?(.+?)"?\s*$/m);
            if (titleMatch && knownAliases.length > 0) {
              const titleSlug = titleMatch[1]
                .trim()
                // Unescape Python-style \xNN hex sequences from ingest_web.py
                .replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) =>
                  String.fromCharCode(parseInt(hex, 16)),
                )
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/ - section.*$/i, '') // strip section suffix
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '');

              // Also try de-pluralized slug (French: filtres->filtre, disques->disque)
              const titleSlugDePlural = titleSlug.replace(/s(-|$)/g, '$1');

              for (const alias of knownAliases) {
                if (alias.length < 4) continue;
                if (
                  titleSlug.includes(alias) ||
                  titleSlugDePlural.includes(alias)
                ) {
                  addResult(alias, fullPath);
                  break;
                }
              }
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
  ): Promise<void> {
    // Prefer explicit file list from validation (no mtime dependency)
    const validFiles = validationResult?.valid ?? [];
    const affectedGammesMap =
      validFiles.length > 0
        ? await this.resolveGammesFromFiles(validFiles)
        : this.detectAffectedGammes();
    const affectedGammes = Array.from(affectedGammesMap.keys());
    const affectedDiagnostics = this.detectAffectedDiagnostics();

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
  }
}
