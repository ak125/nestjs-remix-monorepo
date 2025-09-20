-- 🔍 REQUÊTE TEST : Vérifier la relation entre auto_type et cars_engine
-- Objectif : Comprendre comment lier eng_code avec les données existantes

-- 1. Examiner la structure auto_type pour identifier le lien
SELECT 
  type_id,
  type_name,
  type_engine_code,
  type_fuel,
  type_power_ps,
  type_year_from,
  type_year_to
FROM auto_type 
WHERE type_name ILIKE '%1.0 TFSI%' 
LIMIT 5;

-- 2. Examiner cars_engine pour les codes moteur
SELECT 
  eng_id,
  eng_mfa_id,
  eng_code
FROM cars_engine 
LIMIT 10;

-- 3. Tentative de jointure pour identifier la relation
SELECT 
  at.type_id,
  at.type_name,
  at.type_engine_code,
  ce.eng_id,
  ce.eng_code,
  ce.eng_mfa_id
FROM auto_type at
LEFT JOIN cars_engine ce ON (
  at.type_engine_code = ce.eng_code 
  OR at.type_engine_code = ce.eng_id
  OR at.type_engine_code = ce.eng_mfa_id
)
WHERE at.type_name ILIKE '%1.0 TFSI%'
LIMIT 5;