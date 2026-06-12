-- ====================================================================
-- V3 APPLY — disque-de-frein (pg_id 82) — 107 génériques modèle-seul -> diesel par défaut
-- OWNER-GATED · RÉVERSIBLE · NE PAS EXÉCUTER SANS GO EXPLICITE · ZÉRO PROD DIRECT
-- Généré read-only depuis generics-pack (owner-validé 107 APPROVE le 2026-06-06).
-- Périmètre PROUVÉ : pg_id=82 uniquement · 107 UPDATE · rows_matched=1/ligne · v_level exact.
-- EXCLUS : REMAP_REVIEW (2 clio 2 phase -> Clio II séparé), KEEP (24 Clio IV), REVIEW, DEFER, V5, autres pg_id.
-- Doctrine : essence != diesel (V3 distincts) ; aucune fusion, aucune suppression ; aucun keyword essence/diesel-explicite touché.
-- ====================================================================

-- ÉTAPE 0 — SNAPSHOT BEFORE (exécuter + SAUVEGARDER le résultat AVANT tout apply) :
SELECT id, keyword, v_level, type_id FROM "__seo_keywords"
WHERE pg_id = 82 AND keyword IN (
  'disque 207 prix',
  'disque 207',
  'disque 208',
  'disque 3008',
  'disque 308',
  'disque arriere 207',
  'disque arriere 208',
  'disque arriere 3008',
  'disque arriere 308',
  'disque arriere clio 3',
  'disque arriere megane 3',
  'disque arriere peugeot 208',
  'disque arrière 308 avec roulement',
  'disque avant 207',
  'disque avant 308',
  'disque avant clio 2',
  'disque avant clio 3',
  'disque avant megane 3',
  'disque clio 2',
  'disque clio 3 prix',
  'disque clio 3',
  'disque de frein 207 prix',
  'disque de frein 207',
  'disque de frein 208',
  'disque de frein 3008 prix',
  'disque de frein 3008',
  'disque de frein 308 prix',
  'disque de frein 308',
  'disque de frein arriere 207',
  'disque de frein arriere 208',
  'disque de frein arriere 3008',
  'disque de frein arriere 308',
  'disque de frein arriere clio 3',
  'disque de frein arriere megane 3',
  'disque de frein arrière megane 3 avec roulement',
  'disque de frein arrière peugeot 308',
  'disque de frein avant 207',
  'disque de frein avant clio 2',
  'disque de frein avant clio 3',
  'disque de frein avant megane 3',
  'disque de frein avant peugeot 207',
  'disque de frein clio 2 prix',
  'disque de frein clio 2',
  'disque de frein clio 3 prix',
  'disque de frein clio 3',
  'disque de frein megane 3 prix',
  'disque de frein megane 3',
  'disque de frein peugeot 207 prix',
  'disque de frein peugeot 207',
  'disque de frein peugeot 208',
  'disque de frein peugeot 3008',
  'disque de frein peugeot 308 prix',
  'disque de frein peugeot 308',
  'disque de frein renault megane 3',
  'disque et plaquette clio 2',
  'disque et plaquette clio 3',
  'disque et plaquette de frein 207 prix',
  'disque et plaquette de frein 207',
  'disque et plaquette de frein 208 prix',
  'disque et plaquette de frein arrière megane 3',
  'disque et plaquette de frein clio 2 prix',
  'disque et plaquette de frein clio 3 prix',
  'disque et plaquette de frein clio 3',
  'disque et plaquette de frein megane 3 prix',
  'disque et plaquette de frein peugeot 3008',
  'disque frein 207',
  'disque frein 3008',
  'disque frein 308',
  'disque frein arriere megane 3',
  'disque frein avant clio 3',
  'disque frein avant megane 3',
  'disque frein clio 2',
  'disque frein clio 3 prix',
  'disque frein clio 3',
  'disque frein megane 3',
  'disque frein peugeot 207',
  'disque frein peugeot 208',
  'disque frein peugeot 308',
  'disque megane 3',
  'disque peugeot 207',
  'disque peugeot 208',
  'disque peugeot 3008',
  'disque peugeot 308',
  'disque plaquette 207',
  'disque plaquette 208',
  'disque plaquette 308',
  'disque plaquette clio 2',
  'disque plaquette clio 3',
  'disque plaquette de frein clio 3',
  'disque plaquette megane 3',
  'frein 207',
  'frein 208',
  'frein arriere megane 3',
  'frein clio 2',
  'plaquette de frein prix clio 3',
  'prix disque de frein 207',
  'prix disque de frein clio 2',
  'prix disque de frein clio 3',
  'prix disque de frein megane 3',
  'prix disque de frein peugeot 208',
  'prix disque et plaquette de frein 208',
  'prix disque et plaquette de frein 308',
  'prix disque et plaquette de frein peugeot 207',
  'prix disque et plaquette de frein peugeot 208',
  'prix disque et plaquette de frein peugeot 3008',
  'prix disque et plaquette de frein peugeot 308',
  'prix plaquette de frein et disque clio 3'
) ORDER BY keyword, v_level;

-- ÉTAPE 1 — APPLY (transaction ; lire d'abord ; COMMIT SEULEMENT après vérif) :
BEGIN;
UPDATE "__seo_keywords" SET type_id = 19353 WHERE pg_id = 82 AND keyword = 'disque de frein 207' AND v_level = 'V2';
UPDATE "__seo_keywords" SET type_id = 19353 WHERE pg_id = 82 AND keyword = 'disque 207' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 19353 WHERE pg_id = 82 AND keyword = 'disque 207 prix' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 19353 WHERE pg_id = 82 AND keyword = 'disque arriere 207' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 19353 WHERE pg_id = 82 AND keyword = 'disque avant 207' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 19353 WHERE pg_id = 82 AND keyword = 'disque de frein 207 prix' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 19353 WHERE pg_id = 82 AND keyword = 'disque de frein arriere 207' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 19353 WHERE pg_id = 82 AND keyword = 'disque de frein avant 207' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 19353 WHERE pg_id = 82 AND keyword = 'disque de frein avant peugeot 207' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 19353 WHERE pg_id = 82 AND keyword = 'disque de frein peugeot 207' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 19353 WHERE pg_id = 82 AND keyword = 'disque de frein peugeot 207 prix' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 19353 WHERE pg_id = 82 AND keyword = 'disque et plaquette de frein 207' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 19353 WHERE pg_id = 82 AND keyword = 'disque et plaquette de frein 207 prix' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 19353 WHERE pg_id = 82 AND keyword = 'disque frein 207' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 19353 WHERE pg_id = 82 AND keyword = 'disque frein peugeot 207' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 19353 WHERE pg_id = 82 AND keyword = 'disque peugeot 207' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 19353 WHERE pg_id = 82 AND keyword = 'disque plaquette 207' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 19353 WHERE pg_id = 82 AND keyword = 'frein 207' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 19353 WHERE pg_id = 82 AND keyword = 'prix disque de frein 207' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 19353 WHERE pg_id = 82 AND keyword = 'prix disque et plaquette de frein peugeot 207' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 76381 WHERE pg_id = 82 AND keyword = 'prix disque et plaquette de frein peugeot 208' AND v_level = 'V2';
UPDATE "__seo_keywords" SET type_id = 76381 WHERE pg_id = 82 AND keyword = 'disque 208' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 76381 WHERE pg_id = 82 AND keyword = 'disque arriere 208' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 76381 WHERE pg_id = 82 AND keyword = 'disque arriere peugeot 208' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 76381 WHERE pg_id = 82 AND keyword = 'disque de frein 208' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 76381 WHERE pg_id = 82 AND keyword = 'disque de frein arriere 208' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 76381 WHERE pg_id = 82 AND keyword = 'disque de frein peugeot 208' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 76381 WHERE pg_id = 82 AND keyword = 'disque et plaquette de frein 208 prix' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 76381 WHERE pg_id = 82 AND keyword = 'disque frein peugeot 208' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 76381 WHERE pg_id = 82 AND keyword = 'disque peugeot 208' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 76381 WHERE pg_id = 82 AND keyword = 'disque plaquette 208' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 76381 WHERE pg_id = 82 AND keyword = 'frein 208' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 76381 WHERE pg_id = 82 AND keyword = 'prix disque de frein peugeot 208' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 76381 WHERE pg_id = 82 AND keyword = 'prix disque et plaquette de frein 208' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 30823 WHERE pg_id = 82 AND keyword = 'prix disque et plaquette de frein peugeot 3008' AND v_level = 'V2';
UPDATE "__seo_keywords" SET type_id = 30823 WHERE pg_id = 82 AND keyword = 'disque 3008' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 30823 WHERE pg_id = 82 AND keyword = 'disque arriere 3008' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 30823 WHERE pg_id = 82 AND keyword = 'disque de frein 3008' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 30823 WHERE pg_id = 82 AND keyword = 'disque de frein 3008 prix' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 30823 WHERE pg_id = 82 AND keyword = 'disque de frein arriere 3008' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 30823 WHERE pg_id = 82 AND keyword = 'disque de frein peugeot 3008' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 30823 WHERE pg_id = 82 AND keyword = 'disque et plaquette de frein peugeot 3008' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 30823 WHERE pg_id = 82 AND keyword = 'disque frein 3008' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 30823 WHERE pg_id = 82 AND keyword = 'disque peugeot 3008' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 23383 WHERE pg_id = 82 AND keyword = 'disque 308' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 23383 WHERE pg_id = 82 AND keyword = 'disque arriere 308' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 23383 WHERE pg_id = 82 AND keyword = 'disque arrière 308 avec roulement' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 23383 WHERE pg_id = 82 AND keyword = 'disque avant 308' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 23383 WHERE pg_id = 82 AND keyword = 'disque de frein 308' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 23383 WHERE pg_id = 82 AND keyword = 'disque de frein 308 prix' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 23383 WHERE pg_id = 82 AND keyword = 'disque de frein arriere 308' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 23383 WHERE pg_id = 82 AND keyword = 'disque de frein arrière peugeot 308' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 23383 WHERE pg_id = 82 AND keyword = 'disque de frein peugeot 308' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 23383 WHERE pg_id = 82 AND keyword = 'disque de frein peugeot 308 prix' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 23383 WHERE pg_id = 82 AND keyword = 'disque frein 308' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 23383 WHERE pg_id = 82 AND keyword = 'disque frein peugeot 308' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 23383 WHERE pg_id = 82 AND keyword = 'disque peugeot 308' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 23383 WHERE pg_id = 82 AND keyword = 'disque plaquette 308' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 23383 WHERE pg_id = 82 AND keyword = 'prix disque et plaquette de frein 308' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 23383 WHERE pg_id = 82 AND keyword = 'prix disque et plaquette de frein peugeot 308' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 16108 WHERE pg_id = 82 AND keyword = 'disque de frein clio 2' AND v_level = 'V2';
UPDATE "__seo_keywords" SET type_id = 16108 WHERE pg_id = 82 AND keyword = 'disque avant clio 2' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 16108 WHERE pg_id = 82 AND keyword = 'disque clio 2' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 16108 WHERE pg_id = 82 AND keyword = 'disque de frein avant clio 2' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 16108 WHERE pg_id = 82 AND keyword = 'disque de frein clio 2 prix' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 16108 WHERE pg_id = 82 AND keyword = 'disque et plaquette clio 2' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 16108 WHERE pg_id = 82 AND keyword = 'disque et plaquette de frein clio 2 prix' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 16108 WHERE pg_id = 82 AND keyword = 'disque frein clio 2' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 16108 WHERE pg_id = 82 AND keyword = 'disque plaquette clio 2' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 16108 WHERE pg_id = 82 AND keyword = 'frein clio 2' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 16108 WHERE pg_id = 82 AND keyword = 'prix disque de frein clio 2' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 19052 WHERE pg_id = 82 AND keyword = 'disque clio 3' AND v_level = 'V2';
UPDATE "__seo_keywords" SET type_id = 19052 WHERE pg_id = 82 AND keyword = 'disque arriere clio 3' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 19052 WHERE pg_id = 82 AND keyword = 'disque avant clio 3' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 19052 WHERE pg_id = 82 AND keyword = 'disque clio 3 prix' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 19052 WHERE pg_id = 82 AND keyword = 'disque de frein arriere clio 3' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 19052 WHERE pg_id = 82 AND keyword = 'disque de frein avant clio 3' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 19052 WHERE pg_id = 82 AND keyword = 'disque de frein clio 3' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 19052 WHERE pg_id = 82 AND keyword = 'disque de frein clio 3 prix' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 19052 WHERE pg_id = 82 AND keyword = 'disque et plaquette clio 3' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 19052 WHERE pg_id = 82 AND keyword = 'disque et plaquette de frein clio 3' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 19052 WHERE pg_id = 82 AND keyword = 'disque et plaquette de frein clio 3 prix' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 19052 WHERE pg_id = 82 AND keyword = 'disque frein avant clio 3' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 19052 WHERE pg_id = 82 AND keyword = 'disque frein clio 3' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 19052 WHERE pg_id = 82 AND keyword = 'disque frein clio 3 prix' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 19052 WHERE pg_id = 82 AND keyword = 'disque plaquette clio 3' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 19052 WHERE pg_id = 82 AND keyword = 'disque plaquette de frein clio 3' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 19052 WHERE pg_id = 82 AND keyword = 'plaquette de frein prix clio 3' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 19052 WHERE pg_id = 82 AND keyword = 'prix disque de frein clio 3' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 19052 WHERE pg_id = 82 AND keyword = 'prix plaquette de frein et disque clio 3' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 29956 WHERE pg_id = 82 AND keyword = 'disque arriere megane 3' AND v_level = 'V2';
UPDATE "__seo_keywords" SET type_id = 29956 WHERE pg_id = 82 AND keyword = 'disque avant megane 3' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 29956 WHERE pg_id = 82 AND keyword = 'disque de frein arriere megane 3' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 29956 WHERE pg_id = 82 AND keyword = 'disque de frein arrière megane 3 avec roulement' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 29956 WHERE pg_id = 82 AND keyword = 'disque de frein avant megane 3' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 29956 WHERE pg_id = 82 AND keyword = 'disque de frein megane 3' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 29956 WHERE pg_id = 82 AND keyword = 'disque de frein megane 3 prix' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 29956 WHERE pg_id = 82 AND keyword = 'disque de frein renault megane 3' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 29956 WHERE pg_id = 82 AND keyword = 'disque et plaquette de frein arrière megane 3' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 29956 WHERE pg_id = 82 AND keyword = 'disque et plaquette de frein megane 3 prix' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 29956 WHERE pg_id = 82 AND keyword = 'disque frein arriere megane 3' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 29956 WHERE pg_id = 82 AND keyword = 'disque frein avant megane 3' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 29956 WHERE pg_id = 82 AND keyword = 'disque frein megane 3' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 29956 WHERE pg_id = 82 AND keyword = 'disque megane 3' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 29956 WHERE pg_id = 82 AND keyword = 'disque plaquette megane 3' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 29956 WHERE pg_id = 82 AND keyword = 'frein arriere megane 3' AND v_level = 'V4';
UPDATE "__seo_keywords" SET type_id = 29956 WHERE pg_id = 82 AND keyword = 'prix disque de frein megane 3' AND v_level = 'V4';
-- vérif : les 107 doivent désormais pointer la nouvelle cible (re-exécuter le SELECT ÉTAPE 0).
-- COMMIT;   -- décommenter si vérif OK. SINON :  ROLLBACK;

-- ÉTAPE 2 — ROLLBACK (réversible ; si besoin APRÈS COMMIT, décommenter le bloc) :
-- BEGIN;
-- UPDATE "__seo_keywords" SET type_id = 13004 WHERE pg_id = 82 AND keyword = 'disque de frein 207' AND v_level = 'V2';
-- UPDATE "__seo_keywords" SET type_id = 13004 WHERE pg_id = 82 AND keyword = 'disque 207' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 13004 WHERE pg_id = 82 AND keyword = 'disque 207 prix' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 13004 WHERE pg_id = 82 AND keyword = 'disque arriere 207' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 13004 WHERE pg_id = 82 AND keyword = 'disque avant 207' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 13004 WHERE pg_id = 82 AND keyword = 'disque de frein 207 prix' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 13004 WHERE pg_id = 82 AND keyword = 'disque de frein arriere 207' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 13004 WHERE pg_id = 82 AND keyword = 'disque de frein avant 207' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 13004 WHERE pg_id = 82 AND keyword = 'disque de frein avant peugeot 207' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 13004 WHERE pg_id = 82 AND keyword = 'disque de frein peugeot 207' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 13004 WHERE pg_id = 82 AND keyword = 'disque de frein peugeot 207 prix' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 13004 WHERE pg_id = 82 AND keyword = 'disque et plaquette de frein 207' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 13004 WHERE pg_id = 82 AND keyword = 'disque et plaquette de frein 207 prix' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 13004 WHERE pg_id = 82 AND keyword = 'disque frein 207' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 13004 WHERE pg_id = 82 AND keyword = 'disque frein peugeot 207' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 13004 WHERE pg_id = 82 AND keyword = 'disque peugeot 207' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 13004 WHERE pg_id = 82 AND keyword = 'disque plaquette 207' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 13004 WHERE pg_id = 82 AND keyword = 'frein 207' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 13004 WHERE pg_id = 82 AND keyword = 'prix disque de frein 207' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 13004 WHERE pg_id = 82 AND keyword = 'prix disque et plaquette de frein peugeot 207' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 8683 WHERE pg_id = 82 AND keyword = 'prix disque et plaquette de frein peugeot 208' AND v_level = 'V2';
-- UPDATE "__seo_keywords" SET type_id = 8683 WHERE pg_id = 82 AND keyword = 'disque 208' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 8683 WHERE pg_id = 82 AND keyword = 'disque arriere 208' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 8683 WHERE pg_id = 82 AND keyword = 'disque arriere peugeot 208' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 8683 WHERE pg_id = 82 AND keyword = 'disque de frein 208' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 8683 WHERE pg_id = 82 AND keyword = 'disque de frein arriere 208' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 8683 WHERE pg_id = 82 AND keyword = 'disque de frein peugeot 208' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 8683 WHERE pg_id = 82 AND keyword = 'disque et plaquette de frein 208 prix' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 8683 WHERE pg_id = 82 AND keyword = 'disque frein peugeot 208' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 8683 WHERE pg_id = 82 AND keyword = 'disque peugeot 208' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 8683 WHERE pg_id = 82 AND keyword = 'disque plaquette 208' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 8683 WHERE pg_id = 82 AND keyword = 'frein 208' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 8683 WHERE pg_id = 82 AND keyword = 'prix disque de frein peugeot 208' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 8683 WHERE pg_id = 82 AND keyword = 'prix disque et plaquette de frein 208' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 30821 WHERE pg_id = 82 AND keyword = 'prix disque et plaquette de frein peugeot 3008' AND v_level = 'V2';
-- UPDATE "__seo_keywords" SET type_id = 30821 WHERE pg_id = 82 AND keyword = 'disque 3008' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 30821 WHERE pg_id = 82 AND keyword = 'disque arriere 3008' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 30821 WHERE pg_id = 82 AND keyword = 'disque de frein 3008' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 30821 WHERE pg_id = 82 AND keyword = 'disque de frein 3008 prix' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 30821 WHERE pg_id = 82 AND keyword = 'disque de frein arriere 3008' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 30821 WHERE pg_id = 82 AND keyword = 'disque de frein peugeot 3008' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 30821 WHERE pg_id = 82 AND keyword = 'disque et plaquette de frein peugeot 3008' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 30821 WHERE pg_id = 82 AND keyword = 'disque frein 3008' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 30821 WHERE pg_id = 82 AND keyword = 'disque peugeot 3008' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 23379 WHERE pg_id = 82 AND keyword = 'disque 308' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 23379 WHERE pg_id = 82 AND keyword = 'disque arriere 308' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 23379 WHERE pg_id = 82 AND keyword = 'disque arrière 308 avec roulement' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 23379 WHERE pg_id = 82 AND keyword = 'disque avant 308' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 23379 WHERE pg_id = 82 AND keyword = 'disque de frein 308' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 23379 WHERE pg_id = 82 AND keyword = 'disque de frein 308 prix' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 23379 WHERE pg_id = 82 AND keyword = 'disque de frein arriere 308' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 23379 WHERE pg_id = 82 AND keyword = 'disque de frein arrière peugeot 308' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 23379 WHERE pg_id = 82 AND keyword = 'disque de frein peugeot 308' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 23379 WHERE pg_id = 82 AND keyword = 'disque de frein peugeot 308 prix' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 23379 WHERE pg_id = 82 AND keyword = 'disque frein 308' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 23379 WHERE pg_id = 82 AND keyword = 'disque frein peugeot 308' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 23379 WHERE pg_id = 82 AND keyword = 'disque peugeot 308' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 23379 WHERE pg_id = 82 AND keyword = 'disque plaquette 308' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 23379 WHERE pg_id = 82 AND keyword = 'prix disque et plaquette de frein 308' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 23379 WHERE pg_id = 82 AND keyword = 'prix disque et plaquette de frein peugeot 308' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 9040 WHERE pg_id = 82 AND keyword = 'disque de frein clio 2' AND v_level = 'V2';
-- UPDATE "__seo_keywords" SET type_id = 9040 WHERE pg_id = 82 AND keyword = 'disque avant clio 2' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 9040 WHERE pg_id = 82 AND keyword = 'disque clio 2' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 9040 WHERE pg_id = 82 AND keyword = 'disque de frein avant clio 2' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 9040 WHERE pg_id = 82 AND keyword = 'disque de frein clio 2 prix' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 9040 WHERE pg_id = 82 AND keyword = 'disque et plaquette clio 2' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 9040 WHERE pg_id = 82 AND keyword = 'disque et plaquette de frein clio 2 prix' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 9040 WHERE pg_id = 82 AND keyword = 'disque frein clio 2' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 9040 WHERE pg_id = 82 AND keyword = 'disque plaquette clio 2' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 9040 WHERE pg_id = 82 AND keyword = 'frein clio 2' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 9040 WHERE pg_id = 82 AND keyword = 'prix disque de frein clio 2' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 11056 WHERE pg_id = 82 AND keyword = 'disque clio 3' AND v_level = 'V2';
-- UPDATE "__seo_keywords" SET type_id = 11056 WHERE pg_id = 82 AND keyword = 'disque arriere clio 3' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 11056 WHERE pg_id = 82 AND keyword = 'disque avant clio 3' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 11056 WHERE pg_id = 82 AND keyword = 'disque clio 3 prix' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 11056 WHERE pg_id = 82 AND keyword = 'disque de frein arriere clio 3' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 11056 WHERE pg_id = 82 AND keyword = 'disque de frein avant clio 3' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 11056 WHERE pg_id = 82 AND keyword = 'disque de frein clio 3' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 11056 WHERE pg_id = 82 AND keyword = 'disque de frein clio 3 prix' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 11056 WHERE pg_id = 82 AND keyword = 'disque et plaquette clio 3' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 11056 WHERE pg_id = 82 AND keyword = 'disque et plaquette de frein clio 3' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 11056 WHERE pg_id = 82 AND keyword = 'disque et plaquette de frein clio 3 prix' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 11056 WHERE pg_id = 82 AND keyword = 'disque frein avant clio 3' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 11056 WHERE pg_id = 82 AND keyword = 'disque frein clio 3' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 11056 WHERE pg_id = 82 AND keyword = 'disque frein clio 3 prix' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 11056 WHERE pg_id = 82 AND keyword = 'disque plaquette clio 3' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 11056 WHERE pg_id = 82 AND keyword = 'disque plaquette de frein clio 3' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 11056 WHERE pg_id = 82 AND keyword = 'plaquette de frein prix clio 3' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 11056 WHERE pg_id = 82 AND keyword = 'prix disque de frein clio 3' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 11056 WHERE pg_id = 82 AND keyword = 'prix plaquette de frein et disque clio 3' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 371 WHERE pg_id = 82 AND keyword = 'disque arriere megane 3' AND v_level = 'V2';
-- UPDATE "__seo_keywords" SET type_id = 371 WHERE pg_id = 82 AND keyword = 'disque avant megane 3' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 371 WHERE pg_id = 82 AND keyword = 'disque de frein arriere megane 3' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 371 WHERE pg_id = 82 AND keyword = 'disque de frein arrière megane 3 avec roulement' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 371 WHERE pg_id = 82 AND keyword = 'disque de frein avant megane 3' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 371 WHERE pg_id = 82 AND keyword = 'disque de frein megane 3' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 371 WHERE pg_id = 82 AND keyword = 'disque de frein megane 3 prix' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 371 WHERE pg_id = 82 AND keyword = 'disque de frein renault megane 3' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 371 WHERE pg_id = 82 AND keyword = 'disque et plaquette de frein arrière megane 3' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 371 WHERE pg_id = 82 AND keyword = 'disque et plaquette de frein megane 3 prix' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 371 WHERE pg_id = 82 AND keyword = 'disque frein arriere megane 3' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 371 WHERE pg_id = 82 AND keyword = 'disque frein avant megane 3' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 371 WHERE pg_id = 82 AND keyword = 'disque frein megane 3' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 371 WHERE pg_id = 82 AND keyword = 'disque megane 3' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 371 WHERE pg_id = 82 AND keyword = 'disque plaquette megane 3' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 371 WHERE pg_id = 82 AND keyword = 'frein arriere megane 3' AND v_level = 'V4';
-- UPDATE "__seo_keywords" SET type_id = 371 WHERE pg_id = 82 AND keyword = 'prix disque de frein megane 3' AND v_level = 'V4';
-- COMMIT;

-- ÉTAPE 3 — SNAPSHOT AFTER : ré-exécuter le SELECT ÉTAPE 0 et comparer à BEFORE.
