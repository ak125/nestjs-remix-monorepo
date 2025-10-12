-- Mise à jour du statut d'une ligne pour test
UPDATE ___xtr_order_line 
SET orl_orls_id = '1' 
WHERE orl_id = 'ORD-1759787157480-665-L001';

-- Vérification
SELECT orl_id, orl_pg_name, orl_orls_id, orl_art_quantity, orl_art_price_sell_ttc 
FROM ___xtr_order_line 
WHERE orl_ord_id = 'ORD-1759787157480-665';
