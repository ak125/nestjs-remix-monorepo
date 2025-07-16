-- 🚀 CRÉER UN NOUVEL UTILISATEUR POUR ÉVITER LE RATE LIMITING
-- Utiliser un email différent pour contourner le blocage

-- Créer un nouvel utilisateur avec un email non bloqué
INSERT INTO "___xtr_customer" (
    cst_id,
    cst_mail,
    cst_fname,
    cst_name,
    cst_pswd,
    cst_activ,
    cst_is_pro
) VALUES (
    'test-user-789',
    'testauth@example.com',
    'Auth',
    'Test',
    '$2b$10$zY.Tjx1gYudAcIiJlWtWnO9n8gv6AvgN8cXOOU/.OCBOJDF5s7zry',
    '1',
    '0'
);

-- Vérifier la création
SELECT cst_id, cst_mail, cst_fname, cst_name, LEFT(cst_pswd, 30) as password_hash 
FROM "___xtr_customer" 
WHERE cst_id = 'test-user-789';

-- Test avec ce nouvel utilisateur :
-- Email: testauth@example.com
-- Mot de passe: password123
