-- Script SQL pour donner les privilèges admin à l'utilisateur Test20
-- Exécuter ce script pour transformer l'utilisateur en administrateur

-- Mise à jour de l'utilisateur test-user-123 pour lui donner les privilèges admin
UPDATE ___xtr_customer 
SET cst_is_pro = '1' 
WHERE cst_id = 'test-user-123';

-- Vérifier que la mise à jour a bien eu lieu
SELECT 
    cst_id,
    cst_mail,
    cst_fname,
    cst_name,
    cst_is_pro,
    cst_activ
FROM ___xtr_customer 
WHERE cst_id = 'test-user-123';

-- Optionnel : Voir tous les utilisateurs avec leurs privilèges
-- SELECT 
--     cst_id,
--     cst_mail,
--     cst_fname,
--     cst_name,
--     cst_is_pro,
--     cst_activ
-- FROM ___xtr_customer 
-- ORDER BY cst_is_pro DESC, cst_fname ASC;
