/**
 * ContentRegressionGuard — P1.5 v2.1
 *
 * Decides whether an incoming value is an improvement or a regression.
 * Does NOT perform the write — only returns the decision.
 *
 * Uses per-field regressionProfile from FieldOwnership when available,
 * falls back to sensible defaults.
 */

import { Injectable, Logger } from '@nestjs/common';
import type { FieldOwnership } from './execution-registry.types';
import { FIELD_CATALOG_INDEX } from './field-catalog.constants';
import { ContentMergeEngine } from './content-merge-engine.service';
import type { MergeFieldResult } from './content-merge-engine.service';

/** Regression profile for a single field (configurable per field) */
export interface RegressionProfile {
  /** Minimum ratio of new/existing length before blocking (default 0.5) */
  minLengthRatio: number;
  /** Check paragraph count regression */
  checkParagraphCount?: boolean;
  /** Check bullet/list item count regression */
  checkBulletCount?: boolean;
  /** Max array items (for bounded merge) */
  maxArrayItems?: number;
}

/** Default profile when none is configured on the field */
const DEFAULT_PROFILE: RegressionProfile = {
  minLengthRatio: 0.9,
  checkParagraphCount: true,
  checkBulletCount: false,
};

@Injectable()
export class ContentRegressionGuard {
  private readonly logger = new Logger(ContentRegressionGuard.name);

  constructor(private readonly mergeEngine: ContentMergeEngine) {}

  /**
   * Evaluate a single field: is the incoming value an improvement or regression?
   *
   * Returns a MergeFieldResult with the decision and merged value.
   */
  evaluate(
    table: string,
    field: string,
    existing: unknown,
    incoming: unknown,
  ): MergeFieldResult {
    const catalogEntry = FIELD_CATALOG_INDEX.get(`${table}.${field}`);

    // Field not in catalog — unprotected, allow direct write
    if (!catalogEntry) {
      const incomingLen =
        typeof incoming === 'string'
          ? incoming.length
          : Array.isArray(incoming)
            ? incoming.length
            : 0;
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

    // Route by write strategy
    switch (catalogEntry.writeStrategy) {
      case 'merge':
        return this.evaluateTextMerge(field, existing, incoming, catalogEntry);

      case 'replace':
        return this.evaluateReplace(field, existing, incoming, catalogEntry);

      case 'append':
        return this.mergeEngine.mergeAppend(
          field,
          existing as string | null,
          incoming as string,
        );

      case 'state_transition':
        // State transitions are always allowed
        return {
          field,
          strategy: 'upgraded',
          existingLen: 0,
          newLen: 0,
          finalLen: 0,
          mergedValue: incoming,
          shouldWrite: true,
        };

      default:
        return this.evaluateReplace(field, existing, incoming, catalogEntry);
    }
  }

  /**
   * Evaluate a text field with merge strategy (paragraph-level).
   */
  private evaluateTextMerge(
    field: string,
    existing: unknown,
    incoming: unknown,
    _entry: FieldOwnership,
  ): MergeFieldResult {
    if (typeof incoming !== 'string') {
      return {
        field,
        strategy: 'kept_existing',
        existingLen: 0,
        newLen: 0,
        finalLen: 0,
        mergedValue: null,
        shouldWrite: false,
      };
    }

    return this.mergeEngine.mergeText(
      field,
      existing as string | null,
      incoming,
    );
  }

  /**
   * Evaluate a field with replace strategy.
   * For content class: anti-regression guards apply.
   * For metadata/state class: direct replace.
   */
  private evaluateReplace(
    field: string,
    existing: unknown,
    incoming: unknown,
    entry: FieldOwnership,
  ): MergeFieldResult {
    // Metadata and state: always allow replace
    if (entry.writeClass === 'metadata' || entry.writeClass === 'state') {
      const len =
        typeof incoming === 'string'
          ? incoming.length
          : Array.isArray(incoming)
            ? incoming.length
            : 0;
      return {
        field,
        strategy: 'upgraded',
        existingLen: 0,
        newLen: len,
        finalLen: len,
        mergedValue: incoming,
        shouldWrite: true,
      };
    }

    const profile = this.getProfile(entry);

    // Array content
    if (Array.isArray(incoming) || Array.isArray(existing)) {
      return this.mergeEngine.mergeArray(
        field,
        existing as unknown[],
        incoming as unknown[],
        { maxItems: profile.maxArrayItems },
      );
    }

    // Text content with replace strategy — still apply anti-regression
    if (typeof incoming === 'string') {
      const existingStr = (existing as string) ?? '';
      const existingLen = this.mergeEngine.stripMarkers(existingStr).length;
      const incomingLen = this.mergeEngine.stripMarkers(incoming).length;

      // First write
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

      // Check length ratio
      if (
        incomingLen < existingLen * profile.minLengthRatio &&
        existingLen > 50
      ) {
        this.logger.warn(
          `RegressionGuard: ${field} blocked — ${incomingLen}c < ${existingLen}c × ${profile.minLengthRatio}`,
        );
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

      // Check paragraph count if configured
      if (profile.checkParagraphCount && existingLen > 200) {
        const existingParas = existingStr.split(/\n\n/).filter(Boolean).length;
        const incomingParas = incoming.split(/\n\n/).filter(Boolean).length;
        if (incomingParas < existingParas * 0.5 && existingParas > 2) {
          this.logger.warn(
            `RegressionGuard: ${field} blocked — ${incomingParas} paras < ${existingParas} × 0.5`,
          );
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
      }

      // Passed guards — allow only if incoming >= existing (never shrink)
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

      // Incoming is shorter but passed minLengthRatio — keep existing
      this.logger.log(
        `RegressionGuard: ${field} kept — incoming ${incomingLen}c < existing ${existingLen}c`,
      );
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

    // Non-string, non-array content: allow
    return {
      field,
      strategy: 'upgraded',
      existingLen: 0,
      newLen: 0,
      finalLen: 0,
      mergedValue: incoming,
      shouldWrite: true,
    };
  }

  /**
   * Get the regression profile for a field.
   * Uses field-specific config if available, else defaults.
   */
  private getProfile(_entry: FieldOwnership): RegressionProfile {
    // regressionProfile is not yet in FieldOwnership type — use defaults
    // When A4 is fully implemented, read from entry.regressionProfile
    return DEFAULT_PROFILE;
  }
}
