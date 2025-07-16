-- 🔧 CORRECTION DU MOT DE PASSE POUR L'AUTHENTIFICATION
-- Générer un hash bcrypt pour le mot de passe 'password123'

-- Vérifier l'utilisateur actuel
SELECT cst_id, cst_mail, cst_fname, cst_name, LEFT(cst_pswd, 20) as password_hash FROM "___xtr_customer" WHERE cst_id = 'test-user-456';

-- Corriger le mot de passe avec un hash bcrypt valide pour 'password123'
-- Hash généré pour 'password123' : $2b$10$YourHashHere
UPDATE "___xtr_customer" 
SET cst_pswd = '$2b$10$rOjOL9lEfTgEU6/4uqQZHOyRrNOkQyGZrNWQGLGmMJ1/0VnqYX8K2'
WHERE cst_id = 'test-user-456';

-- Vérifier la correction
SELECT cst_id, cst_mail, cst_fname, cst_name, LEFT(cst_pswd, 30) as password_hash FROM "___xtr_customer" WHERE cst_id = 'test-user-456';

-- Corriger aussi l'email si nécessaire
UPDATE "___xtr_customer" 
SET cst_mail = 'test456@example.com'
WHERE cst_id = 'test-user-456';

-- Vérification finale
SELECT cst_id, cst_mail, cst_fname, cst_name, LEFT(cst_pswd, 30) as password_hash FROM "___xtr_customer" WHERE cst_id = 'test-user-456';
