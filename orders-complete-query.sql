-- 🔧 SCRIPT SQL COMPLET POUR LES COMMANDES
-- Utilise toutes les tables liées : orders, order_lines, customers, addresses, statuses

-- Vue complète des commandes avec toutes les informations liées
SELECT 
    -- Informations commande
    o.ord_id,
    o.ord_date,
    o.ord_amount_ht,
    o.ord_total_ttc,
    o.ord_is_pay,
    o.ord_info,
    
    -- Statut commande
    os.ords_named as status_name,
    os.ords_color as status_color,
    
    -- Informations client
    c.cst_fname,
    c.cst_name,
    c.cst_mail,
    c.cst_is_pro,
    
    -- Adresse facturation
    cba.cba_address as billing_address,
    cba.cba_city as billing_city,
    cba.cba_zip_code as billing_zip,
    
    -- Adresse livraison
    cda.cda_address as delivery_address,
    cda.cda_city as delivery_city,
    cda.cda_zip_code as delivery_zip,
    
    -- Nombre de lignes de commande
    COUNT(ol.orl_id) as total_lines

FROM ___xtr_order o
LEFT JOIN ___xtr_order_status os ON o.ord_ords_id = os.ords_id
LEFT JOIN ___xtr_customer c ON o.ord_cst_id = c.cst_id
LEFT JOIN ___xtr_customer_billing_address cba ON o.ord_cba_id = cba.cba_id
LEFT JOIN ___xtr_customer_delivery_address cda ON o.ord_cda_id = cda.cda_id
LEFT JOIN ___xtr_order_line ol ON o.ord_id = ol.orl_ord_id
GROUP BY 
    o.ord_id, o.ord_date, o.ord_amount_ht, o.ord_total_ttc, o.ord_is_pay, o.ord_info,
    os.ords_named, os.ords_color,
    c.cst_fname, c.cst_name, c.cst_mail, c.cst_is_pro,
    cba.cba_address, cba.cba_city, cba.cba_zip_code,
    cda.cda_address, cda.cda_city, cda.cda_zip_code
ORDER BY o.ord_date DESC
LIMIT 10;

-- Détails des lignes de commande avec leurs statuts
SELECT 
    ol.orl_id,
    ol.orl_ord_id,
    ol.orl_art_ref,
    ol.orl_art_quantity,
    ol.orl_art_price_sell_unit_ttc,
    ol.orl_art_price_sell_ttc,
    ol.orl_pg_name,
    ol.orl_pm_name,
    
    -- Statut ligne
    ols.orls_name as line_status_name,
    ols.orls_color as line_status_color

FROM ___xtr_order_line ol
LEFT JOIN ___xtr_order_line_status ols ON ol.orl_orls_id = ols.orls_id
WHERE ol.orl_ord_id IN (
    SELECT ord_id FROM ___xtr_order ORDER BY ord_date DESC LIMIT 10
)
ORDER BY ol.orl_ord_id, ol.orl_id;

-- Statistiques des commandes par statut
SELECT 
    os.ords_named as status_name,
    os.ords_color as status_color,
    COUNT(o.ord_id) as order_count,
    SUM(CAST(o.ord_total_ttc AS DECIMAL(10,2))) as total_amount
FROM ___xtr_order o
LEFT JOIN ___xtr_order_status os ON o.ord_ords_id = os.ords_id
GROUP BY os.ords_id, os.ords_named, os.ords_color
ORDER BY order_count DESC;

-- Tous les statuts disponibles
SELECT * FROM ___xtr_order_status ORDER BY ords_id;
SELECT * FROM ___xtr_order_line_status ORDER BY orls_id;
