-- Vérifier la structure de la table __blog_advice
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = '__blog_advice'
ORDER BY ordinal_position;

-- Vérifier si l'article 20 (alternateur) a une image
SELECT ba_id, ba_title, ba_pg_id
FROM __blog_advice
WHERE ba_id = 20;

-- Lister toutes les colonnes commençant par 'ba_'
SELECT column_name
FROM information_schema.columns
WHERE table_name = '__blog_advice'
  AND column_name LIKE 'ba_%'
ORDER BY column_name;
