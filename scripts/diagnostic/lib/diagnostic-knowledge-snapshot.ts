/**
 * diagnostic-knowledge-snapshot — construit un snapshot reproductible de la base
 * métier diagnostic (PR-2). Lecture seule. Sérialisation déterministe (canonical-json).
 *
 * Périmètre (ADR-product-C décision #4 — SoT par domaine) :
 *  - `__diag_*` = runtime diagnostic opérationnel
 *  - `kg_*` curatés = knowledge / maintenance / benchmark canon
 *
 * AUCUN timestamp dans la sortie hashée → mêmes données ⇒ mêmes octets ⇒ même sha256.
 * Pagination `.range()` (cap supabase-js 1000, cf. feedback_supabase_js_1000_row_cap_data_loss).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { canonicalize, sortRows } from "./canonical-json";
import { createHash } from "node:crypto";

export const SNAPSHOT_SCHEMA_VERSION = 1;

/** `__diag_*` — runtime diagnostic opérationnel. */
export const DIAG_TABLES = [
  "__diag_system",
  "__diag_symptom",
  "__diag_cause",
  "__diag_symptom_cause_link",
  "__diag_safety_rule",
  "__diag_related_parts",
  "__diag_context_questions",
] as const;

/** `kg_*` curatés — knowledge / maintenance / benchmark canon. */
export const KG_TABLES = [
  "kg_nodes",
  "kg_edges",
  "kg_engine_families",
  "kg_safety_triggers",
  "kg_confidence_config",
] as const;

export const SNAPSHOT_TABLES = [...DIAG_TABLES, ...KG_TABLES];

type Row = Record<string, unknown>;

const PAGE = 1000;

/** Récupère TOUTES les lignes d'une table (pagination .range, anti-cap 1000). */
async function fetchAll(supabase: SupabaseClient, table: string): Promise<Row[]> {
  const all: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`fetch ${table}: ${error.message}`);
    const rows = (data ?? []) as Row[];
    all.push(...rows);
    if (rows.length < PAGE) break;
  }
  return all;
}

export interface Snapshot {
  /** Forme canonique (octets stables) — c'est ce qui est écrit dans le .json et hashé. */
  canonical: string;
  sha256: string;
  counts: Record<string, number>;
}

/** Construit le snapshot déterministe à partir des tables canon. */
export async function buildSnapshot(supabase: SupabaseClient): Promise<Snapshot> {
  const tables: Record<string, Row[]> = {};
  const counts: Record<string, number> = {};

  for (const table of SNAPSHOT_TABLES) {
    const rows = sortRows(await fetchAll(supabase, table)); // ordre indépendant de la DB
    tables[table] = rows;
    counts[table] = rows.length;
  }

  const payload = {
    schema_version: SNAPSHOT_SCHEMA_VERSION,
    domain: "diagnostic-knowledge",
    tables,
  };
  const canonical = canonicalize(payload);
  const sha256 = createHash("sha256").update(canonical, "utf8").digest("hex");
  return { canonical, sha256, counts };
}
