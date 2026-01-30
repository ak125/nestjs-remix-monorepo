-- Migration: DCO V2 (Design as Continuous Optimization)
-- Date: 2026-01-28
-- Description: Tables for UX Capture, UX Debt, Design Systems, and Performance Gates

-- ============================================================================
-- 1. UX Captures (DevTools snapshots)
-- ============================================================================
CREATE TABLE IF NOT EXISTS __ux_captures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  slug TEXT NOT NULL,
  page_role TEXT NOT NULL CHECK (page_role IN ('R1', 'R2', 'R3', 'R4', 'R5', 'R6')),
  captured_at TIMESTAMPTZ DEFAULT NOW(),

  -- Lighthouse scores (0-100)
  lighthouse_mobile JSONB,
  lighthouse_desktop JSONB,

  -- Core Web Vitals Metrics
  cwv_lcp_ms INTEGER,           -- Largest Contentful Paint (ms)
  cwv_cls DECIMAL(5,4),         -- Cumulative Layout Shift (0.00-1.00+)
  cwv_inp_ms INTEGER,           -- Interaction to Next Paint (ms)
  cwv_ttfb_ms INTEGER,          -- Time to First Byte (ms)
  cwv_fcp_ms INTEGER,           -- First Contentful Paint (ms)
  cwv_tbt_ms INTEGER,           -- Total Blocking Time (ms)

  -- Performance data paths
  performance_trace_path TEXT,   -- Path to trace.json file
  layout_shifts JSONB,           -- Array of layout shift events
  long_tasks JSONB,              -- Array of long tasks (>50ms)
  network_waterfall JSONB,       -- Network requests waterfall
  js_unused_bytes INTEGER,       -- Unused JavaScript bytes
  js_total_bytes INTEGER,        -- Total JavaScript bytes

  -- Screenshots (base64 or path)
  screenshot_mobile TEXT,
  screenshot_desktop TEXT,
  snapshot_dom TEXT,             -- DOM snapshot (accessibility tree)

  -- Metadata
  user_agent TEXT,
  viewport_width INTEGER,
  viewport_height INTEGER,
  device_type TEXT CHECK (device_type IN ('mobile', 'desktop', 'tablet')),

  -- Indexing
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_capture_per_url_time UNIQUE (url, captured_at)
);

COMMENT ON TABLE __ux_captures IS 'UX Reality Captures - DevTools performance snapshots per page';
COMMENT ON COLUMN __ux_captures.page_role IS 'R1=Router, R2=Product, R3=Blog, R4=Reference, R5=Diagnostic, R6=Support';
COMMENT ON COLUMN __ux_captures.cwv_cls IS 'Target: <=0.05 (good), <=0.10 (needs improvement), >0.25 (poor)';
COMMENT ON COLUMN __ux_captures.cwv_lcp_ms IS 'Target: <=2500ms (good), <=4000ms (needs improvement), >4000ms (poor)';
COMMENT ON COLUMN __ux_captures.cwv_inp_ms IS 'Target: <=200ms (good), <=500ms (needs improvement), >500ms (poor)';

-- ============================================================================
-- 2. UX Debt Items
-- ============================================================================
CREATE TABLE IF NOT EXISTS __ux_debt (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capture_id UUID REFERENCES __ux_captures(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  page_role TEXT NOT NULL CHECK (page_role IN ('R1', 'R2', 'R3', 'R4', 'R5', 'R6')),

  -- Issue classification
  issue_type TEXT NOT NULL CHECK (issue_type IN (
    'cwv_lcp', 'cwv_cls', 'cwv_inp', 'cwv_ttfb', 'cwv_fcp',  -- Performance
    'role_violation', 'forbidden_block', 'density_overflow',  -- Role compliance
    'cognitive_load', 'cta_hierarchy', 'cta_missing',         -- UX
    'accessibility', 'contrast', 'touch_target',              -- A11y
    'compatibility_unclear', 'trust_missing'                  -- Conversion
  )),
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  category TEXT NOT NULL CHECK (category IN ('performance', 'compliance', 'conversion', 'accessibility')),

  -- Scoring (0-100)
  impact_score INTEGER CHECK (impact_score >= 0 AND impact_score <= 100),  -- Business impact
  effort_score INTEGER CHECK (effort_score >= 0 AND effort_score <= 100),  -- Dev effort
  roi_score INTEGER GENERATED ALWAYS AS (
    CASE WHEN effort_score > 0 THEN ROUND((impact_score::DECIMAL / effort_score) * 100) ELSE 0 END
  ) STORED,  -- ROI = impact / effort

  -- Details
  title TEXT NOT NULL,
  description TEXT,
  recommendation TEXT,
  affected_element TEXT,      -- CSS selector or component name
  current_value TEXT,         -- Current metric value
  target_value TEXT,          -- Target metric value

  -- Resolution
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'wontfix', 'duplicate')),
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,
  resolution_notes TEXT,
  fix_commit TEXT,            -- Git commit hash if resolved

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE __ux_debt IS 'UX Debt tracking - issues discovered during captures';
COMMENT ON COLUMN __ux_debt.roi_score IS 'Computed: (impact_score / effort_score) * 100 - higher = more valuable to fix';

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION __ux_debt_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_ux_debt_updated_at ON __ux_debt;
CREATE TRIGGER trigger_ux_debt_updated_at
  BEFORE UPDATE ON __ux_debt
  FOR EACH ROW
  EXECUTE FUNCTION __ux_debt_updated_at();

-- ============================================================================
-- 3. Design System Configurations
-- ============================================================================
CREATE TABLE IF NOT EXISTS __ux_design_systems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  page_role TEXT NOT NULL CHECK (page_role IN ('R1', 'R2', 'R3', 'R4', 'R5', 'R6')),
  flow_pack TEXT CHECK (flow_pack IN ('urgence', 'confiance', 'pro_mecano', 'budget', 'diagnostic')),

  -- Pattern
  pattern_name TEXT,
  pattern_description TEXT,
  pattern_sections JSONB,     -- Ordered list of section names

  -- Style
  style_name TEXT,            -- e.g., "Trust-First", "Industrial"
  style_keywords TEXT[],      -- e.g., ['refined', 'luxury', 'verified']
  style_tone TEXT,            -- e.g., "Luxury/Refined", "Industrial/Utilitarian"

  -- Colors (hex)
  color_primary TEXT,
  color_secondary TEXT,
  color_cta TEXT,
  color_background TEXT,
  color_text TEXT,
  color_accent TEXT,
  color_success TEXT DEFAULT '#34C759',
  color_warning TEXT DEFAULT '#FF9500',
  color_error TEXT DEFAULT '#FF3B30',

  -- Typography
  font_heading TEXT,          -- e.g., "Montserrat"
  font_body TEXT,             -- e.g., "DM Sans"
  font_mono TEXT DEFAULT 'Roboto Mono',  -- For OEM references

  -- Effects
  effects JSONB,              -- Animations, transitions, hover states
  anti_patterns TEXT[],       -- What to avoid

  -- Pre-delivery checklist
  checklist JSONB,

  -- Metadata
  is_active BOOLEAN DEFAULT TRUE,
  is_default BOOLEAN DEFAULT FALSE,
  version TEXT DEFAULT '1.0.0',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_default_per_role UNIQUE (page_role, is_default)
    WHERE is_default = TRUE
);

COMMENT ON TABLE __ux_design_systems IS 'Design System configurations per page role and flow pack';
COMMENT ON COLUMN __ux_design_systems.flow_pack IS 'urgence=repair-fast, confiance=trust-first, pro_mecano=dense-technical, budget=value, diagnostic=symptoms';
COMMENT ON COLUMN __ux_design_systems.anti_patterns IS 'AI Slop patterns to avoid: Inter, Roboto, purple gradients, etc.';

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trigger_ux_design_systems_updated_at ON __ux_design_systems;
CREATE TRIGGER trigger_ux_design_systems_updated_at
  BEFORE UPDATE ON __ux_design_systems
  FOR EACH ROW
  EXECUTE FUNCTION __ux_debt_updated_at();

-- ============================================================================
-- 4. Performance Gates
-- ============================================================================
CREATE TABLE IF NOT EXISTS __ux_perf_gates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric TEXT NOT NULL CHECK (metric IN ('lcp', 'cls', 'inp', 'ttfb', 'fcp', 'tbt', 'js_unused')),
  page_role TEXT CHECK (page_role IN ('R1', 'R2', 'R3', 'R4', 'R5', 'R6')),  -- NULL = all roles

  -- Thresholds
  threshold_pass DECIMAL NOT NULL,   -- Green: value <= pass
  threshold_warn DECIMAL NOT NULL,   -- Yellow: pass < value <= warn
  threshold_fail DECIMAL NOT NULL,   -- Red: value > fail

  -- Behavior
  is_blocking BOOLEAN DEFAULT FALSE, -- Block PR/deploy if violated?
  is_active BOOLEAN DEFAULT TRUE,

  -- Metadata
  description TEXT,
  unit TEXT,                         -- 'ms', 'score', 'percent'
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_gate_per_metric_role UNIQUE (metric, page_role)
);

COMMENT ON TABLE __ux_perf_gates IS 'Performance gates for CWV metrics - monitoring or blocking mode';
COMMENT ON COLUMN __ux_perf_gates.is_blocking IS 'If true, violations will block PRs in CI/CD';

-- ============================================================================
-- 5. Seed Default Performance Gates
-- ============================================================================
INSERT INTO __ux_perf_gates (metric, page_role, threshold_pass, threshold_warn, threshold_fail, is_blocking, unit, description) VALUES
  -- Global gates (all page roles)
  ('lcp', NULL, 2500, 4000, 6000, FALSE, 'ms', 'Largest Contentful Paint - target <=2.5s mobile'),
  ('cls', NULL, 0.05, 0.10, 0.25, FALSE, 'score', 'Cumulative Layout Shift - target <=0.05'),
  ('inp', NULL, 200, 300, 500, FALSE, 'ms', 'Interaction to Next Paint - target <=200ms'),
  ('ttfb', NULL, 800, 1800, 3000, FALSE, 'ms', 'Time to First Byte - target <=800ms'),
  ('fcp', NULL, 1800, 3000, 4500, FALSE, 'ms', 'First Contentful Paint - target <=1.8s'),
  ('tbt', NULL, 200, 600, 1000, FALSE, 'ms', 'Total Blocking Time - target <=200ms'),
  ('js_unused', NULL, 30, 40, 50, FALSE, 'percent', 'Unused JavaScript percentage - target <=30%')
ON CONFLICT (metric, page_role) DO NOTHING;

-- ============================================================================
-- 6. Seed Default Design Systems (Pack Confiance for R2)
-- ============================================================================
INSERT INTO __ux_design_systems (
  name, page_role, flow_pack,
  pattern_name, pattern_description, pattern_sections,
  style_name, style_keywords, style_tone,
  color_primary, color_secondary, color_cta, color_background, color_text, color_accent,
  font_heading, font_body,
  effects, anti_patterns, checklist,
  is_active, is_default
) VALUES (
  'Pack Confiance - Expert/R2',
  'R2',
  'confiance',
  'Trust-First + Compatibility',
  'Build trust through verified compatibility, OEM references, and social proof before purchase',
  '["compatibility-hero", "trust-badges", "oem-references", "reviews", "compatibility-sheet", "sticky-cta"]'::JSONB,
  'Luxury/Refined',
  ARRAY['verified', 'trusted', 'premium', 'compatible', 'quality'],
  'Refined with trust signals',
  '#1D1D1F',      -- Primary: Near black
  '#007AFF',      -- Secondary: Trust blue
  '#34C759',      -- CTA: Verified green
  '#FAFAFA',      -- Background: Warm white
  '#1D1D1F',      -- Text: Dark
  '#FF6B35',      -- Accent: Automecanik orange
  'Montserrat',
  'DM Sans',
  '{
    "verified_animation": "fade-in with checkmark scale",
    "compatibility_check": "shake + color transition on verify",
    "hover_states": "subtle shadow elevation",
    "transitions": "200-300ms ease-out",
    "stagger_reveal": "50ms delay per element"
  }'::JSONB,
  ARRAY['Inter', 'Roboto', 'Arial', 'purple gradients', 'generic badges', 'stock photos'],
  '{
    "no_emojis_as_icons": true,
    "cursor_pointer_clickables": true,
    "hover_transitions": "150-300ms",
    "contrast_ratio": "4.5:1 minimum",
    "focus_visible": true,
    "reduced_motion_respect": true,
    "responsive_breakpoints": ["375px", "768px", "1024px", "1440px"]
  }'::JSONB,
  TRUE,
  TRUE
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- 7. Indexes
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_ux_captures_url ON __ux_captures(url);
CREATE INDEX IF NOT EXISTS idx_ux_captures_slug ON __ux_captures(slug);
CREATE INDEX IF NOT EXISTS idx_ux_captures_page_role ON __ux_captures(page_role);
CREATE INDEX IF NOT EXISTS idx_ux_captures_captured_at ON __ux_captures(captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_ux_debt_status ON __ux_debt(status);
CREATE INDEX IF NOT EXISTS idx_ux_debt_severity ON __ux_debt(severity);
CREATE INDEX IF NOT EXISTS idx_ux_debt_category ON __ux_debt(category);
CREATE INDEX IF NOT EXISTS idx_ux_debt_roi ON __ux_debt(roi_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_ux_debt_capture ON __ux_debt(capture_id);
CREATE INDEX IF NOT EXISTS idx_ux_debt_url ON __ux_debt(url);

CREATE INDEX IF NOT EXISTS idx_ux_design_systems_role ON __ux_design_systems(page_role);
CREATE INDEX IF NOT EXISTS idx_ux_design_systems_pack ON __ux_design_systems(flow_pack);
CREATE INDEX IF NOT EXISTS idx_ux_design_systems_active ON __ux_design_systems(is_active) WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_ux_perf_gates_metric ON __ux_perf_gates(metric);
CREATE INDEX IF NOT EXISTS idx_ux_perf_gates_active ON __ux_perf_gates(is_active) WHERE is_active = TRUE;

-- ============================================================================
-- 8. RPC Functions
-- ============================================================================

-- Get UX Debt sorted by ROI (highest value fixes first)
CREATE OR REPLACE FUNCTION get_ux_debt_by_roi(
  p_status TEXT DEFAULT 'open',
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  url TEXT,
  page_role TEXT,
  issue_type TEXT,
  severity TEXT,
  title TEXT,
  recommendation TEXT,
  impact_score INTEGER,
  effort_score INTEGER,
  roi_score INTEGER,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.url,
    d.page_role,
    d.issue_type,
    d.severity,
    d.title,
    d.recommendation,
    d.impact_score,
    d.effort_score,
    d.roi_score,
    d.created_at
  FROM __ux_debt d
  WHERE d.status = p_status
  ORDER BY d.roi_score DESC NULLS LAST, d.severity ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- Get latest capture for a URL
CREATE OR REPLACE FUNCTION get_latest_ux_capture(p_url TEXT)
RETURNS __ux_captures AS $$
BEGIN
  RETURN (
    SELECT c.*
    FROM __ux_captures c
    WHERE c.url = p_url
    ORDER BY c.captured_at DESC
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- Get CWV summary for a page role
CREATE OR REPLACE FUNCTION get_cwv_summary_by_role(p_page_role TEXT DEFAULT NULL)
RETURNS TABLE (
  page_role TEXT,
  capture_count BIGINT,
  avg_lcp_ms DECIMAL,
  avg_cls DECIMAL,
  avg_inp_ms DECIMAL,
  lcp_pass_rate DECIMAL,
  cls_pass_rate DECIMAL,
  inp_pass_rate DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.page_role,
    COUNT(*)::BIGINT as capture_count,
    ROUND(AVG(c.cwv_lcp_ms)::DECIMAL, 0) as avg_lcp_ms,
    ROUND(AVG(c.cwv_cls)::DECIMAL, 4) as avg_cls,
    ROUND(AVG(c.cwv_inp_ms)::DECIMAL, 0) as avg_inp_ms,
    ROUND((COUNT(*) FILTER (WHERE c.cwv_lcp_ms <= 2500)::DECIMAL / NULLIF(COUNT(*), 0)) * 100, 1) as lcp_pass_rate,
    ROUND((COUNT(*) FILTER (WHERE c.cwv_cls <= 0.05)::DECIMAL / NULLIF(COUNT(*), 0)) * 100, 1) as cls_pass_rate,
    ROUND((COUNT(*) FILTER (WHERE c.cwv_inp_ms <= 200)::DECIMAL / NULLIF(COUNT(*), 0)) * 100, 1) as inp_pass_rate
  FROM __ux_captures c
  WHERE (p_page_role IS NULL OR c.page_role = p_page_role)
    AND c.captured_at > NOW() - INTERVAL '30 days'
  GROUP BY c.page_role
  ORDER BY c.page_role;
END;
$$ LANGUAGE plpgsql STABLE;

-- Get design system for page role and flow pack
CREATE OR REPLACE FUNCTION get_design_system(
  p_page_role TEXT,
  p_flow_pack TEXT DEFAULT NULL
)
RETURNS __ux_design_systems AS $$
BEGIN
  RETURN (
    SELECT ds.*
    FROM __ux_design_systems ds
    WHERE ds.page_role = p_page_role
      AND ds.is_active = TRUE
      AND (p_flow_pack IS NULL OR ds.flow_pack = p_flow_pack OR ds.is_default = TRUE)
    ORDER BY
      CASE WHEN ds.flow_pack = p_flow_pack THEN 0 ELSE 1 END,
      ds.is_default DESC
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- Validate capture against performance gates
CREATE OR REPLACE FUNCTION validate_capture_against_gates(p_capture_id UUID)
RETURNS TABLE (
  metric TEXT,
  current_value DECIMAL,
  threshold_pass DECIMAL,
  threshold_warn DECIMAL,
  threshold_fail DECIMAL,
  status TEXT,  -- 'pass', 'warn', 'fail'
  is_blocking BOOLEAN
) AS $$
DECLARE
  v_capture __ux_captures;
BEGIN
  SELECT * INTO v_capture FROM __ux_captures WHERE id = p_capture_id;

  IF v_capture IS NULL THEN
    RAISE EXCEPTION 'Capture not found: %', p_capture_id;
  END IF;

  RETURN QUERY
  SELECT
    g.metric,
    CASE g.metric
      WHEN 'lcp' THEN v_capture.cwv_lcp_ms::DECIMAL
      WHEN 'cls' THEN v_capture.cwv_cls
      WHEN 'inp' THEN v_capture.cwv_inp_ms::DECIMAL
      WHEN 'ttfb' THEN v_capture.cwv_ttfb_ms::DECIMAL
      WHEN 'fcp' THEN v_capture.cwv_fcp_ms::DECIMAL
      WHEN 'tbt' THEN v_capture.cwv_tbt_ms::DECIMAL
      WHEN 'js_unused' THEN
        CASE WHEN v_capture.js_total_bytes > 0
          THEN (v_capture.js_unused_bytes::DECIMAL / v_capture.js_total_bytes * 100)
          ELSE 0
        END
    END as current_value,
    g.threshold_pass,
    g.threshold_warn,
    g.threshold_fail,
    CASE
      WHEN CASE g.metric
        WHEN 'lcp' THEN v_capture.cwv_lcp_ms::DECIMAL
        WHEN 'cls' THEN v_capture.cwv_cls
        WHEN 'inp' THEN v_capture.cwv_inp_ms::DECIMAL
        WHEN 'ttfb' THEN v_capture.cwv_ttfb_ms::DECIMAL
        WHEN 'fcp' THEN v_capture.cwv_fcp_ms::DECIMAL
        WHEN 'tbt' THEN v_capture.cwv_tbt_ms::DECIMAL
        WHEN 'js_unused' THEN
          CASE WHEN v_capture.js_total_bytes > 0
            THEN (v_capture.js_unused_bytes::DECIMAL / v_capture.js_total_bytes * 100)
            ELSE 0
          END
      END <= g.threshold_pass THEN 'pass'
      WHEN CASE g.metric
        WHEN 'lcp' THEN v_capture.cwv_lcp_ms::DECIMAL
        WHEN 'cls' THEN v_capture.cwv_cls
        WHEN 'inp' THEN v_capture.cwv_inp_ms::DECIMAL
        WHEN 'ttfb' THEN v_capture.cwv_ttfb_ms::DECIMAL
        WHEN 'fcp' THEN v_capture.cwv_fcp_ms::DECIMAL
        WHEN 'tbt' THEN v_capture.cwv_tbt_ms::DECIMAL
        WHEN 'js_unused' THEN
          CASE WHEN v_capture.js_total_bytes > 0
            THEN (v_capture.js_unused_bytes::DECIMAL / v_capture.js_total_bytes * 100)
            ELSE 0
          END
      END <= g.threshold_warn THEN 'warn'
      ELSE 'fail'
    END as status,
    g.is_blocking
  FROM __ux_perf_gates g
  WHERE g.is_active = TRUE
    AND (g.page_role IS NULL OR g.page_role = v_capture.page_role);
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- Done
-- ============================================================================
