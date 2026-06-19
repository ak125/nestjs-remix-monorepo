/**
 * Catalog gamme membership (server-only) — the 232 indexable catalog gammes.
 *
 * Owner scope (2026-06-10): the R2 sellable-noindex rule applies ONLY to the
 * catalog gammes = `pieces_gamme` where `pg_display='1' AND pg_level IN ('1','2')`
 * (133 niveau 1 + 99 niveau 2 = 232). Off-catalog gammes keep their legacy robots.
 *
 * Source of truth reused (no new endpoint): `GET /api/catalog/gammes`
 * (`GammeUnifiedService.getAllGammes` → already returns `{ id, level, is_displayed }`
 * for every displayed gamme). We derive the level-1/2 ID set and cache it in-process.
 *
 * The set is extremely stable, so we cache it for a long TTL. On any fetch failure
 * we return `null` and the caller falls back to the legacy robots rule (never a
 * silent surprise noindex — the failure is logged).
 */
import { logger } from "~/utils/logger";

interface CatalogGammeRow {
  id: number;
  level?: number;
  is_displayed?: boolean;
}

/** Catalog gamme = displayed AND niveau 1 ou 2 (the 232). */
function isIndexableCatalogRow(g: CatalogGammeRow): boolean {
  return (g.level === 1 || g.level === 2) && g.is_displayed !== false;
}

const TTL_MS = 30 * 60 * 1000; // 30 min — catalog membership changes rarely
let cache: { ids: Set<number>; at: number } | null = null;
let inflight: Promise<Set<number> | null> | null = null;

/**
 * Returns the set of catalog (indexable) gamme IDs, or `null` if it could not be
 * loaded. Cached in-process with a long TTL; concurrent calls share one fetch.
 */
export async function loadCatalogGammeIds(
  now: number = Date.now(),
): Promise<Set<number> | null> {
  if (cache && now - cache.at < TTL_MS) return cache.ids;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const base = process.env.API_BASE_URL || "http://localhost:3000";
      const res = await fetch(`${base}/api/catalog/gammes`, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`/api/catalog/gammes HTTP ${res.status}`);
      const rows = (await res.json()) as CatalogGammeRow[];
      const ids = new Set<number>();
      for (const g of rows ?? []) {
        if (isIndexableCatalogRow(g)) ids.add(g.id);
      }
      cache = { ids, at: now };
      return ids;
    } catch (e) {
      logger.error(
        "⚠️ [R2-INDEX] loadCatalogGammeIds failed — R2 sellable gate falls back to legacy robots:",
        e instanceof Error ? e.message : e,
      );
      return null;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

/** Test-only: reset the in-process cache. */
export function __resetCatalogGammeIdsCache(): void {
  cache = null;
  inflight = null;
}
