-- Script SQL pour créer l'utilisateur test-user-456
-- À exécuter dans l'éditeur SQL de Supabase
-- STRUCTURE DE TABLE CONFIRMÉE !

-- ÉTAPE 1: Voir les données existantes
SELECT * FROM ___xtr_customer LIMIT 5;

-- ÉTAPE 2: Supprimer l'utilisateur s'il existe déjà
DELETE FROM ___xtr_customer WHERE cst_mail = 'test2@example.com';

-- ÉTAPE 3: Créer l'utilisateur test-user-456 avec la vraie structure
INSERT INTO ___xtr_customer (
    cst_id,         -- ID utilisateur
    cst_mail,       -- Email
    cst_pswd,       -- Mot de passe
    cst_keylog,     -- Clé de connexion (peut être vide)
    cst_civility,   -- Civilité
    cst_name,       -- Nom de famille
    cst_fname,      -- Prénom
    cst_address,    -- Adresse
    cst_zip_code,   -- Code postal
    cst_city,       -- Ville
    cst_country,    -- Pays
    cst_tel,        -- Téléphone
    cst_gsm,        -- Mobile
    cst_is_cpy,     -- Est une entreprise
    cst_rs,         -- Raison sociale
    cst_siret,      -- SIRET
    cst_is_pro,     -- Est un professionnel
    cst_activ,      -- Actif
    cst_level       -- Niveau
) VALUES (
    'test-user-456',                                                        -- cst_id
    'test2@example.com',                                                    -- cst_mail
    '$2b$10$nOUIs5kJ7naTuTFkBy1veuK0kSxUFXfuaOKdOKf9xYT0KzJJPjYT2',     -- cst_pswd (test123)
    '',                                                                     -- cst_keylog
    'M',                                                                    -- cst_civility
    'User',                                                                 -- cst_name
    'Test',                                                                 -- cst_fname
    '123 Rue de Test',                                                      -- cst_address
    '75001',                                                                -- cst_zip_code
    'Paris',                                                                -- cst_city
    'France',                                                               -- cst_country
    '+33123456789',                                                         -- cst_tel
    '+33123456789',                                                         -- cst_gsm
    'N',                                                                    -- cst_is_cpy (N = Non)
    '',                                                                     -- cst_rs
    '',                                                                     -- cst_siret
    'N',                                                                    -- cst_is_pro (N = Non)
    'Y',                                                                    -- cst_activ (Y = Oui)
    '1'                                                                     -- cst_level
);

-- ÉTAPE 4: Vérifier que l'utilisateur a été créé
SELECT * FROM ___xtr_customer WHERE cst_mail = 'test2@example.com';

-- ÉTAPE 5: Vérifier tous les utilisateurs
SELECT cst_id, cst_mail, cst_fname, cst_name, cst_is_pro, cst_activ 
FROM ___xtr_customer 
ORDER BY cst_id;

-- INFORMATIONS IMPORTANTES:
-- ✅ Structure de table confirmée avec les vraies colonnes
-- ✅ L'ID utilisateur est 'test-user-456' (colonne cst_id)
-- ✅ Email: test2@example.com (colonne cst_mail)
-- ✅ Mot de passe: test123 (haché dans cst_pswd)
-- ✅ Utilisateur actif (cst_activ = 'Y')
-- ✅ Utilisateur non-professionnel (cst_is_pro = 'N')
