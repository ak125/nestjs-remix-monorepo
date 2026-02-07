import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChromeDevToolsClientService } from './chrome-devtools-client.service';

import {
  ExternalVerificationResult,
  PartLink24CatalogResult,
  PartLink24NavigationPath,
  PartLink24OemPart,
  VehicleInfo,
  SOURCE_CONFIGS,
  sleep,
} from './external-compatibility.types';
import {
  ExternalServiceException,
  ErrorCodes,
} from '../../../common/exceptions';

/**
 * PartLink24 Specialist Service
 *
 * Handles all PartLink24-specific functionality:
 * - Authentication (login with accountId/username/password)
 * - Catalog navigation (Brand → Model → Year → Variant → Group → Subgroup)
 * - OEM part extraction
 * - Direct reference search
 */
@Injectable()
export class ExternalCompatibilityPartsLink24Service {
  private readonly logger = new Logger(
    ExternalCompatibilityPartsLink24Service.name,
  );

  private readonly partslink24Credentials: {
    accountId: string;
    username: string;
    password: string;
  } | null;
  private partslink24Authenticated = false;

  constructor(
    private readonly chromeClient: ChromeDevToolsClientService,
    private readonly configService: ConfigService,
  ) {
    const accountId = this.configService.get<string>('PARTSLINK24_ACCOUNT_ID');
    const username = this.configService.get<string>('PARTSLINK24_USERNAME');
    const password = this.configService.get<string>('PARTSLINK24_PASSWORD');

    if (accountId && username && password) {
      this.partslink24Credentials = { accountId, username, password };
      this.logger.log('PartLink24 credentials configured');
    } else {
      this.partslink24Credentials = null;
      this.logger.warn(
        'PartLink24 credentials not configured - source will be skipped',
      );
    }
  }

  /**
   * Check if PartLink24 credentials are available
   */
  hasCredentials(): boolean {
    return this.partslink24Credentials !== null;
  }

  /**
   * Authenticate to PartLink24
   *
   * Handles:
   * - Standard login flow with accountId/username/password
   * - "Session already exists" dialog (confirms to close existing session)
   * - Password change requirement (clicks Cancel to bypass)
   */
  async authenticate(): Promise<boolean> {
    if (!this.partslink24Credentials) {
      this.logger.warn('PartLink24 credentials not available');
      return false;
    }

    if (this.partslink24Authenticated) {
      return true; // Already authenticated in this session
    }

    const config = SOURCE_CONFIGS['partslink24'];
    const loginUrl = config.baseUrl + config.loginUrl;

    try {
      this.logger.log('Authenticating to PartLink24...');

      // 1. Navigate to login page
      const navResult = await this.chromeClient.navigatePage({
        url: loginUrl,
        timeout: 15000,
      });

      if (!navResult.success) {
        throw new ExternalServiceException({
          code: ErrorCodes.EXTERNAL.SERVICE_ERROR,
          message: `Failed to navigate to login: ${navResult.error}`,
          serviceName: 'PartLink24',
        });
      }

      // 2. Take snapshot to understand the form
      const _snapshot = await this.chromeClient.takeSnapshot();

      // 3. Fill account ID (look for the field by label or common patterns)
      await this.chromeClient.fillByLabel(
        'Account ID',
        this.partslink24Credentials.accountId,
      );
      await sleep(200);

      // 4. Fill username
      await this.chromeClient.fillByLabel(
        'User',
        this.partslink24Credentials.username,
      );
      await sleep(200);

      // 5. Fill password
      await this.chromeClient.fillByLabel(
        'Password',
        this.partslink24Credentials.password,
      );
      await sleep(200);

      // 6. Submit login form (click Login button)
      await this.chromeClient.clickByText('Login');
      await sleep(2000); // Wait for login to process

      // 7. Handle potential "session already exists" dialog
      const sessionDialogSnapshot = await this.chromeClient.takeSnapshot();
      if (
        sessionDialogSnapshot.content?.includes('session') ||
        sessionDialogSnapshot.content?.includes('Confirmer')
      ) {
        this.logger.log('Session dialog detected, clicking Confirmer...');
        await this.chromeClient.clickByText('Confirmer');
        await sleep(2000);
      }

      // 8. Handle potential password change requirement
      const pwChangeSnapshot = await this.chromeClient.takeSnapshot();
      if (
        pwChangeSnapshot.content?.includes('password') &&
        pwChangeSnapshot.content?.includes('change')
      ) {
        this.logger.log('Password change dialog detected, clicking Cancel...');
        await this.chromeClient.clickByText('Annuler');
        await sleep(2000);
      }

      // 9. Verify we're logged in (look for brand menu or welcome message)
      const finalSnapshot = await this.chromeClient.takeSnapshot();
      const isLoggedIn =
        finalSnapshot.content?.includes('Bienvenue') ||
        finalSnapshot.content?.includes('brandMenu') ||
        finalSnapshot.content?.includes('Volkswagen') ||
        finalSnapshot.content?.includes('Mercedes') ||
        finalSnapshot.content?.includes('VIN');

      if (isLoggedIn) {
        this.partslink24Authenticated = true;
        this.logger.log('PartLink24 authentication successful');
        return true;
      }

      this.logger.warn(
        'PartLink24 authentication status uncertain - proceeding anyway',
      );
      this.partslink24Authenticated = true; // Try to continue
      return true;
    } catch (error) {
      this.logger.error(`PartLink24 authentication failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Scrape PartLink24 source for a specific piece reference
   *
   * Authenticates, builds URL, scrapes, and parses results.
   */
  async scrapeSource(
    pieceRef: string,
    vehicleInfo: VehicleInfo,
    timeout: number,
    takeScreenshot: boolean,
  ): Promise<ExternalVerificationResult | null> {
    const config = SOURCE_CONFIGS['partslink24'];
    if (!config || !config.enabled) {
      this.logger.debug('PartLink24 is disabled or not configured');
      return null;
    }

    if (!this.partslink24Credentials) {
      this.logger.debug('PartLink24 requires credentials but none configured');
      return null;
    }

    const authSuccess = await this.authenticate();
    if (!authSuccess) {
      this.logger.warn('PartLink24 authentication failed, skipping source');
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
        const vehicleMatch = data.matrix.find(
          (m) =>
            m.vehicle
              ?.toLowerCase()
              .includes(vehicleInfo.brand.toLowerCase()) &&
            m.vehicle?.toLowerCase().includes(vehicleInfo.model.toLowerCase()),
        );
        compatible = vehicleMatch?.compatible ?? null;
      } else if (data?.vehicles && data.vehicles.length > 0) {
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
      this.logger.warn(`Error scraping PartLink24: ${error.message}`);
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
   * Scrape PartLink24 via catalog navigation
   *
   * This method uses the tested navigation flow:
   * 1. Login with credentials
   * 2. Navigate: Brand → Model → Year → Variant → Group → Subgroup
   * 3. Extract OEM part numbers
   */
  async scrapePartsLink24Catalog(
    navigation: PartLink24NavigationPath,
    takeScreenshot = false,
  ): Promise<PartLink24CatalogResult> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    try {
      // 1. Authenticate first
      const authSuccess = await this.authenticate();
      if (!authSuccess) {
        return {
          success: false,
          navigation,
          parts: [],
          duration_ms: Date.now() - startTime,
          error: 'Authentication failed',
          timestamp,
        };
      }

      // 2. Navigate to brand menu if not already there
      let snapshot = await this.chromeClient.takeSnapshot();
      if (!snapshot.content?.includes(navigation.brand)) {
        // Go to brand menu
        await this.chromeClient.navigatePage({
          url: 'https://www.partslink24.com/partslink24/launchpad/brandMenu.do',
          timeout: 10000,
        });
        await sleep(1000);
      }

      // 3. Click on brand (e.g., "Volkswagen")
      this.logger.log(`Navigating to brand: ${navigation.brand}`);
      await this.chromeClient.clickByText(navigation.brand);
      await sleep(2000);

      // 4. Select model - look for dropdown or list
      this.logger.log(`Selecting model: ${navigation.model}`);
      snapshot = await this.chromeClient.takeSnapshot();

      // Try to find model in the page content
      if (snapshot.content?.includes(navigation.model)) {
        await this.chromeClient.clickByText(navigation.model);
        await sleep(1500);
      } else {
        // Try dropdown selection
        await this.chromeClient.selectByLabel('Modèle', navigation.model);
        await sleep(1500);
      }

      // 5. Select year
      this.logger.log(`Selecting year: ${navigation.year}`);
      snapshot = await this.chromeClient.takeSnapshot();

      if (snapshot.content?.includes(String(navigation.year))) {
        await this.chromeClient.clickByText(String(navigation.year));
        await sleep(1500);
      } else {
        await this.chromeClient.selectByLabel('Année', String(navigation.year));
        await sleep(1500);
      }

      // 6. Select variant if specified
      if (navigation.variant) {
        this.logger.log(`Selecting variant: ${navigation.variant}`);
        await this.chromeClient.clickByText(navigation.variant);
        await sleep(1500);
      }

      // 7. Navigate to parts group
      this.logger.log(`Navigating to group: ${navigation.group}`);
      await this.chromeClient.clickByText(navigation.group);
      await sleep(2000);

      // 8. Select subgroup if specified
      if (navigation.subgroup) {
        this.logger.log(`Selecting subgroup: ${navigation.subgroup}`);
        await this.chromeClient.clickByText(navigation.subgroup);
        await sleep(2000);
      }

      // 9. Extract part data from the page
      const partsData = await this.extractPartsLink24Parts();

      // 10. Take screenshot if requested
      let screenshotData: string | undefined;
      if (takeScreenshot) {
        const screenshotResult = await this.chromeClient.takeScreenshot({
          format: 'jpeg',
          quality: 50,
        });
        screenshotData = screenshotResult.data;
      }

      return {
        success: true,
        navigation,
        parts: partsData,
        screenshot: screenshotData,
        duration_ms: Date.now() - startTime,
        timestamp,
      };
    } catch (error) {
      this.logger.error(`PartLink24 catalog scraping failed: ${error.message}`);
      return {
        success: false,
        navigation,
        parts: [],
        duration_ms: Date.now() - startTime,
        error: error.message,
        timestamp,
      };
    }
  }

  /**
   * Extract OEM part references from PartLink24 parts page
   *
   * Parses the page to extract:
   * - OEM reference (e.g., "5Q0 615 301 F")
   * - Description (e.g., "Disque de frein (ventilé)")
   * - Quantity (e.g., 2)
   */
  private async extractPartsLink24Parts(): Promise<PartLink24OemPart[]> {
    try {
      // Execute extraction script in the page
      const result = await this.chromeClient.evaluateScript<{
        parts: Array<{
          ref: string;
          description: string;
          quantity: number;
          notes?: string;
        }>;
      }>({
        function: `() => {
        const parts = [];

        // Strategy 1: Look for table rows with part data
        const rows = document.querySelectorAll('tr, .part-row, .piece-row, [data-part]');
        for (const row of rows) {
          const cells = row.querySelectorAll('td');
          if (cells.length >= 2) {
            // Look for OEM reference pattern (e.g., "5Q0 615 301 F")
            const refPattern = /[A-Z0-9]{3}\\s*[0-9]{3}\\s*[0-9]{3}\\s*[A-Z0-9]{0,2}/;
            const rowText = row.textContent || '';
            const refMatch = rowText.match(refPattern);

            if (refMatch) {
              // Extract quantity (usually a number like "2" or "x2")
              const qtyMatch = rowText.match(/(\\d+)\\s*(x|pcs|pc|pièce)?/i);
              const qty = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;

              // Extract description (text that's not the ref or qty)
              let desc = rowText
                .replace(refMatch[0], '')
                .replace(/\\d+\\s*(x|pcs|pc|pièce)?/gi, '')
                .trim()
                .slice(0, 100);

              parts.push({
                ref: refMatch[0].trim(),
                description: desc || 'Pièce',
                quantity: qty,
              });
            }
          }
        }

        // Strategy 2: Look for specific part number elements
        if (parts.length === 0) {
          const partNumberEls = document.querySelectorAll('.part-number, .ref-oe, .oem-ref, [data-ref]');
          for (const el of partNumberEls) {
            const ref = el.textContent?.trim();
            if (ref && ref.length >= 5) {
              const parent = el.closest('tr, .part-row, .item') || el.parentElement;
              const descEl = parent?.querySelector('.description, .name, .libelle');
              const qtyEl = parent?.querySelector('.quantity, .qty, .qte');

              parts.push({
                ref,
                description: descEl?.textContent?.trim() || 'Pièce',
                quantity: parseInt(qtyEl?.textContent || '1', 10) || 1,
              });
            }
          }
        }

        // Deduplicate by reference
        const seen = new Set();
        return {
          parts: parts.filter(p => {
            if (seen.has(p.ref)) return false;
            seen.add(p.ref);
            return true;
          })
        };
      }`,
      });

      if (!result?.data?.parts) {
        return [];
      }

      return result.data.parts.map((p) => ({
        oem_ref: p.ref,
        description: p.description,
        quantity: p.quantity,
        notes: p.notes,
      }));
    } catch (error) {
      this.logger.warn(`Failed to extract parts: ${error.message}`);
      return [];
    }
  }

  /**
   * Quick lookup: Search PartLink24 for a specific OEM reference
   *
   * Note: Direct reference search may not work on PartLink24.
   * Use scrapePartsLink24Catalog() for reliable results.
   */
  async searchPartsLink24ByRef(
    oemRef: string,
  ): Promise<ExternalVerificationResult | null> {
    const defaultTimeout = this.configService.get<number>(
      'EXTERNAL_SCRAPE_TIMEOUT',
      15000,
    );
    return this.scrapeSource(
      oemRef,
      { brand: '', model: '' },
      defaultTimeout,
      false,
    );
  }

  /**
   * Get OEM parts for a specific vehicle and parts group
   *
   * Convenience method that wraps scrapePartsLink24Catalog with common defaults.
   */
  async getOemPartsForVehicle(
    brand: string,
    model: string,
    year: number,
    group: string,
    subgroup?: string,
    variant?: string,
  ): Promise<PartLink24OemPart[]> {
    const result = await this.scrapePartsLink24Catalog({
      brand,
      model,
      year,
      variant,
      group,
      subgroup,
    });

    if (!result.success) {
      this.logger.warn(`Failed to get OEM parts: ${result.error}`);
      return [];
    }

    return result.parts;
  }
}
