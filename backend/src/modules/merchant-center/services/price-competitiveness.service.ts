/**
 * PriceCompetitivenessService — INBOUND competitor benchmark from Google.
 *
 * Pulls the Merchant Center "Price competitiveness" report (Merchant API →
 * accounts.reports.search / PriceCompetitivenessProductView) and stores the
 * per-offer market benchmark in `__price_competitiveness` via
 * `upsert_price_competitiveness_v1`. INBOUND complement to
 * MerchantCenterFeedService (which is OUTBOUND only).
 *
 * Auth reuses GoogleCredentialsService.getMerchantContentAuth() (scope
 * `content`). Kill-switch: returns `disabled` if creds / merchantId absent.
 *
 * OBSERVE-only — the benchmark is Google's click-weighted competitor AVERAGE,
 * never a named competitor. Per docs/pricing/economic-governance-system.md it is
 * "signal bruité, jamais autorité": it flags over/under-market SKUs, it NEVER
 * auto-reprices (forbidden anti-pattern). The no-loss floor stays in
 * pricing-invariants.service.ts.
 *
 * Refs: migration 20260602_price_competitiveness.sql
 */
import { Injectable, Logger } from '@nestjs/common';
import { merchantapi_reports_v1 } from 'googleapis';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { GoogleCredentialsService } from '../../seo-monitoring/services/google-credentials.service';

export interface PriceCompetitivenessSyncResult {
  status: 'ok' | 'disabled';
  reason?: string;
  country: string;
  fetched: number;
  upserted: number;
  reportDate: string;
}

interface BenchmarkRow {
  offer_id: string;
  product_rest_id: string | null;
  gtin: string | null;
  title: string | null;
  brand: string | null;
  country: string;
  our_price_eur: number;
  benchmark_price_eur: number;
  report_date: string;
}

const PAGE_SIZE = 1000;
const UPSERT_CHUNK = 1000;
const MICROS = 1_000_000;

@Injectable()
export class PriceCompetitivenessService extends SupabaseBaseService {
  protected override readonly logger = new Logger(
    PriceCompetitivenessService.name,
  );

  constructor(private readonly creds: GoogleCredentialsService) {
    super();
  }

  /**
   * Pull the FR price-competitiveness report and upsert benchmarks.
   * Idempotent per (offer, country, report_date) — safe to run daily (cron/admin).
   */
  async sync(country = 'FR'): Promise<PriceCompetitivenessSyncResult> {
    const reportDate = new Date().toISOString().slice(0, 10);
    const auth = this.creds.getMerchantContentAuth();
    const merchantId = this.creds.getMerchantId();

    if (!auth || !merchantId) {
      const reason = !merchantId
        ? 'GMC_MERCHANT_ID manquant'
        : 'credentials Merchant Center absentes';
      this.logger.warn(`[PRICE_COMPETITIVENESS] sync désactivé — ${reason}`);
      return {
        status: 'disabled',
        reason,
        country,
        fetched: 0,
        upserted: 0,
        reportDate,
      };
    }

    const client = new merchantapi_reports_v1.Merchantapi({ auth });
    const parent = `accounts/${merchantId}`;
    const query = buildQuery(country);

    const rows: BenchmarkRow[] = [];
    let pageToken: string | undefined;
    do {
      const res = await client.accounts.reports.search({
        parent,
        requestBody: { query, pageSize: PAGE_SIZE, pageToken },
      });
      for (const r of res.data.results ?? []) {
        const v = r.priceCompetitivenessProductView;
        if (!v?.offerId || !v.benchmarkPrice?.amountMicros) continue;
        const our = toEur(v.price?.amountMicros);
        const bench = toEur(v.benchmarkPrice.amountMicros);
        if (our == null || bench == null) continue;
        rows.push({
          offer_id: v.offerId,
          product_rest_id: v.id ?? null,
          gtin: null, // not exposed by this view; offer_id is the catalog key
          title: v.title ?? null,
          brand: v.brand ?? null,
          country: v.reportCountryCode ?? country,
          our_price_eur: our,
          benchmark_price_eur: bench,
          report_date: reportDate,
        });
      }
      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken);

    let upserted = 0;
    for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
      const slice = rows.slice(i, i + UPSERT_CHUNK);
      const { data, error } = await this.callRpc<number>(
        'upsert_price_competitiveness_v1',
        { p_rows: slice },
      );
      if (error) {
        this.logger.error(
          `[PRICE_COMPETITIVENESS] upsert chunk@${i} failed: ${error.message}`,
        );
        throw error;
      }
      upserted += Number(data ?? 0);
    }

    this.logger.log(
      `[PRICE_COMPETITIVENESS] sync ${country} date=${reportDate} fetched=${rows.length} upserted=${upserted}`,
    );
    return {
      status: 'ok',
      country,
      fetched: rows.length,
      upserted,
      reportDate,
    };
  }

  /** Read the over/under-market gap (delegates to the STABLE read RPC). */
  async gapReport(
    country = 'FR',
    minGapPct: number | null = null,
    limit = 200,
    offset = 0,
  ): Promise<unknown[]> {
    const { data, error } = await this.callRpc<unknown[]>(
      'get_price_competitiveness_gap_v1',
      {
        p_country: country,
        p_min_gap_pct: minGapPct,
        p_limit: limit,
        p_offset: offset,
      },
    );
    if (error) {
      this.logger.error(
        `[PRICE_COMPETITIVENESS] gapReport failed: ${error.message}`,
      );
      throw error;
    }
    return data ?? [];
  }
}

function toEur(amountMicros: string | null | undefined): number | null {
  if (amountMicros == null) return null;
  const n = Number(amountMicros);
  if (!Number.isFinite(n)) return null;
  return Math.round((n / MICROS) * 100) / 100;
}

function buildQuery(country: string): string {
  // Merchant API reports query language (snake_case view + fields), FR-scoped.
  const c = country.replace(/[^A-Z]/g, '').slice(0, 2) || 'FR';
  return [
    'SELECT',
    '  offer_id,',
    '  id,',
    '  title,',
    '  brand,',
    '  price,',
    '  benchmark_price,',
    '  report_country_code',
    'FROM price_competitiveness_product_view',
    `WHERE report_country_code = '${c}'`,
  ].join('\n');
}
