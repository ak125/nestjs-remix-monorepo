-- TEST 1: Vérifier cgc_type_id et type_id
SELECT 
  cgc.cgc_type_id,
  pg_typeof(cgc.cgc_type_id) as cgc_type_id_type,
  at.type_id,
  pg_typeof(at.type_id) as type_id_type
FROM __cross_gamme_car_new cgc
INNER JOIN auto_type at ON at.type_id = cgc.cgc_type_id
WHERE cgc.cgc_pg_id = '10'
LIMIT 1;

-- TEST 2: Vérifier type_modele_id et modele_id  
SELECT 
  at.type_modele_id,
  pg_typeof(at.type_modele_id) as type_modele_id_type,
  am.modele_id,
  pg_typeof(am.modele_id) as modele_id_type
FROM auto_type at
INNER JOIN auto_modele am ON am.modele_id::TEXT = at.type_modele_id
LIMIT 1;

-- TEST 3: Vérifier modele_marque_id et marque_id
SELECT 
  am.modele_marque_id,
  pg_typeof(am.modele_marque_id) as modele_marque_id_type,
  amarq.marque_id,
  pg_typeof(amarq.marque_id) as marque_id_type
FROM auto_modele am
INNER JOIN auto_marque amarq ON amarq.marque_id = am.modele_marque_id
LIMIT 1;

-- TEST 4: Vérifier mc_pg_id et pg_id
SELECT 
  cg.mc_pg_id,
  pg_typeof(cg.mc_pg_id) as mc_pg_id_type,
  pg.pg_id,
  pg_typeof(pg.pg_id) as pg_id_type
FROM catalog_gamme cg
INNER JOIN pieces_gamme pg ON pg.pg_id::TEXT = cg.mc_pg_id
LIMIT 1;
