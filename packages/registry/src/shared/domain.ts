import { z } from "zod";

/**
 * Canonical domain IDs for the monorepo, sourced from
 * `.spec/00-canon/db-governance/domain-map.md` v1.4.2 (2026-03-14).
 *
 * D1..D8 = domaines identifiés par confiance C1/C2/C3.
 * 'UNKNOWN' réservé pour signal ambigu — JAMAIS forcer une assignation.
 */
export const DomainIdSchema = z.enum([
  "D1", // Catalog Core (P0, 75 GB, 22 tables)
  "D2", // Legacy/XTR (P2, 25 GB, 18 tables)
  "D3", // SEO/Sitemap (P1, 320 MB, 55 tables)
  "D4", // Vehicle (P0, 130 MB, 12 tables)
  "D5", // (reserved, see domain-map.md)
  "D6", // (reserved, see domain-map.md)
  "D7", // (reserved, see domain-map.md)
  "D8", // (reserved, see domain-map.md)
  "UNKNOWN", // signal ambigu — non résolu, à reviewer
]);

export type DomainId = z.infer<typeof DomainIdSchema>;
