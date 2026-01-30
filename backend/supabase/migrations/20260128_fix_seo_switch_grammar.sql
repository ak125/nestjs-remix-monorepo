-- Migration: 20260128_fix_seo_switch_grammar.sql
-- Description: Corrige les erreurs grammaticales dans les switches SEO
-- Impact: ~29 switches mal formatés sur ~27 gammes
--
-- Patterns corrigés:
-- 1. "garantir assurer X" → "pour assurer X"
-- 2. "assurer ralentir X" → "pour ralentir X"
-- 3. "garantir permettre/aider/améliorer/refroidir X par" → "pour [verbe] X"
-- 4. Phrases incomplètes se terminant par "par"

-- ============================================================
-- AVANT: Audit des switches mal formatés
-- ============================================================
-- SELECT COUNT(*) FROM __seo_gamme_car_switch
-- WHERE sgcs_content ~ '(garantir|assurer)\s+(assurer|garantir|permettre|ralentir)'
--    OR sgcs_content LIKE '% par';
-- Résultat attendu: ~29 switches

-- ============================================================
-- FIX 1: Pattern "garantir assurer X" → "pour assurer X"
-- ============================================================
UPDATE __seo_gamme_car_switch
SET sgcs_content = REGEXP_REPLACE(sgcs_content, '^garantir assurer ', 'pour assurer ', 'i')
WHERE sgcs_content ~* '^garantir assurer ';

-- ============================================================
-- FIX 2: Pattern "assurer ralentir X" → "pour ralentir X"
-- ============================================================
UPDATE __seo_gamme_car_switch
SET sgcs_content = REGEXP_REPLACE(sgcs_content, '^assurer ralentir ', 'pour ralentir ', 'i')
WHERE sgcs_content ~* '^assurer ralentir ';

-- ============================================================
-- FIX 3: Pattern "garantir [verbe] X par" → "pour [verbe] X"
-- Verbes: permettre, aider, améliorer, refroidir
-- ============================================================
UPDATE __seo_gamme_car_switch
SET sgcs_content = REGEXP_REPLACE(
  sgcs_content,
  '^garantir (permettre|aider|améliorer|refroidir) (.+) par$',
  'pour \1 \2',
  'i'
)
WHERE sgcs_content ~* '^garantir (permettre|aider|améliorer|refroidir) .+ par$';

-- ============================================================
-- FIX 4: Supprimer " par" en fin de phrase (incomplet)
-- ============================================================
UPDATE __seo_gamme_car_switch
SET sgcs_content = REGEXP_REPLACE(sgcs_content, ' par$', '', 'i')
WHERE sgcs_content ~* ' par$'
  AND sgcs_content !~* '^pour ';  -- Ne pas toucher aux phrases déjà corrigées

-- ============================================================
-- APRÈS: Vérification (doit retourner 0)
-- ============================================================
-- SELECT COUNT(*) FROM __seo_gamme_car_switch
-- WHERE sgcs_content ~ '(garantir|assurer)\s+(assurer|garantir|permettre|ralentir)'
--    OR (sgcs_content LIKE '% par' AND sgcs_content NOT LIKE 'pour %');

-- ============================================================
-- LOG: Enregistrer les corrections effectuées
-- ============================================================
DO $$
DECLARE
  fixed_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO fixed_count
  FROM __seo_gamme_car_switch
  WHERE sgcs_content LIKE 'pour %';

  RAISE NOTICE 'Migration 20260128_fix_seo_switch_grammar: % switches corrigés avec préfixe "pour"', fixed_count;
END $$;
