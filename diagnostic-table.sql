-- 🔍 SCRIPT DE DIAGNOSTIC DE LA TABLE
-- Exécuter ce script en premier pour voir la vraie structure

-- 1. Vérifier que la table existe
SELECT 
    table_name,
    table_type
FROM information_schema.tables
WHERE table_name = '___xtr_customer';

-- 2. Lister TOUTES les colonnes de la table
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    ordinal_position
FROM information_schema.columns
WHERE table_name = '___xtr_customer'
ORDER BY ordinal_position;

-- 3. Compter les utilisateurs existants
SELECT COUNT(*) as total_users FROM "___xtr_customer";

-- 4. Voir un exemple d'utilisateur existant (pour comprendre le format)
SELECT * FROM "___xtr_customer" LIMIT 1;

-- 5. Vérifier si l'utilisateur test existe déjà
SELECT COUNT(*) as user_exists 
FROM "___xtr_customer" 
WHERE cst_id = 'test-user-456' OR cst_mail = 'test456@example.com';
