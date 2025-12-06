-- =====================================================
-- 📊 SEO Link Tracking - Table pour analytics maillage interne
-- Migration: 002_create_seo_link_tracking.sql
-- Date: 2025-12-02
-- =====================================================

-- Table principale pour tracker les clics sur liens internes
CREATE TABLE IF NOT EXISTS seo_link_clicks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Type de lien (LinkGammeCar, LinkGammeCar_ID, CompSwitch, CrossSelling, VoirAussi, Footer)
    link_type VARCHAR(50) NOT NULL,
    
    -- URL source (page où se trouve le lien)
    source_url TEXT NOT NULL,
    
    -- URL destination (page vers laquelle pointe le lien)
    destination_url TEXT NOT NULL,
    
    -- Texte d'ancrage du lien
    anchor_text VARCHAR(255),
    
    -- Position du lien dans la page (header, content, sidebar, footer, crossselling)
    link_position VARCHAR(50),
    
    -- Session ID pour dédupliquer
    session_id VARCHAR(100),
    
    -- User ID si connecté
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    -- Métadonnées
    user_agent TEXT,
    referer TEXT,
    
    -- Device type (mobile, desktop, tablet)
    device_type VARCHAR(20),
    
    -- 🧪 A/B Testing: Tracking des formulations de switches
    -- Pour mesurer quel combo verbe+nom génère le meilleur CTR
    switch_verb_id INTEGER,           -- ID du verbe utilisé (SGCS_ALIAS=1): Découvrez, Trouvez, etc.
    switch_noun_id INTEGER,           -- ID du nom utilisé (SGCS_ALIAS=2): accessoires, équipements, etc.
    switch_formula VARCHAR(100),      -- Formule complète "verb_id:noun_id" pour analytics
    target_gamme_id INTEGER,          -- ID de la gamme cible du lien
    
    -- Timestamps
    clicked_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_seo_link_clicks_type ON seo_link_clicks(link_type);
CREATE INDEX IF NOT EXISTS idx_seo_link_clicks_source ON seo_link_clicks(source_url);
CREATE INDEX IF NOT EXISTS idx_seo_link_clicks_destination ON seo_link_clicks(destination_url);
CREATE INDEX IF NOT EXISTS idx_seo_link_clicks_date ON seo_link_clicks(clicked_at);
CREATE INDEX IF NOT EXISTS idx_seo_link_clicks_session ON seo_link_clicks(session_id);

-- Index pour A/B testing des formulations
CREATE INDEX IF NOT EXISTS idx_seo_link_clicks_formula ON seo_link_clicks(switch_formula);
CREATE INDEX IF NOT EXISTS idx_seo_link_clicks_gamme ON seo_link_clicks(target_gamme_id);

-- Table agrégée pour les métriques quotidiennes (performance)
CREATE TABLE IF NOT EXISTS seo_link_metrics_daily (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Date du jour
    date DATE NOT NULL,
    
    -- Type de lien
    link_type VARCHAR(50) NOT NULL,
    
    -- Métriques agrégées
    total_clicks INTEGER DEFAULT 0,
    unique_sessions INTEGER DEFAULT 0,
    
    -- Top URLs (JSON array)
    top_destinations JSONB DEFAULT '[]'::jsonb,
    
    -- Par device
    mobile_clicks INTEGER DEFAULT 0,
    desktop_clicks INTEGER DEFAULT 0,
    tablet_clicks INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Contrainte unique pour éviter les doublons
    UNIQUE(date, link_type)
);

CREATE INDEX IF NOT EXISTS idx_seo_link_metrics_date ON seo_link_metrics_daily(date);
CREATE INDEX IF NOT EXISTS idx_seo_link_metrics_type ON seo_link_metrics_daily(link_type);

-- Table pour tracking des impressions (liens affichés mais pas cliqués)
CREATE TABLE IF NOT EXISTS seo_link_impressions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Type de lien
    link_type VARCHAR(50) NOT NULL,
    
    -- Page où le lien est affiché
    page_url TEXT NOT NULL,
    
    -- Nombre de liens de ce type sur la page
    link_count INTEGER DEFAULT 1,
    
    -- Session
    session_id VARCHAR(100),
    
    -- Timestamps
    viewed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seo_impressions_type ON seo_link_impressions(link_type);
CREATE INDEX IF NOT EXISTS idx_seo_impressions_date ON seo_link_impressions(viewed_at);

-- Vue pour calculer le CTR en temps réel
CREATE OR REPLACE VIEW seo_link_ctr AS
SELECT 
    link_type,
    DATE_TRUNC('day', clicked_at) as date,
    COUNT(*) as clicks,
    COUNT(DISTINCT session_id) as unique_clicks
FROM seo_link_clicks
WHERE clicked_at >= NOW() - INTERVAL '30 days'
GROUP BY link_type, DATE_TRUNC('day', clicked_at)
ORDER BY date DESC, link_type;

-- Fonction pour agréger les métriques quotidiennes (cron job)
CREATE OR REPLACE FUNCTION aggregate_seo_link_metrics()
RETURNS void AS $$
DECLARE
    yesterday DATE := CURRENT_DATE - INTERVAL '1 day';
BEGIN
    -- Insérer ou mettre à jour les métriques du jour précédent
    INSERT INTO seo_link_metrics_daily (date, link_type, total_clicks, unique_sessions, mobile_clicks, desktop_clicks, tablet_clicks, top_destinations)
    SELECT 
        yesterday,
        link_type,
        COUNT(*) as total_clicks,
        COUNT(DISTINCT session_id) as unique_sessions,
        COUNT(*) FILTER (WHERE device_type = 'mobile') as mobile_clicks,
        COUNT(*) FILTER (WHERE device_type = 'desktop') as desktop_clicks,
        COUNT(*) FILTER (WHERE device_type = 'tablet') as tablet_clicks,
        (
            SELECT jsonb_agg(row_to_json(t))
            FROM (
                SELECT destination_url, COUNT(*) as clicks
                FROM seo_link_clicks c2
                WHERE c2.link_type = c1.link_type
                  AND DATE(c2.clicked_at) = yesterday
                GROUP BY destination_url
                ORDER BY clicks DESC
                LIMIT 10
            ) t
        ) as top_destinations
    FROM seo_link_clicks c1
    WHERE DATE(clicked_at) = yesterday
    GROUP BY link_type
    ON CONFLICT (date, link_type) 
    DO UPDATE SET 
        total_clicks = EXCLUDED.total_clicks,
        unique_sessions = EXCLUDED.unique_sessions,
        mobile_clicks = EXCLUDED.mobile_clicks,
        desktop_clicks = EXCLUDED.desktop_clicks,
        tablet_clicks = EXCLUDED.tablet_clicks,
        top_destinations = EXCLUDED.top_destinations,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- RLS policies pour sécurité
ALTER TABLE seo_link_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_link_metrics_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_link_impressions ENABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes policies si elles existent
DROP POLICY IF EXISTS "Allow anonymous inserts on seo_link_clicks" ON seo_link_clicks;
DROP POLICY IF EXISTS "Allow admin read on seo_link_clicks" ON seo_link_clicks;
DROP POLICY IF EXISTS "Allow admin read on seo_link_metrics_daily" ON seo_link_metrics_daily;
DROP POLICY IF EXISTS "Allow anonymous inserts on seo_link_impressions" ON seo_link_impressions;
DROP POLICY IF EXISTS "Allow admin read on seo_link_impressions" ON seo_link_impressions;

-- Politique: tout le monde peut insérer (tracking anonyme)
CREATE POLICY "Allow anonymous inserts on seo_link_clicks" 
ON seo_link_clicks FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow anonymous inserts on seo_link_impressions" 
ON seo_link_impressions FOR INSERT 
WITH CHECK (true);

-- Politique: seuls les admins peuvent lire
CREATE POLICY "Allow admin read on seo_link_clicks" 
ON seo_link_clicks FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM auth.users 
        WHERE auth.users.id = auth.uid() 
        AND auth.users.raw_user_meta_data->>'isAdmin' = 'true'
    )
);

-- Même chose pour metrics
CREATE POLICY "Allow admin read on seo_link_metrics_daily" 
ON seo_link_metrics_daily FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM auth.users 
        WHERE auth.users.id = auth.uid() 
        AND auth.users.raw_user_meta_data->>'isAdmin' = 'true'
    )
);

-- Politique pour impressions
CREATE POLICY "Allow admin read on seo_link_impressions" 
ON seo_link_impressions FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM auth.users 
        WHERE auth.users.id = auth.uid() 
        AND auth.users.raw_user_meta_data->>'isAdmin' = 'true'
    )
);

-- Commentaires
COMMENT ON TABLE seo_link_clicks IS 'Tracking des clics sur liens internes pour SEO maillage';
COMMENT ON TABLE seo_link_metrics_daily IS 'Métriques agrégées quotidiennes pour dashboard SEO';
COMMENT ON TABLE seo_link_impressions IS 'Tracking des impressions de liens (pour calcul CTR)';
COMMENT ON VIEW seo_link_ctr IS 'Vue calculant le CTR des liens internes sur 30 jours';

-- =====================================================
-- 🧪 A/B Testing Analytics - Vues pour mesurer CTR par formulation
-- =====================================================

-- Vue: CTR par formulation (verbe+nom) sur 30 jours
CREATE OR REPLACE VIEW seo_ab_testing_formula_ctr AS
SELECT 
    switch_formula,
    switch_verb_id,
    switch_noun_id,
    target_gamme_id,
    COUNT(*) as total_clicks,
    COUNT(DISTINCT session_id) as unique_users,
    DATE_TRUNC('day', clicked_at) as date
FROM seo_link_clicks
WHERE 
    switch_formula IS NOT NULL
    AND clicked_at >= NOW() - INTERVAL '30 days'
GROUP BY switch_formula, switch_verb_id, switch_noun_id, target_gamme_id, DATE_TRUNC('day', clicked_at)
ORDER BY total_clicks DESC;

-- Vue: Performance des verbes (SGCS_ALIAS=1)
CREATE OR REPLACE VIEW seo_ab_testing_verbs AS
SELECT 
    switch_verb_id,
    COUNT(*) as total_clicks,
    COUNT(DISTINCT session_id) as unique_users,
    COUNT(DISTINCT source_url) as pages_sources,
    ROUND(AVG(CASE WHEN device_type = 'mobile' THEN 1 ELSE 0 END) * 100, 2) as mobile_pct
FROM seo_link_clicks
WHERE 
    switch_verb_id IS NOT NULL
    AND clicked_at >= NOW() - INTERVAL '30 days'
GROUP BY switch_verb_id
ORDER BY total_clicks DESC;

-- Vue: Performance des noms (SGCS_ALIAS=2)
CREATE OR REPLACE VIEW seo_ab_testing_nouns AS
SELECT 
    switch_noun_id,
    COUNT(*) as total_clicks,
    COUNT(DISTINCT session_id) as unique_users,
    COUNT(DISTINCT target_gamme_id) as gammes_ciblees
FROM seo_link_clicks
WHERE 
    switch_noun_id IS NOT NULL
    AND clicked_at >= NOW() - INTERVAL '30 days'
GROUP BY switch_noun_id
ORDER BY total_clicks DESC;

-- Vue: Top formulations combinées avec CTR estimé
CREATE OR REPLACE VIEW seo_ab_testing_top_formulas AS
WITH formula_clicks AS (
    SELECT 
        switch_formula,
        COUNT(*) as clicks
    FROM seo_link_clicks
    WHERE switch_formula IS NOT NULL
    GROUP BY switch_formula
),
formula_impressions AS (
    SELECT 
        link_type,
        SUM(link_count) as impressions
    FROM seo_link_impressions
    WHERE link_type = 'LinkGammeCar'
    GROUP BY link_type
)
SELECT 
    fc.switch_formula,
    fc.clicks,
    fi.impressions,
    CASE WHEN fi.impressions > 0 
         THEN ROUND((fc.clicks::numeric / fi.impressions) * 100, 2) 
         ELSE 0 
    END as ctr_pct
FROM formula_clicks fc
CROSS JOIN formula_impressions fi
ORDER BY fc.clicks DESC
LIMIT 20;

COMMENT ON VIEW seo_ab_testing_formula_ctr IS 'CTR par formulation verbe+nom pour A/B testing';
COMMENT ON VIEW seo_ab_testing_verbs IS 'Performance des verbes (Découvrez, Trouvez, etc.)';
COMMENT ON VIEW seo_ab_testing_nouns IS 'Performance des noms (accessoires, équipements, etc.)';
COMMENT ON VIEW seo_ab_testing_top_formulas IS 'Top 20 formulations avec CTR estimé';
