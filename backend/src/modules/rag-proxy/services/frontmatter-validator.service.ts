import { Injectable, Logger } from '@nestjs/common';
import {
  readFileSync,
  readdirSync,
  renameSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  statSync,
} from 'node:fs';
import * as path from 'node:path';
import {
  KnowledgeDocType,
  REQUIRED_FRONTMATTER_FIELDS,
  VALID_SOURCE_TYPES,
  VALID_TRUTH_LEVELS,
  VALID_DOC_FAMILIES,
  type FrontmatterData,
  type ValidationResult,
  type QuarantineEntry,
} from '../types/knowledge-doc.types';

@Injectable()
export class FrontmatterValidatorService {
  private readonly logger = new Logger(FrontmatterValidatorService.name);

  /**
   * Parse YAML frontmatter from a markdown file.
   * Only reads flat key: value pairs (no nested YAML).
   */
  parseFrontmatter(content: string): FrontmatterData {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match) return {};

    const fm: FrontmatterData = {};
    for (const line of match[1].split('\n')) {
      const idx = line.indexOf(':');
      if (idx < 0) continue;
      const key = line.substring(0, idx).trim();
      if (!key || key.startsWith('#') || key.startsWith('-')) continue;
      let value = line.substring(idx + 1).trim();
      // Strip surrounding quotes
      value = value.replace(/^['"]|['"]$/g, '').trim();
      if (value) fm[key] = value;
    }
    return fm;
  }

  /**
   * Validate a single file's frontmatter and determine its KB type.
   */
  validateFile(filePath: string): ValidationResult {
    const errors: string[] = [];
    let content: string;
    try {
      content = readFileSync(filePath, 'utf-8');
    } catch {
      return {
        valid: false,
        kbType: null,
        errors: [`UNREADABLE: ${filePath}`],
        frontmatter: {},
      };
    }

    const fm = this.parseFrontmatter(content);

    // Auto-infer doc_family from source_type when missing
    // (web/PDF ingestion scripts don't always set doc_family)
    if (!fm.doc_family && fm.source_type) {
      const SOURCE_TO_FAMILY: Record<string, string> = {
        gamme: 'catalog',
        diagnostic: 'diagnostic',
        guide: 'guide',
        faq: 'knowledge',
        policy: 'knowledge',
        general: 'knowledge',
      };
      const inferred = SOURCE_TO_FAMILY[fm.source_type];
      if (inferred) {
        fm.doc_family = inferred;
      }
    }

    // Check required fields
    for (const field of REQUIRED_FRONTMATTER_FIELDS) {
      if (!fm[field]) {
        errors.push(`MISSING_REQUIRED_FIELD: ${field}`);
      }
    }

    // Validate source_type value
    if (
      fm.source_type &&
      !VALID_SOURCE_TYPES.includes(
        fm.source_type as (typeof VALID_SOURCE_TYPES)[number],
      )
    ) {
      errors.push(`INVALID_SOURCE_TYPE: ${fm.source_type}`);
    }

    // Validate truth_level value
    if (
      fm.truth_level &&
      !VALID_TRUTH_LEVELS.includes(
        fm.truth_level as (typeof VALID_TRUTH_LEVELS)[number],
      )
    ) {
      errors.push(`INVALID_TRUTH_LEVEL: ${fm.truth_level}`);
    }

    // Validate doc_family value
    if (
      fm.doc_family &&
      !VALID_DOC_FAMILIES.includes(
        fm.doc_family as (typeof VALID_DOC_FAMILIES)[number],
      )
    ) {
      errors.push(`INVALID_DOC_FAMILY: ${fm.doc_family}`);
    }

    if (errors.length > 0) {
      return { valid: false, kbType: null, errors, frontmatter: fm };
    }

    // Determine KB type from source_type + doc_family
    const kbType = this.inferKbType(fm);
    return { valid: true, kbType, errors: [], frontmatter: fm };
  }

  /**
   * Infer KB type from frontmatter fields.
   */
  private inferKbType(fm: FrontmatterData): KnowledgeDocType {
    if (fm.source_type === 'gamme' || fm.doc_family === 'catalog') {
      return KnowledgeDocType.KB_GAMME;
    }
    if (fm.source_type === 'diagnostic' || fm.doc_family === 'diagnostic') {
      return KnowledgeDocType.KB_DIAGNOSTIC;
    }
    if (fm.source_type === 'faq' || fm.source_type === 'policy') {
      return KnowledgeDocType.KB_SUPPORT;
    }
    // guide, general, or other → KB_REFERENCE
    return KnowledgeDocType.KB_REFERENCE;
  }

  /**
   * Validate all recently modified files in an intake zone (web/ or web-catalog/).
   * Invalid files are moved to _quarantine/ with REASON.log.
   * Returns list of quarantined entries.
   */
  validateIntakeZone(
    knowledgePath: string,
    subDir: string,
    cutoffMs?: number,
  ): { valid: string[]; quarantined: QuarantineEntry[] } {
    const dir = path.join(knowledgePath, subDir);
    const quarantineDir = path.join(knowledgePath, '_quarantine');
    const cutoff = cutoffMs ?? Date.now() - 30 * 60 * 1000;
    const valid: string[] = [];
    const quarantined: QuarantineEntry[] = [];

    if (!existsSync(dir)) return { valid, quarantined };
    mkdirSync(quarantineDir, { recursive: true });

    let files: string[];
    try {
      files = readdirSync(dir).filter((f) => f.endsWith('.md'));
    } catch {
      return { valid, quarantined };
    }

    for (const file of files) {
      const fullPath = path.join(dir, file);
      try {
        if (statSync(fullPath).mtimeMs <= cutoff) continue;
      } catch {
        continue;
      }

      const result = this.validateFile(fullPath);

      if (!result.valid) {
        const entry = this.moveToQuarantine(
          knowledgePath,
          fullPath,
          `${subDir}/${file}`,
          result.errors.join('; '),
          result.frontmatter,
        );
        quarantined.push(entry);
        this.logger.warn(
          `Quarantined ${subDir}/${file}: ${result.errors.join(', ')}`,
        );
      } else {
        valid.push(fullPath);
      }
    }

    return { valid, quarantined };
  }

  /**
   * Move a file to _quarantine/ and write REASON.log.
   */
  private moveToQuarantine(
    knowledgePath: string,
    filePath: string,
    originalRelPath: string,
    reason: string,
    frontmatter: FrontmatterData,
  ): QuarantineEntry {
    const quarantineDir = path.join(knowledgePath, '_quarantine');
    mkdirSync(quarantineDir, { recursive: true });

    const now = new Date();
    const datePrefix = now.toISOString().slice(0, 10); // YYYY-MM-DD
    const filename = path.basename(filePath);
    const qFilename = `${datePrefix}_${filename}`;
    const qPath = path.join(quarantineDir, qFilename);

    // Move file
    renameSync(filePath, qPath);

    // Write REASON.log
    const entry: QuarantineEntry = {
      filename: qFilename,
      originalPath: originalRelPath,
      reason,
      details: Object.entries(frontmatter)
        .filter(([, v]) => v)
        .map(([k, v]) => `${k}=${v}`)
        .join(', '),
      quarantinedAt: now.toISOString(),
    };

    const reasonLog = [
      `quarantined_at: ${entry.quarantinedAt}`,
      `original_path: ${entry.originalPath}`,
      `reason: ${entry.reason}`,
      `details: ${entry.details}`,
      `action: moved to _quarantine, skipped from reindex + event`,
    ].join('\n');

    writeFileSync(`${qPath}.REASON.log`, reasonLog, 'utf-8');

    return entry;
  }
}
