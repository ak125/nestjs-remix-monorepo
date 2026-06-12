-- ====================================================================
-- V-LEVEL APPLY — champions V3 BLOCKED cas CLAIRS -> rendables — freinage (pg 82/402/124) · 2026-06-07
-- 12 lignes : RESOLVE_CANDIDATE=6 · REMAP_REVIEW(TecDoc rendable)=6.
-- Transforme UNIQUEMENT des champions cassés (type_id NULL/non-rendable) en champions rendables (display=1).
-- EXCLUS (confirmés) : DEFER_CATALOG=2 · QUARANTINE_CANDIDATE=3 · REMAP_REVIEW=1 · V5 · 206 · clio 3 1.5 dci · autres gammes.
-- NE PAS mélanger avec décontamination / réélection / V5 / quarantine / wrong_gamme.
-- OWNER-GATED · RÉVERSIBLE · ZÉRO PROD · GÉNÉRÉ. Tous candidats re-vérifiés display=1.
-- ====================================================================

-- ÉTAPE 0 — BEFORE (état cassé : type_id NULL ou TecDoc non-affiché) :
SELECT k.pg_id, k.keyword, k.v_level, k.type_id, t.type_display
FROM "__seo_keywords" k LEFT JOIN auto_type t ON t.type_id = k.type_id::text
WHERE (k.pg_id, k.keyword) IN ((82,'disque de frein twingo 3'), (82,'disque megane 4'), (402,'plaquette de frein 1.0 sce'), (402,'plaquette de frein 1.3 cdti'), (402,'plaquette de frein 1.8 rs tce'), (402,'plaquette de frein corsa e 1.0'), (82,'disque de frein 207 1.4 essence'), (82,'disque de frein scenic 1 phase 2'), (82,'disque de frein scenic 2 1.9 dci'), (82,'disque scenic 2'), (402,'disque et plaquette de frein arrière scenic 2'), (402,'disque plaquette scenic 3'))
  AND k.v_level='V3' ORDER BY k.pg_id, k.keyword;

-- ÉTAPE 1 — APPLY (transaction gardée ; COMMIT après AFTER conforme) :
BEGIN;
DO $$ DECLARE n int;
BEGIN
  UPDATE "__seo_keywords" k SET type_id = s.new_tid::int, updated_at = now()
  FROM (VALUES
    (82, 'disque de frein twingo 3', '108062', '77670'),  -- TECDOC_ORPHAN REMAP_REVIEW -> /pieces/disque-de-frein-82/renault-140/twingo-iii-140170/z-e-77670.html
    (82, 'disque megane 4', '117850', '77593'),  -- TECDOC_ORPHAN REMAP_REVIEW -> /pieces/disque-de-frein-82/renault-140/megane-iv-140159/1-6-dci-77593.html
    (402, 'plaquette de frein 1.0 sce', '108062', '77670'),  -- TECDOC_ORPHAN REMAP_REVIEW [!!CYLINDREE != keyword] -> /pieces/plaquette-de-frein-402/renault-140/twingo-iii-140170/z-e-77670.html
    (402, 'plaquette de frein 1.3 cdti', '107798', '76009'),  -- TECDOC_ORPHAN REMAP_REVIEW -> /pieces/plaquette-de-frein-402/opel-123/corsa-e-123159/1-3-cdti-76009.html
    (402, 'plaquette de frein 1.8 rs tce', '130043', '77587'),  -- TECDOC_ORPHAN REMAP_REVIEW [!!CYLINDREE != keyword] -> /pieces/plaquette-de-frein-402/renault-140/megane-iv-140159/1-3-tce-160-77587.html
    (402, 'plaquette de frein corsa e 1.0', '107793', '76014'),  -- TECDOC_ORPHAN REMAP_REVIEW [!!CYLINDREE != keyword] -> /pieces/plaquette-de-frein-402/opel-123/corsa-e-123159/1-4-lpg-76014.html
    (82, 'disque de frein 207 1.4 essence', '', '19350'),  -- TYPE_ID_NULL RESOLVE_CANDIDATE [!!CYLINDREE != keyword] -> /pieces/disque-de-frein-82/peugeot-128/207-128018/1-6-16v-19350.html
    (82, 'disque de frein scenic 1 phase 2', '', '54945'),  -- TYPE_ID_NULL RESOLVE_CANDIDATE -> /pieces/disque-de-frein-82/renault-140/scenic-i-140087/1-9-dci-rx4-54945.html
    (82, 'disque de frein scenic 2 1.9 dci', '', '19036'),  -- TYPE_ID_NULL RESOLVE_CANDIDATE -> /pieces/disque-de-frein-82/renault-140/scenic-ii-140088/1-9-dci-19036.html
    (82, 'disque scenic 2', '', '19036'),  -- TYPE_ID_NULL RESOLVE_CANDIDATE -> /pieces/disque-de-frein-82/renault-140/scenic-ii-140088/1-9-dci-19036.html
    (402, 'disque et plaquette de frein arrière scenic 2', '', '19036'),  -- TYPE_ID_NULL RESOLVE_CANDIDATE -> /pieces/plaquette-de-frein-402/renault-140/scenic-ii-140088/1-9-dci-19036.html
    (402, 'disque plaquette scenic 3', '', '5853')  -- TYPE_ID_NULL RESOLVE_CANDIDATE -> /pieces/plaquette-de-frein-402/renault-140/scenic-iii-140089/1-5-dci-5853.html
  ) AS s(pg, keyword, old_tid, new_tid)
  WHERE k.pg_id = s.pg AND k.keyword = s.keyword AND k.v_level = 'V3'
    AND coalesce(k.type_id::text, '') = s.old_tid;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 12 THEN RAISE EXCEPTION 'GUARD blocked-clear: % lignes (attendu 12) -- ROLLBACK', n; END IF;
  RAISE NOTICE 'OK: % champions cassés -> rendables', n;
END $$;

-- vérif AFTER (tous doivent être rendables : type_display=1) :
SELECT k.pg_id, k.keyword, k.type_id, m.modele_name, t.type_alias, t.type_display
FROM "__seo_keywords" k JOIN auto_type t ON t.type_id=k.type_id::text
JOIN auto_modele m ON m.modele_id=NULLIF(t.type_modele_id,'')::int
WHERE (k.pg_id, k.keyword) IN ((82,'disque de frein twingo 3'), (82,'disque megane 4'), (402,'plaquette de frein 1.0 sce'), (402,'plaquette de frein 1.3 cdti'), (402,'plaquette de frein 1.8 rs tce'), (402,'plaquette de frein corsa e 1.0'), (82,'disque de frein 207 1.4 essence'), (82,'disque de frein scenic 1 phase 2'), (82,'disque de frein scenic 2 1.9 dci'), (82,'disque scenic 2'), (402,'disque et plaquette de frein arrière scenic 2'), (402,'disque plaquette scenic 3'))
  AND k.v_level='V3' ORDER BY k.pg_id, k.keyword;

-- COMMIT;   -- décommenter si AFTER montre tous display=1. SINON : ROLLBACK;

-- ÉTAPE 2 — ROLLBACK (réversible ; restaure l'état cassé : NULL si old vide, sinon l'ancien type_id) :
-- BEGIN;
-- UPDATE "__seo_keywords" k SET type_id = CASE WHEN s.old_tid='' THEN NULL ELSE s.old_tid::int END, updated_at = now()
-- FROM (VALUES
--     (82, 'disque de frein twingo 3', '108062', '77670'),
--     (82, 'disque megane 4', '117850', '77593'),
--     (402, 'plaquette de frein 1.0 sce', '108062', '77670'),
--     (402, 'plaquette de frein 1.3 cdti', '107798', '76009'),
--     (402, 'plaquette de frein 1.8 rs tce', '130043', '77587'),
--     (402, 'plaquette de frein corsa e 1.0', '107793', '76014'),
--     (82, 'disque de frein 207 1.4 essence', '', '19350'),
--     (82, 'disque de frein scenic 1 phase 2', '', '54945'),
--     (82, 'disque de frein scenic 2 1.9 dci', '', '19036'),
--     (82, 'disque scenic 2', '', '19036'),
--     (402, 'disque et plaquette de frein arrière scenic 2', '', '19036'),
--     (402, 'disque plaquette scenic 3', '', '5853')
-- ) AS s(pg, keyword, old_tid, new_tid)
-- WHERE k.pg_id = s.pg AND k.keyword = s.keyword AND k.v_level = 'V3' AND k.type_id::text = s.new_tid;
-- COMMIT;
