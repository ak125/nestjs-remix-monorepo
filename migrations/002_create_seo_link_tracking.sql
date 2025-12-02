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

-- Politique: tout le monde peut insérer (tracking anonyme)
CREATE POLICY "Allow anonymous inserts on seo_link_clicks" 
ON seo_link_clicks FOR INSERT 
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

-- Commentaires
COMMENT ON TABLE seo_link_clicks IS 'Tracking des clics sur liens internes pour SEO maillage';
COMMENT ON TABLE seo_link_metrics_daily IS 'Métriques agrégées quotidiennes pour dashboard SEO';
COMMENT ON TABLE seo_link_impressions IS 'Tracking des impressions de liens (pour calcul CTR)';
COMMENT ON VIEW seo_link_ctr IS 'Vue calculant le CTR des liens internes sur 30 jours';
