-- 🚀 SCRIPT SQL MINIMAL POUR CRÉER L'UTILISATEUR TEST
-- Utilise uniquement les colonnes obligatoires qui existent certainement

-- Supprimer l'utilisateur s'il existe déjà
DELETE FROM "___xtr_customer" WHERE cst_id = 'test-user-456';

-- Créer l'utilisateur test avec les colonnes essentielles
INSERT INTO "___xtr_customer" (
    cst_id,
    cst_mail,
    cst_fname,
    cst_name,
    cst_pswd,
    cst_activ
) VALUES (
    'test-user-456',
    'test456@example.com',
    'John',
    'Doe',
    '$2b$10$example.hash.for.password123',
    'true'
);

-- Vérifier que l'utilisateur a été créé
SELECT 
    cst_id,
    cst_mail,
    cst_fname,
    cst_name,
    cst_activ
FROM "___xtr_customer" 
WHERE cst_id = 'test-user-456';

-- Si l'utilisateur existe, afficher un message de succès
SELECT 
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ Utilisateur test-user-456 créé avec succès'
        ELSE '❌ Échec de création de l''utilisateur'
    END as status
FROM "___xtr_customer"
WHERE cst_id = 'test-user-456';
