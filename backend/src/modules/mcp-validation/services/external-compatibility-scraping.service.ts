import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChromeDevToolsClientService } from './chrome-devtools-client.service';

import {
  ExternalVerificationResult,
  VehicleInfo,
  SOURCE_CONFIGS,
} from './external-compatibility.types';

/**
 * External Scraping Engine
 *
 * Handles scraping of generic external sources (PartLink, CatCar, Info-Cars, Oscaro, Autodoc).
 * PartLink24 is handled separately by ExternalCompatibilityPartsLink24Service.
 */
@Injectable()
export class ExternalCompatibilityScrapingService {
  private readonly logger = new Logger(
    ExternalCompatibilityScrapingService.name,
  );
  readonly enabledSources: string[];
  readonly defaultTimeout: number;

  constructor(
    private readonly chromeClient: ChromeDevToolsClientService,
    private readonly configService: ConfigService,
  ) {
    const sourcesEnv = this.configService.get<string>(
      'EXTERNAL_SOURCES_ENABLED',
      'partlink,catcar',
    );
    this.enabledSources = sourcesEnv
      .split(',')
      .map((s) => s.trim().toLowerCase());

    this.defaultTimeout = this.configService.get<number>(
      'EXTERNAL_SCRAPE_TIMEOUT',
      15000,
    );

    this.logger.log(
      `External sources enabled: ${this.enabledSources.join(', ')}`,
    );
  }

  /**
   * Scrape a specific source (non-partslink24)
   */
  async scrapeSource(
    source: string,
    pieceRef: string,
    vehicleInfo: VehicleInfo,
    timeout: number,
    takeScreenshot: boolean,
  ): Promise<ExternalVerificationResult | null> {
    const config = SOURCE_CONFIGS[source];
    if (!config || !config.enabled) {
      this.logger.debug(`Source ${source} is disabled or not configured`);
      return null;
    }

    const startTime = Date.now();

    // Build URL
    let url = config.baseUrl + config.searchUrlPattern;
    url = url.replace('{ref}', encodeURIComponent(pieceRef));
    url = url.replace('{brand}', encodeURIComponent(vehicleInfo.brand));
    url = url.replace('{model}', encodeURIComponent(vehicleInfo.model));

    try {
      const result = await this.chromeClient.scrape<{
        vehicles?: string[];
        oemRefs?: string[];
        price?: number;
        priceRange?: { min: number; max: number };
        found: boolean;
        matrix?: Array<{ vehicle: string; compatible: boolean }>;
        parts?: Array<{ ref: string; name: string }>;
      }>({
        url,
        waitForText: config.waitForText,
        extractScript: config.extractScript,
        timeout,
        takeScreenshot,
        screenshotQuality: 50,
      });

      if (!result.success) {
        return {
          source: config.name,
          url,
          compatible: null,
          confidence: 0,
          extractedData: {},
          error: result.error,
          duration_ms: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        };
      }

      // Parse result
      const data = result.data;
      const hasData = data?.found || false;

      // Determine compatibility from extracted data
      let compatible: boolean | null = null;
      if (data?.matrix) {
        // Check if vehicle is in compatibility matrix
        const vehicleMatch = data.matrix.find(
          (m) =>
            m.vehicle
              ?.toLowerCase()
              .includes(vehicleInfo.brand.toLowerCase()) &&
            m.vehicle?.toLowerCase().includes(vehicleInfo.model.toLowerCase()),
        );
        compatible = vehicleMatch?.compatible ?? null;
      } else if (data?.vehicles && data.vehicles.length > 0) {
        // Check if vehicle is in compatible list
        const vehiclePattern =
          `${vehicleInfo.brand} ${vehicleInfo.model}`.toLowerCase();
        compatible = data.vehicles.some((v) =>
          v.toLowerCase().includes(vehiclePattern),
        );
      }

      return {
        source: config.name,
        url,
        compatible,
        confidence: hasData ? (compatible !== null ? 0.85 : 0.5) : 0.3,
        extractedData: {
          oem_refs: data?.oemRefs,
          compatible_vehicles: data?.vehicles,
          price_range:
            data?.priceRange ||
            (data?.price ? { min: data.price, max: data.price } : undefined),
        },
        screenshot: result.screenshot,
        duration_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.warn(`Error scraping ${config.name}: ${error.message}`);
      return {
        source: config.name,
        url,
        compatible: null,
        confidence: 0,
        extractedData: {},
        error: error.message,
        duration_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Scrape PartLink specifically
   */
  async scrapePartLink(
    pieceRef: string,
  ): Promise<ExternalVerificationResult | null> {
    return this.scrapeSource(
      'partlink',
      pieceRef,
      { brand: '', model: '' },
      this.defaultTimeout,
      false,
    );
  }

  /**
   * Scrape CatCar specifically
   */
  async scrapeCatCar(
    brand: string,
    model: string,
  ): Promise<ExternalVerificationResult | null> {
    return this.scrapeSource(
      'catcar',
      '',
      { brand, model },
      this.defaultTimeout,
      false,
    );
  }

  /**
   * Scrape Info-Cars specifically
   */
  async scrapeInfoCars(
    pieceRef: string,
  ): Promise<ExternalVerificationResult | null> {
    return this.scrapeSource(
      'infocars',
      pieceRef,
      { brand: '', model: '' },
      this.defaultTimeout,
      false,
    );
  }
}
