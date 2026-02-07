-- ============================================================================
-- V-LEVEL HEALTH CHECKS
-- ============================================================================
-- Suite de vérifications pour garantir l'intégrité du système V-Level
-- Exécuter après chaque import CSV ou modification de masse
--
-- Tous les checks doivent retourner 0 (sauf distribution qui est informative)
-- ============================================================================

-- ============================================================================
-- T1: 0 V2 non-vehicle (V2 réservé aux véhicules)
-- ============================================================================
SELECT COUNT(*) as t1_v2_non_vehicle
FROM __seo_keywords
WHERE v_level = 'V2' AND type <> 'vehicle';
-- EXPECTED: 0

-- ============================================================================
-- T2: 0 V2 avec model/energy NULL (validation P1)
-- ============================================================================
SELECT COUNT(*) as t2_v2_invalid
FROM __seo_keywords
WHERE v_level = 'V2' AND (model IS NULL OR energy IS NULL);
-- EXPECTED: 0

-- ============================================================================
-- T3: Unicité V2 par (pg_id, energy) - 0 doublons
-- ============================================================================
SELECT COUNT(*) as t3_v2_duplicates
FROM (
  SELECT pg_id, COALESCE(LOWER(energy), 'unknown') as energy_norm
  FROM __seo_keywords
  WHERE v_level = 'V2' AND type = 'vehicle' AND pg_id IS NOT NULL
  GROUP BY pg_id, COALESCE(LOWER(energy), 'unknown')
  HAVING COUNT(*) > 1
) sub;
-- EXPECTED: 0

-- ============================================================================
-- T4: 0 v_level NULL (zero NULL policy)
-- ============================================================================
SELECT COUNT(*) as t4_null_vlevel
FROM __seo_keywords
WHERE v_level IS NULL;
-- EXPECTED: 0

-- ============================================================================
-- T5: V5 = vehicle + volume=0 uniquement
-- ============================================================================
SELECT COUNT(*) as t5_v5_invalid
FROM __seo_keywords
WHERE v_level = 'V5' AND (type <> 'vehicle' OR volume <> 0 OR volume IS NULL);
-- EXPECTED: 0

-- ============================================================================
-- T6: V3 = vehicle + volume>0 (pas V2)
-- ============================================================================
SELECT COUNT(*) as t6_v3_invalid
FROM __seo_keywords
WHERE v_level = 'V3' AND (type <> 'vehicle' OR volume IS NULL OR volume <= 0);
-- EXPECTED: 0

-- ============================================================================
-- T7: Distribution par v_level (informatif)
-- ============================================================================
SELECT
  v_level,
  type,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 2) as percentage
FROM __seo_keywords
GROUP BY v_level, type
ORDER BY v_level, type;

-- ============================================================================
-- T8: V4 = volume NULL uniquement (pas volume=0)
-- ============================================================================
SELECT COUNT(*) as t8_v4_with_volume_zero
FROM __seo_keywords
WHERE v_level = 'V4' AND type = 'vehicle' AND volume = 0;
-- EXPECTED: 0 (devrait être V5)

-- ============================================================================
-- T9: Tous les pg_id non-NULL pour V2
-- ============================================================================
SELECT COUNT(*) as t9_v2_missing_pg_id
FROM __seo_keywords
WHERE v_level = 'V2' AND pg_id IS NULL;
-- EXPECTED: 0

-- ============================================================================
-- T10: vehicule_v1_dominant cohérence
-- ============================================================================
SELECT COUNT(*) as t10_v1_invalid_score
FROM vehicule_v1_dominant
WHERE score <= 0 OR score IS NULL;
-- EXPECTED: 0

-- ============================================================================
-- RESUME: Exécuter tous les checks en une seule query
-- ============================================================================
SELECT
  'T1: V2 non-vehicle' as check_name,
  (SELECT COUNT(*) FROM __seo_keywords WHERE v_level='V2' AND type<>'vehicle') as count,
  0 as expected
UNION ALL
SELECT
  'T2: V2 invalid (model/energy NULL)',
  (SELECT COUNT(*) FROM __seo_keywords WHERE v_level='V2' AND (model IS NULL OR energy IS NULL)),
  0
UNION ALL
SELECT
  'T3: V2 duplicates',
  (SELECT COUNT(*) FROM (
    SELECT pg_id, COALESCE(LOWER(energy), 'unknown')
    FROM __seo_keywords WHERE v_level='V2' AND type='vehicle' AND pg_id IS NOT NULL
    GROUP BY pg_id, COALESCE(LOWER(energy), 'unknown') HAVING COUNT(*) > 1
  ) sub),
  0
UNION ALL
SELECT
  'T4: NULL v_level',
  (SELECT COUNT(*) FROM __seo_keywords WHERE v_level IS NULL),
  0
UNION ALL
SELECT
  'T5: V5 invalid (not vehicle or volume<>0)',
  (SELECT COUNT(*) FROM __seo_keywords WHERE v_level='V5' AND (type<>'vehicle' OR volume<>0 OR volume IS NULL)),
  0
UNION ALL
SELECT
  'T6: V3 invalid (not vehicle or volume<=0)',
  (SELECT COUNT(*) FROM __seo_keywords WHERE v_level='V3' AND (type<>'vehicle' OR volume IS NULL OR volume<=0)),
  0
UNION ALL
SELECT
  'T8: V4 with volume=0 (should be V5)',
  (SELECT COUNT(*) FROM __seo_keywords WHERE v_level='V4' AND type='vehicle' AND volume=0),
  0
UNION ALL
SELECT
  'T9: V2 missing pg_id',
  (SELECT COUNT(*) FROM __seo_keywords WHERE v_level='V2' AND pg_id IS NULL),
  0
UNION ALL
SELECT
  'T10: V1 dominant invalid score',
  (SELECT COUNT(*) FROM vehicule_v1_dominant WHERE score<=0 OR score IS NULL),
  0;
