/**
 * Types for Admin Gamme SEO Detail page
 * Extracted from admin.gammes-seo_.$pgId.tsx to reduce file size
 */

// V-Level item representing a vehicle variant ranking
export interface VLevelItem {
  id: number;
  type_id?: string; // auto_type.type_id for stable identification
  gamme_name: string;
  model_name: string;
  brand: string;
  variant_name: string;
  energy: string;
  v_level: string;
  rank: number; // Google Suggest position (1=best, lower is better)
  search_volume: number | null;
  v2_repetitions: number; // Number of gammes where this variant is V2
  updated_at: string | null;
  // Extra fields from __seo_keywords
  keyword?: string;
  generation?: string;
  // Complete vehicle info (from RPC get_vlevel_dashboard joins)
  year_from?: string;
  year_to?: string;
  canon_key?: string; // Canonical key for deduplication
  // NEW: Enriched vehicle label from RPC (MARQUE MODELE engine power (years))
  vehicle_label?: string | null;
  power_hp?: number | null;
  fuel?: string | null;
}

// Freshness status for data staleness indicators
export interface FreshnessStatus {
  status: "unknown" | "fresh" | "stale" | "old";
  color: string;
  text: string;
  icon: string;
  days: number;
}

// Pre-computed freshness data returned from loader (SSR-safe)
export interface LoaderFreshness {
  vLevel: FreshnessStatus;
  articles: FreshnessStatus;
  articleRelativeTime: string;
}

// Vehicle compatibility entry
export interface VehicleEntry {
  cgc_id: number;
  type_id: number;
  type_name: string;
  marque_name: string;
  modele_name: string;
  fuel: string;
  year_from: string;
  year_to: string;
  power_ps: string;
}

// Main gamme detail interface
export interface GammeDetail {
  gamme: {
    pg_id: number;
    pg_name: string;
    pg_alias: string;
    pg_level: string;
    pg_top: string;
    pg_relfollow: string;
    pg_sitemap: string;
    pg_display: string;
    pg_img: string | null;
  };
  seo: {
    sg_id: number | null;
    sg_title: string;
    sg_descrip: string;
    sg_keywords: string;
    sg_h1: string;
    sg_content: string;
  };
  conseils: Array<{
    sgc_id: number;
    sgc_title: string;
    sgc_content: string;
  }>;
  switchGroups: Array<{
    alias: string;
    count: number;
    sample: string;
    name?: string;
    placeholder?: string;
    usedInTemplate?: boolean;
    variations: Array<{ sis_id: number; content: string }>;
  }>;
  familySwitchGroups: Array<{
    alias: string;
    count: number;
    sample: string;
    name?: string;
    placeholder?: string;
    usedInTemplate?: boolean;
    variations: Array<{ id: number; content: string }>;
  }>;
  articles: Array<{
    ba_id: number;
    ba_title: string;
    ba_alias: string;
    ba_preview: string;
    ba_visit: string;
    ba_create: string;
    ba_update: string;
    sections_count: number;
  }>;
  vehicles: {
    level1: VehicleEntry[];
    level2: VehicleEntry[];
    level5: VehicleEntry[];
  };
  vLevel: {
    v1: VLevelItem[];
    v2: VLevelItem[];
    v3: VLevelItem[];
    v4: VLevelItem[];
    v5: VLevelItem[];
  };
  stats: GammeStats;
  purchaseGuide: PurchaseGuideData | null;
}

// Stats section of GammeDetail
export interface GammeStats {
  // Valeurs "verite" (agregats)
  products_count: number;
  vehicles_count?: number;
  content_words?: number;
  vlevel_counts?: {
    V1: number;
    V2: number;
    V3: number;
    V4: number;
    V5: number;
  };
  // Phase 2 Badges
  priority_score?: number;
  catalog_issues?: string[];
  smart_actions?: Array<{ action: string; priority: string }>;
  // Badges v2 (11 badges)
  // Pilotage
  index_policy?: "INDEX" | "SOFT-INDEX" | "NOINDEX";
  final_priority?: "P1" | "P1-PENDING" | "P2" | "P3" | "SOFT-INDEX";
  // Potentiel
  potential_level?: "HIGH" | "MID" | "LOW";
  demand_level?: "HIGH" | "MID" | "LOW";
  difficulty_level?: "EASY" | "MED" | "HARD";
  intent_type?: "BUY" | "COMPARE" | "INFO" | "MIXED";
  // Realite Intra-Gamme
  catalog_status?: "OK" | "LOW" | "EMPTY";
  vehicle_coverage?: "COVERED" | "PARTIAL" | "EMPTY";
  content_depth?: "RICH" | "OK" | "THIN";
  freshness_status?: "FRESH" | "STALE" | "EXPIRED";
  cluster_health?: "STRONG" | "MISSING" | "ISOLATED" | "CANNIBAL";
  topic_purity?: "PURE" | "DILUTED";
  // Executabilite
  execution_status?: "PASS" | "WARN" | "FAIL";
  // Champs existants (backward compatibility)
  articles_count: number;
  vehicles_level1_count: number;
  vehicles_level2_count: number;
  vehicles_level5_count: number;
  vehicles_total_count: number;
  vLevel_v1_count: number;
  vLevel_v2_count: number;
  vLevel_v3_count: number;
  vLevel_v4_count: number;
  vLevel_v5_count: number;
  vLevel_total_count: number;
  vLevel_last_updated: string | null;
  last_article_date: string | null;
  // Keywords SEO (depuis gamme_aggregates via __seo_keywords)
  keyword_total: number;
  kw_v2_count: number;
  kw_v3_count: number;
  kw_v4_count: number;
  kw_v5_count: number;
  g_level: string;
  seo_score: number;
  // Debug (valeurs brutes)
  _debug?: {
    products_direct: number;
    products_via_vehicles: number;
    products_via_family: number;
    seo_content_raw_words: number;
    content_breakdown?: {
      seo: number;
      conseil: number;
      switches: number;
      purchaseGuide: number;
    } | null;
    aggregates_computed_at: string | null;
    source_updated_at: string | null;
    _note?: string;
  };
}

// Interface for Purchase Guide data
export interface PurchaseGuideData {
  id?: number;
  pgId?: string;
  step1: {
    title: string;
    content: string;
    highlight: string;
    bullets?: string[];
  };
  step2: {
    economique: {
      subtitle: string;
      description: string;
      specs: string[];
      priceRange: string;
    };
    qualitePlus: {
      subtitle: string;
      description: string;
      specs: string[];
      priceRange: string;
      badge?: string;
    };
    premium: {
      subtitle: string;
      description: string;
      specs: string[];
      priceRange: string;
    };
  };
  step3: {
    title: string;
    content: string;
    alerts: Array<{ type: "danger" | "warning" | "info"; text: string }>;
    relatedGammes?: Array<{ pgId: number; pgName: string; pgAlias: string }>;
  };
  createdAt?: string;
  updatedAt?: string;
}

// SEO form state
export interface SeoFormState {
  sg_title: string;
  sg_descrip: string;
  sg_keywords: string;
  sg_h1: string;
  sg_content: string;
}

// Energy filter type
export type EnergyFilter = "all" | "diesel" | "essence";
