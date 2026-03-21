/**
 * ContentMergerService — Merge-only content improvement engine.
 *
 * INVARIANT: Output size >= Input size. Content is NEVER shrunk, deleted, or replaced.
 * Only append, grow, enrich operations are allowed.
 *
 * Used by all R* enrichers when processing RAG change events.
 */

import { Injectable, Logger } from '@nestjs/common';

export class MergeShrinkError extends Error {
  constructor(field: string, inputSize: number, outputSize: number) {
    super(
      `MERGE_SHRINK_BLOCKED: field="${field}" shrank from ${inputSize} to ${outputSize}. Content must only grow.`,
    );
    this.name = 'MergeShrinkError';
  }
}

export interface MergeResult<T> {
  merged: T;
  additions: string[]; // Human-readable list of what was added
  unchanged: boolean; // True if no new content was added
}

@Injectable()
export class ContentMergerService {
  private readonly logger = new Logger(ContentMergerService.name);

  /**
   * Merge two JSONB arrays — union by a key field, never remove.
   * Items in `delta` that don't exist in `existing` (by key) are appended.
   * Items that already exist are left untouched.
   */
  mergeJsonbArray<T extends Record<string, unknown>>(
    existing: T[],
    delta: T[],
    keyField: string,
    fieldName: string,
  ): MergeResult<T[]> {
    const existingKeys = new Set(
      existing.map((item) => String(item[keyField] ?? '')),
    );

    const newItems = delta.filter(
      (item) => !existingKeys.has(String(item[keyField] ?? '')),
    );

    const merged = [...existing, ...newItems];

    this.assertNoShrink(fieldName, existing.length, merged.length);

    return {
      merged,
      additions: newItems.map(
        (item) => `${fieldName}: added ${String(item[keyField])}`,
      ),
      unchanged: newItems.length === 0,
    };
  }

  /**
   * Merge two text arrays — concat + dedup, never remove.
   */
  mergeTextArray(
    existing: string[],
    delta: string[],
    fieldName: string,
  ): MergeResult<string[]> {
    const existingSet = new Set(existing.map((s) => s.toLowerCase().trim()));

    const newItems = delta.filter(
      (item) => !existingSet.has(item.toLowerCase().trim()),
    );

    const merged = [...existing, ...newItems];

    this.assertNoShrink(fieldName, existing.length, merged.length);

    return {
      merged,
      additions: newItems.map((item) => `${fieldName}: added "${item}"`),
      unchanged: newItems.length === 0,
    };
  }

  /**
   * Merge HTML/text content — append new paragraphs, never truncate.
   */
  mergeText(
    existing: string,
    delta: string,
    fieldName: string,
  ): MergeResult<string> {
    if (!delta || !delta.trim()) {
      return { merged: existing, additions: [], unchanged: true };
    }

    // Don't append if delta is already contained in existing
    const normalizedExisting = existing.toLowerCase().replace(/\s+/g, ' ');
    const normalizedDelta = delta.toLowerCase().replace(/\s+/g, ' ');

    if (normalizedExisting.includes(normalizedDelta)) {
      return { merged: existing, additions: [], unchanged: true };
    }

    const merged = `${existing}\n\n${delta}`;

    this.assertNoShrink(fieldName, existing.length, merged.length);

    return {
      merged,
      additions: [`${fieldName}: appended ${delta.length} chars`],
      unchanged: false,
    };
  }

  /**
   * Merge JSONB objects — add new keys, never remove existing ones.
   * Existing keys are preserved as-is (not overwritten).
   */
  mergeJsonbObject(
    existing: Record<string, unknown>,
    delta: Record<string, unknown>,
    fieldName: string,
  ): MergeResult<Record<string, unknown>> {
    const existingKeys = new Set(Object.keys(existing));
    const additions: string[] = [];

    const merged = { ...existing };

    for (const [key, value] of Object.entries(delta)) {
      if (!existingKeys.has(key)) {
        merged[key] = value;
        additions.push(`${fieldName}: added key "${key}"`);
      }
      // Existing keys are NEVER overwritten
    }

    const existingSize = Object.keys(existing).length;
    const mergedSize = Object.keys(merged).length;
    this.assertNoShrink(fieldName, existingSize, mergedSize);

    return {
      merged,
      additions,
      unchanged: additions.length === 0,
    };
  }

  /**
   * Merge brands_guide JSONB — add new tiers or new brands within tiers.
   */
  mergeBrandsGuide(
    existing: Record<string, unknown>,
    delta: Record<string, unknown>,
    fieldName = 'brands_guide',
  ): MergeResult<Record<string, unknown>> {
    const additions: string[] = [];
    const merged = JSON.parse(JSON.stringify(existing)) as Record<
      string,
      unknown
    >;

    // Handle tiers array
    if (Array.isArray(delta.tiers) && Array.isArray(merged.tiers)) {
      const result = this.mergeJsonbArray(
        merged.tiers as Record<string, unknown>[],
        delta.tiers as Record<string, unknown>[],
        'tier_id',
        `${fieldName}.tiers`,
      );
      merged.tiers = result.merged;
      additions.push(...result.additions);
    }

    // Handle alerts array
    if (Array.isArray(delta.alerts) && Array.isArray(merged.alerts)) {
      const result = this.mergeTextArray(
        merged.alerts as string[],
        delta.alerts as string[],
        `${fieldName}.alerts`,
      );
      merged.alerts = result.merged;
      additions.push(...result.additions);
    }

    return {
      merged,
      additions,
      unchanged: additions.length === 0,
    };
  }

  /**
   * Merge when_pro JSONB — add new cases, never remove existing ones.
   */
  mergeWhenPro(
    existing: Record<string, unknown>[],
    delta: Record<string, unknown>[],
    fieldName = 'when_pro',
  ): MergeResult<Record<string, unknown>[]> {
    return this.mergeJsonbArray(existing, delta, 'situation', fieldName);
  }

  /**
   * INVARIANT: output must be >= input. Throws MergeShrinkError otherwise.
   */
  private assertNoShrink(
    field: string,
    inputSize: number,
    outputSize: number,
  ): void {
    if (outputSize < inputSize) {
      throw new MergeShrinkError(field, inputSize, outputSize);
    }
  }
}
