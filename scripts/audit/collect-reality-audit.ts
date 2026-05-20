#!/usr/bin/env -S npx ts-node
/**
 * Reality Audit Collector — Phase 0.5 du plan Reality Audit Business-First.
 *
 * Lit GSC + GA4 + ___xtr_order + gamme_aggregates + support_tickets + CWV
 * et écrit une row dans __seo_reality_audit avec verdict dominant_problem.
 *
 * Usage (depuis workspace seo-analytics OU repo root) :
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     npx ts-node scripts/audit/collect-reality-audit.ts [--pg-id=8|...|--site-wide]
 *
 * Par défaut : run site-wide. Pour gamme : --pg-id=402.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  computeVerdict,
  VerdictInputs,
  DominantProblem,
} from "../../backend/src/modules/seo/audit/reality-audit-verdict";

interface CollectorArgs {
  pgId: number | null; // null = site-wide
}

interface IndexationStats {
  pages_submitted: number | null;
  pages_discovered: number | null;
  pages_indexed: number | null;
  pages_noindex_intentional: number | null;
  pages_noindex_involuntary: number | null;
  canonical_correct_pct: number | null;
  duplication_clusters_count: number | null;
  sitemap_last_processed: string | null;
}

interface FunnelStats {
  organic_sessions_28d: number | null;
  organic_addtocart_28d: number | null;
  organic_orders_28d: number | null;
  organic_revenue_28d: number | null;
  funnel_dropoff_steps: Record<string, number> | null;
}

interface ViabilityStats {
  margin_estimate_pct: number | null;
  margin_estimate_method: "cost_of_goods" | "price_proxy" | "unknown" | "none";
  stock_coverage_pct: number | null;
  avg_delivery_days: number | null;
  sav_return_rate_pct: number | null;
  compatibility_trust_score: number | null;
  business_viability_score: number | null;
  business_viability_tier: "high" | "medium" | "low" | "unviable" | null;
}

interface UxStats {
  mobile_ux_friction_score: number | null;
}

// Window 28j cohérent partout
const WINDOW_DAYS = 28;
const today = new Date();
const windowStart = new Date(today.getTime() - WINDOW_DAYS * 24 * 3600 * 1000);
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

async function collectIndexation(
  sb: SupabaseClient,
  pgAlias: string | null,
): Promise<IndexationStats> {
  // GSC daily : compter pages distinctes avec impressions > 0 (fenêtre 28j)
  // SI pgAlias présent : filtre page LIKE '%pg_alias%'
  let q = sb
    .from("__seo_gsc_daily")
    .select("page")
    .gte("date", isoDate(windowStart))
    .gt("impressions", 0);
  if (pgAlias) q = q.like("page", `%${pgAlias}%`);
  const { data: gscRows, error: gscErr } = await q.limit(50_000);
  if (gscErr) {
    console.error("GSC query error:", gscErr);
    return {
      pages_submitted: null,
      pages_discovered: null,
      pages_indexed: null,
      pages_noindex_intentional: null,
      pages_noindex_involuntary: null,
      canonical_correct_pct: null,
      duplication_clusters_count: null,
      sitemap_last_processed: null,
    };
  }
  const pagesDiscovered = new Set((gscRows ?? []).map((r: any) => r.page)).size;
  // pages_indexed ≈ same set (GSC ne donne pas l'état index direct via daily) — NULL si __seo_index_history non disponible
  return {
    pages_submitted: pagesDiscovered, // proxy : ce que Google voit
    pages_discovered: pagesDiscovered,
    pages_indexed: pagesDiscovered, // proxy même valeur en absence de table dédiée
    pages_noindex_intentional: null, // MISSING (cf precheck)
    pages_noindex_involuntary: null, // MISSING
    canonical_correct_pct: null, // MISSING
    duplication_clusters_count: null,
    sitemap_last_processed: null,
  };
}

async function collectFunnel(
  sb: SupabaseClient,
  pgAlias: string | null,
): Promise<FunnelStats> {
  // GA4 daily organic
  let q = sb
    .from("__seo_ga4_daily")
    .select("sessions, bounce_rate")
    .eq("channel", "organic")
    .gte("date", isoDate(windowStart));
  if (pgAlias) q = q.like("page", `%${pgAlias}%`);
  const { data: gaRows, error: gaErr } = await q.limit(50_000);
  const sessions = gaErr
    ? null
    : (gaRows ?? []).reduce((s: number, r: any) => s + (r.sessions ?? 0), 0);

  // ___xtr_order organic attribuables (via ga_client_id présent)
  // Approximation : commandes payées avec ga_client_id non-null + date dans fenêtre
  // (l'attribution organic strict nécessiterait join GA4 sessions, ici on prend la borne haute)
  const { data: orderRows, error: orderErr } = await sb
    .from("___xtr_order")
    .select("ord_total_ttc, ord_date_pay")
    .not("ga_client_id", "is", null)
    .eq("payment_confirmed", true)
    .gte("ord_date_pay", isoDate(windowStart))
    .limit(50_000);
  const orders = orderErr ? null : (orderRows ?? []).length;
  const revenue = orderErr
    ? null
    : (orderRows ?? []).reduce(
        (s: number, r: any) => s + Number(r.ord_total_ttc ?? 0),
        0,
      );

  return {
    organic_sessions_28d: sessions,
    organic_addtocart_28d: null, // MISSING — GA4 events détaillés non agrégés
    organic_orders_28d: orders,
    organic_revenue_28d: revenue,
    funnel_dropoff_steps: null,
  };
}

async function collectViability(
  sb: SupabaseClient,
  pgId: number | null,
): Promise<ViabilityStats> {
  if (!pgId) {
    // Site-wide : pas de viability par gamme, retourne NULL
    return {
      margin_estimate_pct: null,
      margin_estimate_method: "none",
      stock_coverage_pct: null,
      avg_delivery_days: null,
      sav_return_rate_pct: null,
      compatibility_trust_score: null,
      business_viability_score: null,
      business_viability_tier: null,
    };
  }
  const { data: ga, error: gaErr } = await sb
    .from("gamme_aggregates")
    .select("price_min_rag, price_max_rag, products_total, seo_score, priority_score")
    .eq("ga_pg_id", pgId)
    .maybeSingle();
  if (gaErr || !ga) {
    return {
      margin_estimate_pct: null,
      margin_estimate_method: "unknown",
      stock_coverage_pct: null,
      avg_delivery_days: null,
      sav_return_rate_pct: null,
      compatibility_trust_score: null,
      business_viability_score: null,
      business_viability_tier: null,
    };
  }
  // Proxy : si products_total > 0, "stock" = présence catalogue ; sinon 0
  const stock = ga.products_total > 0 ? 100 : 0;
  // Score viability composite simple (proxy, à raffiner)
  const seoScore = Number(ga.seo_score ?? 0);
  const compositeRaw = Math.min(100, Math.round(stock * 0.5 + seoScore * 0.5));
  const tier: "high" | "medium" | "low" | "unviable" =
    compositeRaw >= 70
      ? "high"
      : compositeRaw >= 40
        ? "medium"
        : compositeRaw >= 20
          ? "low"
          : "unviable";

  return {
    margin_estimate_pct: null, // pas de cost_of_goods → method='unknown'
    margin_estimate_method: "unknown",
    stock_coverage_pct: stock,
    avg_delivery_days: null, // peut être calculé via ___xtr_order si besoin futur
    sav_return_rate_pct: null,
    compatibility_trust_score: null,
    business_viability_score: compositeRaw,
    business_viability_tier: tier,
  };
}

async function collectUx(
  sb: SupabaseClient,
  pgAlias: string | null,
): Promise<UxStats> {
  // CWV daily : LCP + INP agrégés, friction composite simple
  let q = sb
    .from("__seo_cwv_daily")
    .select("lcp, inp")
    .gte("date", isoDate(windowStart));
  if (pgAlias) q = q.like("page", `%${pgAlias}%`);
  const { data, error } = await q.limit(50_000);
  if (error || !data?.length) {
    return { mobile_ux_friction_score: null };
  }
  // p75 simpliste (mean) pour proxy
  const avgLcp =
    data.reduce((s: number, r: any) => s + Number(r.lcp ?? 0), 0) / data.length;
  const avgInp =
    data.reduce((s: number, r: any) => s + Number(r.inp ?? 0), 0) / data.length;
  // Score friction : 0=fluide, 100=cassé. LCP > 2500ms = problème, INP > 200ms = problème
  const lcpScore = Math.min(100, Math.max(0, (avgLcp - 1000) / 25));
  const inpScore = Math.min(100, Math.max(0, (avgInp - 50) / 5));
  const friction = Math.round((lcpScore + inpScore) / 2);
  return { mobile_ux_friction_score: friction };
}

function parseArgs(argv: string[]): CollectorArgs {
  const args: CollectorArgs = { pgId: null };
  for (const a of argv) {
    if (a === "--site-wide") args.pgId = null;
    const m = a.match(/^--pg-id=(\d+)$/);
    if (m) args.pgId = parseInt(m[1], 10);
  }
  return args;
}

async function getPgAlias(
  sb: SupabaseClient,
  pgId: number,
): Promise<string | null> {
  const { data, error } = await sb
    .from("pieces_gamme")
    .select("pg_alias")
    .eq("pg_id", pgId)
    .maybeSingle();
  return error || !data ? null : (data as any).pg_alias;
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("ERROR: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required");
    process.exit(2);
  }
  const sb = createClient(url, key);
  const args = parseArgs(process.argv.slice(2));
  const pgAlias = args.pgId ? await getPgAlias(sb, args.pgId) : null;

  console.error(
    `Collecting reality audit ${args.pgId ? `for pg_id=${args.pgId} (${pgAlias})` : "site-wide"}...`,
  );

  const [indexation, funnel, viability, ux] = await Promise.all([
    collectIndexation(sb, pgAlias),
    collectFunnel(sb, pgAlias),
    collectViability(sb, args.pgId),
    collectUx(sb, pgAlias),
  ]);

  // Intent + selector telemetry = MISSING (manuel ou non instrumenté)
  // Note honnête dans `notes`
  const notesParts: string[] = [];
  notesParts.push(
    "Intent sample : NON capturé (review SERP manuel requis, 21 reviews top-1 pilote).",
  );
  notesParts.push(
    "Selector telemetry (E.bis-E.sexies) : NON instrumenté, NULL honnête.",
  );
  notesParts.push("margin_estimate_method=unknown (cost_of_goods absent).");

  // Compute verdict
  const verdictInputs: VerdictInputs = {
    pages_noindex_involuntary: indexation.pages_noindex_involuntary,
    canonical_correct_pct: indexation.canonical_correct_pct,
    intent_sample_size: null, // MISSING (à filler manuellement)
    intent_match_count: null,
    organic_sessions_28d: funnel.organic_sessions_28d,
    organic_orders_28d: funnel.organic_orders_28d,
    business_viability_tier: viability.business_viability_tier,
  };
  const verdict = computeVerdict(verdictInputs);
  notesParts.push(`Verdict notes: ${verdict.notes}`);

  // Data availability % : compter décisives non-null
  const decisives = [
    indexation.pages_noindex_involuntary,
    indexation.canonical_correct_pct,
    verdictInputs.intent_sample_size,
    verdictInputs.organic_sessions_28d,
    verdictInputs.organic_orders_28d,
    verdictInputs.business_viability_tier,
  ];
  const availability =
    (decisives.filter((d) => d !== null).length / decisives.length) * 100;

  const row = {
    pg_id: args.pgId,
    ...indexation,
    ...funnel,
    baseline_orders_seo_attributable_28d: funnel.organic_orders_28d,
    baseline_orders_attribution_method: "ga4_last_touch",
    baseline_window_start: isoDate(windowStart),
    baseline_window_end: isoDate(today),
    ...viability,
    ...ux,
    data_availability_pct: Math.round(availability * 100) / 100,
    dominant_problem: verdict.dominant_problem as DominantProblem,
    notes: notesParts.join(" | "),
  };

  const { data: inserted, error: insertErr } = await sb
    .from("__seo_reality_audit")
    .insert(row)
    .select("id, dominant_problem, data_availability_pct")
    .single();

  if (insertErr) {
    console.error("INSERT __seo_reality_audit failed:", insertErr);
    process.exit(1);
  }

  console.log(JSON.stringify(inserted, null, 2));
  console.error(
    `OK — id=${(inserted as any).id} verdict=${(inserted as any).dominant_problem} availability=${(inserted as any).data_availability_pct}%`,
  );
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
