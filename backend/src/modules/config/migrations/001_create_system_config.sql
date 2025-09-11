-- Migration pour la table system_config (Enhanced Config Module)
-- Cette migration assure que la table system_config existe avec la structure complète

-- Créer la table si elle n'existe pas
CREATE TABLE IF NOT EXISTS system_config (
    id SERIAL PRIMARY KEY,
    key VARCHAR(255) UNIQUE NOT NULL,
    value JSONB NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'string',
    category VARCHAR(100) NOT NULL DEFAULT 'general',
    description TEXT,
    is_sensitive BOOLEAN DEFAULT FALSE,
    requires_restart BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by VARCHAR(255),
    
    -- Index pour performance
    CONSTRAINT system_config_key_unique UNIQUE (key)
);

-- Créer les index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_system_config_category ON system_config (category);
CREATE INDEX IF NOT EXISTS idx_system_config_active ON system_config (is_active);
CREATE INDEX IF NOT EXISTS idx_system_config_type ON system_config (type);
CREATE INDEX IF NOT EXISTS idx_system_config_sensitive ON system_config (is_sensitive);

-- Ajouter des colonnes manquantes si elles n'existent pas
DO $$ 
BEGIN
    -- Vérifier et ajouter la colonne type si elle n'existe pas
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'system_config' AND column_name = 'type') THEN
        ALTER TABLE system_config ADD COLUMN type VARCHAR(50) NOT NULL DEFAULT 'string';
    END IF;
    
    -- Vérifier et ajouter la colonne category si elle n'existe pas
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'system_config' AND column_name = 'category') THEN
        ALTER TABLE system_config ADD COLUMN category VARCHAR(100) NOT NULL DEFAULT 'general';
    END IF;
    
    -- Vérifier et ajouter la colonne is_sensitive si elle n'existe pas
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'system_config' AND column_name = 'is_sensitive') THEN
        ALTER TABLE system_config ADD COLUMN is_sensitive BOOLEAN DEFAULT FALSE;
    END IF;
    
    -- Vérifier et ajouter la colonne requires_restart si elle n'existe pas
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'system_config' AND column_name = 'requires_restart') THEN
        ALTER TABLE system_config ADD COLUMN requires_restart BOOLEAN DEFAULT FALSE;
    END IF;
    
    -- Vérifier et ajouter la colonne is_active si elle n'existe pas
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'system_config' AND column_name = 'is_active') THEN
        ALTER TABLE system_config ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
    END IF;
    
    -- Vérifier et ajouter la colonne updated_by si elle n'existe pas
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'system_config' AND column_name = 'updated_by') THEN
        ALTER TABLE system_config ADD COLUMN updated_by VARCHAR(255);
    END IF;
END $$;

-- Insérer des configurations par défaut si la table est vide
INSERT INTO system_config (key, value, type, category, description, is_sensitive, requires_restart) 
VALUES 
    ('app.name', '"Mon Application"', 'string', 'application', 'Nom de l''application', false, false),
    ('app.version', '"1.0.0"', 'string', 'application', 'Version de l''application', false, false),
    ('app.debug', 'false', 'boolean', 'application', 'Mode debug activé', false, true),
    ('app.maintenance', 'false', 'boolean', 'application', 'Mode maintenance activé', false, false),
    
    ('cache.ttl', '3600', 'number', 'cache', 'TTL par défaut du cache (secondes)', false, true),
    ('cache.max_size', '1000', 'number', 'cache', 'Taille maximale du cache', false, true),
    
    ('security.jwt_expiry', '86400', 'number', 'security', 'Durée de vie des tokens JWT (secondes)', false, true),
    ('security.password_min_length', '8', 'number', 'security', 'Longueur minimale des mots de passe', false, false),
    ('security.max_login_attempts', '5', 'number', 'security', 'Nombre max de tentatives de connexion', false, false),
    
    ('email.smtp_host', '""', 'string', 'email', 'Serveur SMTP', false, true),
    ('email.smtp_port', '587', 'number', 'email', 'Port SMTP', false, true),
    ('email.from_address', '""', 'string', 'email', 'Adresse d''expédition par défaut', false, false),
    
    ('api.rate_limit', '100', 'number', 'api', 'Limite de requêtes par minute', false, true),
    ('api.max_request_size', '10485760', 'number', 'api', 'Taille max des requêtes (bytes)', false, true),
    
    ('monitoring.enabled', 'true', 'boolean', 'monitoring', 'Monitoring activé', false, true),
    ('monitoring.metrics_interval', '300', 'number', 'monitoring', 'Intervalle de collecte des métriques (secondes)', false, true)
ON CONFLICT (key) DO NOTHING;

-- Fonction pour mettre à jour automatiquement updated_at
CREATE OR REPLACE FUNCTION update_system_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer le trigger si il n'existe pas
DROP TRIGGER IF EXISTS trigger_update_system_config_updated_at ON system_config;
CREATE TRIGGER trigger_update_system_config_updated_at
    BEFORE UPDATE ON system_config
    FOR EACH ROW
    EXECUTE FUNCTION update_system_config_updated_at();

-- Commentaires sur la table et les colonnes
COMMENT ON TABLE system_config IS 'Configuration système centralisée pour l''application';
COMMENT ON COLUMN system_config.key IS 'Clé unique de configuration (format: category.subcategory.name)';
COMMENT ON COLUMN system_config.value IS 'Valeur de configuration stockée en JSONB';
COMMENT ON COLUMN system_config.type IS 'Type de données: string, number, boolean, json, array';
COMMENT ON COLUMN system_config.category IS 'Catégorie de configuration pour regroupement';
COMMENT ON COLUMN system_config.description IS 'Description de la configuration';
COMMENT ON COLUMN system_config.is_sensitive IS 'Indique si la valeur doit être chiffrée';
COMMENT ON COLUMN system_config.requires_restart IS 'Indique si un redémarrage est requis après modification';
COMMENT ON COLUMN system_config.is_active IS 'Indique si la configuration est active';
COMMENT ON COLUMN system_config.updated_by IS 'Utilisateur ayant effectué la dernière modification';

-- Afficher un résumé
SELECT 
    'Migration system_config terminée' as status,
    count(*) as total_configs,
    count(CASE WHEN is_active = true THEN 1 END) as active_configs,
    count(CASE WHEN is_sensitive = true THEN 1 END) as sensitive_configs
FROM system_config;
