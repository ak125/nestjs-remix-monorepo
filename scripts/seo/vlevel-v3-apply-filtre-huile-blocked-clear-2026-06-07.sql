-- ====================================================================
-- V-LEVEL APPLY — champions V3 BLOCKED cas CLAIRS -> rendables — filtre-huile (pg 7) · 2026-06-07
-- 8 lignes : RESOLVE_CANDIDATE=6 · REMAP_REVIEW(TecDoc rendable)=2.
-- Transforme UNIQUEMENT des champions cassés (type_id NULL/non-rendable) en champions rendables (display=1).
-- EXCLUS STRICTS (11) : PARSER_RETRY_CANDIDATE=1 · QUARANTINE_CANDIDATE=2 · DEFER_CATALOG=1 · CYLINDRÉE 2-0!=1-6-16v=1 · CYLINDRÉE 1-2!=1-6-hybrid=1 · CYLINDRÉE 1-0!=1-4-lpg=1 · CYLINDRÉE 1-2!=1-3-tce-160=1 · CYLINDRÉE 1-5!=1-9-dci=1 · MOTEUR electrique = pas de filtre (gamme combustion)=1 · MOTEUR essence(kw)->diesel(cand 60761)=1.
-- NE PAS mélanger avec décontamination / réélection / V5 / quarantine / wrong_gamme.
-- OWNER-GATED · RÉVERSIBLE · ZÉRO PROD · GÉNÉRÉ. Tous candidats : GATE 1 cylindrée + GATE 2 moteur + display=1 (preuve DB).
-- ====================================================================

-- ÉTAPE 0 — BEFORE (état cassé : type_id NULL ou TecDoc non-affiché) :
SELECT k.pg_id, k.keyword, k.v_level, k.type_id, t.type_display
FROM "__seo_keywords" k LEFT JOIN auto_type t ON t.type_id = k.type_id::text
WHERE (k.pg_id, k.keyword) IN ((7,'filtre à huile megane 4 1.6 dci 130'), (7,'filtre à huile 1.3 cdti'), (7,'filtre à huile clio 5 dci'), (7,'filtre à huile golf 6'), (7,'filtre à huile golf 7'), (7,'filtre à huile renault scenic 3'), (7,'filtre à huile scenic 2'), (7,'filtre à huile scenic 3 1.5 dci 110'))
  AND k.v_level='V3' ORDER BY k.pg_id, k.keyword;

-- ÉTAPE 1 — APPLY (transaction gardée ; COMMIT après AFTER conforme) :
BEGIN;
DO $$ DECLARE n int;
BEGIN
  UPDATE "__seo_keywords" k SET type_id = s.new_tid::int, updated_at = now()
  FROM (VALUES
    (7, 'filtre à huile megane 4 1.6 dci 130', '117856', '77593'),  -- TECDOC_ORPHAN REMAP_REVIEW -> /pieces/filtre-a-huile-7/renault-140/megane-iv-140159/1-6-dci-77593.html
    (7, 'filtre à huile 1.3 cdti', '107798', '76009'),  -- TECDOC_ORPHAN REMAP_REVIEW -> /pieces/filtre-a-huile-7/opel-123/corsa-e-123159/1-3-cdti-76009.html
    (7, 'filtre à huile clio 5 dci', '', '77702'),  -- TYPE_ID_NULL RESOLVE_CANDIDATE -> /pieces/filtre-a-huile-7/renault-140/clio-v-140174/1-5-blue-dci-100-77702.html
    (7, 'filtre à huile golf 6', '', '32063'),  -- TYPE_ID_NULL RESOLVE_CANDIDATE -> /pieces/filtre-a-huile-7/volkswagen-173/golf-vi-173046/2-0-tdi-32063.html
    (7, 'filtre à huile golf 7', '', '82351'),  -- TYPE_ID_NULL RESOLVE_CANDIDATE -> /pieces/filtre-a-huile-7/volkswagen-173/golf-vii-173049/1-6-tdi-82351.html
    (7, 'filtre à huile renault scenic 3', '', '5853'),  -- TYPE_ID_NULL RESOLVE_CANDIDATE -> /pieces/filtre-a-huile-7/renault-140/scenic-iii-140089/1-5-dci-5853.html
    (7, 'filtre à huile scenic 2', '', '19036'),  -- TYPE_ID_NULL RESOLVE_CANDIDATE -> /pieces/filtre-a-huile-7/renault-140/scenic-ii-140088/1-9-dci-19036.html
    (7, 'filtre à huile scenic 3 1.5 dci 110', '', '5853')  -- TYPE_ID_NULL RESOLVE_CANDIDATE -> /pieces/filtre-a-huile-7/renault-140/scenic-iii-140089/1-5-dci-5853.html
  ) AS s(pg, keyword, old_tid, new_tid)
  WHERE k.pg_id = s.pg AND k.keyword = s.keyword AND k.v_level = 'V3'
    AND coalesce(k.type_id::text, '') = s.old_tid;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 8 THEN RAISE EXCEPTION 'GUARD blocked-clear: % lignes (attendu 8) -- ROLLBACK', n; END IF;
  RAISE NOTICE 'OK: % champions cassés -> rendables', n;
END $$;

-- vérif AFTER (tous doivent être rendables : type_display=1) :
SELECT k.pg_id, k.keyword, k.type_id, m.modele_name, t.type_alias, t.type_display
FROM "__seo_keywords" k JOIN auto_type t ON t.type_id=k.type_id::text
JOIN auto_modele m ON m.modele_id=NULLIF(t.type_modele_id,'')::int
WHERE (k.pg_id, k.keyword) IN ((7,'filtre à huile megane 4 1.6 dci 130'), (7,'filtre à huile 1.3 cdti'), (7,'filtre à huile clio 5 dci'), (7,'filtre à huile golf 6'), (7,'filtre à huile golf 7'), (7,'filtre à huile renault scenic 3'), (7,'filtre à huile scenic 2'), (7,'filtre à huile scenic 3 1.5 dci 110'))
  AND k.v_level='V3' ORDER BY k.pg_id, k.keyword;

-- COMMIT;   -- décommenter si AFTER montre tous display=1. SINON : ROLLBACK;

-- ÉTAPE 2 — ROLLBACK (réversible ; restaure l'état cassé : NULL si old vide, sinon l'ancien type_id) :
-- BEGIN;
-- UPDATE "__seo_keywords" k SET type_id = CASE WHEN s.old_tid='' THEN NULL ELSE s.old_tid::int END, updated_at = now()
-- FROM (VALUES
--     (7, 'filtre à huile megane 4 1.6 dci 130', '117856', '77593'),
--     (7, 'filtre à huile 1.3 cdti', '107798', '76009'),
--     (7, 'filtre à huile clio 5 dci', '', '77702'),
--     (7, 'filtre à huile golf 6', '', '32063'),
--     (7, 'filtre à huile golf 7', '', '82351'),
--     (7, 'filtre à huile renault scenic 3', '', '5853'),
--     (7, 'filtre à huile scenic 2', '', '19036'),
--     (7, 'filtre à huile scenic 3 1.5 dci 110', '', '5853')
-- ) AS s(pg, keyword, old_tid, new_tid)
-- WHERE k.pg_id = s.pg AND k.keyword = s.keyword AND k.v_level = 'V3' AND k.type_id::text = s.new_tid;
-- COMMIT;
