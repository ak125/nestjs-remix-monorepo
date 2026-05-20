#!/usr/bin/env -S npx ts-node
/**
 * Render Reality Audit Report — Phase 0.5 Task 2.
 *
 * Lit la dernière row __seo_reality_audit (site-wide ou par gamme) et rend
 * un rapport markdown structuré (A indexation / B intent / C funnel / D viability /
 * E UX) + verdict + recommandation orientation.
 *
 * Usage :
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     npx ts-node scripts/audit/render-reality-audit-report.ts [--pg-id=402] > report.md
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

const ORIENTATION: Record<string, string> = {
  content_quality:
    "✅ Le levier restant = qualité contenu. Ouvrir un NOUVEAU plan mini Evidence Guard V1 (4 inputs : wiki + raw + catalog_signature + keyword_intent, L1 preflight + L2 trigger, PAS OPA). Pilote 21 gammes max.",
  conversion_funnel:
    "🔀 PIVOT Commerce-Loop V1 (déjà TOP PRIORITY). Le tunnel est cassé, pas le contenu — investir SEO contenu serait du gaspillage.",
  indexation:
    "🔧 Ouvrir un plan fix indexation (canonical / noindex involontaire / sitemap / crawl budget). Google ne voit pas les pages — aucun contenu ne convertira.",
  intent_mismatch:
    "🧭 Ouvrir un plan re-architecture URL/template (R1 catégorie e-commerce vs R3 guide vs R6 conseil). Le contenu est désaligné de l'intent SERP dominant.",
  business_unviable:
    "💰 Ouvrir un plan re-priorisation gammes (drop non-rentables, focus marge × stock × SAV positifs). Pas d'investissement SEO sur gammes non viables.",
  mixed:
    "⚠️ Plusieurs bottlenecks simultanés. Approfondir l'audit (plus de sample, plus de mois) avant tout build.",
  unknown:
    "❓ Données insuffisantes pour conclure. Instrumenter les sources MISSING (cf notes) puis re-run le collector avant toute décision.",
};

function fmt(v: any): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") return String(v);
  return String(v);
}

function render(row: any): string {
  const scope = row.pg_id ? `gamme pg_id=${row.pg_id}` : "site-wide";
  return `# Reality Audit Report — ${scope}

**Capturé le** : ${row.captured_at}
**Confiance audit (data_availability_pct)** : ${fmt(row.data_availability_pct)}%
**Verdict** : \`${row.dominant_problem}\`

## A. Indexation
| Métrique | Valeur |
|---|---|
| pages_submitted | ${fmt(row.pages_submitted)} |
| pages_discovered | ${fmt(row.pages_discovered)} |
| pages_indexed | ${fmt(row.pages_indexed)} |
| pages_noindex_involuntary | ${fmt(row.pages_noindex_involuntary)} |
| canonical_correct_pct | ${fmt(row.canonical_correct_pct)} |
| duplication_clusters_count | ${fmt(row.duplication_clusters_count)} |

## B. Intent match
| Métrique | Valeur |
|---|---|
| intent_sample_size | ${fmt(row.intent_sample_size)} |
| intent_match_count | ${fmt(row.intent_match_count)} |
${row.intent_mismatch_examples ? "| examples | " + JSON.stringify(row.intent_mismatch_examples).slice(0, 200) + " |" : "| examples | — (non capturé) |"}

## C. Conversion funnel (28j)
| Métrique | Valeur |
|---|---|
| organic_sessions_28d | ${fmt(row.organic_sessions_28d)} |
| organic_addtocart_28d | ${fmt(row.organic_addtocart_28d)} |
| organic_orders_28d | ${fmt(row.organic_orders_28d)} |
| organic_revenue_28d | ${fmt(row.organic_revenue_28d)} |
| baseline_orders_seo_attributable_28d | ${fmt(row.baseline_orders_seo_attributable_28d)} |

## D. Business viability
| Métrique | Valeur |
|---|---|
| margin_estimate_pct (${fmt(row.margin_estimate_method)}) | ${fmt(row.margin_estimate_pct)} |
| stock_coverage_pct | ${fmt(row.stock_coverage_pct)} |
| avg_delivery_days | ${fmt(row.avg_delivery_days)} |
| sav_return_rate_pct | ${fmt(row.sav_return_rate_pct)} |
| business_viability_score | ${fmt(row.business_viability_score)} |
| business_viability_tier | ${fmt(row.business_viability_tier)} |

## E. UX & confiance achat
| Métrique | Valeur |
|---|---|
| mobile_ux_friction_score | ${fmt(row.mobile_ux_friction_score)} |
| time_to_compatibility_seconds_p50 | ${fmt(row.time_to_compatibility_seconds_p50)} |
| compatibility_validation_success_pct | ${fmt(row.compatibility_validation_success_pct)} |
| vehicle_selector_abandon_pct | ${fmt(row.vehicle_selector_abandon_pct)} |
| compatibility_error_report_rate | ${fmt(row.compatibility_error_report_rate)} |
| mobile_vehicle_selector_failure_pct | ${fmt(row.mobile_vehicle_selector_failure_pct)} |

> Note : la majorité des colonnes E.bis-E.sexies (selector telemetry) sont NULL car non instrumentées (cf data-availability precheck). Ce sont des **mesures contextuelles**, elles ne pèsent PAS dans le verdict.

## Notes audit
${row.notes ?? "—"}

## Recommandation orientation (post-STOP 4 semaines)
${ORIENTATION[row.dominant_problem] ?? "—"}

---
_Rapport généré par scripts/audit/render-reality-audit-report.ts_
_⚠️ STOP ABSOLU 4 semaines avant toute décision — observer GSC/GA4/commandes réelles, comparer baseline._
`;
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("ERROR: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required");
    process.exit(2);
  }
  const sb: SupabaseClient = createClient(url, key);
  const pgIdArg = process.argv.slice(2).find((a) => a.startsWith("--pg-id="));
  const pgId = pgIdArg ? parseInt(pgIdArg.split("=")[1], 10) : null;

  let q = sb
    .from("__seo_reality_audit")
    .select("*")
    .order("captured_at", { ascending: false })
    .limit(1);
  q = pgId ? q.eq("pg_id", pgId) : q.is("pg_id", null);

  const { data, error } = await q.maybeSingle();
  if (error) {
    console.error("Query error:", error);
    process.exit(1);
  }
  if (!data) {
    console.error(
      `Aucune row __seo_reality_audit ${pgId ? `pour pg_id=${pgId}` : "site-wide"}. Run collect-reality-audit.ts d'abord.`,
    );
    process.exit(1);
  }
  process.stdout.write(render(data));
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

export { render };
