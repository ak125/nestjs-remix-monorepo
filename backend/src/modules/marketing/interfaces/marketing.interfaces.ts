export interface MarketingCampaign {
  id: number;
  name: string;
  type: 'backlink' | 'guest_post' | 'outreach' | 'linkbait';
  status: 'draft' | 'active' | 'paused' | 'completed';
  goal_backlinks: number;
  goal_da_min: number;
  start_date: string | null;
  end_date: string | null;
  budget_euros: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MarketingBacklink {
  id: number;
  campaign_id: number | null;
  source_url: string;
  source_domain: string;
  target_url: string;
  anchor_text: string | null;
  anchor_type: 'brand' | 'product' | 'instructional' | 'url' | 'generic' | null;
  link_type: 'dofollow' | 'nofollow' | 'ugc' | 'sponsored';
  status: 'live' | 'lost' | 'pending' | 'broken';
  da_score: number | null;
  dr_score: number | null;
  first_seen: string | null;
  last_checked: string | null;
  source_category:
    | 'forum'
    | 'blog'
    | 'annuaire'
    | 'media'
    | 'garage'
    | 'other'
    | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MarketingContentRoadmap {
  id: number;
  title: string;
  slug: string | null;
  content_type: 'glossary' | 'guide' | 'advice' | 'diagnostic' | 'linkbait';
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'planned' | 'writing' | 'review' | 'published' | 'cancelled';
  target_family: string | null;
  pg_id: number | null;
  blog_advice_id: number | null;
  seo_observable_id: number | null;
  seo_reference_id: number | null;
  estimated_words: number;
  assigned_to: string | null;
  deadline: string | null;
  ga4_traffic: number | null;
  backlink_potential: 'high' | 'medium' | 'low' | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MarketingKpiSnapshot {
  id: number;
  snapshot_date: string;
  referring_domains: number;
  total_backlinks: number;
  backlinks_da30plus: number;
  organic_traffic: number;
  diagnostic_anchors: number;
  indexed_pages: number;
  avg_position: number | null;
  content_coverage_pct: number | null;
  outreach_sent: number;
  outreach_accepted: number;
  guest_posts_published: number;
  notes: string | null;
  created_at: string;
}

export interface BacklinkFilters {
  status?: string;
  min_da?: number;
  domain?: string;
  source_category?: string;
  page?: number;
  limit?: number;
}

export interface RoadmapFilters {
  content_type?: string;
  priority?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface BacklinkStats {
  total: number;
  live: number;
  lost: number;
  pending: number;
  broken: number;
  da30plus: number;
  uniqueDomains: number;
  byCategory: Record<string, number>;
}

export interface MarketingDashboard {
  backlinks: {
    total: number;
    live: number;
    da30plus: number;
    uniqueDomains: number;
  };
  outreach: { sent: number; accepted: number; responseRate: number };
  content: { total: number; published: number; coverage_pct: number };
  campaigns: { active: number; total: number };
}

export interface CoverageAnalysis {
  total_gammes: number;
  gammes_with_advice: number;
  gammes_with_reference: number;
  gammes_with_diagnostic: number;
  gammes_with_roadmap: number;
  coverage_pct: number;
  gaps: GammeGap[];
}

export interface GammeGap {
  pg_id: number;
  pg_name: string;
  pg_alias: string;
  has_advice: boolean;
  has_reference: boolean;
  has_diagnostic: boolean;
  has_roadmap: boolean;
}

// ── Pipeline-driven Roadmap types ──

export type PipelineRunStatus =
  | 'auto_published'
  | 'published'
  | 'draft'
  | 'failed'
  | 'skipped'
  | null;

export interface GammePipelineStatus {
  pg_id: number;
  pg_name: string;
  pg_alias: string;
  r1_pieces: PipelineRunStatus;
  r3_conseils: PipelineRunStatus;
  r3_guide_achat: PipelineRunStatus;
  r4_reference: PipelineRunStatus;
  has_conseil: boolean;
  has_purchase_guide: boolean;
  has_reference: boolean;
  has_diagnostic: boolean;
  pipeline_last_run: string | null;
  pipeline_overall:
    | 'published'
    | 'in_progress'
    | 'pending'
    | 'failed'
    | 'skipped';
}

export interface PipelineStatusResult {
  gammes: GammePipelineStatus[];
  summary: {
    total: number;
    published: number;
    in_progress: number;
    failed: number;
    skipped: number;
    pending: number;
  };
}

export interface GammeGapV2 extends GammeGap {
  has_conseil_seo: boolean;
  has_purchase_guide: boolean;
}

export interface CoverageAnalysisV2 extends Omit<CoverageAnalysis, 'gaps'> {
  gammes_with_conseil_seo: number;
  gammes_with_purchase_guide: number;
  gaps: GammeGapV2[];
}
