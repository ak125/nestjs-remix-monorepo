/**
 * PR-SBD-1 Task 5 — Route Remix /admin/seo-control (Phase A)
 *
 * Cockpit SEO Business Control — UI **ULTRA-FOCUSÉE 2 BLOCS VISIBLES**.
 *
 * Discipline Phase A (cf. .claude/plans/verifier-existant-avant-et-ethereal-firefly.md) :
 *   - SSR pur (pas de TanStack Query, pas de polling 60s)
 *   - Pas de DecisionsPopover / SurfaceBadge enrichi / DomainFilter / sparklines
 *   - 2 SECTIONS VISIBLES UNIQUEMENT :
 *       1. Top pages en perte (max 20, principal)
 *       2. Alertes critiques (severity >= high, max 20)
 *   - Ligne traffic compact dans le header (pas une section dédiée)
 *   - Blocs Low CTR + Conversion Gap : data récupérée dans le snapshot, MAIS
 *     UI ne les rend PAS (ignorés au render)
 *   - Range selector 7d/28d via URL search param
 *
 * Anti surcharge cognitive :
 *   Le snapshot complet (5 blocs) est validé par le Zod schema côté loader
 *   (fail-loud anti-bricolage), mais l'UI ne montre que 2 blocs pour rester
 *   exploitable au quotidien. Phase A.5 / A.6 / C activent les autres blocs
 *   uniquement sur signaux Phase B documentés (≥ 5j d'usage + ≥ 3 décisions
 *   tracées dans log.md).
 *
 * Refs :
 *   - backend/src/modules/admin/controllers/seo-control.controller.ts (endpoint)
 *   - packages/seo-types/src/control-dashboard.ts (Zod contract)
 */
import { type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { SeoControlSnapshotSchema, RangeSchema } from "@repo/seo-types";
import { ExternalLink } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { getInternalApiUrl } from "~/utils/internal-api.server";
import { createNoIndexMeta } from "~/utils/meta-helpers";

// ─── Meta (noindex admin) ───────────────────────────────────────────

export const meta: MetaFunction = () =>
  createNoIndexMeta("SEO Business Control · Phase A");

// ─── Loader (SSR pur, Zod fail-loud) ────────────────────────────────

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);

  // Zod parse range — defensive default '7d'
  let range: "7d" | "28d";
  try {
    range = RangeSchema.parse(url.searchParams.get("range") ?? "7d");
  } catch {
    range = "7d";
  }

  const backendUrl = getInternalApiUrl("");
  const cookieHeader = request.headers.get("Cookie") ?? "";

  const res = await fetch(
    `${backendUrl}/api/admin/seo-control/snapshot?range=${range}`,
    { headers: { Cookie: cookieHeader } },
  );

  // 404 = feature flag OFF or admin not enrolled — show empty state, don't crash
  if (res.status === 404) {
    return { snapshot: null, range, status: 404 };
  }
  if (!res.ok) {
    throw new Response(`snapshot unavailable (${res.status})`, {
      status: res.status,
    });
  }

  // Fail-loud Zod parse — anti-bricolage
  const snapshot = SeoControlSnapshotSchema.parse(await res.json());
  return { snapshot, range, status: 200 };
}

// ─── Component (UI minimal Phase A — 2 blocs visibles) ──────────────

export default function SeoControlDashboard() {
  const data = useLoaderData<typeof loader>();

  // Feature flag OFF → 404 empty state explicit
  if (data.status === 404 || !data.snapshot) {
    return (
      <main className="container mx-auto p-6">
        <h1 className="text-2xl font-bold mb-2">SEO Business Control</h1>
        <p className="text-muted-foreground text-sm">
          Dashboard non activé pour cet utilisateur. Contactez l&apos;admin pour
          override{" "}
          <code className="font-mono">SEO_CONTROL_DASHBOARD_ENABLED</code>.
        </p>
      </main>
    );
  }

  const { snapshot, range } = data;
  const tw = snapshot.trafficWindow;

  // Filter alerts to severity ∈ {critical, high} only (Phase A discipline)
  const criticalAlerts = snapshot.technicalAlerts
    .filter((a) => a.severity === "critical" || a.severity === "high")
    .slice(0, 20);

  const directionColor =
    tw.delta_vs_previous.direction === "down"
      ? "text-red-600"
      : tw.delta_vs_previous.direction === "up"
        ? "text-green-600"
        : "text-muted-foreground";

  return (
    <main className="container mx-auto p-6 space-y-8">
      {/* ─── Header : titre + ligne trafic compact + range selector ──── */}
      <header className="flex items-center justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold">SEO Business Control · Phase A</h1>
          <p className="text-sm mt-1">
            <strong>Trafic {range}</strong> ·{" "}
            {tw.clicks.toLocaleString("fr-FR")} clics ·{" "}
            {tw.impressions.toLocaleString("fr-FR")} imp · CTR{" "}
            {tw.ctr.toFixed(2)}% · pos {tw.avg_position.toFixed(1)} ·{" "}
            <span className={directionColor}>
              Δ clics {tw.delta_vs_previous.clicks_pct ?? "—"}%
            </span>
          </p>
          <p className="text-xs text-muted-foreground font-mono">
            snapshot_id: {snapshot.snapshot_id} · hash:{" "}
            {snapshot.snapshot_hash.slice(0, 12)}… ·{" "}
            {new Date(snapshot.generated_at).toLocaleString("fr-FR")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant={range === "7d" ? "default" : "outline"}>
            <Link to="?range=7d" prefetch="intent">
              7 jours
            </Link>
          </Button>
          <Button asChild variant={range === "28d" ? "default" : "outline"}>
            <Link to="?range=28d" prefetch="intent">
              28 jours
            </Link>
          </Button>
        </div>
      </header>

      {/* ─── Bloc PRINCIPAL — Top pages en perte ──────────────────── */}
      <section>
        <h2 className="text-lg font-semibold mb-2">
          Top pages en perte ({snapshot.topLosers.length})
        </h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Page</TableHead>
              <TableHead>Surface</TableHead>
              <TableHead className="text-right">Clics</TableHead>
              <TableHead className="text-right">Δ</TableHead>
              <TableHead>Top queries Δ</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Rule IDs</TableHead>
              <TableHead>Owner</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {snapshot.topLosers.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center text-muted-foreground"
                >
                  Aucune page en perte cette semaine.
                </TableCell>
              </TableRow>
            ) : (
              snapshot.topLosers.map((row) => (
                <TableRow key={row.page}>
                  <TableCell className="font-mono text-xs">
                    <a
                      href={row.page}
                      target="_blank"
                      rel="noopener nofollow noreferrer"
                      className="text-blue-600 hover:underline inline-flex items-center gap-1"
                    >
                      {row.page}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {row.surface_key}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.clicks_current}
                  </TableCell>
                  <TableCell className="text-right text-red-600">
                    {row.delta_clicks} ({row.delta_pct ?? "—"}%)
                  </TableCell>
                  <TableCell className="font-mono text-[10px]">
                    {row.top_queries_sample
                      .map(
                        (q) =>
                          `${q.query} (${q.clicks_delta >= 0 ? "+" : ""}${q.clicks_delta})`,
                      )
                      .join(" · ") || "—"}
                  </TableCell>
                  <TableCell>{row.severity}</TableCell>
                  <TableCell className="font-mono text-[10px]">
                    {row.decisions.decision_rule_ids.join(", ")}
                  </TableCell>
                  <TableCell className="text-xs">
                    {row.decisions.role_id}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>

      {/* ─── Bloc SECONDAIRE — Alertes critiques ────────────────────── */}
      <section>
        <h2 className="text-lg font-semibold mb-2">
          Alertes critiques ({criticalAlerts.length})
        </h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Domain</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>URL</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Detected</TableHead>
              <TableHead>Rule IDs</TableHead>
              <TableHead>Owner</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {criticalAlerts.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-muted-foreground"
                >
                  Aucune alerte critique active.
                </TableCell>
              </TableRow>
            ) : (
              criticalAlerts.map((a, i) => (
                <TableRow key={`${a.source}-${a.detected_at}-${i}`}>
                  <TableCell>{a.operational_domain}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {a.alert_type}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {a.entity_url ?? "—"}
                  </TableCell>
                  <TableCell>{a.severity}</TableCell>
                  <TableCell className="text-xs">
                    {new Date(a.detected_at).toLocaleString("fr-FR")}
                  </TableCell>
                  <TableCell className="font-mono text-[10px]">
                    {a.decisions.decision_rule_ids.join(", ")}
                  </TableCell>
                  <TableCell className="text-xs">
                    {a.decisions.role_id}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>

      {/* ─── Footer Phase A discipline reminder ──────────────────────── */}
      <footer className="text-xs text-muted-foreground font-mono pt-8 border-t space-y-1">
        <p>
          Phase A · 2 blocs visibles (Top Losers + Alertes critiques). Bloc Low
          CTR + Conversion masqués jusqu&apos;à signaux Phase B documentés dans
          log.md.
        </p>
        <p>
          Format trace : <code>## YYYY-MM-DD — Décision dashboard</code> avec
          champs Bloc / Signal / Décision / Verdict rule_id / Mesure prévue.
        </p>
      </footer>
    </main>
  );
}
