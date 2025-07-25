-- Script SQL pour créer un Super Admin niveau 9
-- À exécuter dans l'éditeur SQL de Supabase

-- 1. Vérifier la structure de la table ___config_admin
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = '___config_admin'
ORDER BY ordinal_position;

-- 2. Vérifier les admins existants
SELECT cnfa_id, cnfa_login, cnfa_mail, cnfa_level, cnfa_activ 
FROM ___config_admin 
ORDER BY cnfa_level DESC;

-- 3. Créer le Super Admin niveau 9
INSERT INTO ___config_admin (
    cnfa_id,
    cnfa_login,
    cnfa_pswd,
    cnfa_mail,
    cnfa_keylog,
    cnfa_level,
    cnfa_job,
    cnfa_name,
    cnfa_fname,
    cnfa_tel,
    cnfa_activ
) VALUES (
    'adm_superadmin_' || extract(epoch from now())::text,
    'superadmin',
    '$2a$12$/KcjP/hYXo4QVSKo3wF18.fyYP5VmD8pE6s.tQhPnVMIBfe3bwg4.', -- Hash bcrypt de 'SuperAdmin2025!'
    'superadmin@autoparts.com',
    encode(gen_random_bytes(16), 'hex'),
    '9',
    'Super Administrator',
    'Super',
    'Admin',
    '+33 1 00 00 00 00',
    '1'
);

-- 4. Vérifier la création
SELECT 
    cnfa_id,
    cnfa_login,
    cnfa_mail,
    cnfa_level,
    cnfa_job,
    cnfa_name || ' ' || cnfa_fname as full_name,
    cnfa_activ,
    'SuperAdmin2025!' as temp_password
FROM ___config_admin 
WHERE cnfa_level = '9'
ORDER BY cnfa_id DESC;

-- 5. Alternative avec hash bcrypt correct (si le hash ci-dessus ne fonctionne pas)
-- Vous devrez remplacer le hash par celui généré avec bcrypt
/*
UPDATE ___config_admin 
SET cnfa_pswd = '$2a$12$[HASH_BCRYPT_GENERE]'
WHERE cnfa_login = 'superadmin' AND cnfa_level = '9';
*/

-- 6. Informations de connexion
-- Email: superadmin@autoparts.com
-- Mot de passe: SuperAdmin2025!
-- Niveau: 9 (Super Admin)

-- 7. Test de connexion (optionnel - pour vérifier le hash)
-- Vous pouvez utiliser cette requête pour tester si le mot de passe est correct
/*
SELECT 
    cnfa_id,
    cnfa_login,
    cnfa_mail,
    cnfa_level,
    crypt('SuperAdmin2025!', cnfa_pswd) = cnfa_pswd as password_valid
FROM ___config_admin 
WHERE cnfa_login = 'superadmin';
*/
