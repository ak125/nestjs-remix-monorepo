/**
 * RagGammeReaderService — Lecture centralisee des fichiers RAG gamme.
 *
 * Remplace les 5 copies de readRagFromDisk/parseRagData dispersees dans :
 * - r1-image-prompt.service.ts
 * - r3-image-prompt.service.ts
 * - r1-enricher.service.ts
 * - r1-related-resources.service.ts
 * - vehicle-rag-generator.service.ts
 *
 * Utilise EnricherYamlParser (service partage existant) pour le parsing YAML.
 *
 * Virtual Merge (bridge) : quand RAG_VIRTUAL_MERGE_ENABLED=true,
 * readAndParseWithDbKnowledge() fusionne le .md disque + les docs DB
 * (__rag_knowledge) en memoire. Les docs sont classes par section cible
 * (FAQ, Entretien, Symptomes, etc.) et dedupliques par hash normalise.
 * C'est un pont transitoire — Phase 2 materialisera dans les .md.
 */
import { Injectable, Logger, Optional, Inject } from '@nestjs/common';
import { existsSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import * as yaml from 'js-yaml';
import { EnricherYamlParser } from './enricher-yaml-parser.service';
import { type RagData } from './rag-data.types';
import { RagKnowledgeService } from '../../rag-proxy/services/rag-knowledge.service';
import { FeatureFlagsService } from '../../../config/feature-flags.service';

const RAG_GAMMES_DIR = '/opt/automecanik/rag/knowledge/gammes';

const MAX_DOCS_PER_GAMME = 20;
const MAX_CHARS_TOTAL = 15_000;
const MIN_DOC_LENGTH = 100;
const CACHE_TTL_MS = 60_000;

/**
 * Category → target section mapping (deterministic, no LLM).
 * Matches both simple ('diagnostic') and compound ('diagnostic/diagnostic',
 * 'knowledge/guide') categories by checking each segment.
 */
const SECTION_MAP: Record<string, string> = {
  faq: 'FAQ supplementaire',
  diagnostic: 'Symptomes supplementaires',
  maintenance: 'Entretien supplementaire',
  entretien: 'Entretien supplementaire',
  selection: 'Conseils supplementaires',
  achat: 'Conseils supplementaires',
  guide: 'Conseils supplementaires',
  definition: 'References supplementaires',
  reference: 'References supplementaires',
  canonical: 'References supplementaires',
  knowledge: 'References supplementaires',
  variante: 'Variantes supplementaires',
  type: 'Variantes supplementaires',
};
const FALLBACK_SECTION = 'References supplementaires';

export interface VirtualMergeProvenance {
  dbDocsConsidered: number;
  dbDocsAccepted: number;
  dbDocsSkipped: number;
  dbDocsSkippedReasons: Record<string, number>;
  mergeSources: string[];
  mergeFingerprintSet: string[];
  totalCharsAppended: number;
}

export interface VirtualMergeResult {
  ragData: RagData;
  rawContent: string;
  provenance: VirtualMergeProvenance;
}

interface CacheEntry {
  data: VirtualMergeResult;
  expiry: number;
  cacheKey: string;
}

@Injectable()
export class RagGammeReaderService {
  private readonly logger = new Logger(RagGammeReaderService.name);
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    private readonly yamlParser: EnricherYamlParser,
    @Optional()
    @Inject(RagKnowledgeService)
    private readonly ragKnowledgeService: RagKnowledgeService | null,
    @Optional()
    @Inject(FeatureFlagsService)
    private readonly featureFlags: FeatureFlagsService | null,
  ) {}

  /**
   * Lit le contenu brut d'un fichier RAG gamme depuis le disque.
   * @returns Contenu markdown complet ou null si fichier absent.
   */
  readRawContent(pgAlias: string): string | null {
    const filePath = join(RAG_GAMMES_DIR, `${pgAlias}.md`);
    try {
      if (!existsSync(filePath)) return null;
      return readFileSync(filePath, 'utf-8');
    } catch {
      this.logger.warn(`[RAG-READER] Failed to read ${pgAlias}.md`);
      return null;
    }
  }

  /**
   * Parse le frontmatter YAML d'un contenu RAG en RagData type.
   * Utilise EnricherYamlParser.extractFrontmatterBlock() (centralise).
   */
  parseRagData(content: string): RagData {
    const fm = this.yamlParser.extractFrontmatterBlock(content);
    if (!fm) return {};
    try {
      const parsed = yaml.load(fm) as Record<string, unknown>;
      return {
        category: parsed.category as string | undefined,
        domain: parsed.domain as RagData['domain'],
        diagnostic: parsed.diagnostic as RagData['diagnostic'],
        maintenance: parsed.maintenance as RagData['maintenance'],
        selection: parsed.selection as RagData['selection'],
        installation: parsed.installation as RagData['installation'],
      };
    } catch {
      this.logger.warn(`[RAG-READER] Failed to parse YAML frontmatter`);
      return {};
    }
  }

  /**
   * Lecture + parsing combines. Methode principale (sync, backward compat).
   */
  readAndParse(pgAlias: string): RagData | null {
    const content = this.readRawContent(pgAlias);
    if (!content) return null;
    const data = this.parseRagData(content);
    return Object.keys(data).length > 0 ? data : null;
  }

  /**
   * Virtual Merge — Lecture .md + docs DB fusionnes en memoire.
   *
   * Bridge transitoire : quand RAG_VIRTUAL_MERGE_ENABLED=true, enrichit
   * le contenu .md avec les docs __rag_knowledge classes par section cible.
   * Fallback sur readAndParse() sync si flag OFF ou services absents.
   */
  async readAndParseWithDbKnowledge(
    pgAlias: string,
  ): Promise<VirtualMergeResult | null> {
    // Feature flag OFF or missing dependencies → sync fallback
    if (
      !this.featureFlags?.ragVirtualMergeEnabled ||
      !this.ragKnowledgeService
    ) {
      const ragData = this.readAndParse(pgAlias);
      if (!ragData) return null;
      return {
        ragData,
        rawContent: this.readRawContent(pgAlias) || '',
        provenance: emptyProvenance(),
      };
    }

    // Read disk content
    const diskContent = this.readRawContent(pgAlias);
    if (!diskContent) return null;

    // Cache check with versioned key
    const mdMtime = this.getFileMtime(pgAlias);
    const cached = this.cache.get(pgAlias);
    if (cached && cached.expiry > Date.now()) {
      // Verify version key still matches (mtime-based)
      const currentKey = `${pgAlias}:${mdMtime}`;
      if (cached.cacheKey.startsWith(currentKey)) {
        return cached.data;
      }
    }

    // Fetch DB docs
    let dbDocs: Array<{
      id: string;
      title: string;
      content: string;
      source: string;
      truth_level: string;
      category: string | null;
      updated_at: string;
    }>;
    try {
      dbDocs = await this.ragKnowledgeService.getDbKnowledgeForGamme(pgAlias);
    } catch (err) {
      this.logger.warn(
        `[VIRTUAL-MERGE] DB fetch failed for ${pgAlias}: ${err}`,
      );
      const ragData = this.parseRagData(diskContent);
      return {
        ragData,
        rawContent: diskContent,
        provenance: emptyProvenance(),
      };
    }

    // Build fingerprint set from existing body (paragraph-level hashes)
    const existingHashes = buildParagraphHashes(diskContent);

    // Classify and merge DB docs into sections
    const sections = new Map<string, string[]>();
    const provenance: VirtualMergeProvenance = {
      dbDocsConsidered: dbDocs.length,
      dbDocsAccepted: 0,
      dbDocsSkipped: 0,
      dbDocsSkippedReasons: {},
      mergeSources: [],
      mergeFingerprintSet: [],
      totalCharsAppended: 0,
    };

    let charsUsed = 0;

    for (const doc of dbDocs) {
      // Budget: doc count
      if (provenance.dbDocsAccepted >= MAX_DOCS_PER_GAMME) {
        skipDoc(provenance, 'budget_max_docs');
        continue;
      }

      // Budget: total chars
      if (charsUsed >= MAX_CHARS_TOTAL) {
        skipDoc(provenance, 'budget_max_chars');
        continue;
      }

      // Min length filter
      if (!doc.content || doc.content.length < MIN_DOC_LENGTH) {
        skipDoc(provenance, 'too_short');
        continue;
      }

      // Dedup by normalized hash
      const docHash = normalizedHash(doc.content);
      if (existingHashes.has(docHash)) {
        skipDoc(provenance, 'dedup');
        continue;
      }

      // Classify into target section
      const sectionName = classifySection(doc.category);
      const trimmedContent = doc.content.trim();
      const charsToAdd = Math.min(
        trimmedContent.length,
        MAX_CHARS_TOTAL - charsUsed,
      );
      const contentSlice =
        charsToAdd < trimmedContent.length
          ? trimmedContent.slice(0, charsToAdd) + '\n\n[...]'
          : trimmedContent;

      if (!sections.has(sectionName)) {
        sections.set(sectionName, []);
      }
      sections
        .get(sectionName)!
        .push(
          `<!-- source: ${doc.source}, ${doc.truth_level}, ${doc.updated_at?.split('T')[0] || 'unknown'} -->\n${contentSlice}`,
        );

      // Track provenance
      provenance.dbDocsAccepted++;
      provenance.mergeSources.push(doc.source);
      provenance.mergeFingerprintSet.push(docHash);
      charsUsed += charsToAdd;
      existingHashes.add(docHash); // prevent intra-batch duplicates
    }

    provenance.totalCharsAppended = charsUsed;

    // Assemble merged content
    let mergedContent = diskContent;
    if (sections.size > 0) {
      const appendParts: string[] = [];
      for (const [sectionName, blocks] of sections) {
        appendParts.push(`\n\n## ${sectionName}\n\n${blocks.join('\n\n')}`);
      }
      mergedContent = diskContent + appendParts.join('');
    }

    // Parse merged content
    const ragData = this.parseRagData(mergedContent);

    const result: VirtualMergeResult = {
      ragData,
      rawContent: mergedContent,
      provenance,
    };

    // Cache with versioned key
    const maxUpdatedAt = dbDocs.length > 0 ? dbDocs[0].updated_at || '' : '';
    const cacheKey = `${pgAlias}:${mdMtime}:${maxUpdatedAt}`;
    this.cache.set(pgAlias, {
      data: result,
      expiry: Date.now() + CACHE_TTL_MS,
      cacheKey,
    });

    if (provenance.dbDocsAccepted > 0) {
      this.logger.log(
        `[VIRTUAL-MERGE] ${pgAlias}: +${provenance.dbDocsAccepted} docs, +${charsUsed} chars (${provenance.dbDocsSkipped} skipped)`,
      );
    }

    return result;
  }

  private getFileMtime(pgAlias: string): number {
    const filePath = join(RAG_GAMMES_DIR, `${pgAlias}.md`);
    try {
      return statSync(filePath).mtimeMs;
    } catch {
      return 0;
    }
  }
}

// ── Helpers (module-level, no class state) ──

function emptyProvenance(): VirtualMergeProvenance {
  return {
    dbDocsConsidered: 0,
    dbDocsAccepted: 0,
    dbDocsSkipped: 0,
    dbDocsSkippedReasons: {},
    mergeSources: [],
    mergeFingerprintSet: [],
    totalCharsAppended: 0,
  };
}

function skipDoc(provenance: VirtualMergeProvenance, reason: string): void {
  provenance.dbDocsSkipped++;
  provenance.dbDocsSkippedReasons[reason] =
    (provenance.dbDocsSkippedReasons[reason] || 0) + 1;
}

/** Classify category into target section. Handles compound categories like 'diagnostic/diagnostic'. */
function classifySection(category: string | null): string {
  if (!category) return FALLBACK_SECTION;
  // Try exact match first, then check each segment
  const lower = category.toLowerCase();
  if (SECTION_MAP[lower]) return SECTION_MAP[lower];
  for (const segment of lower.split('/')) {
    if (SECTION_MAP[segment]) return SECTION_MAP[segment];
  }
  return FALLBACK_SECTION;
}

/** Normalize text and compute SHA-256 hash (16 chars). */
function normalizedHash(text: string): string {
  const normalized = text.toLowerCase().replace(/\s+/g, ' ').trim();
  return createHash('sha256').update(normalized).digest('hex').slice(0, 16);
}

/** Build a set of paragraph-level hashes from existing content. */
function buildParagraphHashes(content: string): Set<string> {
  const hashes = new Set<string>();
  // Split by double newline (paragraph boundaries)
  const paragraphs = content.split(/\n{2,}/);
  for (const p of paragraphs) {
    const trimmed = p.trim();
    if (trimmed.length >= MIN_DOC_LENGTH) {
      hashes.add(normalizedHash(trimmed));
    }
  }
  return hashes;
}
