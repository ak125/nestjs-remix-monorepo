-- 🔧 CORRECTION DE L'EMAIL POUR L'AUTHENTIFICATION
-- Mettre à jour l'email de l'utilisateur test pour correspondre aux tests

-- Vérifier l'utilisateur actuel
SELECT cst_id, cst_mail, cst_fname, cst_name FROM "___xtr_customer" WHERE cst_id = 'test-user-456';

-- Corriger l'email pour correspondre aux tests d'authentification
UPDATE "___xtr_customer" 
SET cst_mail = 'test456@example.com'
WHERE cst_id = 'test-user-456';

-- Vérifier la correction
SELECT cst_id, cst_mail, cst_fname, cst_name FROM "___xtr_customer" WHERE cst_id = 'test-user-456';

-- Vérifier que l'email est maintenant trouvable
SELECT cst_id, cst_mail, cst_fname, cst_name FROM "___xtr_customer" WHERE cst_mail = 'test456@example.com';
