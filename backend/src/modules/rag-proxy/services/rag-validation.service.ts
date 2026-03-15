import { Injectable, Logger } from '@nestjs/common';
import type {
  QualityGateResult,
  ValidationReport,
  RagExtractionResult,
  RagProvenance,
} from '../types/rag-contracts.types';

/**
 * RagValidationService — Phase 1 Quality Gates (3 levels).
 *
 * - Blocking: prevent any publication (contenu vide, canonical invalide, etc.)
 * - Degrading: allow staged but prevent published
 * - Alert: allow published but with reinforced monitoring
 */
@Injectable()
export class RagValidationService {
  private readonly logger = new Logger(RagValidationService.name);

  /** Minimum content length to pass blocking gate. */
  private static readonly MIN_CONTENT_LENGTH = 50;

  /** Minimum quality score to pass degrading gate. */
  private static readonly MIN_QUALITY_SCORE = 0.3;

  /** Threshold for alert on low-quality but publishable content. */
  private static readonly ALERT_QUALITY_THRESHOLD = 0.5;

  /** Minimum content length before alert fires. */
  private static readonly ALERT_MIN_LENGTH = 200;

  /**
   * Run all quality gates against an extraction result.
   * Returns a full validation report with pass/fail per level.
   */
  validate(
    extraction: RagExtractionResult,
    provenance: RagProvenance,
  ): ValidationReport {
    const blockingGates = this.runBlockingGates(extraction, provenance);
    const degradingGates = this.runDegradingGates(extraction, provenance);
    const alertGates = this.runAlertGates(extraction, provenance);

    const hasBlocking = blockingGates.some((g) => !g.passed);
    const hasDegrading = degradingGates.some((g) => !g.passed);

    return {
      overallPassed: !hasBlocking,
      canPublish: !hasBlocking && !hasDegrading,
      blockingGates,
      degradingGates,
      alertGates,
      qualityScore: extraction.extractionQualityScore,
    };
  }

  // ── Blocking Gates (prevent publication entirely) ───────────

  private runBlockingGates(
    extraction: RagExtractionResult,
    provenance: RagProvenance,
  ): QualityGateResult[] {
    const results: QualityGateResult[] = [];

    // G-B1: Content not empty
    results.push({
      passed: extraction.extractedText.trim().length > 0,
      level: 'blocking',
      gateName: 'content_not_empty',
      message:
        extraction.extractedText.trim().length > 0
          ? 'Content is not empty'
          : 'BLOCKING: Extracted content is empty',
    });

    // G-B2: Content minimum length
    results.push({
      passed:
        extraction.extractedText.trim().length >=
        RagValidationService.MIN_CONTENT_LENGTH,
      level: 'blocking',
      gateName: 'content_min_length',
      message:
        extraction.extractedText.trim().length >=
        RagValidationService.MIN_CONTENT_LENGTH
          ? `Content length OK (${extraction.extractedText.trim().length} chars)`
          : `BLOCKING: Content too short (${extraction.extractedText.trim().length} < ${RagValidationService.MIN_CONTENT_LENGTH})`,
    });

    // G-B3: Canonical source key valid
    const hasCanonical =
      !!extraction.canonicalSourceKey || !!extraction.normalizedSourceKey;
    results.push({
      passed: hasCanonical,
      level: 'blocking',
      gateName: 'canonical_valid',
      message: hasCanonical
        ? 'Canonical key present'
        : 'BLOCKING: No canonical or normalized source key',
    });

    // G-B4: Source URL present in provenance
    results.push({
      passed: !!provenance.sourceUrl,
      level: 'blocking',
      gateName: 'source_url_present',
      message: provenance.sourceUrl
        ? 'Source URL present'
        : 'BLOCKING: Missing source URL in provenance',
    });

    // G-B5: Truth level valid
    const validTruthLevels = ['L1', 'L2', 'L3', 'L4'];
    results.push({
      passed: validTruthLevels.includes(provenance.truthLevel),
      level: 'blocking',
      gateName: 'truth_level_valid',
      message: validTruthLevels.includes(provenance.truthLevel)
        ? `Truth level OK (${provenance.truthLevel})`
        : `BLOCKING: Invalid truth level "${provenance.truthLevel}"`,
    });

    return results;
  }

  // ── Degrading Gates (staged OK, published blocked) ──────────

  private runDegradingGates(
    extraction: RagExtractionResult,
    _provenance: RagProvenance,
  ): QualityGateResult[] {
    const results: QualityGateResult[] = [];

    // G-D1: Quality score above minimum
    results.push({
      passed:
        extraction.extractionQualityScore >=
        RagValidationService.MIN_QUALITY_SCORE,
      level: 'degrading',
      gateName: 'quality_score_minimum',
      message:
        extraction.extractionQualityScore >=
        RagValidationService.MIN_QUALITY_SCORE
          ? `Quality score OK (${extraction.extractionQualityScore})`
          : `DEGRADING: Quality score too low (${extraction.extractionQualityScore} < ${RagValidationService.MIN_QUALITY_SCORE})`,
      score: extraction.extractionQualityScore,
    });

    // G-D2: Metadata completeness (at least source type + normalized key)
    const hasMinMeta =
      !!extraction.sourceType && !!extraction.normalizedSourceKey;
    results.push({
      passed: hasMinMeta,
      level: 'degrading',
      gateName: 'metadata_complete',
      message: hasMinMeta
        ? 'Minimum metadata present'
        : 'DEGRADING: Incomplete metadata (missing sourceType or normalizedSourceKey)',
    });

    // G-D3: No critical warnings
    const criticalWarnings = extraction.warnings.filter(
      (w) =>
        w.includes('CRITICAL') ||
        w.includes('FATAL') ||
        w.includes('CORRUPTED'),
    );
    results.push({
      passed: criticalWarnings.length === 0,
      level: 'degrading',
      gateName: 'no_critical_warnings',
      message:
        criticalWarnings.length === 0
          ? 'No critical warnings'
          : `DEGRADING: ${criticalWarnings.length} critical warning(s): ${criticalWarnings.join('; ')}`,
    });

    return results;
  }

  // ── Alert Gates (published OK, monitoring reinforced) ───────

  private runAlertGates(
    extraction: RagExtractionResult,
    provenance: RagProvenance,
  ): QualityGateResult[] {
    const results: QualityGateResult[] = [];

    // G-A1: Low quality but above threshold
    if (
      extraction.extractionQualityScore <
      RagValidationService.ALERT_QUALITY_THRESHOLD
    ) {
      results.push({
        passed: false,
        level: 'alert',
        gateName: 'quality_score_alert',
        message: `ALERT: Quality score below alert threshold (${extraction.extractionQualityScore} < ${RagValidationService.ALERT_QUALITY_THRESHOLD})`,
        score: extraction.extractionQualityScore,
      });
    }

    // G-A2: Short content
    if (
      extraction.extractedText.trim().length <
      RagValidationService.ALERT_MIN_LENGTH
    ) {
      results.push({
        passed: false,
        level: 'alert',
        gateName: 'content_length_alert',
        message: `ALERT: Short content (${extraction.extractedText.trim().length} < ${RagValidationService.ALERT_MIN_LENGTH} chars)`,
      });
    }

    // G-A3: Low trust source
    if (provenance.truthLevel === 'L3' || provenance.truthLevel === 'L4') {
      results.push({
        passed: false,
        level: 'alert',
        gateName: 'low_trust_source',
        message: `ALERT: Low trust source (${provenance.truthLevel})`,
      });
    }

    // G-A4: Warnings present (non-critical)
    if (extraction.warnings.length > 0) {
      results.push({
        passed: false,
        level: 'alert',
        gateName: 'warnings_present',
        message: `ALERT: ${extraction.warnings.length} warning(s): ${extraction.warnings.slice(0, 3).join('; ')}`,
      });
    }

    return results;
  }
}
