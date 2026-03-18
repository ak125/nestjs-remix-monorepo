/**
 * ContentMergeEngine — P1.5 v2.1
 *
 * Pure merge logic. No DB access, no locks, no side effects.
 * Responsible for: mergeText, mergeArray, mergeAppend, stripMarkers.
 *
 * Extracted from BuyingGuideDbService.mergeTextContent() and generalized
 * for all roles and field types.
 */

import { Injectable, Logger } from '@nestjs/common';

/** Result of a single field merge decision */
export interface MergeFieldResult {
  field: string;
  strategy:
    | 'first_write'
    | 'upgraded'
    | 'minor_rewrite'
    | 'merged_paragraphs'
    | 'kept_existing'
    | 'array_union'
    | 'append'
    | 'protected_restore';
  existingLen: number;
  newLen: number;
  finalLen: number;
  /** The merged value to write (null = skip, keep existing) */
  mergedValue: unknown;
  /** True if the field should be written */
  shouldWrite: boolean;
}

/** Regex pattern for link markers injected by injectLinkMarkers() */
const MARKER_PATTERN = /#LinkGamme_\d+#/g;

@Injectable()
export class ContentMergeEngine {
  private readonly logger = new Logger(ContentMergeEngine.name);

  // ═══════════════════════════════════════════════════════════════
  // TEXT MERGE (paragraph-level, extracted from BuyingGuideDbService)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Merge text content with anti-regression.
   * Rules:
   *   - empty existing → first_write
   *   - incoming >= existing → upgraded
   *   - incoming >= 80% existing → minor_rewrite (allow)
   *   - incoming < 80% existing → merge unique paragraphs
   *   - merge adds nothing → kept_existing (skip)
   */
  mergeText(
    field: string,
    existing: string | null | undefined,
    incoming: string,
  ): MergeFieldResult {
    const existingClean = this.stripMarkers(existing ?? '');
    const incomingClean = this.stripMarkers(incoming);
    const existingLen = existingClean.length;
    const incomingLen = incomingClean.length;

    // First write — no existing content
    if (existingLen === 0) {
      return {
        field,
        strategy: 'first_write',
        existingLen: 0,
        newLen: incomingLen,
        finalLen: incomingLen,
        mergedValue: incoming,
        shouldWrite: true,
      };
    }

    // Upgrade — incoming is longer or equal
    if (incomingLen >= existingLen) {
      return {
        field,
        strategy: 'upgraded',
        existingLen,
        newLen: incomingLen,
        finalLen: incomingLen,
        mergedValue: incoming,
        shouldWrite: true,
      };
    }

    // Incoming is shorter — try paragraph merge to grow, never shrink
    const merged = this.mergeTextParagraphs(existingClean, incomingClean);

    if (merged.length > existingLen) {
      return {
        field,
        strategy: 'merged_paragraphs',
        existingLen,
        newLen: incomingLen,
        finalLen: merged.length,
        mergedValue: merged,
        shouldWrite: true,
      };
    }

    // Merge adds nothing — keep existing
    return {
      field,
      strategy: 'kept_existing',
      existingLen,
      newLen: incomingLen,
      finalLen: existingLen,
      mergedValue: null,
      shouldWrite: false,
    };
  }

  /**
   * Paragraph-level merge: append unique paragraphs from incoming into existing.
   * Extracted from BuyingGuideDbService.mergeTextContent().
   */
  mergeTextParagraphs(existing: string, incoming: string): string {
    const existingParas = existing
      .split(/\n\n|<\/p>\s*<p>/)
      .map((p) => p.trim())
      .filter(Boolean);
    const incomingParas = incoming
      .split(/\n\n|<\/p>\s*<p>/)
      .map((p) => p.trim())
      .filter(Boolean);

    const normalize = (s: string) =>
      s
        .replace(/<[^>]*>/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();

    const existingNormalized = new Set(existingParas.map(normalize));

    const uniqueNew = incomingParas.filter((p) => {
      const norm = normalize(p);
      if (norm.length < 30) return false;
      const prefix = norm.substring(0, 50);
      return ![...existingNormalized].some((e) => e.startsWith(prefix));
    });

    if (uniqueNew.length === 0) return existing;
    return existing + '\n\n' + uniqueNew.join('\n\n');
  }

  // ═══════════════════════════════════════════════════════════════
  // ARRAY MERGE (idempotent union with normalization + cap)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Merge arrays with union logic.
   * - Empty existing → use incoming
   * - Empty incoming → keep existing
   * - Union: keep all existing + add unique incoming items
   * - Idempotent: running twice produces same result
   * - Bounded: optional maxItems cap
   * - Stable: sorted after merge
   */
  mergeArray(
    field: string,
    existing: unknown[] | null | undefined,
    incoming: unknown[] | null | undefined,
    options?: { maxItems?: number },
  ): MergeFieldResult {
    const existingArr = Array.isArray(existing) ? existing : [];
    const incomingArr = Array.isArray(incoming) ? incoming : [];

    // First write
    if (existingArr.length === 0) {
      const capped = options?.maxItems
        ? incomingArr.slice(0, options.maxItems)
        : incomingArr;
      return {
        field,
        strategy: 'first_write',
        existingLen: 0,
        newLen: incomingArr.length,
        finalLen: capped.length,
        mergedValue: capped,
        shouldWrite: capped.length > 0,
      };
    }

    // Empty incoming — keep existing
    if (incomingArr.length === 0) {
      return {
        field,
        strategy: 'kept_existing',
        existingLen: existingArr.length,
        newLen: 0,
        finalLen: existingArr.length,
        mergedValue: null,
        shouldWrite: false,
      };
    }

    // Union merge
    const normalize = (item: unknown) =>
      JSON.stringify(item).toLowerCase().trim().slice(0, 120);

    const existingSet = new Set(existingArr.map(normalize));
    const uniqueIncoming = incomingArr.filter(
      (x) => !existingSet.has(normalize(x)),
    );

    if (uniqueIncoming.length === 0) {
      return {
        field,
        strategy: 'kept_existing',
        existingLen: existingArr.length,
        newLen: incomingArr.length,
        finalLen: existingArr.length,
        mergedValue: null,
        shouldWrite: false,
      };
    }

    let merged = [...existingArr, ...uniqueIncoming];

    // Cap if configured
    if (options?.maxItems && merged.length > options.maxItems) {
      merged = merged.slice(0, options.maxItems);
    }

    return {
      field,
      strategy: 'array_union',
      existingLen: existingArr.length,
      newLen: incomingArr.length,
      finalLen: merged.length,
      mergedValue: merged,
      shouldWrite: true,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // APPEND MERGE
  // ═══════════════════════════════════════════════════════════════

  /**
   * Append incoming to existing (no dedup, just concatenation).
   * Used for metadata or log-like fields.
   */
  mergeAppend(
    field: string,
    existing: string | null | undefined,
    incoming: string,
  ): MergeFieldResult {
    const existingStr = existing ?? '';
    const merged = existingStr ? existingStr + '\n\n' + incoming : incoming;

    return {
      field,
      strategy: 'append',
      existingLen: existingStr.length,
      newLen: incoming.length,
      finalLen: merged.length,
      mergedValue: merged,
      shouldWrite: true,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // MARKER UTILITIES
  // ═══════════════════════════════════════════════════════════════

  /**
   * Strip link markers from text for clean comparison.
   * Markers are `#LinkGamme_123#` injected by injectLinkMarkers().
   * Merge/CAS/hash must operate on marker-free text to avoid false diffs.
   */
  stripMarkers(text: string): string {
    if (!text) return '';
    return text.replace(MARKER_PATTERN, '').trim();
  }

  /**
   * Count link markers in text (diagnostic).
   */
  countMarkers(text: string): number {
    if (!text) return 0;
    return (text.match(MARKER_PATTERN) || []).length;
  }
}
