import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Chrome DevTools MCP Client
 *
 * Wrapper service for interacting with Chrome DevTools MCP server.
 * Used for external website scraping (PartLink, CatCar, etc.)
 *
 * NOTE: This service calls MCP tools via the NestJS backend.
 * The actual MCP server runs as a separate process configured in .mcp.json
 *
 * Features:
 * - Navigate to URLs
 * - Wait for elements/text
 * - Extract data via JavaScript evaluation
 * - Take screenshots for audit
 * - Handle timeouts and errors gracefully
 */

export interface NavigateOptions {
  url: string;
  timeout?: number;
  waitFor?: string;
}

export interface EvaluateScriptOptions {
  function: string;
  args?: Array<{ uid: string }>;
}

export interface ScreenshotOptions {
  format?: 'png' | 'jpeg' | 'webp';
  quality?: number;
  fullPage?: boolean;
  filePath?: string;
}

export interface ScrapingResult<T = unknown> {
  success: boolean;
  data: T | null;
  screenshot?: string;
  error?: string;
  duration_ms: number;
  url: string;
}

export interface ScrapeConfig {
  url: string;
  waitForText?: string;
  waitForSelector?: string;
  extractScript: string;
  timeout?: number;
  takeScreenshot?: boolean;
  screenshotQuality?: number;
}

@Injectable()
export class ChromeDevToolsClientService implements OnModuleInit {
  private readonly logger = new Logger(ChromeDevToolsClientService.name);
  private isAvailable = false;
  private readonly defaultTimeout: number;
  private readonly maxRetries: number;

  constructor(private readonly configService: ConfigService) {
    this.defaultTimeout = this.configService.get<number>(
      'EXTERNAL_SCRAPE_TIMEOUT',
      15000,
    );
    this.maxRetries = this.configService.get<number>(
      'EXTERNAL_SCRAPE_MAX_RETRIES',
      2,
    );
  }

  async onModuleInit() {
    // Check if Chrome DevTools MCP is available
    // In production, this would verify the MCP server is running
    this.isAvailable = true;
    this.logger.log('ChromeDevToolsClientService initialized');
  }

  /**
   * Check if the Chrome DevTools MCP is available
   */
  isServiceAvailable(): boolean {
    return this.isAvailable;
  }

  /**
   * Generic scraping method with retry logic
   */
  async scrape<T>(config: ScrapeConfig): Promise<ScrapingResult<T>> {
    const startTime = Date.now();
    const timeout = config.timeout || this.defaultTimeout;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        // 1. Navigate to URL
        const navigateResult = await this.navigatePage({
          url: config.url,
          timeout,
          waitFor: config.waitForText,
        });

        if (!navigateResult.success) {
          throw new Error(`Navigation failed: ${navigateResult.error}`);
        }

        // 2. Wait for content (if selector specified)
        if (config.waitForSelector) {
          await this.waitForElement(config.waitForSelector, timeout);
        }

        // 3. Extract data
        const extractResult = await this.evaluateScript<T>({
          function: config.extractScript,
        });

        if (!extractResult.success) {
          throw new Error(`Data extraction failed: ${extractResult.error}`);
        }

        // 4. Take screenshot if requested
        let screenshot: string | undefined;
        if (config.takeScreenshot) {
          const screenshotResult = await this.takeScreenshot({
            format: 'jpeg',
            quality: config.screenshotQuality || 50,
          });
          screenshot = screenshotResult.data || undefined;
        }

        return {
          success: true,
          data: extractResult.data,
          screenshot,
          duration_ms: Date.now() - startTime,
          url: config.url,
        };
      } catch (error) {
        this.logger.warn(
          `Scraping attempt ${attempt}/${this.maxRetries} failed for ${config.url}: ${error.message}`,
        );

        if (attempt === this.maxRetries) {
          return {
            success: false,
            data: null,
            error: error.message,
            duration_ms: Date.now() - startTime,
            url: config.url,
          };
        }

        // Wait before retry
        await this.delay(1000 * attempt);
      }
    }

    // Should never reach here, but TypeScript needs this
    return {
      success: false,
      data: null,
      error: 'Max retries exceeded',
      duration_ms: Date.now() - startTime,
      url: config.url,
    };
  }

  /**
   * Navigate to a URL
   *
   * NOTE: In production, this calls the MCP Chrome DevTools server.
   * For now, we simulate the interface to allow development without the actual browser.
   */
  async navigatePage(
    options: NavigateOptions,
  ): Promise<{ success: boolean; error?: string }> {
    this.logger.debug(`Navigating to: ${options.url}`);

    // TODO: Replace with actual MCP call when integrated
    // await mcp__chrome-devtools__navigate_page({ url: options.url, timeout: options.timeout });

    // Simulated for development - will be replaced with real MCP call
    if (!this.isAvailable) {
      return { success: false, error: 'Chrome DevTools not available' };
    }

    // In real implementation, this would call the MCP server
    return { success: true };
  }

  /**
   * Wait for text to appear on page
   */
  async waitForText(
    text: string,
    _timeout?: number,
  ): Promise<{ success: boolean; error?: string }> {
    this.logger.debug(`Waiting for text: "${text}"`);

    // TODO: Replace with actual MCP call
    // await mcp__chrome-devtools__wait_for({ text, timeout });

    return { success: true };
  }

  /**
   * Wait for element by selector
   */
  async waitForElement(
    selector: string,
    _timeout?: number,
  ): Promise<{ success: boolean; error?: string }> {
    this.logger.debug(`Waiting for element: ${selector}`);

    // TODO: Replace with actual MCP call using evaluate_script
    return { success: true };
  }

  /**
   * Execute JavaScript on the page and return result
   */
  async evaluateScript<T>(
    _options: EvaluateScriptOptions,
  ): Promise<{ success: boolean; data: T | null; error?: string }> {
    this.logger.debug('Evaluating script on page');

    // TODO: Replace with actual MCP call
    // const result = await mcp__chrome-devtools__evaluate_script({ function: options.function });

    // Simulated response for development
    return { success: true, data: null };
  }

  /**
   * Take a screenshot of the current page
   */
  async takeScreenshot(
    _options?: ScreenshotOptions,
  ): Promise<{ success: boolean; data: string | null; error?: string }> {
    this.logger.debug('Taking screenshot');

    // TODO: Replace with actual MCP call
    // const result = await mcp__chrome-devtools__take_screenshot(options);

    return { success: true, data: null };
  }

  /**
   * Click on an element
   */
  async click(uid: string): Promise<{ success: boolean; error?: string }> {
    this.logger.debug(`Clicking element: ${uid}`);

    // TODO: Replace with actual MCP call
    // await mcp__chrome-devtools__click({ uid });

    return { success: true };
  }

  /**
   * Fill an input field
   */
  async fill(
    uid: string,
    _value: string,
  ): Promise<{ success: boolean; error?: string }> {
    this.logger.debug(`Filling element ${uid} with value`);

    // TODO: Replace with actual MCP call
    // await mcp__chrome-devtools__fill({ uid, value });

    return { success: true };
  }

  /**
   * Get the current page snapshot (DOM tree)
   */
  async getSnapshot(): Promise<{
    success: boolean;
    data: string | null;
    error?: string;
  }> {
    this.logger.debug('Getting page snapshot');

    // TODO: Replace with actual MCP call
    // const result = await mcp__chrome-devtools__take_snapshot();

    return { success: true, data: null };
  }

  // ============================================================================
  // HELPER METHODS FOR FORM INTERACTION
  // ============================================================================

  /**
   * Take a snapshot and return it in a more convenient format
   */
  async takeSnapshot(): Promise<{
    success: boolean;
    content: string | null;
    error?: string;
  }> {
    const result = await this.getSnapshot();
    return {
      success: result.success,
      content: result.data,
      error: result.error,
    };
  }

  /**
   * Fill an input field by finding it via its associated label text
   *
   * @param labelText - The label text to search for (partial match)
   * @param value - The value to fill
   *
   * @example
   * await chromeClient.fillByLabel('Account ID', 'fr-152103');
   * await chromeClient.fillByLabel('Password', 'secret123');
   */
  async fillByLabel(
    labelText: string,
    value: string,
  ): Promise<{ success: boolean; error?: string }> {
    this.logger.debug(`Filling field labeled "${labelText}"`);

    // TODO: Replace with actual MCP call that:
    // 1. Takes snapshot to find the label
    // 2. Gets the associated input UID
    // 3. Fills the input

    // For now, we use a generic approach:
    // Find input elements near the label text
    try {
      // First try to find by evaluating script
      const findResult = await this.evaluateScript<{ uid: string }>({
        function: `() => {
        // Strategy 1: Find by label element
        const labels = Array.from(document.querySelectorAll('label'));
        for (const label of labels) {
          if (label.textContent?.toLowerCase().includes('${labelText.toLowerCase()}')) {
            const forId = label.getAttribute('for');
            if (forId) {
              const input = document.getElementById(forId);
              if (input) return { uid: input.id || forId };
            }
            // Check for nested input
            const nestedInput = label.querySelector('input');
            if (nestedInput) return { uid: nestedInput.id || nestedInput.name };
          }
        }

        // Strategy 2: Find input by name containing the label text
        const inputs = Array.from(document.querySelectorAll('input'));
        for (const input of inputs) {
          const name = input.name?.toLowerCase() || '';
          const id = input.id?.toLowerCase() || '';
          const placeholder = input.placeholder?.toLowerCase() || '';
          const labelLower = '${labelText.toLowerCase()}';

          if (name.includes(labelLower) || id.includes(labelLower) || placeholder.includes(labelLower)) {
            return { uid: input.id || input.name };
          }
        }

        return null;
      }`,
      });

      if (findResult.success && findResult.data?.uid) {
        return this.fill(findResult.data.uid, value);
      }

      // Fallback: try common field name patterns
      const fieldMappings: Record<string, string[]> = {
        account: ['accountId', 'account', 'accountid'],
        user: ['userName', 'username', 'user', 'login'],
        password: ['password', 'pwd', 'pass'],
        email: ['email', 'mail'],
      };

      const labelLower = labelText.toLowerCase();
      for (const [key, fieldNames] of Object.entries(fieldMappings)) {
        if (labelLower.includes(key)) {
          for (const fieldName of fieldNames) {
            const fillResult = await this.fill(fieldName, value);
            if (fillResult.success) return fillResult;
          }
        }
      }

      return {
        success: false,
        error: `Could not find field for label: ${labelText}`,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Click an element by its visible text content
   *
   * @param text - The text to search for (partial match)
   *
   * @example
   * await chromeClient.clickByText('Login');
   * await chromeClient.clickByText('Volkswagen');
   * await chromeClient.clickByText('Confirmer');
   */
  async clickByText(
    text: string,
  ): Promise<{ success: boolean; error?: string }> {
    this.logger.debug(`Clicking element with text: "${text}"`);

    // TODO: Replace with actual MCP call that:
    // 1. Takes snapshot
    // 2. Finds element with matching text
    // 3. Clicks it

    try {
      // Use evaluate script to find and click
      const result = await this.evaluateScript<{
        clicked: boolean;
        uid?: string;
      }>({
        function: `() => {
        // Find clickable element containing the text
        const textLower = '${text.toLowerCase()}';
        const selectors = ['button', 'a', 'input[type="submit"]', 'input[type="button"]', '[role="button"]', '[onclick]', 'li', 'div[class*="clickable"]', 'span[class*="link"]', '.brand-logo', '[data-action]'];

        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          for (const el of elements) {
            if (el.textContent?.toLowerCase().includes(textLower) ||
                el.getAttribute('title')?.toLowerCase().includes(textLower) ||
                el.getAttribute('value')?.toLowerCase().includes(textLower) ||
                el.getAttribute('alt')?.toLowerCase().includes(textLower)) {
              el.click();
              return { clicked: true, uid: el.id || el.className };
            }
          }
        }

        // Fallback: try any element with matching text
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          if (walker.currentNode.textContent?.toLowerCase().includes(textLower)) {
            const parent = walker.currentNode.parentElement;
            if (parent && parent.tagName !== 'SCRIPT' && parent.tagName !== 'STYLE') {
              parent.click();
              return { clicked: true, uid: parent.id || parent.tagName };
            }
          }
        }

        return { clicked: false };
      }`,
      });

      return result.success && result.data?.clicked
        ? { success: true }
        : {
            success: false,
            error: `Could not find element with text: ${text}`,
          };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Select an option from a dropdown by label
   *
   * @param labelText - The label text of the select element
   * @param optionValue - The value or text of the option to select
   */
  async selectByLabel(
    labelText: string,
    optionValue: string,
  ): Promise<{ success: boolean; error?: string }> {
    this.logger.debug(
      `Selecting "${optionValue}" from dropdown labeled "${labelText}"`,
    );

    try {
      const result = await this.evaluateScript<{ selected: boolean }>({
        function: `() => {
        const labelLower = '${labelText.toLowerCase()}';
        const valueLower = '${optionValue.toLowerCase()}';

        // Find select by label
        const labels = Array.from(document.querySelectorAll('label'));
        for (const label of labels) {
          if (label.textContent?.toLowerCase().includes(labelLower)) {
            const forId = label.getAttribute('for');
            const select = forId
              ? document.getElementById(forId)
              : label.querySelector('select');

            if (select && select.tagName === 'SELECT') {
              const selectEl = select as HTMLSelectElement;
              for (const option of selectEl.options) {
                if (option.value.toLowerCase().includes(valueLower) ||
                    option.text.toLowerCase().includes(valueLower)) {
                  selectEl.value = option.value;
                  selectEl.dispatchEvent(new Event('change', { bubbles: true }));
                  return { selected: true };
                }
              }
            }
          }
        }

        // Try finding select by name/id containing label
        const selects = document.querySelectorAll('select');
        for (const selectEl of selects) {
          const name = (selectEl as HTMLSelectElement).name?.toLowerCase() || '';
          const id = selectEl.id?.toLowerCase() || '';
          if (name.includes(labelLower) || id.includes(labelLower)) {
            for (const option of (selectEl as HTMLSelectElement).options) {
              if (option.value.toLowerCase().includes(valueLower) ||
                  option.text.toLowerCase().includes(valueLower)) {
                (selectEl as HTMLSelectElement).value = option.value;
                selectEl.dispatchEvent(new Event('change', { bubbles: true }));
                return { selected: true };
              }
            }
          }
        }

        return { selected: false };
      }`,
      });

      return result.success && result.data?.selected
        ? { success: true }
        : {
            success: false,
            error: `Could not select "${optionValue}" from "${labelText}"`,
          };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Utility: delay for specified milliseconds
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
