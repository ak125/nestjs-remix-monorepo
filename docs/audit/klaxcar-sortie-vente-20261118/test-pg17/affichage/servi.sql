-- Sortie des fonctions servies sur les 20 paires de l'échantillon (type_id, pg_id)
COPY (
  SELECT v.t AS type_id, v.g AS pg_id, f.id, f.marque_id, f.prix_unitaire, f.stock_status, md5(row_to_json(f)::text) AS ligne
    FROM (VALUES (10271,9),(11754,48),(11755,3927),(11792,1260),(11793,854),(11883,1145),(1756,112),(18308,7),(18312,105),(22443,1361),(28199,111),(28568,82),(28569,105),(28569,470),(33338,10),(54959,111),(56761,111),(66764,111),(77411,111),(80873,111)) v(t,g)
    CROSS JOIN LATERAL public.get_listing_products_extended_filtered(v.g, v.t, 200) f
   ORDER BY 1, 2, 3
) TO STDOUT WITH CSV;
