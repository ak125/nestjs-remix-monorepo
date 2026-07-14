/**
 * EDITORIAL_AUTHORITY_SINKS — governance classification (NOT a DB table, NOT a runtime service).
 *
 * WHY THIS EXISTS (plan §Fermeture B3, ADR-059 loop):
 *   The served-content write-sink ratchet (`check-served-content-write-sinks-ratchet.ts`,
 *   `SERVED_TABLES`) only tracks tables read **at render** on a public page. It is therefore
 *   BLIND to tables that never render directly but still **influence future served content** —
 *   image-prompt drafts, keyword plans, brief templates. A re-introduced RAG writer into one of
 *   those (a B3-class regression) would land green under the served ratchet.
 *
 *   `EDITORIAL_AUTHORITY_SINKS` is the exact, evidence-pinned list of those editorial-authority
 *   tables. It is a *classification*, deliberately SEPARATE from `SERVED_TABLES` (do not deform
 *   `SERVED_TABLES` to hold them — a served-at-render table and an influences-future-content
 *   table are different concerns). Consumers = the RAG-read authority ast-grep rule
 *   (`.ast-grep/rules/seo-no-rag-as-content-source.yml`) and human review during Tranche B.
 *
 * SOURCE OF RECORD (do not re-derive here — provider/caller attribution proven in P0):
 *   audit/adr059-p0d0-audit-2026-07-14.md §6.
 *
 * HARD RULES (plan): 0 `rN` pattern expansion · 0 presumed table · each entry linked to a proven
 *   writer/caller. The audit §6 prose rounds the count to "18"; the ENUMERATED proven set is 17
 *   (2 ratchet-tracked + 15 ratchet-blind). We pin the 17 enumerated names — no padding to a round
 *   number, per "0 presumed table". A genuinely-new sink is added only with fresh proof + an
 *   authority decision (never by wildcard).
 *
 * NOT closure. Listing a sink here does not delete or freeze its writer — B1..B8 close writers by
 * structural delete (owner-gated). This registry only makes the blind surface explicit + rat-chetable.
 */

/** How the writer of a sink was evidenced in P0 (audit §6). */
export type SinkEvidence =
  | "in_app_writer" // a backend/src writer is proven (closable + testable in-app)
  | "read_only_in_app" // read in-app, writer is external (in-app path must never become a writer)
  | "external_agentic" // written only by agentic-engine / external skill (runtime-only proof)
  | "no_in_app_writer"; // table exists, no writer found in-app (runtime-only to confirm)

export interface EditorialAuthoritySink {
  /** Exact table name (verified in audit §6 — never a pattern). */
  readonly table: string;
  /** Proven writer/caller (P0 attribution). Empty string only when evidence = no_in_app_writer. */
  readonly writer: string;
  readonly evidence: SinkEvidence;
  /**
   * True when this table is ALSO in `SERVED_TABLES` (served at render), so the served-content
   * ratchet already tracks writes to it. The whole point of this registry is the `false` rows:
   * editorial-authority tables the served ratchet is BLIND to.
   */
  readonly servedRatchetTracked: boolean;
  /** Optional Tranche-B / role note (context, not authority). */
  readonly note?: string;
}

export const EDITORIAL_AUTHORITY_SINKS: readonly EditorialAuthoritySink[] = [
  // ── Tracked by the served ratchet too (dual-nature: served-at-render AND editorial-authority) ──
  {
    table: "__seo_r1_image_prompts",
    writer: "R1ImagePromptService",
    evidence: "in_app_writer",
    servedRatchetTracked: true,
    note: "B4 — DELETE RAG generation, KEEP uploaded images/approvals.",
  },
  {
    table: "__seo_r3_image_prompts",
    writer: "R3ImagePromptService",
    evidence: "in_app_writer",
    servedRatchetTracked: true,
    note: "B5 — DELETE RAG generation, KEEP images/approvals; never downgrade an approved image.",
  },

  // ── Ratchet-BLIND (not in SERVED_TABLES → the served ratchet cannot see writes here) ──
  {
    table: "__seo_r6_image_prompts",
    writer: "",
    evidence: "no_in_app_writer",
    servedRatchetTracked: false,
  },
  {
    table: "__seo_r1_keyword_plan",
    writer: "R1KeywordPlanGatesService",
    evidence: "in_app_writer",
    servedRatchetTracked: false,
  },
  {
    table: "__seo_r2_keyword_plan",
    writer: "R2EnricherService",
    evidence: "in_app_writer",
    servedRatchetTracked: false,
    note: "B3 — the exact table the served ratchet excludes by design.",
  },
  {
    table: "__seo_r3_keyword_plan",
    writer: "(external writer; read in-app)",
    evidence: "read_only_in_app",
    servedRatchetTracked: false,
    note: "R3 HEAD brief source (skp_seo_brief) — must stay READ-only in-app.",
  },
  {
    table: "__seo_r4_keyword_plan",
    writer: "(external)",
    evidence: "external_agentic",
    servedRatchetTracked: false,
  },
  {
    table: "__seo_r5_keyword_plan",
    writer: "(agentic / external)",
    evidence: "external_agentic",
    servedRatchetTracked: false,
  },
  {
    table: "__seo_r6_keyword_plan",
    writer: "(agentic / external)",
    evidence: "external_agentic",
    servedRatchetTracked: false,
  },
  {
    table: "__seo_r7_keyword_plan",
    writer: "(agentic / external)",
    evidence: "external_agentic",
    servedRatchetTracked: false,
  },
  {
    table: "__seo_r8_keyword_plan",
    writer: "(agentic / external)",
    evidence: "external_agentic",
    servedRatchetTracked: false,
  },
  {
    table: "__seo_r8_vehicle_plan",
    writer: "(agentic)",
    evidence: "external_agentic",
    servedRatchetTracked: false,
  },
  {
    table: "__seo_page_brief",
    writer: "PageBriefService",
    evidence: "in_app_writer",
    servedRatchetTracked: false,
  },
  {
    table: "__seo_brief_template",
    writer: "BriefTemplateService",
    evidence: "in_app_writer",
    servedRatchetTracked: false,
  },
  {
    table: "__seo_research_brief",
    writer: "(agentic)",
    evidence: "external_agentic",
    servedRatchetTracked: false,
  },
  {
    table: "__seo_keyword_results",
    writer: "AdminKeywordPlannerController",
    evidence: "in_app_writer",
    servedRatchetTracked: false,
    note: "The live keyword-plan store (real write target).",
  },
  {
    table: "__seo_keywords",
    writer:
      "GammeVlevelService + GammeDetailEnricherService (+ seo-batch external)",
    evidence: "in_app_writer",
    servedRatchetTracked: false,
  },
] as const;

/** Just the table names (for membership checks by the ast-grep rule / reviewers). */
export const EDITORIAL_AUTHORITY_SINK_TABLES: readonly string[] =
  EDITORIAL_AUTHORITY_SINKS.map((s) => s.table);

/** Invariants that must hold for the registry to be trustworthy. Thrown-checked in the test. */
export function registryInvariants(): {
  total: number;
  servedTracked: number;
  ratchetBlind: number;
  duplicates: string[];
} {
  const tables = EDITORIAL_AUTHORITY_SINK_TABLES;
  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const t of tables) {
    if (seen.has(t)) duplicates.push(t);
    seen.add(t);
  }
  return {
    total: tables.length,
    servedTracked: EDITORIAL_AUTHORITY_SINKS.filter(
      (s) => s.servedRatchetTracked,
    ).length,
    ratchetBlind: EDITORIAL_AUTHORITY_SINKS.filter(
      (s) => !s.servedRatchetTracked,
    ).length,
    duplicates,
  };
}
