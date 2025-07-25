-- Script pour nettoyer les doublons et garder le bon super admin
-- À exécuter dans l'éditeur SQL de Supabase

-- 1. Voir tous les super admins
SELECT cnfa_id, cnfa_login, cnfa_mail, cnfa_level, cnfa_pswd 
FROM ___config_admin 
WHERE cnfa_mail = 'superadmin@autoparts.com'
ORDER BY cnfa_id;

-- 2. Supprimer l'admin avec le mauvais hash (celui qui commence par 8K0H1K2K3K4K5K6K7K8K9K0K)
DELETE FROM ___config_admin 
WHERE cnfa_mail = 'superadmin@autoparts.com' 
AND cnfa_pswd = '$2a$12$8K0H1K2K3K4K5K6K7K8K9K0K1K2K3K4K5K6K7K8K9K0K1K2K3K4K5K6';

-- 3. Vérifier qu'il ne reste qu'un seul admin
SELECT cnfa_id, cnfa_login, cnfa_mail, cnfa_level, cnfa_pswd 
FROM ___config_admin 
WHERE cnfa_mail = 'superadmin@autoparts.com';

-- 4. Le bon hash doit être : $2a$12$/KcjP/hYXo4QVSKo3wF18.fyYP5VmD8pE6s.tQhPnVMIBfe3bwg4.
-- Si ce n'est pas le cas, mettre à jour :
UPDATE ___config_admin 
SET cnfa_pswd = '$2a$12$/KcjP/hYXo4QVSKo3wF18.fyYP5VmD8pE6s.tQhPnVMIBfe3bwg4.'
WHERE cnfa_mail = 'superadmin@autoparts.com';
