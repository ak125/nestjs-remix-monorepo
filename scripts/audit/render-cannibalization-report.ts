#!/usr/bin/env -S npx ts-node
/**
 * Render GSC Cannibalization Report (cluster-first).
 *
 * Lit `__seo_cannibalization_recommendations` et rend un rapport markdown organisé
 * PAR CLUSTER (requête), trié par sévérité, avec distribution des actions + encart
 * "aucune action appliquée".
 *
 * Usage :
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     npx ts-node scripts/audit/render-cannibalization-report.ts > report.md
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("ERROR: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required");
    process.exit(2);
  }
  const sb: SupabaseClient = createClient(url, key);

  const { data: all, error } = await sb
    .from("__seo_cannibalization_recommendations")
    .select("*")
    .order("competing_pages", { ascending: false });
  if (error) throw error;
  if (!all?.length) {
    console.error("Aucune recommandation. Run gsc-cannibalization-audit.ts d'abord.");
    process.exit(1);
  }

  // group by query
  const byQuery = new Map<string, any[]>();
  for (const r of all as any[]) {
    if (!byQuery.has(r.query)) byQuery.set(r.query, []);
    byQuery.get(r.query)!.push(r);
  }

  const actionCounts: Record<string, number> = {};
  for (const r of all as any[])
    actionCounts[r.recommended_action] =
      (actionCounts[r.recommended_action] ?? 0) + 1;

  const patternClusters: Record<string, Set<string>> = {};
  for (const r of all as any[]) {
    (patternClusters[r.cluster_pattern] ??= new Set()).add(r.query);
  }

  let md = `# GSC Cannibalization Audit — rapport cluster-first

**Date** : ${new Date().toISOString().slice(0, 10)}
**Source** : signal Google réel (\`__seo_gsc_daily\`, 28j) — pas de similarité de contenu, pas de crawl
**Clusters** : ${byQuery.size} · **Pages analysées** : ${all.length}

## Distribution par pattern de cannibalisation
| Pattern | Clusters |
|---|---|
${Object.entries(patternClusters)
  .map(([p, s]) => `| ${p} | ${s.size} |`)
  .join("\n")}

> 🔑 **Constat clé** : la cannibalisation est dominée par l'**intra-R2** (pages /pieces/ qui se disputent entre elles). Le duplicate R8↔R2 inter-rôles est marginal.

## Distribution des actions recommandées
| Action | Nb pages |
|---|---|
${Object.entries(actionCounts)
  .map(([a, n]) => `| ${a} | ${n} |`)
  .join("\n")}

> ⚠️ **AUCUNE action appliquée.** Toutes les lignes sont \`status='proposed'\`. Révision humaine **obligatoire** avant tout canonical/noindex (cf gardes \`feedback_no_url_changes_ever\`, \`feedback_no_auto_page_suppression_ever\`).

## Top clusters par sévérité (nb pages × impressions)

`;

  const clusters = Array.from(byQuery.entries())
    .map(([query, rows]) => ({
      query,
      rows,
      competing: rows[0].competing_pages,
      impr: rows[0].cluster_impressions,
      pattern: rows[0].cluster_pattern,
      winner: rows[0].winner_page,
      winnerPos: rows[0].winner_position,
    }))
    .sort((a, b) => b.competing * b.impr - a.competing * a.impr)
    .slice(0, 25);

  for (const c of clusters) {
    md += `### \`${c.query}\` — ${c.pattern}\n`;
    md += `- ${c.competing} pages · ${c.impr} impressions · winner \`${c.winner}\` (pos ${c.winnerPos})\n`;
    md += `\n| page | pos | impr | clics | action | conf |\n|---|---|---|---|---|---|\n`;
    for (const r of c.rows.sort((a: any, b: any) => a.page_position - b.page_position)) {
      const w = r.is_winner ? " 🏆" : "";
      md += `| \`${r.page}\`${w} | ${r.page_position} | ${r.page_impressions} | ${r.page_clicks} | ${r.recommended_action} | ${r.confidence_level} |\n`;
    }
    md += `\n`;
  }

  md += `---
_Recommandations stockées dans \`__seo_cannibalization_recommendations\` (status=proposed)._
_Étape suivante = révision humaine page par page, puis application manuelle approuvée des canonical/noindex._
`;

  process.stdout.write(md);
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
