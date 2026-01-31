/**
 * Section K - V-Level Conformity Types
 *
 * STATUS = (missing == 0 AND extras == 0) → CONFORME
 */

export interface SectionKMetrics {
  pg_id: number;
  gamme_name: string;
  /** T-A: type_ids distincts dans catalogue (avec auto_type valide) */
  catalog_valid: number;
  /** T-B: type_ids couverts par V2+V3 (confidence >= 0.9) */
  covered_v2v3: number;
  /** T-C: catalog_valid - covered_v2v3 */
  expected_v4: number;
  /** T-D: type_ids actuellement V4 (confidence >= 0.9) */
  actual_v4: number;
  /** T-E: expected_v4 - actual_v4 (manquants) */
  missing: number;
  /** T-F: actual_v4 - expected_v4 (extras) */
  extras: number;
  /** CONFORME si missing=0 AND extras=0 */
  status: 'CONFORME' | 'NON_CONFORME';
}

export interface MissingTypeId {
  pg_id: number;
  type_id: string;
  modele_name: string;
  type_name: string;
  type_fuel: string;
}

export interface ExtraTypeId {
  pg_id: number;
  type_id: string;
  keyword_id: number;
  keyword: string;
}

export interface SectionKKpis {
  total: number;
  conformes: number;
  nonConformes: number;
  coverageGlobal: string;
}

export interface SectionKResponse {
  metrics: SectionKMetrics[];
  kpis: SectionKKpis;
}
