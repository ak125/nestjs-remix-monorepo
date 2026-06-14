#!/usr/bin/env -S npx ts-node
/**
 * GSC Cannibalization Audit.
 *
 * Mesure la cannibalisation SEO RÉELLE via Google Search Console (`__seo_gsc_daily`) :
 * requêtes où plusieurs pages du site se disputent le même mot-clé. Clusterise par
 * requête, identifie le winner (meilleure position) vs losers, classe chaque loser
 * (canonical_candidate / noindex_candidate / differentiate / keep) avec niveau de
 * confiance, et écrit des recommandations `proposed` (JAMAIS appliquées).
 *
 * Usage :
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     npx ts-node scripts/audit/gsc-cannibalization-audit.ts [--window=28] [--min-pages=2] [--dry-run]
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  classifyCannibalizedPage,
  ClusterContext,
  LoserPageInput,
} from "../../backend/src/modules/seo/audit/cannibalization-classifier";

interface GscRow {
  query: string;
  page: string;
  impressions: number;
  clicks: number;
  position: number;
}

interface PageAgg {
  page: string;
  impressions: number;
  clicks: number;
  position: number; // moyenne pondérée approx (moyenne simple ici)
  _posSum: number;
  _posN: number;
}

function patternOf(page: string): "r8" | "r2" | "other" {
  if (/\/constructeurs\//.test(page)) return "r8";
  if (/\/pieces\//.test(page)) return "r2";
  return "other";
}

/** Filtre le bruit : opérateurs site:, requêtes trop courtes, refs internes (ai12345), mots vides. */
function isNoiseQuery(q: string): boolean {
  const s = q.trim().toLowerCase();
  if (s.length < 4) return true;
  if (s.startsWith("site:")) return true;
  if (/^ai\d+$/.test(s)) return true; // refs internes
  if (/^\d+$/.test(s)) return true; // requête purement numérique
  if (["oui", "non", "automecanik", "auto mecanik"].includes(s)) return true;
  return false;
}

async function fetchGsc(
  sb: SupabaseClient,
  windowDays: number,
): Promise<GscRow[]> {
  const since = new Date(Date.now() - windowDays * 864e5).toISOString().slice(0, 10);
  const rows: GscRow[] = [];
  const pageSize = 1000;
  let from = 0;
  // pagination pour dépasser la limite par défaut
  for (;;) {
    const { data, error } = await sb
      .from("__seo_gsc_daily")
      .select("query, page, impressions, clicks, position")
      .gte("date", since)
      .not("query", "is", null)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const r of data as any[]) {
      if (!r.query || isNoiseQuery(r.query)) continue;
      rows.push({
        query: r.query,
        page: r.page,
        impressions: Number(r.impressions ?? 0),
        clicks: Number(r.clicks ?? 0),
        position: Number(r.position ?? 0),
      });
    }
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

interface ClusterReco {
  query: string;
  cluster_pattern: "intra_r2" | "intra_r8" | "r8_vs_r2" | "mixed";
  competing_pages: number;
  winner_page: string;
  winner_position: number;
  cluster_clicks: number;
  cluster_impressions: number;
  rows: Array<{
    page: string;
    page_position: number;
    page_impressions: number;
    page_clicks: number;
    is_winner: boolean;
    recommended_action: string;
    confidence_level: string;
    target_canonical_url: string | null;
    reason: string;
  }>;
}

function buildClusters(gsc: GscRow[], minPages: number): ClusterReco[] {
  // group by query → page agg
  const byQuery = new Map<string, Map<string, PageAgg>>();
  for (const r of gsc) {
    if (!byQuery.has(r.query)) byQuery.set(r.query, new Map());
    const pages = byQuery.get(r.query)!;
    if (!pages.has(r.page)) {
      pages.set(r.page, {
        page: r.page,
        impressions: 0,
        clicks: 0,
        position: 0,
        _posSum: 0,
        _posN: 0,
      });
    }
    const a = pages.get(r.page)!;
    a.impressions += r.impressions;
    a.clicks += r.clicks;
    a._posSum += r.position;
    a._posN += 1;
  }

  const clusters: ClusterReco[] = [];
  for (const [query, pagesMap] of byQuery) {
    const pages = Array.from(pagesMap.values()).map((a) => ({
      ...a,
      position: a._posN ? a._posSum / a._posN : 0,
    }));
    // ne garder que les pages catalog (r8/r2), ignorer 'other'
    const catalog = pages.filter((p) => patternOf(p.page) !== "other");
    if (catalog.length < minPages) continue;

    const r8 = catalog.filter((p) => patternOf(p.page) === "r8").length;
    const r2 = catalog.filter((p) => patternOf(p.page) === "r2").length;
    let pattern: ClusterReco["cluster_pattern"];
    if (r8 >= 1 && r2 >= 1) pattern = "r8_vs_r2";
    else if (r2 >= 2) pattern = "intra_r2";
    else if (r8 >= 2) pattern = "intra_r8";
    else continue; // single page, pas de cannibalisation

    const winner = catalog.reduce((best, p) =>
      p.position > 0 && (best.position === 0 || p.position < best.position) ? p : best,
    );
    const ctx: ClusterContext = {
      competingPages: catalog.length,
      winnerPosition: winner.position,
      clusterClicks: catalog.reduce((s, p) => s + p.clicks, 0),
    };
    const clusterImpr = catalog.reduce((s, p) => s + p.impressions, 0);

    const rows = catalog.map((p) => {
      const input: LoserPageInput = {
        position: p.position,
        impressions: p.impressions,
        clicks: p.clicks,
        isWinner: p.page === winner.page,
      };
      const res = classifyCannibalizedPage(input, ctx);
      return {
        page: p.page,
        page_position: Math.round(p.position * 100) / 100,
        page_impressions: p.impressions,
        page_clicks: p.clicks,
        is_winner: input.isWinner,
        recommended_action: res.action,
        confidence_level: res.confidence_level,
        target_canonical_url:
          res.action === "canonical_candidate" ? winner.page : null,
        reason: res.reason,
      };
    });

    clusters.push({
      query,
      cluster_pattern: pattern,
      competing_pages: catalog.length,
      winner_page: winner.page,
      winner_position: Math.round(winner.position * 100) / 100,
      cluster_clicks: ctx.clusterClicks,
      cluster_impressions: clusterImpr,
      rows,
    });
  }
  // tri sévérité : nb pages × impressions × écart positions
  clusters.sort(
    (a, b) =>
      b.competing_pages * b.cluster_impressions -
      a.competing_pages * a.cluster_impressions,
  );
  return clusters;
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("ERROR: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required");
    process.exit(2);
  }
  const args = process.argv.slice(2);
  const windowDays = parseInt(
    args.find((a) => a.startsWith("--window="))?.split("=")[1] ?? "28",
    10,
  );
  const minPages = parseInt(
    args.find((a) => a.startsWith("--min-pages="))?.split("=")[1] ?? "2",
    10,
  );
  const dryRun = args.includes("--dry-run");

  const sb = createClient(url, key);
  console.error(`Fetching GSC (${windowDays}j)...`);
  const gsc = await fetchGsc(sb, windowDays);
  console.error(`${gsc.length} rows GSC (noise filtré). Clustering...`);
  const clusters = buildClusters(gsc, minPages);

  const totalReco = clusters.reduce((s, c) => s + c.rows.length, 0);
  const byAction: Record<string, number> = {};
  for (const c of clusters)
    for (const r of c.rows)
      byAction[r.recommended_action] = (byAction[r.recommended_action] ?? 0) + 1;

  console.error(
    `${clusters.length} clusters cannibalisés, ${totalReco} recommandations. Distribution: ${JSON.stringify(byAction)}`,
  );

  if (dryRun) {
    console.log(JSON.stringify({ clusters: clusters.length, byAction }, null, 2));
    return;
  }

  // INSERT recommandations (status proposed)
  const rows = clusters.flatMap((c) =>
    c.rows.map((r) => ({
      query: c.query,
      cluster_pattern: c.cluster_pattern,
      competing_pages: c.competing_pages,
      winner_page: c.winner_page,
      winner_position: c.winner_position,
      cluster_clicks: c.cluster_clicks,
      cluster_impressions: c.cluster_impressions,
      page: r.page,
      page_position: r.page_position,
      page_impressions: r.page_impressions,
      page_clicks: r.page_clicks,
      is_winner: r.is_winner,
      recommended_action: r.recommended_action,
      confidence_level: r.confidence_level,
      target_canonical_url: r.target_canonical_url,
      reason: r.reason,
      status: "proposed",
    })),
  );
  // insert par batch de 500
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await sb
      .from("__seo_cannibalization_recommendations")
      .insert(rows.slice(i, i + 500));
    if (error) throw error;
  }
  console.error(`Inséré ${rows.length} recommandations (status=proposed).`);
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

export { buildClusters, isNoiseQuery };
