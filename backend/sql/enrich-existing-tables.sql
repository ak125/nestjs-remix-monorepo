-- 🚗 ENRICHISSEMENT DES TABLES EXISTANTES
-- Utilise les tables auto_* qui fonctionnent déjà parfaitement
-- Ajoute seulement les colonnes manquantes si nécessaire

-- 1. Enrichir auto_marque (si colonnes manquantes)
ALTER TABLE auto_marque 
ADD COLUMN IF NOT EXISTS marque_description TEXT,
ADD COLUMN IF NOT EXISTS marque_website_url TEXT,
ADD COLUMN IF NOT EXISTS marque_country VARCHAR(100),
ADD COLUMN IF NOT EXISTS marque_group_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS marque_seo_title VARCHAR(255),
ADD COLUMN IF NOT EXISTS marque_seo_description TEXT,
ADD COLUMN IF NOT EXISTS marque_seo_keywords TEXT[],
ADD COLUMN IF NOT EXISTS marque_view_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS marque_sort_order INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS marque_is_featured BOOLEAN DEFAULT false;

-- 2. Enrichir auto_modele (si colonnes manquantes)  
ALTER TABLE auto_modele
ADD COLUMN IF NOT EXISTS modele_platform VARCHAR(100),
ADD COLUMN IF NOT EXISTS modele_generation VARCHAR(50),
ADD COLUMN IF NOT EXISTS modele_predecessor_id INTEGER REFERENCES auto_modele(modele_id),
ADD COLUMN IF NOT EXISTS modele_successor_id INTEGER REFERENCES auto_modele(modele_id),
ADD COLUMN IF NOT EXISTS modele_specifications JSONB,
ADD COLUMN IF NOT EXISTS modele_images JSONB,
ADD COLUMN IF NOT EXISTS modele_seo_data JSONB,
ADD COLUMN IF NOT EXISTS modele_view_count INTEGER DEFAULT 0;

-- 3. Enrichir auto_type (si colonnes manquantes)
ALTER TABLE auto_type
ADD COLUMN IF NOT EXISTS type_segment VARCHAR(50), -- 'A', 'B', 'C', 'D', 'E', 'F', 'S', 'M', 'J'
ADD COLUMN IF NOT EXISTS type_category VARCHAR(50), -- 'passenger', 'commercial', 'motorcycle'
ADD COLUMN IF NOT EXISTS type_specifications JSONB,
ADD COLUMN IF NOT EXISTS type_images JSONB,
ADD COLUMN IF NOT EXISTS type_seo_data JSONB,
ADD COLUMN IF NOT EXISTS type_view_count INTEGER DEFAULT 0;

-- 4. Créer table d'historique des marques (nouvelle table légère)
CREATE TABLE IF NOT EXISTS auto_marque_history (
    id SERIAL PRIMARY KEY,
    marque_id INTEGER REFERENCES auto_marque(marque_id),
    event_type VARCHAR(50), -- 'founded', 'merger', 'acquisition', 'discontinued'
    event_date DATE,
    description TEXT,
    related_marque_id INTEGER REFERENCES auto_marque(marque_id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Créer table de statistiques (nouvelle table légère)
CREATE TABLE IF NOT EXISTS auto_marque_stats (
    id SERIAL PRIMARY KEY,
    marque_id INTEGER REFERENCES auto_marque(marque_id) ON DELETE CASCADE,
    year INTEGER,
    models_count INTEGER DEFAULT 0,
    types_count INTEGER DEFAULT 0,
    pieces_count INTEGER DEFAULT 0,
    sales_volume INTEGER,
    market_share DECIMAL(5,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(marque_id, year)
);

-- 6. Index pour les performances (sur les nouvelles colonnes)
CREATE INDEX IF NOT EXISTS idx_auto_marque_featured ON auto_marque(marque_is_featured) WHERE marque_is_featured = true;
CREATE INDEX IF NOT EXISTS idx_auto_marque_sort ON auto_marque(marque_sort_order);
CREATE INDEX IF NOT EXISTS idx_auto_marque_country ON auto_marque(marque_country);
CREATE INDEX IF NOT EXISTS idx_auto_modele_generation ON auto_modele(modele_generation);
CREATE INDEX IF NOT EXISTS idx_auto_type_segment ON auto_type(type_segment);
CREATE INDEX IF NOT EXISTS idx_auto_type_category ON auto_type(type_category);

-- 7. Fonctions pour les slugs (utilise les colonnes existantes)
CREATE OR REPLACE FUNCTION generate_auto_slug(input_text TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN LOWER(
        REGEXP_REPLACE(
            REGEXP_REPLACE(
                UNACCENT(input_text),
                '[^a-zA-Z0-9\s-]', '', 'g'
            ),
            '\s+', '-', 'g'
        )
    );
END;
$$ LANGUAGE plpgsql;

-- 8. Trigger pour auto-générer les slugs (si colonne marque_slug manque)
CREATE OR REPLACE FUNCTION update_auto_marque_slug()
RETURNS TRIGGER AS $$
BEGIN
    -- Si la colonne marque_slug existe, la mettre à jour
    IF column_exists('auto_marque', 'marque_slug') THEN
        IF NEW.marque_slug IS NULL OR NEW.marque_slug = '' THEN
            NEW.marque_slug := generate_auto_slug(NEW.marque_name);
        END IF;
    END IF;
    
    -- Mettre à jour updated_at si la colonne existe
    IF column_exists('auto_marque', 'updated_at') THEN
        NEW.updated_at := NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fonction helper pour vérifier l'existence des colonnes
CREATE OR REPLACE FUNCTION column_exists(table_name TEXT, column_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = $1 
        AND column_name = $2
    );
END;
$$ LANGUAGE plpgsql;

-- 9. Vue pour compatibilité avec le nouveau schéma (si besoin)
CREATE OR REPLACE VIEW manufacturers AS
SELECT 
    marque_id as id,
    marque_code as code,
    marque_name as name,
    marque_name as display_name,
    marque_country as country,
    marque_group_name as group_name,
    CASE 
        WHEN marque_logo IS NOT NULL AND marque_logo != '' 
        THEN 'https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public/uploads/constructeurs-automobiles/marques-logos/' || marque_logo
        ELSE NULL 
    END as logo_url,
    marque_website_url as website_url,
    marque_description as description,
    marque_seo_title as seo_title,
    marque_seo_description as seo_description,
    marque_seo_keywords as seo_keywords,
    marque_slug as slug,
    (marque_activ = '1') as is_active,
    COALESCE(marque_is_featured, false) as is_featured,
    COALESCE(marque_sort_order, 0) as sort_order,
    COALESCE(marque_view_count, 0) as view_count,
    marque_created_at as created_at,
    marque_updated_at as updated_at
FROM auto_marque;

-- Vue pour les modèles
CREATE OR REPLACE VIEW manufacturer_models AS
SELECT 
    modele_id as id,
    modele_marque_id as manufacturer_id,
    null as type_id, -- Peut être mappé si nécessaire
    modele_code as code,
    modele_name as name,
    modele_commercial_name as commercial_name,
    modele_serie as series,
    modele_generation::INTEGER as generation,
    modele_year_from as year_start,
    modele_year_to as year_end,
    ARRAY[]::TEXT[] as markets, -- Peut être enrichi
    (modele_display = 1) as is_active,
    modele_created_at as created_at
FROM auto_modele;

-- 10. Commentaires pour documentation
COMMENT ON TABLE auto_marque IS 'Table des constructeurs automobiles - Enrichie avec colonnes SEO et métadonnées';
COMMENT ON TABLE auto_modele IS 'Table des modèles automobiles - Enrichie avec colonnes génération et spécifications';
COMMENT ON TABLE auto_type IS 'Table des types/motorisations - Enrichie avec catégories et segments';
COMMENT ON TABLE auto_marque_history IS 'Historique des événements des constructeurs';
COMMENT ON TABLE auto_marque_stats IS 'Statistiques annuelles des constructeurs';
COMMENT ON VIEW manufacturers IS 'Vue de compatibilité pour le nouveau schéma manufacturers';
COMMENT ON VIEW manufacturer_models IS 'Vue de compatibilité pour le nouveau schéma manufacturer_models';
