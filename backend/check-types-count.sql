-- Compter les types actifs
SELECT 
  'Total types actifs (type_display=1)' as description,
  COUNT(*) as count
FROM __auto_type
WHERE type_display = '1'

UNION ALL

-- Compter avec type_relfollow = '1'
SELECT 
  'Types avec relfollow=1' as description,
  COUNT(*) as count
FROM __auto_type
WHERE type_display = '1'
  AND type_relfollow = '1'

UNION ALL

-- Distribution
SELECT 
  CONCAT('Partie 1 (0-35k) avec relfollow=1') as description,
  COUNT(*) as count
FROM __auto_type
WHERE type_display = '1'
  AND type_relfollow = '1'
  AND type_id < 35000

UNION ALL

SELECT 
  CONCAT('Partie 2 (35k+) avec relfollow=1') as description,
  COUNT(*) as count
FROM __auto_type
WHERE type_display = '1'
  AND type_relfollow = '1'
  AND type_id >= 35000;
