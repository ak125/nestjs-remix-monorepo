-- Script pour rendre un utilisateur admin
-- Remplace l'email par celui que tu veux rendre admin

-- Option 1: Rendre monia123@gmail.com admin
UPDATE ___xtr_user
SET usr_is_admin = true
WHERE usr_mail = 'monia123@gmail.com';

-- Option 2: Créer un compte admin de test
-- INSERT INTO ___xtr_user (
--   usr_id,
--   usr_mail,
--   usr_password,
--   usr_firstname,
--   usr_lastname,
--   usr_is_admin,
--   usr_is_active,
--   usr_level
-- ) VALUES (
--   'usr_admin_test',
--   'admin@automecanik.com',
--   -- Mot de passe: Admin123! (à hasher avec bcrypt)
--   '$2b$10$example',
--   'Admin',
--   'Test',
--   true,
--   true,
--   1
-- );

-- Vérification
SELECT usr_id, usr_mail, usr_firstname, usr_lastname, usr_is_admin, usr_is_active
FROM ___xtr_user
WHERE usr_mail = 'monia123@gmail.com';
