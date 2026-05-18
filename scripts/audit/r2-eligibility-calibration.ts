/**
 * ADR-066 — R2 Eligibility threshold calibration script
 *
 * Runs `R2EligibilityService.evaluate()` on **N=200 stratified samples** to
 * empirically validate `THRESHOLD_V1` (initial = 45) before PR 1 merge.
 *
 * Stratification per ADR-066 :
 *   - 50 G1 universelles  (pieces_gamme.pg_level=1, gamme_universelle=true)
 *   - 50 G1 spécifiques   (pieces_gamme.pg_level=1, gamme_universelle=false)
 *   - 50 G2               (pieces_gamme.pg_level=2)
 *   - 50 edge cases       (type_id ∈ [60000, 83456] TecDoc remap noindex zone)
 *
 * Output : histogramme distribution `eligibilityScore`, percentiles p10/p25/p50/
 * p75/p90, list borderline 40-50 for manual review, sensitivity analysis on weights.
 *
 * STRICT READ-ONLY — pulls data via Supabase RPC + table reads, never writes.
 * Designed to run pre-merge :
 *   pnpm tsx scripts/audit/r2-eligibility-calibration.ts
 *   pnpm tsx scripts/audit/r2-eligibility-calibration.ts --json
 */

import { createClient } from '@supabase/supabase-js';
import { R2EligibilityService } from '../../backend/src/modules/seo/r2/services/r2-eligibility.service';
import { R2CommercialDistinctivenessService } from '../../backend/src/modules/seo/r2/services/r2-commercial-distinctiveness.service';
import { THRESHOLD_V1 } from '../../backend/src/modules/seo/r2/constants/r2-eligibility.constants';

interface StratumSample {
  pg_id: number;
  type_id: number;
  pg_level: number;
  gamme_universelle: boolean;
  product_count: number;
  source_stratum: 'G1_universal' | 'G1_specific' | 'G2' | 'edge_tecdoc';
}

interface CalibrationResult {
  totalSamples: number;
  thresholdV1: number;
  distribution: {
    eligible: number;
    suppressed: number;
    reject: number;
    rejectByProductCount: number;
  };
  scorePercentiles: {
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
  };
  borderlineCount: number;            // samples with score in [40, 50]
  borderlineSamples: Array<{
    pg_id: number;
    type_id: number;
    score: number;
    verdict: string;
  }>;
  byStratum: Record<string, { eligible: number; suppressed: number; reject: number }>;
  thresholdRecommendation: {
    suggested: number;
    rationale: string;
  };
}

async function loadStratifiedSamples(): Promise<StratumSample[]> {
  // Placeholder : real implementation would issue stratified SQL queries.
  // For PR 1 foundation, this script structure is shipped; data loading is
  // wired in PR 2 V1.5 once R2DataLoaderService exists. Calibration run
  // happens once before PR 1 merge with manual SQL backed CSV → adapt loader.
  console.warn(
    '[calibration] STUB : real stratified sampling deferred to PR 1 final wire-up.',
  );
  return [];
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.floor((p / 100) * (sorted.length - 1));
  return sorted[idx];
}

async function main(): Promise<void> {
  const samples = await loadStratifiedSamples();
  if (samples.length === 0) {
    console.log(JSON.stringify({
      error: 'no_samples',
      hint: 'Wire R2DataLoaderService in PR 1 final step or use manual CSV input.',
      thresholdV1: THRESHOLD_V1,
    }, null, 2));
    process.exit(0);
  }

  const _service = new R2EligibilityService(
    new R2CommercialDistinctivenessService(),
  );

  // Placeholder for actual evaluation loop. PR 1 final wire-up will:
  //   for each sample : load motor delta + commercial inputs → service.evaluate()
  //   collect scores + verdicts → produce report.
  const result: CalibrationResult = {
    totalSamples: samples.length,
    thresholdV1: THRESHOLD_V1,
    distribution: { eligible: 0, suppressed: 0, reject: 0, rejectByProductCount: 0 },
    scorePercentiles: { p10: 0, p25: 0, p50: 0, p75: 0, p90: 0 },
    borderlineCount: 0,
    borderlineSamples: [],
    byStratum: {},
    thresholdRecommendation: {
      suggested: THRESHOLD_V1,
      rationale: 'No empirical data yet — keep initial value 45.',
    },
  };

  if (process.argv.includes('--json')) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } else {
    console.log(`ADR-066 — Eligibility threshold calibration`);
    console.log(`─`.repeat(60));
    console.log(`Total samples           : ${result.totalSamples}`);
    console.log(`Current THRESHOLD_V1    : ${result.thresholdV1}`);
    console.log(`Eligible / Suppressed / Reject : ${result.distribution.eligible} / ${result.distribution.suppressed} / ${result.distribution.reject}`);
    console.log(`Score p10/p25/p50/p75/p90 : ${result.scorePercentiles.p10}/${result.scorePercentiles.p25}/${result.scorePercentiles.p50}/${result.scorePercentiles.p75}/${result.scorePercentiles.p90}`);
    console.log(`Borderline (40-50)       : ${result.borderlineCount} samples`);
    console.log(`Suggested THRESHOLD_V1   : ${result.thresholdRecommendation.suggested}`);
    console.log(`  Rationale              : ${result.thresholdRecommendation.rationale}`);
  }
}

main().catch((err) => {
  console.error(`calibration failed: ${err instanceof Error ? err.message : err}`);
  process.exit(2);
});
