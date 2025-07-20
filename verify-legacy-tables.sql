-- ================================================================
-- VÉRIFICATION DES VRAIES TABLES LEGACY - MODULE PAIEMENTS
-- ================================================================
-- 
-- Ce script vérifie que les VRAIES tables existent et affiche leur structure
-- Tables utilisées: ___xtr_order, ___xtr_customer, ic_postback
--

-- 1. Vérifier la table ___xtr_order (commandes avec paiements)
SELECT 'Table ___xtr_order' as table_name, count(*) as total_rows 
FROM ___xtr_order;

-- 2. Vérifier la table ___xtr_customer (clients)  
SELECT 'Table ___xtr_customer' as table_name, count(*) as total_rows 
FROM ___xtr_customer;

-- 3. Vérifier la table ic_postback (callbacks de paiement)
SELECT 'Table ic_postback' as table_name, count(*) as total_rows 
FROM ic_postback;

-- 4. Afficher quelques exemples de données de commandes
SELECT 
  ord_id, 
  ord_cst_id, 
  ord_total_ttc, 
  ord_is_pay,
  ord_date_pay,
  ord_info
FROM ___xtr_order 
WHERE ord_total_ttc IS NOT NULL 
ORDER BY ord_id DESC 
LIMIT 5;

-- 5. Afficher quelques exemples de callbacks
SELECT 
  id,
  created_at,
  status,
  reference,
  data
FROM ic_postback 
ORDER BY created_at DESC 
LIMIT 5;

-- ================================================================
-- RÉSUMÉ
-- ================================================================
-- ✅ Tables existantes utilisées pour les paiements:
-- - ___xtr_order: Commandes (avec ord_is_pay pour statut paiement)
-- - ___xtr_customer: Clients  
-- - ic_postback: Callbacks et logs de paiement
--
-- 💡 Le module TypeScript utilise directement ces tables sans modification
-- 💡 Aucune création/modification de table nécessaire
