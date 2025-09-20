-- 🔐 Table password_resets pour PasswordService
-- À exécuter dans Supabase SQL Editor

-- Créer la table password_resets
CREATE TABLE IF NOT EXISTS password_resets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    used_at TIMESTAMP WITH TIME ZONE NULL,
    
    -- Contrainte de clé étrangère vers la table utilisateurs (corrigée)
    FOREIGN KEY (user_id) REFERENCES ___xtr_customer(cst_id) ON DELETE CASCADE
);

-- Créer les index pour performance (séparément)
CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets (token);
CREATE INDEX IF NOT EXISTS idx_password_resets_user_id ON password_resets (user_id);
CREATE INDEX IF NOT EXISTS idx_password_resets_expires_at ON password_resets (expires_at);
CREATE INDEX IF NOT EXISTS idx_password_resets_used ON password_resets (used);

-- Ajouter une politique RLS (Row Level Security) si nécessaire
-- ALTER TABLE password_resets ENABLE ROW LEVEL SECURITY;

-- Créer un trigger pour nettoyer automatiquement les tokens expirés (optionnel)
CREATE OR REPLACE FUNCTION cleanup_expired_password_resets()
RETURNS void AS $$
BEGIN
    DELETE FROM password_resets 
    WHERE expires_at < NOW() - INTERVAL '1 day';
END;
$$ LANGUAGE plpgsql;

-- Programmer le nettoyage automatique (optionnel - nécessite pg_cron extension)
-- SELECT cron.schedule('cleanup-password-resets', '0 2 * * *', 'SELECT cleanup_expired_password_resets();');

-- Ajouter une colonne password_changed_at à la table utilisateurs si elle n'existe pas
ALTER TABLE ___xtr_customer 
ADD COLUMN IF NOT EXISTS cst_password_changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Créer un index sur cette colonne pour performance
CREATE INDEX IF NOT EXISTS idx_customer_password_changed_at 
ON ___xtr_customer(cst_password_changed_at);

-- Vérifier la structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'password_resets'
ORDER BY ordinal_position;

-- Test de la table
-- INSERT INTO password_resets (user_id, token, expires_at) 
-- VALUES ('test-user-id', 'test-token-hash', NOW() + INTERVAL '1 hour');

-- SELECT * FROM password_resets WHERE user_id = 'test-user-id';

-- Nettoyer le test
-- DELETE FROM password_resets WHERE user_id = 'test-user-id';
