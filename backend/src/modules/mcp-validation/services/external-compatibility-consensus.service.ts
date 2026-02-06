import { Injectable, Logger } from '@nestjs/common';

import {
  CompatibilityComparisonResult,
  ExternalVerificationResult,
  OemCrossValidationResult,
  VehicleInfo,
  WeightedConsensusResult,
  SOURCE_RELIABILITY_WEIGHTS,
} from './external-compatibility.types';

/**
 * Consensus & OEM Cross-Validation Service
 *
 * Pure analysis logic — no external dependencies.
 * Implements both simple and weighted consensus algorithms,
 * OEM reference cross-validation, and recommendation building.
 *
 * CRITICAL: Never recommends blocking — always redirects to diagnostic.
 */
@Injectable()
export class ExternalCompatibilityConsensusService {
  private readonly logger = new Logger(
    ExternalCompatibilityConsensusService.name,
  );

  /**
   * Analyze consensus between internal and external results
   */
  analyzeConsensus(
    internalResult: { compatible: boolean; confidence: number },
    externalResults: ExternalVerificationResult[],
  ): {
    consensus: CompatibilityComparisonResult['consensus'];
    confidence: number;
  } {
    // Filter successful results
    const validResults = externalResults.filter(
      (r) => r.compatible !== null && !r.error,
    );

    if (validResults.length === 0) {
      return {
        consensus: 'inconclusive',
        confidence: internalResult.confidence,
      };
    }

    // Count agreements
    const agreements = validResults.filter(
      (r) => r.compatible === internalResult.compatible,
    ).length;
    const disagreements = validResults.filter(
      (r) => r.compatible !== internalResult.compatible,
    ).length;
    const total = validResults.length;

    // Calculate weighted confidence
    const avgExternalConfidence =
      validResults.reduce((sum, r) => sum + r.confidence, 0) /
      validResults.length;

    if (agreements === total) {
      // All sources agree
      return {
        consensus: 'confirmed',
        confidence: Math.min(
          0.95,
          (internalResult.confidence + avgExternalConfidence) / 2 + 0.1,
        ),
      };
    } else if (disagreements > agreements) {
      // More sources disagree
      return {
        consensus: 'divergent',
        confidence: Math.max(0.3, avgExternalConfidence - 0.2),
      };
    } else if (agreements > 0) {
      // Mixed results
      return {
        consensus: 'partial',
        confidence: (agreements / total) * avgExternalConfidence,
      };
    }

    return { consensus: 'inconclusive', confidence: 0.4 };
  }

  /**
   * Analyze consensus using weighted source reliability
   *
   * Phase 6: Multi-Source Aggregation
   * - Uses SOURCE_RELIABILITY_WEIGHTS for each source
   * - Calculates weighted compatibility score
   * - Provides detailed source breakdown
   */
  analyzeConsensusWeighted(
    internalResult: { compatible: boolean; confidence: number },
    externalResults: ExternalVerificationResult[],
  ): WeightedConsensusResult {
    const validResults = externalResults.filter(
      (r) => r.compatible !== null && !r.error,
    );

    if (validResults.length === 0) {
      return {
        consensus: 'inconclusive',
        confidence: internalResult.confidence,
        weightedScore: 0.5,
        sourceBreakdown: [],
      };
    }

    // Calculate weighted scores
    let totalWeight = 0;
    let compatibleWeight = 0;
    const sourceBreakdown: WeightedConsensusResult['sourceBreakdown'] = [];

    for (const result of validResults) {
      const sourceName = result.source.toLowerCase();
      const weight = SOURCE_RELIABILITY_WEIGHTS[sourceName] || 0.5;

      totalWeight += weight;

      if (result.compatible === internalResult.compatible) {
        compatibleWeight += weight;
      }

      sourceBreakdown.push({
        source: result.source,
        weight,
        compatible: result.compatible,
        contribution:
          result.compatible === internalResult.compatible
            ? weight
            : -weight * 0.5,
      });
    }

    // Calculate weighted score (0-1)
    const weightedScore =
      totalWeight > 0 ? compatibleWeight / totalWeight : 0.5;

    // Determine consensus based on weighted score
    let consensus: CompatibilityComparisonResult['consensus'];
    let confidence: number;

    if (weightedScore >= 0.7) {
      consensus = 'confirmed';
      confidence = Math.min(0.95, 0.5 + weightedScore * 0.45);
    } else if (weightedScore <= 0.3) {
      consensus = 'divergent';
      confidence = Math.max(0.3, 0.5 - (1 - weightedScore) * 0.3);
    } else {
      consensus = 'partial';
      confidence = 0.4 + weightedScore * 0.3;
    }

    // Adjust confidence based on number of high-reliability sources
    const highReliabilitySources = validResults.filter((r) => {
      const w = SOURCE_RELIABILITY_WEIGHTS[r.source.toLowerCase()] || 0;
      return w >= 0.75;
    });

    if (highReliabilitySources.length >= 2 && consensus === 'confirmed') {
      confidence = Math.min(0.98, confidence + 0.05);
    }

    return {
      consensus,
      confidence,
      weightedScore,
      sourceBreakdown,
    };
  }

  /**
   * Normalize OEM reference for comparison
   * Removes spaces, dashes, and converts to uppercase
   */
  normalizeOemRef(ref: string): string {
    return ref
      .toUpperCase()
      .replace(/[\s\-_\.]/g, '')
      .trim();
  }

  /**
   * Cross-validate OEM references across multiple sources
   *
   * Phase 6: OEM Cross-Validation
   * - Collects OEM refs from all sources
   * - Normalizes refs for comparison
   * - Identifies primary OEM ref and conflicts
   */
  crossValidateOemReferences(
    externalResults: ExternalVerificationResult[],
  ): OemCrossValidationResult {
    const oemsBySource = new Map<string, string[]>();

    // Collect OEM refs from each source
    for (const result of externalResults) {
      if (
        result.extractedData.oem_refs &&
        result.extractedData.oem_refs.length > 0
      ) {
        oemsBySource.set(result.source, result.extractedData.oem_refs);
      }
    }

    if (oemsBySource.size === 0) {
      return {
        validated: [],
        hasConflicts: false,
        primaryOem: null,
      };
    }

    // Normalize and count occurrences
    const normalizedOems = new Map<
      string,
      {
        original: string;
        sources: string[];
        count: number;
      }
    >();

    for (const [source, refs] of oemsBySource.entries()) {
      for (const ref of refs) {
        const normalized = this.normalizeOemRef(ref);

        if (normalizedOems.has(normalized)) {
          const entry = normalizedOems.get(normalized)!;
          entry.sources.push(source);
          entry.count++;
        } else {
          normalizedOems.set(normalized, {
            original: ref,
            sources: [source],
            count: 1,
          });
        }
      }
    }

    // Convert to array and sort by count (descending)
    const validated = Array.from(normalizedOems.entries())
      .map(([normalized, data]) => ({
        ref: data.original,
        normalizedRef: normalized,
        occurrenceCount: data.count,
        sources: data.sources,
        confidence: Math.min(0.95, data.count / oemsBySource.size),
      }))
      .sort((a, b) => b.occurrenceCount - a.occurrenceCount);

    // Identify conflicts (different refs from high-reliability sources)
    const conflictDetails: string[] = [];
    const topRefs = validated.filter((v) => v.occurrenceCount >= 2);

    if (topRefs.length > 1) {
      conflictDetails.push(
        `Multiple OEM refs found: ${topRefs.map((r) => r.ref).join(', ')}`,
      );
    }

    // Check if high-reliability sources disagree
    const partslink24Refs = oemsBySource.get('PartLink24') || [];
    const partlinkRefs = oemsBySource.get('PartLink') || [];

    if (partslink24Refs.length > 0 && partlinkRefs.length > 0) {
      const pl24Normalized = new Set(
        partslink24Refs.map((r) => this.normalizeOemRef(r)),
      );
      const plNormalized = new Set(
        partlinkRefs.map((r) => this.normalizeOemRef(r)),
      );

      const intersection = [...pl24Normalized].filter((r) =>
        plNormalized.has(r),
      );
      if (intersection.length === 0 && partslink24Refs.length > 0) {
        conflictDetails.push(`PartLink24 and PartLink refs do not overlap`);
      }
    }

    return {
      validated,
      hasConflicts: conflictDetails.length > 0,
      primaryOem: validated.length > 0 ? validated[0].ref : null,
      conflictDetails: conflictDetails.length > 0 ? conflictDetails : undefined,
    };
  }

  /**
   * Build recommendation based on analysis
   *
   * CRITICAL: Never recommends blocking - always redirects to diagnostic
   */
  buildRecommendation(
    analysis: {
      consensus: CompatibilityComparisonResult['consensus'];
      confidence: number;
    },
    pieceRef: string,
    vehicleInfo: VehicleInfo,
  ): CompatibilityComparisonResult['recommendation'] {
    const encodedParams = new URLSearchParams({
      ref: pieceRef,
      brand: vehicleInfo.brand,
      model: vehicleInfo.model,
      reason: analysis.consensus,
    }).toString();

    switch (analysis.consensus) {
      case 'confirmed':
        return {
          action: 'proceed',
          message: 'Compatibilité confirmée par sources multiples.',
          message_detail:
            'Notre base de données et les sources externes concordent.',
        };

      case 'divergent':
        return {
          action: 'diagnostic',
          redirect_url: `/diagnostic/compatibility-analysis?${encodedParams}`,
          message: 'Informations divergentes détectées.',
          message_detail:
            'Nos sources indiquent des résultats différents. Utilisez notre outil de diagnostic pour une analyse approfondie et des alternatives.',
        };

      case 'partial':
        return {
          action: 'verify',
          redirect_url: `/diagnostic/compatibility-analysis?${encodedParams}`,
          message: 'Vérification recommandée.',
          message_detail:
            "Certaines sources confirment la compatibilité, d'autres non. Vérifiez les références OEM.",
        };

      case 'inconclusive':
      default:
        return {
          action: 'verify',
          message: 'Vérification impossible via sources externes.',
          message_detail:
            "Les sources externes n'ont pas pu confirmer. Fiez-vous aux références OEM ou contactez-nous.",
        };
    }
  }
}
