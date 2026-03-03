import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { existsSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import * as yaml from 'js-yaml';
import type { RagMergePatch } from './pdf-rag-classifier.service';

export interface MergeResult {
  /** Whether the merge was applied (false if skipped due to low confidence) */
  applied: boolean;
  /** Skip reason when applied=false */
  reason?: string;
  /** Fields that were modified */
  modifiedFields: string[];
  /** Markdown sections added */
  markdownSectionsAdded: number;
  /** Attribution count (Source: ...) */
  sourceAttributions: number;
  /** Before/after character count */
  charsBefore: number;
  charsAfter: number;
  /** Path to the modified file */
  filePath: string;
}

/** Minimum LLM confidence to apply a merge patch */
const MIN_MERGE_CONFIDENCE = 30;

@Injectable()
export class RagMdMergerService {
  private readonly logger = new Logger(RagMdMergerService.name);
  private readonly RAG_GAMMES_DIR = '/opt/automecanik/rag/knowledge/gammes';

  /**
   * Apply a merge-patch to an existing RAG .md file.
   * Appends to arrays, adds new blocks, inserts markdown sections.
   * All modifications are attributed with (Source: {sourceRef}).
   */
  merge(pgAlias: string, patch: RagMergePatch): MergeResult {
    const filePath = join(this.RAG_GAMMES_DIR, `${pgAlias}.md`);

    // Guard: reject low-confidence LLM output to protect RAG files
    if (patch.confidence < MIN_MERGE_CONFIDENCE) {
      this.logger.warn(
        `Skipping merge for ${pgAlias}: confidence ${patch.confidence}% < ${MIN_MERGE_CONFIDENCE}% threshold`,
      );
      return {
        applied: false,
        reason: 'LOW_CONFIDENCE',
        modifiedFields: [],
        markdownSectionsAdded: 0,
        sourceAttributions: 0,
        charsBefore: 0,
        charsAfter: 0,
        filePath,
      };
    }

    if (!existsSync(filePath)) {
      throw new BadRequestException(`RAG file not found: ${filePath}`);
    }

    const originalContent = readFileSync(filePath, 'utf-8');
    const { charsBefore } = { charsBefore: originalContent.length };

    // Split into YAML frontmatter + markdown body
    const { yamlStr, body } = this.splitFrontmatter(originalContent);
    if (!yamlStr) {
      throw new BadRequestException(`No YAML frontmatter in ${filePath}`);
    }

    // Parse YAML
    let yamlObj: Record<string, unknown>;
    try {
      yamlObj = yaml.load(yamlStr) as Record<string, unknown>;
    } catch (err) {
      throw new BadRequestException(
        `Invalid YAML in ${filePath}: ${err instanceof Error ? err.message : err}`,
      );
    }

    const modifiedFields: string[] = [];
    let sourceAttributions = 0;
    const sourceTag = `(Source: ${patch.source_ref})`;

    // 1. Apply array appends
    for (const [dotPath, items] of Object.entries(patch.yaml_array_appends)) {
      if (!Array.isArray(items) || items.length === 0) continue;

      const existing = this.getNestedValue(yamlObj, dotPath);
      const arr = Array.isArray(existing) ? existing : [];

      for (const item of items) {
        // Avoid duplicates (check content similarity)
        const normalizedItem = item.toLowerCase().replace(/\s+/g, ' ');
        const isDuplicate = arr.some(
          (a: unknown) =>
            typeof a === 'string' &&
            a
              .toLowerCase()
              .replace(/\s+/g, ' ')
              .includes(normalizedItem.substring(0, 40)),
        );
        if (isDuplicate) continue;

        // Attribute source
        const attributed = item.includes(sourceTag)
          ? item
          : `${item} ${sourceTag}`;
        arr.push(attributed);
        sourceAttributions++;
      }

      this.setNestedValue(yamlObj, dotPath, arr);
      modifiedFields.push(dotPath);
    }

    // 2. Apply field enrichments (append text to existing items)
    for (const [dotPath, enrichments] of Object.entries(
      patch.yaml_field_enrichments,
    )) {
      if (!Array.isArray(enrichments) || enrichments.length === 0) continue;

      const existing = this.getNestedValue(yamlObj, dotPath);
      if (!Array.isArray(existing)) continue;

      for (const enrichment of enrichments) {
        const { key, append } = enrichment;
        // Extract step index from key like "step_3"
        const match = key.match(/(\d+)/);
        if (!match) continue;
        const idx = parseInt(match[1], 10) - 1; // 0-indexed

        if (
          idx >= 0 &&
          idx < existing.length &&
          typeof existing[idx] === 'string'
        ) {
          const attributed = append.includes(sourceTag)
            ? append
            : `${append} ${sourceTag}`;
          existing[idx] = `${existing[idx]} ${attributed}`;
          sourceAttributions++;
        }
      }

      modifiedFields.push(dotPath);
    }

    // 3. Add new YAML blocks
    for (const [key, value] of Object.entries(patch.new_yaml_blocks)) {
      if (yamlObj[key]) {
        this.logger.warn(`YAML block '${key}' already exists — skipping`);
        continue;
      }
      yamlObj[key] = value;
      modifiedFields.push(key);
    }

    // 4. Update metadata
    const now = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    this.setNestedValue(yamlObj, 'updated_at', now);
    this.setNestedValue(
      yamlObj,
      'lifecycle.last_enriched_by',
      `${patch.truth_level === 'L2' ? 'web' : 'pdf'}-${patch.source_ref.toLowerCase().replace(/\s+/g, '-')}`,
    );
    this.setNestedValue(yamlObj, 'lifecycle.last_enriched_at', now);

    // Bump quality score if LLM confidence is high
    if (patch.confidence >= 70) {
      const currentScore = this.getNestedValue(
        yamlObj,
        'rendering.quality.score',
      );
      const current = typeof currentScore === 'number' ? currentScore : 80;
      const newScore = Math.min(current + 3, 99);
      this.setNestedValue(yamlObj, 'rendering.quality.score', newScore);
      const existingSrc =
        this.getNestedValue(yamlObj, 'rendering.quality.source') || '';
      if (
        typeof existingSrc === 'string' &&
        !existingSrc.includes(patch.source_ref)
      ) {
        this.setNestedValue(
          yamlObj,
          'rendering.quality.source',
          `${existingSrc} + ${patch.source_ref}`.replace(/^\s*\+\s*/, ''),
        );
      }
    }

    // 5. Serialize YAML back
    const newYaml = yaml.dump(yamlObj, {
      lineWidth: 120,
      noRefs: true,
      quotingType: '"',
      forceQuotes: false,
    });

    // 6. Apply markdown sections to body
    let newBody = body;
    let markdownSectionsAdded = 0;

    for (const section of patch.markdown_sections) {
      if (!section.title || !section.content) continue;

      const sectionMd = `\n## ${section.title} ${sourceTag}\n\n${section.content}\n`;

      if (section.after) {
        // Insert after the specified H2
        const afterPattern = new RegExp(
          `(## ${this.escapeRegex(section.after)}[^\n]*\n(?:(?!## ).+\n)*)`,
        );
        const match = newBody.match(afterPattern);
        if (match && match.index !== undefined) {
          const insertPos = match.index + match[0].length;
          newBody =
            newBody.substring(0, insertPos) +
            sectionMd +
            newBody.substring(insertPos);
          markdownSectionsAdded++;
          sourceAttributions++;
          continue;
        }
      }

      // Fallback: append before the last line (typically the source footer)
      const lastNewline = newBody.lastIndexOf('\n\n');
      if (lastNewline > 0) {
        newBody =
          newBody.substring(0, lastNewline) +
          sectionMd +
          newBody.substring(lastNewline);
      } else {
        newBody += sectionMd;
      }
      markdownSectionsAdded++;
      sourceAttributions++;
    }

    // 7. Reassemble file
    const finalContent = `---\n${newYaml}---\n${newBody}`;

    // 8. Write file (atomic: write tmp then rename to prevent corruption)
    const tmpPath = filePath + '.tmp';
    writeFileSync(tmpPath, finalContent, 'utf-8');
    renameSync(tmpPath, filePath);

    const result: MergeResult = {
      applied: true,
      modifiedFields,
      markdownSectionsAdded,
      sourceAttributions,
      charsBefore,
      charsAfter: finalContent.length,
      filePath,
    };

    this.logger.log(
      `Merged ${patch.source_ref} into ${pgAlias}: ${modifiedFields.length} fields, ` +
        `${markdownSectionsAdded} md sections, ${sourceAttributions} attributions, ` +
        `${charsBefore} → ${finalContent.length} chars`,
    );

    return result;
  }

  /**
   * Generate a diff preview without writing.
   */
  preview(
    pgAlias: string,
    patch: RagMergePatch,
  ): {
    fieldsToModify: string[];
    sectionsToAdd: string[];
    estimatedNewItems: number;
  } {
    const filePath = join(this.RAG_GAMMES_DIR, `${pgAlias}.md`);
    if (!existsSync(filePath)) {
      return { fieldsToModify: [], sectionsToAdd: [], estimatedNewItems: 0 };
    }

    const fieldsToModify = Object.keys(patch.yaml_array_appends).filter(
      (k) => (patch.yaml_array_appends[k]?.length ?? 0) > 0,
    );
    fieldsToModify.push(...Object.keys(patch.yaml_field_enrichments));
    fieldsToModify.push(...Object.keys(patch.new_yaml_blocks));

    const sectionsToAdd = patch.markdown_sections.map((s) => s.title);

    let estimatedNewItems = 0;
    for (const items of Object.values(patch.yaml_array_appends)) {
      estimatedNewItems += items.length;
    }
    estimatedNewItems += patch.markdown_sections.length;

    return { fieldsToModify, sectionsToAdd, estimatedNewItems };
  }

  // ── Helpers ──

  private splitFrontmatter(content: string): {
    yamlStr: string | null;
    body: string;
    yamlStartLine: number;
  } {
    if (!content.startsWith('---\n')) {
      return { yamlStr: null, body: content, yamlStartLine: 0 };
    }
    const endIdx = content.indexOf('\n---\n', 4);
    if (endIdx < 0) {
      return { yamlStr: null, body: content, yamlStartLine: 0 };
    }
    return {
      yamlStr: content.substring(4, endIdx),
      body: content.substring(endIdx + 5),
      yamlStartLine: 1,
    };
  }

  private getNestedValue(
    obj: Record<string, unknown>,
    dotPath: string,
  ): unknown {
    const keys = dotPath.split('.');
    let current: unknown = obj;
    for (const key of keys) {
      if (
        current === null ||
        current === undefined ||
        typeof current !== 'object'
      ) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[key];
    }
    return current;
  }

  private setNestedValue(
    obj: Record<string, unknown>,
    dotPath: string,
    value: unknown,
  ): void {
    const keys = dotPath.split('.');
    let current: Record<string, unknown> = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]] || typeof current[keys[i]] !== 'object') {
        current[keys[i]] = {};
      }
      current = current[keys[i]] as Record<string, unknown>;
    }
    current[keys[keys.length - 1]] = value;
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
