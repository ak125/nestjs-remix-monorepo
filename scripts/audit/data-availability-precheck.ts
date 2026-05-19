#!/usr/bin/env -S npx ts-node
/**
 * PR-0.5 : Data Availability Precheck for Reality Audit
 *
 * Vérifie pour chaque colonne du schema `__seo_reality_audit` la source réelle disponible,
 * pour éviter d'exécuter le collector avec 70%+ de colonnes NULL (audit fantôme).
 *
 * Output : markdown rendu sur stdout (à rediriger vers docs/superpowers/specs/...).
 *
 * Usage:
 *   cd workspaces/seo-analytics && SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     npx ts-node scripts/audit/data-availability-precheck.ts > /tmp/availability.md
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

type Status = "available" | "missing" | "partial" | "manual";

interface Check {
  column: string;
  dimension: "A_indexation" | "B_intent" | "C_funnel" | "C_baseline" | "D_viability" | "E_ux" | "E_bis" | "E_ter" | "E_quater" | "E_quinquies" | "E_sexies";
  decisive: boolean;
  source: string;
  status: Status;
  evidence: string;
}

async function tableExists(sb: SupabaseClient, name: string): Promise<boolean> {
  const { data, error } = await sb
    .from("information_schema.tables" as any)
    .select("table_name")
    .eq("table_schema", "public")
    .eq("table_name", name)
    .maybeSingle();
  return !error && !!data;
}

async function columnExists(sb: SupabaseClient, table: string, column: string): Promise<boolean> {
  const { data, error } = await sb
    .from("information_schema.columns" as any)
    .select("column_name")
    .eq("table_schema", "public")
    .eq("table_name", table)
    .eq("column_name", column)
    .maybeSingle();
  return !error && !!data;
}

async function run(sb: SupabaseClient): Promise<Check[]> {
  const checks: Check[] = [];

  // ===== A. Indexation =====
  const hasGscDaily = await tableExists(sb, "__seo_gsc_daily");
  const hasIndexHistory = await tableExists(sb, "__seo_index_history");
  const hasCrawlLog = await tableExists(sb, "__seo_crawl_log");
  checks.push({
    column: "pages_indexed / pages_submitted / pages_discovered",
    dimension: "A_indexation",
    decisive: true,
    source: "__seo_gsc_daily aggregated + __seo_index_history",
    status: hasGscDaily && hasIndexHistory ? "available" : hasGscDaily ? "partial" : "missing",
    evidence: `gsc_daily=${hasGscDaily}, index_history=${hasIndexHistory}`,
  });
  checks.push({
    column: "pages_noindex_intentional / pages_noindex_involuntary",
    dimension: "A_indexation",
    decisive: true,
    source: "Pas de table __seo_url_audit dédiée. Dérivable via crawl_log + meta-robots scan",
    status: hasCrawlLog ? "partial" : "missing",
    evidence: `__seo_url_audit=false, __seo_crawl_log=${hasCrawlLog}. Nécessite scan crawler dédié pour distinguer intentional/involuntary.`,
  });
  checks.push({
    column: "canonical_correct_pct",
    dimension: "A_indexation",
    decisive: false,
    source: "Crawl scan (Screaming Frog ou interne)",
    status: hasCrawlLog ? "partial" : "missing",
    evidence: `Dérivable depuis crawl_log si canonical_url stocké, sinon manuel`,
  });
  checks.push({
    column: "duplication_clusters_count",
    dimension: "A_indexation",
    decisive: false,
    source: "Analyse GSC similar pages OU manuel",
    status: "manual",
    evidence: "Pas de table de clustering URL automatique",
  });
  checks.push({
    column: "sitemap_last_processed",
    dimension: "A_indexation",
    decisive: false,
    source: "GSC Sitemaps API ou table __seo_crawl_hub",
    status: hasCrawlLog ? "partial" : "missing",
    evidence: `__seo_crawl_hub existe peut-être, à explorer`,
  });

  // ===== B. Intent match =====
  checks.push({
    column: "intent_sample_size / intent_match_count / intent_mismatch_examples",
    dimension: "B_intent",
    decisive: true,
    source: "Review SERP manuel sur top 5 pages × 21 gammes (105 reviews) ou échantillon réduit",
    status: "manual",
    evidence: "Pas de capture SERP automatisée (cf plan : SERP scraping différé)",
  });

  // ===== C. Funnel (28j) =====
  const hasGa4Daily = await tableExists(sb, "__seo_ga4_daily");
  const hasOrder = await tableExists(sb, "___xtr_order");
  const hasOrderLine = await tableExists(sb, "___xtr_order_line");
  const hasGaClientId = hasOrder && (await columnExists(sb, "___xtr_order", "ga_client_id"));
  checks.push({
    column: "organic_sessions_28d",
    dimension: "C_funnel",
    decisive: true,
    source: "__seo_ga4_daily WHERE channel = 'organic' agrégé 28j",
    status: hasGa4Daily ? "available" : "missing",
    evidence: `ga4_daily=${hasGa4Daily}`,
  });
  checks.push({
    column: "organic_addtocart_28d / organic_orders_28d / organic_revenue_28d",
    dimension: "C_funnel",
    decisive: true,
    source: "JOIN ___xtr_order ↔ __seo_ga4_daily via ga_client_id (channel=organic)",
    status: hasOrder && hasGaClientId && hasGa4Daily ? "available" : "partial",
    evidence: `order=${hasOrder}, ga_client_id=${hasGaClientId}, ga4_daily=${hasGa4Daily}`,
  });
  checks.push({
    column: "funnel_dropoff_steps",
    dimension: "C_funnel",
    decisive: false,
    source: "GA4 events (page_view → add_to_cart → begin_checkout → purchase)",
    status: hasGa4Daily ? "partial" : "missing",
    evidence: `__seo_ga4_daily n'a pas les events détaillés ; dépend de GA4 MCP queries directes`,
  });

  // ===== C.bis BASELINE =====
  const hasBaseline = await tableExists(sb, "__seo_gamme_gsc_baseline");
  checks.push({
    column: "baseline_orders_seo_attributable_28d + attribution_method + windows",
    dimension: "C_baseline",
    decisive: true,
    source: "__seo_gamme_gsc_baseline + computed via __seo_ga4_daily ∩ ___xtr_order",
    status: hasBaseline && hasOrder && hasGaClientId ? "available" : "partial",
    evidence: `baseline_table=${hasBaseline}. Computation orders attribuables OK si ga_client_id présent`,
  });

  // ===== D. Business viability =====
  const hasGammeAgg = await tableExists(sb, "gamme_aggregates");
  const hasPriceMin = hasGammeAgg && (await columnExists(sb, "gamme_aggregates", "price_min_rag"));
  const hasVlevelCounts = hasGammeAgg && (await columnExists(sb, "gamme_aggregates", "vlevel_counts"));
  const hasProductsTotal = hasGammeAgg && (await columnExists(sb, "gamme_aggregates", "products_total"));
  const hasSupportTickets = await tableExists(sb, "support_tickets");
  checks.push({
    column: "margin_estimate_pct",
    dimension: "D_viability",
    decisive: false,
    source: "gamme_aggregates n'a PAS margin direct ; approximation depuis price_min/max_rag + coût d'achat (probablement absent)",
    status: hasPriceMin ? "partial" : "missing",
    evidence: `price_min_rag=${hasPriceMin}, mais cout_achat probablement absent → marge réelle non calculable directement`,
  });
  checks.push({
    column: "stock_coverage_pct",
    dimension: "D_viability",
    decisive: false,
    source: "products_total via gamme_aggregates (proxy : nombre SKU)",
    status: hasProductsTotal ? "partial" : "missing",
    evidence: `products_total=${hasProductsTotal}, mais pas de % SKU avec stock>0 directement`,
  });
  checks.push({
    column: "avg_delivery_days",
    dimension: "D_viability",
    decisive: false,
    source: "___xtr_order : ord_date_deliv - ord_date_pay",
    status: hasOrder ? "available" : "missing",
    evidence: `Calcul ord_date_deliv-ord_date_pay possible (cf colonnes ord)`,
  });
  checks.push({
    column: "sav_return_rate_pct",
    dimension: "D_viability",
    decisive: false,
    source: "support_tickets WHERE category IN ('return','sav','incompatible') / ___xtr_order total",
    status: hasSupportTickets ? "partial" : "missing",
    evidence: `support_tickets=${hasSupportTickets} (catégorie à mapper)`,
  });
  checks.push({
    column: "compatibility_trust_score / business_viability_score / tier",
    dimension: "D_viability",
    decisive: true,
    source: "Composite calculé : margin × stock × delivery × sav × conversion (formule à figer)",
    status: "partial",
    evidence: `Score dérivé — dépend qualité inputs ci-dessus`,
  });

  // ===== E. UX (CWV) =====
  const hasCwvDaily = await tableExists(sb, "__seo_cwv_daily");
  checks.push({
    column: "mobile_ux_friction_score",
    dimension: "E_ux",
    decisive: false,
    source: "__seo_cwv_daily (lcp/inp/cls/ttfb) — mais pas de device split direct",
    status: hasCwvDaily ? "partial" : "missing",
    evidence: `cwv_daily=${hasCwvDaily} ; pas de device column → friction mobile composite imparfait`,
  });
  checks.push({
    column: "time_to_compatibility_seconds_p50 / p95",
    dimension: "E_ux",
    decisive: false,
    source: "Vehicle selector telemetry events (NON instrumenté actuellement)",
    status: "missing",
    evidence: "Pas de table vehicle_selector_events trouvée — nécessite instrumentation",
  });
  checks.push({
    column: "search_to_product_confidence_score",
    dimension: "E_ux",
    decisive: false,
    source: "Composite GA4 bounce + sessions pages",
    status: hasGa4Daily ? "partial" : "missing",
    evidence: `Dérivable de ga4_daily (bounce_rate, avg_session_duration)`,
  });

  // ===== E.bis / E.ter / E.quater / E.quinquies / E.sexies — selector telemetry =====
  checks.push({
    column: "[bloc selector E.bis-E.sexies : 15 colonnes vehicle selector + mobile dropoff + compat conflict]",
    dimension: "E_sexies",
    decisive: false,
    source: "GA4 events custom + vehicle_selector_events + support_tickets correlation",
    status: "missing",
    evidence: "Majoritairement MISSING — nécessite instrumentation GA4 events + table vehicle_selector_events. Pour Phase 0.5, laisser NULL honnêtement.",
  });
  checks.push({
    column: "mobile_vs_desktop_dropoff_pct",
    dimension: "E_bis",
    decisive: false,
    source: "GA4 device dimension via MCP (PAS dans __seo_ga4_daily)",
    status: "partial",
    evidence: "GA4 MCP direct query nécessaire (workspace seo-analytics)",
  });

  return checks;
}

function statusBadge(s: Status): string {
  return s === "available" ? "✅ AVAILABLE" : s === "partial" ? "🟡 PARTIAL" : s === "manual" ? "✋ MANUAL" : "❌ MISSING";
}

function render(checks: Check[]): string {
  const total = checks.length;
  const decisive = checks.filter((c) => c.decisive);
  const decisiveAvail = decisive.filter((c) => c.status === "available").length;
  const decisivePartial = decisive.filter((c) => c.status === "partial").length;
  const decisiveMissing = decisive.filter((c) => c.status === "missing").length;

  const summary = `# Reality Audit — Data Availability Precheck

**Date** : ${new Date().toISOString().slice(0, 10)}
**Total colonnes vérifiées** : ${total}
**Colonnes DÉCISIVES (pèsent dans verdict)** : ${decisive.length}
- ✅ Available : ${decisiveAvail}
- 🟡 Partial : ${decisivePartial}
- ❌ Missing : ${decisiveMissing}

## Verdict Go/No-Go pour Task 1 collector

`;
  const ratio = decisiveAvail / decisive.length;
  const goNoGo =
    ratio >= 0.7
      ? "✅ **GO** : ≥ 70% des colonnes décisives sont AVAILABLE. Task 1 collector peut s'exécuter avec audit significatif. Documenter les colonnes contextuelles MISSING comme NULL honnêtes."
      : ratio >= 0.4
      ? "🟡 **GO PARTIEL** : 40-70% colonnes décisives disponibles. Task 1 collector peut s'exécuter mais verdict `dominant_problem` aura confiance dégradée. Ajouter `notes` explicite."
      : "❌ **NO-GO** : < 40% colonnes décisives disponibles. Task 1 collector produirait un audit fantôme. Instrumenter d'abord (priorité : vehicle_selector_events + GA4 attribution).";

  const detail = "## Détail par dimension\n\n| Dimension | Colonne | Décisive ? | Status | Source | Evidence |\n|---|---|---|---|---|---|\n" +
    checks
      .map((c) => `| ${c.dimension} | ${c.column} | ${c.decisive ? "OUI" : "non"} | ${statusBadge(c.status)} | ${c.source} | ${c.evidence} |`)
      .join("\n");

  return summary + goNoGo + "\n\n" + detail + "\n";
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required");
    process.exit(2);
  }
  const sb = createClient(url, key);
  const checks = await run(sb);
  process.stdout.write(render(checks));
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

export { run, render };
