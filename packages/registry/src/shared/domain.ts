import { z } from "zod";

/**
 * Canonical domain IDs for the monorepo, sourced from
 * `.spec/00-canon/db-governance/domain-map.md` v1.4.2 (2026-03-14).
 *
 * **Schema canon coverage extended in PR-D after real-world overlay seeding**
 * discovered that domain-map.md actually lists D1..D15 (with D9 reserved
 * for Import/ETL). PR-B initially only declared D1..D8 from a partial reading.
 * Since `@repo/registry@0.1.0` was still in `proposed` (pre-merge) state,
 * extending the enum is a pre-merge correction, not a Schema Evolution policy
 * minor bump (which applies after `accepted` status).
 *
 * D16 Maintenance added 2026-05-18 (Diagnostic Control Plane V1 — PR-A) to
 * decouple preventive-maintenance engine from D4 (Vehicle) / D7 (KG-Diagnostic).
 * Pre-merge correction (registry still `0.1.0` proposed) — no schema evolution
 * minor bump required.
 *
 * D1..D16 = domaines identifiés (D1..D15 par domain-map.md v1.4.2, D16 ajout
 * Diagnostic Control Plane V1). 'UNKNOWN' réservé pour signal ambigu — JAMAIS
 * forcer une assignation (cf. invariant V1-3 ADR-058).
 */
export const DomainIdSchema = z.enum([
  "D1",  // Catalog Core (P0, 75 GB, 22 tables)
  "D2",  // Legacy/XTR — Migration PrestaShop (P2, 25 GB, 18 tables)
  "D3",  // SEO & Sitemap (P1, 320 MB, 55 tables)
  "D4",  // Vehicle / Compatibility (P0, 130 MB, 12 tables)
  "D5",  // Blog / Content
  "D6",  // RAG & AI Engine
  "D7",  // Knowledge Graph & Diagnostic
  "D8",  // Read Model / Serving (RM)
  "D9",  // Import / ETL / Normalisation
  "D10", // Quality, Monitoring & Observabilité
  "D11", // Commerce & Users
  "D12", // Marketing & Video
  "D13", // Config & System
  "D14", // Gamme Aggregates & V-Level (cross-cutting)
  "D15", // Security & Governance
  "D16", // Maintenance (preventive : service interval, oil spec, schedule)
  "UNKNOWN", // signal ambigu — non résolu, à reviewer
]);

export type DomainId = z.infer<typeof DomainIdSchema>;
