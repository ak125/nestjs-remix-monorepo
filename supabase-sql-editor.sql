-- 🔍 ÉDITEUR SQL SUPABASE - REQUÊTES UTILES
-- Copier-coller ces requêtes dans l'éditeur SQL de Supabase

-- ==========================================
-- 1. CRÉATION DE L'UTILISATEUR TEST
-- ==========================================

-- Supprimer l'utilisateur s'il existe déjà
DELETE FROM "___xtr_customer" WHERE cst_id = 'test-user-456';

-- Créer l'utilisateur test avec les colonnes existantes uniquement
INSERT INTO "___xtr_customer" (
    cst_id,
    cst_mail,
    cst_fname,
    cst_name,
    cst_pswd,
    cst_is_pro,
    cst_activ,
    cst_phone,
    cst_address,
    cst_city,
    cst_postal_code,
    cst_country,
    cst_birth_date,
    cst_gender,
    cst_newsletter,
    cst_login_count,
    cst_notes
) VALUES (
    'test-user-456',
    'test456@example.com',
    'John',
    'Doe',
    '$2b$10$example.hash.for.password123',
    'false',
    'true',
    '+33123456789',
    '123 rue de la Test',
    'Paris',
    '75001',
    'France',
    '1990-01-01',
    'M',
    'true',
    0,
    'Utilisateur créé pour les tests'
);

-- Vérifier que l'utilisateur a été créé
SELECT * FROM "___xtr_customer" WHERE cst_id = 'test-user-456';

-- ==========================================
-- 2. REQUÊTES DE VÉRIFICATION
-- ==========================================

-- Vérifier la structure de la table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = '___xtr_customer'
ORDER BY ordinal_position;

-- Compter le nombre total d'utilisateurs
SELECT COUNT(*) as total_users FROM "___xtr_customer";

-- Lister les 10 premiers utilisateurs
SELECT cst_id, cst_mail, cst_fname, cst_name, cst_activ
FROM "___xtr_customer"
ORDER BY cst_id DESC
LIMIT 10;

-- Vérifier les utilisateurs actifs
SELECT cst_id, cst_mail, cst_fname, cst_name
FROM "___xtr_customer"
WHERE cst_activ = 'true'
ORDER BY cst_id DESC;

-- ==========================================
-- 3. REQUÊTES DE DIAGNOSTIC
-- ==========================================

-- Vérifier si l'utilisateur test existe
SELECT 
    cst_id,
    cst_mail,
    cst_fname,
    cst_name,
    cst_activ
FROM "___xtr_customer"
WHERE cst_id = 'test-user-456' OR cst_mail = 'test456@example.com';

-- Vérifier la validité des mots de passe (longueur bcrypt)
SELECT 
    cst_id,
    cst_mail,
    LENGTH(cst_pswd) as password_length,
    LEFT(cst_pswd, 10) as password_prefix
FROM "___xtr_customer"
WHERE cst_id = 'test-user-456';

-- Vérifier les utilisateurs récents (basé sur l'ID)
SELECT 
    cst_id,
    cst_mail,
    cst_fname,
    cst_name
FROM "___xtr_customer"
WHERE cst_id LIKE '%test%' OR cst_mail LIKE '%@example.com'
ORDER BY cst_id DESC;

-- ==========================================
-- 4. REQUÊTES DE MAINTENANCE
-- ==========================================

-- Mise à jour du mot de passe de l'utilisateur test
UPDATE "___xtr_customer"
SET cst_pswd = '$2b$10$example.hash.for.password123'
WHERE cst_id = 'test-user-456';

-- Activer l'utilisateur test
UPDATE "___xtr_customer"
SET cst_activ = 'true'
WHERE cst_id = 'test-user-456';

-- Mettre à jour les informations de l'utilisateur test
UPDATE "___xtr_customer"
SET cst_fname = 'John',
    cst_name = 'Doe',
    cst_phone = '+33123456789',
    cst_city = 'Paris'
WHERE cst_id = 'test-user-456';

-- ==========================================
-- 5. REQUÊTES DE NETTOYAGE
-- ==========================================

-- Supprimer l'utilisateur test (si nécessaire)
DELETE FROM "___xtr_customer" WHERE cst_id = 'test-user-456';

-- Supprimer les utilisateurs de test (attention !)
-- DELETE FROM "___xtr_customer" WHERE cst_mail LIKE '%@example.com';

-- ==========================================
-- 6. REQUÊTES DE VALIDATION POST-CRÉATION
-- ==========================================

-- Test de connexion simulée
SELECT 
    cst_id,
    cst_mail,
    cst_fname,
    cst_name,
    cst_activ,
    CASE 
        WHEN cst_pswd IS NOT NULL AND LENGTH(cst_pswd) > 10 THEN 'Mot de passe OK'
        ELSE 'Mot de passe invalide'
    END as password_status
FROM "___xtr_customer"
WHERE cst_id = 'test-user-456';

-- Vérifier que tous les champs requis sont remplis
SELECT 
    cst_id,
    cst_mail,
    cst_fname,
    cst_name,
    cst_pswd,
    cst_activ,
    CASE 
        WHEN cst_id IS NOT NULL AND cst_mail IS NOT NULL AND cst_pswd IS NOT NULL THEN 'Complet'
        ELSE 'Incomplet'
    END as completeness_status
FROM "___xtr_customer"
WHERE cst_id = 'test-user-456';

-- ==========================================
-- 7. REQUÊTE FINALE DE VALIDATION
-- ==========================================

-- Test complet de l'utilisateur créé
SELECT 
    '✅ Utilisateur créé avec succès' as status,
    cst_id,
    cst_mail,
    cst_fname || ' ' || cst_name as full_name,
    cst_activ as is_active,
    'Prêt pour les tests' as note
FROM "___xtr_customer"
WHERE cst_id = 'test-user-456';

-- ==========================================
-- INSTRUCTIONS D'UTILISATION
-- ==========================================

/*
1. Copier la section "CRÉATION DE L'UTILISATEUR TEST" dans l'éditeur SQL
2. Exécuter les requêtes une par une
3. Vérifier que l'utilisateur a été créé avec la requête de validation
4. Utiliser les requêtes de diagnostic pour vérifier l'état
5. Tester l'application avec l'utilisateur créé

Email: test456@example.com
Mot de passe: password123 (sera hashé automatiquement)
*/
