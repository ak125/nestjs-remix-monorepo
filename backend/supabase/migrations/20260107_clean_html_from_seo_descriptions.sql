-- Migration: Clean HTML tags from SEO description fields
-- 🎯 Objectif: Supprimer les balises HTML des meta descriptions pour éviter les problèmes d'indexation Google
--
-- Contexte: 267k+ pages avaient des meta descriptions avec du HTML brut:
--   - &lt;strong&gt;Alternateur&lt;/strong&gt; pour...
--   - &lt;span&gt;Kit embrayage&lt;/span&gt;
--   - &lt;spanCalibri","sans-serif""&gt;... (tags malformés)
--
-- Tables concernées:
--   - __seo_gamme_car.sgc_content (SEO véhicule-spécifique, ~267k lignes)
--   - seo_gamme.sg_descrip (SEO gamme générale, ~230 lignes)

-- ============================================================================
-- Fonction utilitaire pour supprimer TOUTES les balises HTML
-- ============================================================================
CREATE OR REPLACE FUNCTION strip_html_tags(html TEXT)
RETURNS TEXT AS $$
DECLARE
  result TEXT;
BEGIN
  IF html IS NULL THEN
    RETURN NULL;
  END IF;

  result := html;

  -- 1. Décoder les entités HTML courantes (&lt; → <, &gt; → >)
  result := regexp_replace(result, '&lt;', '<', 'gi');
  result := regexp_replace(result, '&gt;', '>', 'gi');
  result := regexp_replace(result, '&amp;', '&', 'gi');
  result := regexp_replace(result, '&quot;', '"', 'gi');
  result := regexp_replace(result, '&#39;', '''', 'gi');
  result := regexp_replace(result, '&#x27;', '''', 'gi');
  result := regexp_replace(result, '&apos;', '''', 'gi');
  result := regexp_replace(result, '&nbsp;', ' ', 'gi');

  -- 2. Supprimer TOUTES les balises HTML (y compris malformées)
  -- Pattern: <...> y compris <spanCalibri","...>
  result := regexp_replace(result, '<[^>]*>', '', 'gi');

  -- 3. Supprimer les attributs style orphelins (résidus de <span style="font-family:Calibri...">)
  -- Pattern: Calibri","sans-serif"" ou font-size:11pt
  result := regexp_replace(result, '[A-Za-z-]+["'',]+[^"'']*["'']+', '', 'gi');

  -- 4. Normaliser les espaces multiples
  result := regexp_replace(result, '\s+', ' ', 'g');

  -- 5. Trim
  result := btrim(result);

  RETURN result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- 1. Nettoyer __seo_gamme_car.sgc_content (SEO véhicule-spécifique)
-- ============================================================================
-- Compter les lignes avec HTML avant nettoyage
DO $$
DECLARE
  html_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO html_count
  FROM __seo_gamme_car
  WHERE sgc_content ~ '<[^>]+>'
     OR sgc_content ~ '&lt;'
     OR sgc_content ~ '&gt;';

  RAISE NOTICE '🔍 __seo_gamme_car: % lignes avec HTML détecté', html_count;
END $$;

-- Appliquer le nettoyage
UPDATE __seo_gamme_car
SET sgc_content = strip_html_tags(sgc_content)
WHERE sgc_content ~ '<[^>]+>'
   OR sgc_content ~ '&lt;'
   OR sgc_content ~ '&gt;';

-- Log du résultat
DO $$
DECLARE
  affected_rows INTEGER;
BEGIN
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RAISE NOTICE '✅ __seo_gamme_car: % lignes nettoyées', affected_rows;
END $$;

-- ============================================================================
-- 2. Nettoyer seo_gamme.sg_descrip (SEO gamme générale)
-- ============================================================================
-- Compter les lignes avec HTML avant nettoyage
DO $$
DECLARE
  html_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO html_count
  FROM seo_gamme
  WHERE sg_descrip ~ '<[^>]+>'
     OR sg_descrip ~ '&lt;'
     OR sg_descrip ~ '&gt;';

  RAISE NOTICE '🔍 seo_gamme.sg_descrip: % lignes avec HTML détecté', html_count;
END $$;

-- Appliquer le nettoyage
UPDATE seo_gamme
SET sg_descrip = strip_html_tags(sg_descrip)
WHERE sg_descrip ~ '<[^>]+>'
   OR sg_descrip ~ '&lt;'
   OR sg_descrip ~ '&gt;';

-- Log du résultat
DO $$
DECLARE
  affected_rows INTEGER;
BEGIN
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RAISE NOTICE '✅ seo_gamme.sg_descrip: % lignes nettoyées', affected_rows;
END $$;

-- ============================================================================
-- 3. Nettoyer seo_gamme.sg_content (contenu SEO, peut contenir du HTML intentionnel)
-- ============================================================================
-- Note: sg_content peut contenir du HTML intentionnel (<b>, <strong>) pour l'affichage
-- On ne nettoie que les entités HTML encodées qui ne devraient pas être là
DO $$
DECLARE
  html_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO html_count
  FROM seo_gamme
  WHERE sg_content ~ '&lt;'
     OR sg_content ~ '&gt;';

  RAISE NOTICE '🔍 seo_gamme.sg_content: % lignes avec entités HTML encodées', html_count;
END $$;

-- Seulement décoder les entités (pas supprimer les vraies balises HTML)
UPDATE seo_gamme
SET sg_content = regexp_replace(
  regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(sg_content, '&lt;', '<', 'gi'),
        '&gt;', '>', 'gi'),
      '&amp;', '&', 'gi'),
    '&quot;', '"', 'gi'),
  '&nbsp;', ' ', 'gi')
WHERE sg_content ~ '&lt;'
   OR sg_content ~ '&gt;';

-- ============================================================================
-- Vérification post-migration
-- ============================================================================
DO $$
DECLARE
  remaining_html INTEGER;
BEGIN
  -- Vérifier qu'il n'y a plus de HTML dans les descriptions
  SELECT COUNT(*) INTO remaining_html
  FROM __seo_gamme_car
  WHERE sgc_content ~ '<[^>]+>'
     OR sgc_content ~ '&lt;'
     OR sgc_content ~ '&gt;';

  IF remaining_html > 0 THEN
    RAISE WARNING '⚠️ __seo_gamme_car: % lignes ont encore du HTML', remaining_html;
  ELSE
    RAISE NOTICE '✅ __seo_gamme_car: Aucun HTML résiduel';
  END IF;

  SELECT COUNT(*) INTO remaining_html
  FROM seo_gamme
  WHERE sg_descrip ~ '<[^>]+>'
     OR sg_descrip ~ '&lt;'
     OR sg_descrip ~ '&gt;';

  IF remaining_html > 0 THEN
    RAISE WARNING '⚠️ seo_gamme.sg_descrip: % lignes ont encore du HTML', remaining_html;
  ELSE
    RAISE NOTICE '✅ seo_gamme.sg_descrip: Aucun HTML résiduel';
  END IF;
END $$;

-- ============================================================================
-- Note: La fonction strip_html_tags reste disponible pour usage futur
-- Elle peut être utilisée dans des triggers pour prévenir l'insertion de HTML
-- ============================================================================
COMMENT ON FUNCTION strip_html_tags(TEXT) IS
  'Supprime toutes les balises HTML et décode les entités.
   Utilisé pour nettoyer les meta descriptions SEO.
   Créé lors de la migration 20260107_clean_html_from_seo_descriptions.sql';
