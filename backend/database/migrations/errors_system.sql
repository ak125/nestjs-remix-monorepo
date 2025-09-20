-- Tables pour le système de gestion des erreurs et redirections

-- Table pour les logs d'erreurs
CREATE TABLE IF NOT EXISTS error_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    error_code VARCHAR(100) NOT NULL,
    error_message TEXT NOT NULL,
    stack_trace TEXT,
    user_id VARCHAR(100),
    user_agent TEXT,
    ip_address INET,
    request_url TEXT,
    request_method VARCHAR(10),
    request_body JSONB,
    request_headers JSONB,
    response_status INTEGER,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    environment VARCHAR(50) NOT NULL DEFAULT 'development',
    service_name VARCHAR(100) NOT NULL DEFAULT 'nestjs-remix-monorepo',
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved BOOLEAN NOT NULL DEFAULT FALSE,
    resolved_by VARCHAR(100),
    resolved_at TIMESTAMPTZ,
    tags TEXT[],
    correlation_id VARCHAR(100),
    session_id VARCHAR(100),
    additional_context JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour optimiser les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_error_logs_timestamp ON error_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_error_logs_error_code ON error_logs(error_code);
CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON error_logs(severity);
CREATE INDEX IF NOT EXISTS idx_error_logs_resolved ON error_logs(resolved);
CREATE INDEX IF NOT EXISTS idx_error_logs_environment ON error_logs(environment);
CREATE INDEX IF NOT EXISTS idx_error_logs_correlation_id ON error_logs(correlation_id);

-- Table pour les règles de redirection
CREATE TABLE IF NOT EXISTS redirect_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_path TEXT NOT NULL,
    destination_path TEXT NOT NULL,
    status_code INTEGER NOT NULL DEFAULT 302 CHECK (status_code IN (301, 302, 307, 308)),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_regex BOOLEAN NOT NULL DEFAULT FALSE,
    priority INTEGER NOT NULL DEFAULT 0,
    description TEXT,
    hit_count INTEGER NOT NULL DEFAULT 0,
    last_hit TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour optimiser les redirections
CREATE INDEX IF NOT EXISTS idx_redirect_rules_source_path ON redirect_rules(source_path);
CREATE INDEX IF NOT EXISTS idx_redirect_rules_active ON redirect_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_redirect_rules_priority ON redirect_rules(priority);
CREATE INDEX IF NOT EXISTS idx_redirect_rules_regex ON redirect_rules(is_regex);

-- Fonction pour mettre à jour automatiquement updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers pour auto-update des timestamps
CREATE TRIGGER update_error_logs_updated_at 
    BEFORE UPDATE ON error_logs 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_redirect_rules_updated_at 
    BEFORE UPDATE ON redirect_rules 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Quelques redirections par défaut utiles
INSERT INTO redirect_rules (source_path, destination_path, status_code, description, priority) VALUES
('/admin', '/dashboard', 301, 'Redirection vers le nouveau dashboard admin', 100),
('/support', '/contact', 302, 'Redirection temporaire vers la page de contact', 90),
('/help', '/guides', 301, 'Redirection vers les guides d''aide', 80),
('/faq', '/support/faq', 301, 'Redirection vers la FAQ du support', 70)
ON CONFLICT DO NOTHING;

-- Vues utiles pour les rapports
CREATE OR REPLACE VIEW error_summary AS
SELECT 
    error_code,
    error_message,
    severity,
    COUNT(*) as total_occurrences,
    MIN(timestamp) as first_occurrence,
    MAX(timestamp) as last_occurrence,
    COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL) as affected_users,
    COUNT(*) FILTER (WHERE resolved = false) as unresolved_count
FROM error_logs 
GROUP BY error_code, error_message, severity
ORDER BY total_occurrences DESC;

CREATE OR REPLACE VIEW redirect_stats AS
SELECT 
    source_path,
    destination_path,
    status_code,
    hit_count,
    last_hit,
    is_active,
    description
FROM redirect_rules
ORDER BY hit_count DESC, last_hit DESC;

-- Commentaires sur les tables
COMMENT ON TABLE error_logs IS 'Table de stockage des logs d''erreurs avec contexte complet';
COMMENT ON TABLE redirect_rules IS 'Table de gestion des règles de redirection avec compteurs de hits';
COMMENT ON VIEW error_summary IS 'Vue agrégée des erreurs pour reporting et analyse';
COMMENT ON VIEW redirect_stats IS 'Vue des statistiques de redirection pour monitoring';
