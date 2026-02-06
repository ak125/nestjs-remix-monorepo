import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ExternalCompatibilityScrapingService } from './external-compatibility-scraping.service';
import { ExternalCompatibilityConsensusService } from './external-compatibility-consensus.service';
import { ExternalCompatibilityCacheService } from './external-compatibility-cache.service';
import { ExternalCompatibilityPartsLink24Service } from './external-compatibility-partslink24.service';

import {
  CompatibilityComparisonResult,
  ExternalVerificationResult,
  ExternalVerifyOptions,
  OemCrossValidationResult,
  PartLink24CatalogResult,
  PartLink24NavigationPath,
  PartLink24OemPart,
  VehicleInfo,
  WeightedConsensusResult,
} from './external-compatibility.types';

// Re-export all types for backward compatibility
export {
  VehicleInfo,
  ExternalVerificationResult,
  CompatibilityComparisonResult,
  ExternalVerifyOptions,
  WeightedConsensusResult,
  OemCrossValidationResult,
  PartLink24OemPart,
  PartLink24NavigationPath,
  PartLink24CatalogResult,
} from './external-compatibility.types';

/**
 * External Compatibility Verification Service (Orchestrator)
 *
 * Lightweight orchestrator that delegates to specialist services:
 * - ScrapingService: generic source scraping (PartLink, CatCar, Info-Cars, Oscaro, Autodoc)
 * - PartsLink24Service: PartLink24 auth, catalog navigation, OEM extraction
 * - ConsensusService: consensus algorithms, OEM cross-validation, recommendations
 * - CacheService: Redis cache layer for scraping results
 *
 * CRITICAL: This service NEVER blocks sales.
 * On divergence, it returns recommendations for diagnostic instead.
 *
 * AI-COS Axiome: The AI doesn't create truth, it verifies against multiple sources.
 */
@Injectable()
export class ExternalCompatibilityService {
  private readonly logger = new Logger(ExternalCompatibilityService.name);

  constructor(
    private readonly scrapingService: ExternalCompatibilityScrapingService,
    private readonly consensusService: ExternalCompatibilityConsensusService,
    private readonly cacheService: ExternalCompatibilityCacheService,
    private readonly partslink24Service: ExternalCompatibilityPartsLink24Service,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Verify compatibility across multiple external sources
   *
   * CRITICAL: Never blocks sales - returns recommendations for diagnostic instead
   */
  async verifyCompatibilityExternal(
    pieceRef: string,
    vehicleInfo: VehicleInfo,
    internalResult: { compatible: boolean; confidence: number },
    options?: ExternalVerifyOptions,
  ): Promise<CompatibilityComparisonResult> {
    const timestamp = new Date().toISOString();

    // Determine which sources to use
    const sourcesToUse =
      options?.sources ||
      (this.scrapingService.enabledSources as ExternalVerifyOptions['sources']);
    const timeout = options?.timeout || this.scrapingService.defaultTimeout;
    const takeScreenshots = options?.screenshots ?? false;

    this.logger.log(
      `Verifying piece ${pieceRef} for ${vehicleInfo.brand} ${vehicleInfo.model}`,
    );

    // Fetch from all sources (parallel or sequential)
    const externalResults: ExternalVerificationResult[] = [];

    if (options?.parallel !== false) {
      // Parallel execution
      const promises = sourcesToUse!.map((source) =>
        this.scrapeSourceRouted(
          source,
          pieceRef,
          vehicleInfo,
          timeout,
          takeScreenshots,
        ),
      );
      const results = await Promise.allSettled(promises);

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          externalResults.push(result.value);
        }
      }
    } else {
      // Sequential execution
      for (const source of sourcesToUse!) {
        const result = await this.scrapeSourceRouted(
          source,
          pieceRef,
          vehicleInfo,
          timeout,
          takeScreenshots,
        );
        if (result) {
          externalResults.push(result);
        }
      }
    }

    // Analyze consensus - Phase 6: Use weighted algorithm if requested
    const useWeighted = options?.useWeightedConsensus !== false; // Default to weighted
    const analysis = useWeighted
      ? this.consensusService.analyzeConsensusWeighted(
          internalResult,
          externalResults,
        )
      : {
          ...this.consensusService.analyzeConsensus(
            internalResult,
            externalResults,
          ),
          weightedScore: 0,
          sourceBreakdown: [],
        };

    // Phase 6: Cross-validate OEM references
    const oemValidation =
      this.consensusService.crossValidateOemReferences(externalResults);

    // Build recommendation (NEVER block)
    const recommendation = this.consensusService.buildRecommendation(
      analysis,
      pieceRef,
      vehicleInfo,
    );

    // Build detailed response
    const response: CompatibilityComparisonResult & {
      weighted_consensus?: WeightedConsensusResult;
      oem_validation?: OemCrossValidationResult;
    } = {
      internal_result: {
        compatible: internalResult.compatible,
        confidence: internalResult.confidence,
        source: 'internal_db',
      },
      external_results: externalResults,
      consensus: analysis.consensus,
      consensus_confidence: analysis.confidence,
      recommendation,
      can_purchase: true, // NEVER block
      purchase_warning:
        analysis.consensus === 'divergent'
          ? '⚠️ Compatibilité non confirmée à 100%. Vérifiez les références OEM avant achat.'
          : oemValidation.hasConflicts
            ? '⚠️ Références OEM divergentes détectées. Vérifiez la référence exacte pour votre véhicule.'
            : undefined,
      verification_timestamp: timestamp,
    };

    // Include Phase 6 data if weighted consensus was used
    if (useWeighted) {
      response.weighted_consensus = analysis as WeightedConsensusResult;
    }

    if (oemValidation.validated.length > 0) {
      response.oem_validation = oemValidation;
    }

    return response;
  }

  /**
   * Verify compatibility with caching enabled
   *
   * Wrapper around verifyCompatibilityExternal that uses cached scraping
   */
  async verifyCompatibilityExternalCached(
    pieceRef: string,
    vehicleInfo: VehicleInfo,
    internalResult: { compatible: boolean; confidence: number },
    options?: ExternalVerifyOptions & { bypassCache?: boolean },
  ): Promise<CompatibilityComparisonResult> {
    const timestamp = new Date().toISOString();
    const bypassCache = options?.bypassCache ?? false;

    // Determine which sources to use
    const sourcesToUse =
      options?.sources ||
      (this.scrapingService.enabledSources as ExternalVerifyOptions['sources']);
    const timeout = options?.timeout || this.scrapingService.defaultTimeout;
    const takeScreenshots = options?.screenshots ?? false;

    this.logger.log(
      `Verifying (cached) piece ${pieceRef} for ${vehicleInfo.brand} ${vehicleInfo.model}`,
    );

    // Fetch from all sources with caching
    const externalResults: ExternalVerificationResult[] = [];

    if (options?.parallel !== false) {
      // Parallel execution with caching
      const promises = sourcesToUse!.map((source) =>
        source === 'partslink24'
          ? this.partslink24Service.scrapeSource(
              pieceRef,
              vehicleInfo,
              timeout,
              takeScreenshots,
            )
          : this.cacheService.scrapeSourceCached(
              source,
              pieceRef,
              vehicleInfo,
              timeout,
              takeScreenshots,
              bypassCache,
            ),
      );
      const results = await Promise.allSettled(promises);

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          externalResults.push(result.value);
        }
      }
    } else {
      // Sequential execution with caching
      for (const source of sourcesToUse!) {
        const result =
          source === 'partslink24'
            ? await this.partslink24Service.scrapeSource(
                pieceRef,
                vehicleInfo,
                timeout,
                takeScreenshots,
              )
            : await this.cacheService.scrapeSourceCached(
                source,
                pieceRef,
                vehicleInfo,
                timeout,
                takeScreenshots,
                bypassCache,
              );
        if (result) {
          externalResults.push(result);
        }
      }
    }

    // Use weighted consensus (Phase 6)
    const analysis = this.consensusService.analyzeConsensusWeighted(
      internalResult,
      externalResults,
    );

    // Cross-validate OEM references (Phase 6)
    const oemValidation =
      this.consensusService.crossValidateOemReferences(externalResults);

    // Build recommendation
    const recommendation = this.consensusService.buildRecommendation(
      analysis,
      pieceRef,
      vehicleInfo,
    );

    return {
      internal_result: {
        compatible: internalResult.compatible,
        confidence: internalResult.confidence,
        source: 'internal_db',
      },
      external_results: externalResults,
      consensus: analysis.consensus,
      consensus_confidence: analysis.confidence,
      recommendation,
      can_purchase: true, // NEVER block
      purchase_warning:
        analysis.consensus === 'divergent'
          ? '⚠️ Compatibilité non confirmée à 100%. Vérifiez les références OEM avant achat.'
          : oemValidation.hasConflicts
            ? '⚠️ Références OEM divergentes détectées. Vérifiez la référence exacte pour votre véhicule.'
            : undefined,
      verification_timestamp: timestamp,
    };
  }

  // =========================================================================
  // DELEGATIONS — preserve public API
  // =========================================================================

  /**
   * Route scraping to the appropriate service based on source type
   */
  private async scrapeSourceRouted(
    source: string,
    pieceRef: string,
    vehicleInfo: VehicleInfo,
    timeout: number,
    takeScreenshot: boolean,
  ): Promise<ExternalVerificationResult | null> {
    if (source === 'partslink24') {
      return this.partslink24Service.scrapeSource(
        pieceRef,
        vehicleInfo,
        timeout,
        takeScreenshot,
      );
    }
    return this.scrapingService.scrapeSource(
      source,
      pieceRef,
      vehicleInfo,
      timeout,
      takeScreenshot,
    );
  }

  async scrapePartLink(
    pieceRef: string,
  ): Promise<ExternalVerificationResult | null> {
    return this.scrapingService.scrapePartLink(pieceRef);
  }

  async scrapeCatCar(
    brand: string,
    model: string,
  ): Promise<ExternalVerificationResult | null> {
    return this.scrapingService.scrapeCatCar(brand, model);
  }

  async scrapeInfoCars(
    pieceRef: string,
  ): Promise<ExternalVerificationResult | null> {
    return this.scrapingService.scrapeInfoCars(pieceRef);
  }

  async scrapePartsLink24Catalog(
    navigation: PartLink24NavigationPath,
    takeScreenshot = false,
  ): Promise<PartLink24CatalogResult> {
    return this.partslink24Service.scrapePartsLink24Catalog(
      navigation,
      takeScreenshot,
    );
  }

  async searchPartsLink24ByRef(
    oemRef: string,
  ): Promise<ExternalVerificationResult | null> {
    return this.partslink24Service.searchPartsLink24ByRef(oemRef);
  }

  async getOemPartsForVehicle(
    brand: string,
    model: string,
    year: number,
    group: string,
    subgroup?: string,
    variant?: string,
  ): Promise<PartLink24OemPart[]> {
    return this.partslink24Service.getOemPartsForVehicle(
      brand,
      model,
      year,
      group,
      subgroup,
      variant,
    );
  }

  crossValidateOemReferences(
    externalResults: ExternalVerificationResult[],
  ): OemCrossValidationResult {
    return this.consensusService.crossValidateOemReferences(externalResults);
  }

  async clearCacheForPiece(
    pieceRef: string,
    vehicleInfo?: VehicleInfo,
  ): Promise<number> {
    return this.cacheService.clearCacheForPiece(pieceRef, vehicleInfo);
  }

  async clearAllExternalCache(): Promise<number> {
    return this.cacheService.clearAllExternalCache();
  }

  getEnabledSources(): string[] {
    return this.scrapingService.enabledSources;
  }
}
