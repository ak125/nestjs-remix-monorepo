-- Voir quelques exemples de la table cars_engine
SELECT eng_id, eng_mfa_id, eng_code 
FROM cars_engine 
LIMIT 5;

-- Voir si eng_mfa_id correspond à type_id
SELECT COUNT(*) as total_matches
FROM cars_engine ce
INNER JOIN auto_type at ON ce.eng_mfa_id = at.type_id::text
LIMIT 1;
