/**
 * CrUX API Client — HTTP wrapper for Chrome User Experience Report.
 *
 * Endpoint : POST https://chromeuxreport.googleapis.com/v1/records:queryHistoryRecord?key=$CRUX_API_KEY
 * Body     : { origin XOR url, formFactor?, metrics: string[], collectionPeriodCount: 40 }
 *
 * V1 only uses `queryHistoryRecord` (40 weekly periods per call, rolling 28j each).
 * `queryRecord` (daily snapshot) is explicitly excluded — see ADR-063 § Décisions.
 *
 * Behavior :
 *  - 200 OK → Zod-parsed `CruxHistoryResponse`
 *  - 404    → `null` (origin/URL not in CrUX dataset, returned to caller for sticky backoff)
 *  - 429/5xx → retry exp (5s / 30s / 120s, 3 attempts) then surface
 *  - Circuit breaker : opens for 5 minutes after 5 consecutive failures
 *
 * Refs :
 *  - ADR-063 (Accepted 2026-05-14)
 *  - packages/seo-types/src/crux.ts (Zod schemas)
 *  - https://developer.chrome.com/docs/crux/api
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CruxFormFactor,
  CruxHistoryResponse,
  CruxHistoryResponseSchema,
} from '@repo/seo-types';

/** Metrics requested from CrUX. Order must match what the fetcher expects. */
export const CRUX_METRICS_V1 = [
  'largest_contentful_paint',
  'interaction_to_next_paint',
  'cumulative_layout_shift',
  'experimental_time_to_first_byte',
  'first_contentful_paint',
] as const;

export interface CruxFetchOutcome {
  /** Parsed response, or null if 404 (origin/URL absent from CrUX). */
  response: CruxHistoryResponse | null;
  /** HTTP status of the final attempt (200 / 404 / 429 / 5xx / 0 for network error). */
  status: number;
  /** Total number of attempts performed (1 if success first try). */
  attempts: number;
  /** Total latency from first attempt to final outcome (ms). */
  latencyMs: number;
}

const CIRCUIT_OPEN_DURATION_MS = 5 * 60 * 1000;
const CIRCUIT_BREAKER_THRESHOLD = 5;
const RETRY_DELAYS_MS = [5_000, 30_000, 120_000];

@Injectable()
export class CruxApiClient {
  private readonly logger = new Logger(CruxApiClient.name);
  private readonly apiKey: string;
  private readonly endpoint =
    'https://chromeuxreport.googleapis.com/v1/records:queryHistoryRecord';

  private consecutiveFailures = 0;
  private circuitOpenUntil = 0;

  constructor(configService: ConfigService) {
    this.apiKey = configService.get<string>('CRUX_API_KEY') ?? '';
    if (!this.apiKey) {
      this.logger.warn(
        'CRUX_API_KEY unset — CrUX fetches will return null (graceful degrade)',
      );
    }
  }

  /** Returns true if API key is configured and circuit breaker is closed. */
  isAvailable(): boolean {
    if (!this.apiKey) return false;
    return Date.now() >= this.circuitOpenUntil;
  }

  /**
   * Fetch CrUX history for an origin.
   * Returns null response if origin not in CrUX (404) or circuit open.
   */
  async fetchOriginHistory(
    origin: string,
    formFactor: CruxFormFactor,
  ): Promise<CruxFetchOutcome> {
    return this.fetchWithRetry({
      origin,
      formFactor,
      metrics: [...CRUX_METRICS_V1],
      collectionPeriodCount: 40,
    });
  }

  /**
   * Fetch CrUX history for a specific URL.
   * Returns null response if URL not in CrUX (404) — typical for low-traffic URLs.
   */
  async fetchUrlHistory(
    url: string,
    formFactor: CruxFormFactor,
  ): Promise<CruxFetchOutcome> {
    return this.fetchWithRetry({
      url,
      formFactor,
      metrics: [...CRUX_METRICS_V1],
      collectionPeriodCount: 40,
    });
  }

  private async fetchWithRetry(
    body: Record<string, unknown>,
  ): Promise<CruxFetchOutcome> {
    const start = Date.now();
    let attempts = 0;
    let lastStatus = 0;

    if (!this.apiKey) {
      return { response: null, status: 0, attempts: 0, latencyMs: 0 };
    }

    if (Date.now() < this.circuitOpenUntil) {
      this.logger.warn('CrUX circuit breaker open, skipping fetch');
      return { response: null, status: 0, attempts: 0, latencyMs: 0 };
    }

    for (let i = 0; i <= RETRY_DELAYS_MS.length; i++) {
      attempts++;
      try {
        const resp = await fetch(`${this.endpoint}?key=${this.apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        lastStatus = resp.status;

        if (resp.status === 200) {
          const json = (await resp.json()) as unknown;
          const parsed = CruxHistoryResponseSchema.safeParse(json);
          if (!parsed.success) {
            this.logger.error(
              `CrUX response failed Zod parse: ${parsed.error.message}`,
            );
            this.recordFailure();
            return {
              response: null,
              status: 200,
              attempts,
              latencyMs: Date.now() - start,
            };
          }
          this.recordSuccess();
          return {
            response: parsed.data,
            status: 200,
            attempts,
            latencyMs: Date.now() - start,
          };
        }

        if (resp.status === 404) {
          // Not a failure: origin/URL just isn't in the CrUX dataset.
          this.recordSuccess();
          return {
            response: null,
            status: 404,
            attempts,
            latencyMs: Date.now() - start,
          };
        }

        // 429 or 5xx — retry if attempts remaining
        if (i < RETRY_DELAYS_MS.length) {
          const delayMs = RETRY_DELAYS_MS[i];
          this.logger.warn(
            `CrUX HTTP ${resp.status}, retrying in ${delayMs}ms (attempt ${attempts}/${RETRY_DELAYS_MS.length + 1})`,
          );
          await this.sleep(delayMs);
          continue;
        }

        this.logger.error(
          `CrUX HTTP ${resp.status} after ${attempts} attempts, giving up`,
        );
        this.recordFailure();
        return {
          response: null,
          status: resp.status,
          attempts,
          latencyMs: Date.now() - start,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`CrUX fetch error: ${message}`);
        if (i < RETRY_DELAYS_MS.length) {
          await this.sleep(RETRY_DELAYS_MS[i]);
          continue;
        }
        this.recordFailure();
        return {
          response: null,
          status: 0,
          attempts,
          latencyMs: Date.now() - start,
        };
      }
    }

    return {
      response: null,
      status: lastStatus,
      attempts,
      latencyMs: Date.now() - start,
    };
  }

  private recordSuccess(): void {
    this.consecutiveFailures = 0;
  }

  private recordFailure(): void {
    this.consecutiveFailures++;
    if (this.consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
      this.circuitOpenUntil = Date.now() + CIRCUIT_OPEN_DURATION_MS;
      this.logger.error(
        `CrUX circuit breaker opened (${this.consecutiveFailures} consecutive failures), reset in ${CIRCUIT_OPEN_DURATION_MS / 1000}s`,
      );
      this.consecutiveFailures = 0;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
