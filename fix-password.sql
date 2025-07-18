-- 🔧 MISE À JOUR DES PRIVILÈGES ADMIN
-- Donner les privilèges admin à l'utilisateur test-user-123

-- Vérifier l'utilisateur actuel
SELECT cst_id, cst_mail, cst_fname, cst_name, cst_is_pro, cst_activ FROM ___xtr_customer WHERE cst_id = 'test-user-123';

-- Donner les privilèges admin (cst_is_pro = '1')
UPDATE ___xtr_customer 
SET cst_is_pro = '1'
WHERE cst_id = 'test-user-123';

-- Activer l'utilisateur si nécessaire (cst_activ = '1')
UPDATE ___xtr_customer 
SET cst_activ = '1'
WHERE cst_id = 'test-user-123';

-- Vérification finale
SELECT cst_id, cst_mail, cst_fname, cst_name, cst_is_pro, cst_activ FROM ___xtr_customer WHERE cst_id = 'test-user-123';
