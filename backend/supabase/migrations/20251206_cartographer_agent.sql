-- ================================================
-- AI-COS v2.31.0: Agent Cartographe Monorepo
-- Migration Supabase pour le suivi architecture
-- ================================================

-- Table pour stocker les rapports cartographe
CREATE TABLE IF NOT EXISTS ai_cos_cartographer_reports (
    id TEXT PRIMARY KEY,
    report_type TEXT NOT NULL CHECK (report_type IN ('daily', 'weekly', 'pr', 'manual')),
    summary JSONB NOT NULL DEFAULT '{}',
    kpis JSONB NOT NULL DEFAULT '{}',
    recommendations TEXT[] DEFAULT '{}',
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_cartographer_reports_type ON ai_cos_cartographer_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_cartographer_reports_generated ON ai_cos_cartographer_reports(generated_at DESC);

-- Table pour stocker les problèmes détectés
CREATE TABLE IF NOT EXISTS ai_cos_cartographer_issues (
    id TEXT PRIMARY KEY,
    issue_type TEXT NOT NULL CHECK (issue_type IN (
        'circular_dependency',
        'layer_violation',
        'forbidden_import',
        'orphan_package',
        'bundle_bloat',
        'health_warning',
        'health_critical'
    )),
    severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'error', 'critical')),
    data JSONB NOT NULL DEFAULT '{}',
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    resolved_by TEXT,
    resolution_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour filtrer les problèmes
CREATE INDEX IF NOT EXISTS idx_cartographer_issues_type ON ai_cos_cartographer_issues(issue_type);
CREATE INDEX IF NOT EXISTS idx_cartographer_issues_severity ON ai_cos_cartographer_issues(severity);
CREATE INDEX IF NOT EXISTS idx_cartographer_issues_resolved ON ai_cos_cartographer_issues(is_resolved);
CREATE INDEX IF NOT EXISTS idx_cartographer_issues_detected ON ai_cos_cartographer_issues(detected_at DESC);

-- Table pour stocker les exécutions SAGA
CREATE TABLE IF NOT EXISTS ai_cos_saga_executions (
    id SERIAL PRIMARY KEY,
    saga_id TEXT NOT NULL UNIQUE,
    saga_name TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'compensating', 'compensated')),
    report_id TEXT REFERENCES ai_cos_cartographer_reports(id),
    kpis JSONB,
    error TEXT,
    executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour les SAGAs
CREATE INDEX IF NOT EXISTS idx_saga_executions_name ON ai_cos_saga_executions(saga_name);
CREATE INDEX IF NOT EXISTS idx_saga_executions_status ON ai_cos_saga_executions(status);
CREATE INDEX IF NOT EXISTS idx_saga_executions_executed ON ai_cos_saga_executions(executed_at DESC);

-- Table pour les rapports hebdomadaires
CREATE TABLE IF NOT EXISTS ai_cos_weekly_reports (
    id SERIAL PRIMARY KEY,
    saga_id TEXT NOT NULL,
    report_id TEXT NOT NULL REFERENCES ai_cos_cartographer_reports(id),
    executive_summary TEXT,
    comparison JSONB,
    trends JSONB,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour les rapports hebdomadaires
CREATE INDEX IF NOT EXISTS idx_weekly_reports_generated ON ai_cos_weekly_reports(generated_at DESC);

-- Table pour les validations PR
CREATE TABLE IF NOT EXISTS ai_cos_pr_validations (
    id SERIAL PRIMARY KEY,
    pr_number INTEGER NOT NULL,
    pr_branch TEXT,
    base_branch TEXT,
    author TEXT,
    changed_files TEXT[],
    validation_result JSONB NOT NULL,
    is_valid BOOLEAN NOT NULL,
    issues TEXT[],
    warnings TEXT[],
    validated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour les validations PR
CREATE INDEX IF NOT EXISTS idx_pr_validations_number ON ai_cos_pr_validations(pr_number);
CREATE INDEX IF NOT EXISTS idx_pr_validations_valid ON ai_cos_pr_validations(is_valid);
CREATE INDEX IF NOT EXISTS idx_pr_validations_date ON ai_cos_pr_validations(validated_at DESC);

-- Table pour la baseline architecture
CREATE TABLE IF NOT EXISTS ai_cos_architecture_baseline (
    id SERIAL PRIMARY KEY,
    version TEXT NOT NULL,
    packages TEXT[] NOT NULL DEFAULT '{}',
    allowed_dependencies JSONB NOT NULL DEFAULT '{}',
    forbidden_imports JSONB NOT NULL DEFAULT '[]',
    layers JSONB NOT NULL DEFAULT '[]',
    max_bundle_sizes JSONB NOT NULL DEFAULT '{}',
    min_health_scores JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour la baseline
CREATE INDEX IF NOT EXISTS idx_baseline_active ON ai_cos_architecture_baseline(is_active);

-- Table pour l'historique des KPIs cartographe
CREATE TABLE IF NOT EXISTS ai_cos_cartographer_kpi_history (
    id SERIAL PRIMARY KEY,
    circular_deps_count INTEGER NOT NULL DEFAULT 0,
    average_package_health INTEGER NOT NULL DEFAULT 0,
    architecture_drift_count INTEGER NOT NULL DEFAULT 0,
    largest_bundle_size INTEGER NOT NULL DEFAULT 0,
    orphan_packages_count INTEGER NOT NULL DEFAULT 0,
    outdated_deps_count INTEGER NOT NULL DEFAULT 0,
    critical_issues_count INTEGER NOT NULL DEFAULT 0,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour l'historique KPIs
CREATE INDEX IF NOT EXISTS idx_kpi_history_date ON ai_cos_cartographer_kpi_history(recorded_at DESC);

-- ================================================
-- Fonctions utilitaires
-- ================================================

-- Fonction pour obtenir les derniers KPIs
CREATE OR REPLACE FUNCTION get_latest_cartographer_kpis()
RETURNS ai_cos_cartographer_kpi_history AS $$
BEGIN
    RETURN (
        SELECT * FROM ai_cos_cartographer_kpi_history
        ORDER BY recorded_at DESC
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- Fonction pour calculer les tendances KPIs
CREATE OR REPLACE FUNCTION get_cartographer_kpi_trends(days_back INTEGER DEFAULT 7)
RETURNS TABLE (
    metric TEXT,
    current_value NUMERIC,
    previous_value NUMERIC,
    change_percent NUMERIC,
    trend TEXT
) AS $$
DECLARE
    current_kpis ai_cos_cartographer_kpi_history;
    previous_kpis ai_cos_cartographer_kpi_history;
BEGIN
    -- Get current (latest) KPIs
    SELECT * INTO current_kpis
    FROM ai_cos_cartographer_kpi_history
    ORDER BY recorded_at DESC
    LIMIT 1;
    
    -- Get previous KPIs (from N days ago)
    SELECT * INTO previous_kpis
    FROM ai_cos_cartographer_kpi_history
    WHERE recorded_at < NOW() - (days_back || ' days')::INTERVAL
    ORDER BY recorded_at DESC
    LIMIT 1;
    
    IF current_kpis IS NULL THEN
        RETURN;
    END IF;
    
    -- Return trends for each metric
    RETURN QUERY
    SELECT 
        'circular_deps_count'::TEXT,
        current_kpis.circular_deps_count::NUMERIC,
        COALESCE(previous_kpis.circular_deps_count, 0)::NUMERIC,
        CASE WHEN previous_kpis.circular_deps_count > 0 
             THEN ((current_kpis.circular_deps_count - previous_kpis.circular_deps_count)::NUMERIC / previous_kpis.circular_deps_count * 100)
             ELSE 0 END,
        CASE 
            WHEN current_kpis.circular_deps_count < COALESCE(previous_kpis.circular_deps_count, 0) THEN 'improving'
            WHEN current_kpis.circular_deps_count > COALESCE(previous_kpis.circular_deps_count, 0) THEN 'degrading'
            ELSE 'stable'
        END;
    
    RETURN QUERY
    SELECT 
        'average_package_health'::TEXT,
        current_kpis.average_package_health::NUMERIC,
        COALESCE(previous_kpis.average_package_health, 0)::NUMERIC,
        CASE WHEN previous_kpis.average_package_health > 0 
             THEN ((current_kpis.average_package_health - previous_kpis.average_package_health)::NUMERIC / previous_kpis.average_package_health * 100)
             ELSE 0 END,
        CASE 
            WHEN current_kpis.average_package_health > COALESCE(previous_kpis.average_package_health, 0) THEN 'improving'
            WHEN current_kpis.average_package_health < COALESCE(previous_kpis.average_package_health, 0) THEN 'degrading'
            ELSE 'stable'
        END;
END;
$$ LANGUAGE plpgsql STABLE;

-- Fonction pour résoudre un problème
CREATE OR REPLACE FUNCTION resolve_cartographer_issue(
    p_issue_id TEXT,
    p_resolved_by TEXT,
    p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE ai_cos_cartographer_issues
    SET 
        is_resolved = TRUE,
        resolved_at = NOW(),
        resolved_by = p_resolved_by,
        resolution_notes = p_notes
    WHERE id = p_issue_id AND is_resolved = FALSE;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- ================================================
-- Vue pour le dashboard
-- ================================================

CREATE OR REPLACE VIEW v_cartographer_dashboard AS
SELECT
    -- Latest KPIs
    (SELECT circular_deps_count FROM ai_cos_cartographer_kpi_history ORDER BY recorded_at DESC LIMIT 1) AS circular_deps,
    (SELECT average_package_health FROM ai_cos_cartographer_kpi_history ORDER BY recorded_at DESC LIMIT 1) AS avg_health,
    (SELECT architecture_drift_count FROM ai_cos_cartographer_kpi_history ORDER BY recorded_at DESC LIMIT 1) AS drift_count,
    (SELECT largest_bundle_size FROM ai_cos_cartographer_kpi_history ORDER BY recorded_at DESC LIMIT 1) AS bundle_size,
    
    -- Open issues counts
    (SELECT COUNT(*) FROM ai_cos_cartographer_issues WHERE is_resolved = FALSE AND severity = 'critical')::INTEGER AS critical_issues,
    (SELECT COUNT(*) FROM ai_cos_cartographer_issues WHERE is_resolved = FALSE AND severity = 'error')::INTEGER AS error_issues,
    (SELECT COUNT(*) FROM ai_cos_cartographer_issues WHERE is_resolved = FALSE AND severity = 'warning')::INTEGER AS warning_issues,
    
    -- Recent reports
    (SELECT generated_at FROM ai_cos_cartographer_reports ORDER BY generated_at DESC LIMIT 1) AS last_report_at,
    (SELECT COUNT(*) FROM ai_cos_cartographer_reports WHERE generated_at > NOW() - INTERVAL '7 days')::INTEGER AS reports_this_week,
    
    -- PR validations
    (SELECT COUNT(*) FROM ai_cos_pr_validations WHERE validated_at > NOW() - INTERVAL '7 days')::INTEGER AS prs_validated_this_week,
    (SELECT COUNT(*) FROM ai_cos_pr_validations WHERE validated_at > NOW() - INTERVAL '7 days' AND is_valid = TRUE)::INTEGER AS prs_passed_this_week;

-- ================================================
-- RLS Policies
-- ================================================

-- Enable RLS on all tables
ALTER TABLE ai_cos_cartographer_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_cos_cartographer_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_cos_saga_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_cos_weekly_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_cos_pr_validations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_cos_architecture_baseline ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_cos_cartographer_kpi_history ENABLE ROW LEVEL SECURITY;

-- Policies for authenticated users (read all)
CREATE POLICY "Authenticated users can read cartographer reports" ON ai_cos_cartographer_reports
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read cartographer issues" ON ai_cos_cartographer_issues
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read saga executions" ON ai_cos_saga_executions
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read weekly reports" ON ai_cos_weekly_reports
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read PR validations" ON ai_cos_pr_validations
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read architecture baseline" ON ai_cos_architecture_baseline
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read KPI history" ON ai_cos_cartographer_kpi_history
    FOR SELECT TO authenticated USING (true);

-- Policies for service role (full access)
CREATE POLICY "Service role has full access to cartographer reports" ON ai_cos_cartographer_reports
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to cartographer issues" ON ai_cos_cartographer_issues
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to saga executions" ON ai_cos_saga_executions
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to weekly reports" ON ai_cos_weekly_reports
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to PR validations" ON ai_cos_pr_validations
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to architecture baseline" ON ai_cos_architecture_baseline
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to KPI history" ON ai_cos_cartographer_kpi_history
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ================================================
-- Initial seed data
-- ================================================

-- Insert default architecture baseline
INSERT INTO ai_cos_architecture_baseline (
    version,
    packages,
    allowed_dependencies,
    forbidden_imports,
    layers,
    max_bundle_sizes,
    min_health_scores
) VALUES (
    '1.0.0',
    ARRAY['packages/ui', 'packages/design-tokens', 'packages/shared-types', 'packages/typescript-config', 'packages/eslint-config', 'packages/patterns', 'packages/theme-admin', 'packages/theme-vitrine', 'backend', 'frontend'],
    '{"frontend": ["packages/*", "@monorepo/*"], "backend": ["packages/shared-types", "@monorepo/shared-types"], "packages/ui": ["packages/design-tokens", "packages/patterns"]}'::JSONB,
    '[{"from": "frontend", "to": "backend/src", "reason": "Frontend ne doit pas importer backend"}, {"from": "packages/ui", "to": "frontend/app", "reason": "UI ne doit pas dépendre de frontend"}]'::JSONB,
    '[{"name": "ui", "packages": ["packages/ui", "packages/design-tokens"], "canDependOn": ["shared"]}, {"name": "app", "packages": ["frontend", "backend"], "canDependOn": ["ui", "shared"]}, {"name": "shared", "packages": ["packages/shared-types", "packages/patterns"], "canDependOn": []}]'::JSONB,
    '{"frontend": 512000, "backend": 1048576}'::JSONB,
    '{"packages/ui": 80, "packages/shared-types": 90}'::JSONB
) ON CONFLICT DO NOTHING;

-- Insert initial KPIs (baseline)
INSERT INTO ai_cos_cartographer_kpi_history (
    circular_deps_count,
    average_package_health,
    architecture_drift_count,
    largest_bundle_size,
    orphan_packages_count,
    outdated_deps_count,
    critical_issues_count
) VALUES (
    0,  -- Target: 0
    80, -- Target: >80
    0,  -- Target: 0
    384000, -- ~375KB
    1,
    5,
    0
);

-- ================================================
-- Comments
-- ================================================

COMMENT ON TABLE ai_cos_cartographer_reports IS 'Stocke les rapports générés par l''Agent Cartographe (daily/weekly/pr/manual)';
COMMENT ON TABLE ai_cos_cartographer_issues IS 'Stocke tous les problèmes détectés (circular deps, drifts, health issues)';
COMMENT ON TABLE ai_cos_saga_executions IS 'Historique des exécutions SAGA du Cartographe';
COMMENT ON TABLE ai_cos_weekly_reports IS 'Rapports hebdomadaires avec executive summary et trends';
COMMENT ON TABLE ai_cos_pr_validations IS 'Résultats des validations architecture sur les PRs';
COMMENT ON TABLE ai_cos_architecture_baseline IS 'Baseline architecture du monorepo (règles, layers, limites)';
COMMENT ON TABLE ai_cos_cartographer_kpi_history IS 'Historique des KPIs pour tracking des trends';

COMMENT ON VIEW v_cartographer_dashboard IS 'Vue consolidée pour le dashboard Cartographe';
COMMENT ON FUNCTION get_latest_cartographer_kpis() IS 'Retourne les derniers KPIs enregistrés';
COMMENT ON FUNCTION get_cartographer_kpi_trends(INTEGER) IS 'Calcule les tendances KPIs sur N jours';
COMMENT ON FUNCTION resolve_cartographer_issue(TEXT, TEXT, TEXT) IS 'Marque un problème comme résolu';
