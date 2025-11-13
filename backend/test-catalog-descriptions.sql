-- Vérifier les descriptions dans catalog_gamme avec switches
SELECT 
  mc_pg_id,
  mc_name,
  mc_description,
  mc_meta_description,
  LENGTH(mc_description) as desc_length,
  CASE 
    WHEN mc_description LIKE '%{%' THEN 'Avec switch'
    ELSE 'Sans switch'
  END as has_switch
FROM catalog_gamme
WHERE mc_mf_id = 7 -- Système de freinage
  AND mc_display = 1
ORDER BY mc_sort
LIMIT 10;
