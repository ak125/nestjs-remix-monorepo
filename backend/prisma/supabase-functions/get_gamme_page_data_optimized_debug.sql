-- 🔍 VERSION DEBUG : Teste chaque section séparément pour identifier le problème

-- Test 1: Catalog (mc_pg_id est TEXT!)
SELECT json_build_object(
  'mc_mf_prime', mc_mf_prime
)
FROM catalog_gamme
WHERE mc_pg_id = '10'::TEXT
LIMIT 1;

-- Test 2: SEO
SELECT json_build_object(
  'sg_title', sg_title,
  'sg_descrip', sg_descrip
)
FROM __seo_gamme
WHERE sg_pg_id = '10'::TEXT
LIMIT 1;

-- Test 3: Conseils
SELECT json_agg(json_build_object(
  'sgc_id', sgc_id,
  'sgc_title', sgc_title
))
FROM __seo_gamme_conseil
WHERE sgc_pg_id = '10'::TEXT;

-- Test 4: Informations
SELECT json_agg(json_build_object(
  'sgi_content', sgi_content
))
FROM __seo_gamme_info
WHERE sgi_pg_id = '10'::TEXT;

-- Test 5: Motorisations (cgc_pg_id est TEXT!)
SELECT json_agg(json_build_object(
  'cgc_type_id', cgc_type_id,
  'cgc_id', cgc_id
))
FROM __cross_gamme_car_new
WHERE cgc_pg_id = '10'::TEXT
  AND cgc_level = '1';

-- Test 6: Equipementiers
SELECT json_agg(json_build_object(
  'seg_pm_id', seg_pm_id,
  'seg_content', seg_content
))
FROM __seo_equip_gamme
WHERE seg_pg_id = '10'::TEXT
  AND seg_content IS NOT NULL
LIMIT 4;

-- Test 7: Blog
SELECT json_build_object(
  'ba_id', ba_id,
  'ba_h1', ba_h1
)
FROM __blog_advice
WHERE ba_pg_id = '10'::TEXT
ORDER BY ba_update DESC
LIMIT 1;

-- Test 8: SEO Fragments 1
SELECT json_agg(json_build_object(
  'sis_id', sis_id,
  'sis_content', sis_content
))
FROM __seo_item_switch
WHERE sis_pg_id = '10'::TEXT
  AND sis_alias = '1';

-- Test 9: SEO Fragments 2
SELECT json_agg(json_build_object(
  'sis_id', sis_id,
  'sis_content', sis_content
))
FROM __seo_item_switch
WHERE sis_pg_id = '10'::TEXT
  AND sis_alias = '2';

-- Test 10: Motorisations enrichies (PROBLÈME POTENTIEL ICI)
SELECT json_agg(
  json_build_object(
    'type_id', at.type_id,
    'type_name', at.type_name,
    'marque_name', amarq.marque_name
  )
)
FROM __cross_gamme_car_new cgc
INNER JOIN auto_type at ON at.type_id = cgc.cgc_type_id
INNER JOIN auto_modele am ON am.modele_id::TEXT = at.type_modele_id
INNER JOIN auto_marque amarq ON amarq.marque_id = am.modele_marque_id
WHERE cgc.cgc_pg_id = '10'::TEXT
  AND cgc.cgc_level = '1'
  AND at.type_display = '1'
  AND am.modele_display = '1'
  AND amarq.marque_display = '1';
