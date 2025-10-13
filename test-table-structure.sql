-- Vérifier la structure exacte des tables legacy
-- Date: 6 octobre 2025

-- 1. Structure de ___XTR_ORDER (___xtr_order)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = '___xtr_order'
ORDER BY ordinal_position;

-- 2. Tester si les colonnes sont sensibles à la casse
\d "___xtr_order"

-- 3. Vérifier quelques lignes existantes
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = '___xtr_order' AND column_name = 'ord_id') THEN 'Colonnes en minuscules (ord_id)'
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = '___xtr_order' AND column_name = 'ORD_ID') THEN 'Colonnes en MAJUSCULES (ORD_ID)'
        ELSE 'Structure inconnue'
    END AS structure_type;
