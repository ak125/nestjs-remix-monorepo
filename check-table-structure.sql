-- 🔍 VÉRIFICATION DE LA STRUCTURE DE LA TABLE ___xtr_customer
-- Script pour vérifier la structure exacte et les types de données

-- Voir la structure de la table
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = '___xtr_customer' 
ORDER BY ordinal_position;

-- Voir quelques exemples de données pour comprendre le format
SELECT cst_id, cst_mail, cst_fname, cst_name, cst_is_pro, cst_activ
FROM ___xtr_customer 
LIMIT 5;

-- Vérifier les valeurs possibles pour cst_is_pro et cst_activ
SELECT DISTINCT cst_is_pro, cst_activ, COUNT(*) as count
FROM ___xtr_customer 
GROUP BY cst_is_pro, cst_activ
ORDER BY count DESC;

-- Chercher spécifiquement l'utilisateur test-user-123 s'il existe
SELECT cst_id, cst_mail, cst_fname, cst_name, cst_is_pro, cst_activ
FROM ___xtr_customer 
WHERE cst_id = 'test-user-123';
