// ===== Marketing Hub Interfaces — aligned with DB CHECK constraints =====

// ── Enums alignes DB ──

export type SocialChannel = 'instagram' | 'facebook' | 'youtube';
export type ContentPillar = 'catalogue' | 'conseil' | 'confiance' | 'promo';
export type PostStatus =
  | 'draft'
  | 'generated'
  | 'gate_pending'
  | 'gate_passed'
  | 'gate_failed'
  | 'approved'
  | 'published'
  | 'archived';
export type PostObjective =
  | 'traffic'
  | 'engagement'
  | 'conversion'
  | 'awareness';
export type GateLevel = 'PASS' | 'WARN' | 'FAIL';
export type BrandRuleType =
  | 'tone'
  | 'forbidden_word'
  | 'required_element'
  | 'legal'
  | 'visual'
  | 'claims_policy';
export type BrandRuleSeverity = 'block' | 'warn' | 'info';
export type ContentSource =
  | 'gamme_catalogue'
  | 'blog_advice'
  | 'blog_guide'
  | 'promo'
  | 'trust_review'
  | 'seo_recycle';

// ── Template Key (composable) ──

export type TemplateLength = 'short' | 'standard' | 'long';
export type TemplateKey = `${ContentPillar}:${SocialChannel}:${TemplateLength}`;

export interface TemplateContext {
  gamme_name: string;
  gamme_alias: string;
  vehicles?: string[];
  key_selling_points: string[];
  price_range?: string;
  source_url: string;
  utm_link: string;
  format: string;
  dimensions?: string;
  week_iso: string;
  pillar: ContentPillar;
  // Social proof (confiance)
  top_review?: { rating: number; text: string; verified: boolean };
  trust_stats?: {
    total_products: number;
    total_users: number;
    years_active: number;
  };
  // Recyclage SEO
  blog_excerpt?: string;
  guide_excerpt?: string;
}

// ── Contenu par canal ──

export interface InstagramContent {
  caption: string;
  hashtags: string[];
  format: 'carrousel' | 'post' | 'reel' | 'story';
  dimensions: '1080x1080' | '1080x1350' | '1080x1920';
  visual_brief?: string;
  alt_text?: string;
}

export interface FacebookContent {
  caption: string;
  hashtags: string[];
  format: 'post' | 'story' | 'reel';
  link_preview: boolean;
}

export interface YouTubeContent {
  title: string;
  description: string;
  tags: string[];
  format: 'short' | 'video_long';
  hook_script?: string;
  thumbnail_brief?: string;
}

export interface ChannelVariants {
  instagram?: InstagramContent;
  facebook?: FacebookContent;
  youtube?: YouTubeContent;
}

// ── UTM ──

export interface UTMParams {
  utm_campaign: string; // mktg_{week}_{pillar}_{gamme}
  utm_source: SocialChannel;
  utm_medium: 'social';
  utm_content?: string; // hash unique pour A/B
}

export interface UTMLink {
  base_url: string;
  params: UTMParams;
  full_url: string;
}

// ── Gates (pattern PASS/WARN/FAIL) ──

export interface GateViolation {
  rule_key: string;
  rule_type: BrandRuleType;
  severity: BrandRuleSeverity;
  message: string;
  snippet?: string;
  fix_suggestion?: string;
}

export interface BrandGateResult {
  level: GateLevel;
  violations: GateViolation[];
  warnings: GateViolation[];
  fix_suggestions: string[];
}

export interface ComplianceCheck {
  check: string;
  level: GateLevel;
  details: string;
}

export interface ComplianceGateResult {
  level: GateLevel;
  checks: ComplianceCheck[];
}

export interface GateSummary {
  brand: BrandGateResult;
  compliance: ComplianceGateResult;
  can_approve: boolean; // true si AUCUN FAIL
  blocking_issues: string[];
}

// ── Brief & Plan ──

export interface PostBrief {
  topic: string;
  angle: string;
  gamme_id: number | null;
  gamme_alias: string | null;
  content_source: ContentSource;
  source_url: string;
  target_channels: SocialChannel[];
  objective: PostObjective;
  cta_type: 'lien_bio' | 'sauvegarde' | 'partage' | 'commentaire' | 'achat';
  key_selling_points: string[];
  visual_direction: string;
  // Claims policy
  price_source?: { value: string; table: string; updated_at: string };
  delivery_conditions?: string;
}

export interface DaySlot {
  day_of_week: number;
  date_iso: string;
  pillar: ContentPillar;
  optimal_hour: string;
  brief: PostBrief;
}

export interface WeeklyPlan {
  id: number;
  week_iso: string;
  priority_gammes: PriorityGamme[];
  calendar_rules: CalendarRules;
  plan_json: DaySlot[];
  status: 'draft' | 'reviewed' | 'approved' | 'in_progress' | 'completed';
  posts_generated: number;
  posts_approved: number;
  posts_published: number;
}

export interface PriorityGamme {
  pg_id: number;
  pg_alias: string;
  pg_name: string;
  reason: 'high_traffic' | 'low_coverage' | 'seasonal' | 'trending' | 'manual';
  search_volume?: number;
}

export interface CalendarRules {
  posting_days: number[];
  pillar_schedule: Record<number, ContentPillar>;
  excluded_dates: string[];
  optimal_hours: Record<number, string>;
  max_posts_per_day: number;
}

// ── Publish Manifest ──

export interface PublishManifest {
  week_iso: string;
  channel: SocialChannel;
  generated_at: string;
  posts: Array<{
    post_id: number;
    scheduled_date: string;
    scheduled_time: string;
    caption: string;
    hashtags: string[];
    link: string;
    format: string;
    visual_brief: string;
  }>;
}

// ── Social Post (DB row) ──

export interface SocialPost {
  id: number;
  week_iso: string;
  day_of_week: number;
  slot_label: ContentPillar;
  channels: ChannelVariants;
  primary_channel: SocialChannel;
  channels_list: SocialChannel[];
  gamme_id: number | null;
  gamme_alias: string | null;
  content_source: ContentSource | null;
  source_url: string | null;
  reused: boolean;
  utm_campaign: string;
  utm_source: string;
  utm_medium: string;
  utm_content: string | null;
  objective: PostObjective;
  expected_reach: number | null;
  expected_clicks: number | null;
  brand_gate_level: GateLevel | null;
  compliance_gate_level: GateLevel | null;
  gate_summary: GateSummary | null;
  quality_score: number | null;
  status: PostStatus;
  approved_by: string | null;
  approved_at: string | null;
  published_at: string | null;
  ai_provider: string | null;
  ai_model: string | null;
  generation_prompt_hash: string | null;
  performance_score: number | null;
  actual_reach: number | null;
  actual_clicks: number | null;
  actual_engagement_rate: number | null;
  actual_conversions: number | null;
  performance_updated_at: string | null;
  created_at: string;
  updated_at: string;
}

// ── Brand Rule (DB row) ──

export interface BrandRule {
  id: number;
  rule_type: BrandRuleType;
  channel: SocialChannel | null;
  rule_key: string;
  rule_value: Record<string, unknown>;
  severity: BrandRuleSeverity;
  active: boolean;
  created_at: string;
}
