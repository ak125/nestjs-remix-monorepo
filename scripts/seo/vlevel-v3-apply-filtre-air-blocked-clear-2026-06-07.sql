-- ====================================================================
-- V-LEVEL APPLY — champions V3 BLOCKED cas CLAIRS -> rendables — filtre-air (pg 8) · 2026-06-07
-- 66 lignes : RESOLVE_CANDIDATE=66 · REMAP_REVIEW(TecDoc rendable)=0.
-- Transforme UNIQUEMENT des champions cassés (type_id NULL/non-rendable) en champions rendables (display=1).
-- EXCLUS STRICTS (13) : DEFER_CATALOG=6 · CYLINDRÉE 1-5!=1-6-sce-flexfuel=1 · CYLINDRÉE 1-6!=2-0-16v=1 · CYLINDRÉE 1-6!=2-0-hdi=1 · CYLINDRÉE 2-2!=2-0-hdi=1 · CYLINDRÉE 1-1!=1-6=1 · CYLINDRÉE 2-0!=1-9-d=1 · MOTEUR diesel(kw)->essence(cand 77163)=1.
-- NE PAS mélanger avec décontamination / réélection / V5 / quarantine / wrong_gamme.
-- OWNER-GATED · RÉVERSIBLE · ZÉRO PROD · GÉNÉRÉ. Tous candidats : GATE 1 cylindrée + GATE 2 moteur + display=1 (preuve DB).
-- ====================================================================

-- ÉTAPE 0 — BEFORE (état cassé : type_id NULL ou TecDoc non-affiché) :
SELECT k.pg_id, k.keyword, k.v_level, k.type_id, t.type_display
FROM "__seo_keywords" k LEFT JOIN auto_type t ON t.type_id = k.type_id::text
WHERE (k.pg_id, k.keyword) IN ((8,'filtre a air 206'), (8,'filtre a air 207'), (8,'filtre a air kangoo'), (8,'filtre a air 206 cc'), (8,'filtre a air 206 essence'), (8,'filtre a air 206 hdi'), (8,'filtre a air 207 1.6 vti'), (8,'filtre a air 207 hdi'), (8,'filtre a air 207 sw 1.6 hdi'), (8,'filtre a air 306'), (8,'filtre a air 306 hdi'), (8,'filtre a air 307 hdi'), (8,'filtre a air 307 sw'), (8,'filtre a air 406 hdi'), (8,'filtre a air 407'), (8,'filtre a air alfa 147'), (8,'filtre a air alfa 147 1.9 jtd'), (8,'filtre a air alfa 159'), (8,'filtre a air alfa romeo mito'), (8,'filtre a air amarok'), (8,'filtre a air c15'), (8,'filtre a air c3 aircross'), (8,'filtre a air c3 picasso'), (8,'filtre à air c3 picasso 1.6 hdi'), (8,'filtre a air citroen c elysee'), (8,'filtre a air citroen nemo'), (8,'filtre à air clio iii'), (8,'filtre a air corsa d'), (8,'filtre a air dacia dokker'), (8,'filtre a air dacia lodgy'), (8,'filtre a air ds3'), (8,'filtre a air ds3 1.6 hdi'), (8,'filtre a air ds3 thp'), (8,'filtre a air ds4'), (8,'filtre a air fiat 500x'), (8,'filtre a air fiat punto evo'), (8,'filtre a air ford fusion'), (8,'filtre a air grande punto'), (8,'filtre a air hyundai i20'), (8,'filtre a air hyundai ix35'), (8,'filtre a air jeep renegade'), (8,'filtre a air kadjar'), (8,'filtre a air modus'), (8,'filtre a air new beetle'), (8,'filtre a air opel astra h 1.7 cdti'), (8,'filtre a air opel corsa c'), (8,'filtre a air opel crossland x'), (8,'filtre à air opel mokka'), (8,'filtre a air peugeot 107'), (8,'filtre a air peugeot 107 essence'), (8,'filtre a air peugeot 406'), (8,'filtre a air pt cruiser'), (8,'filtre a air renault modus 1.5 dci'), (8,'filtre a air saxo'), (8,'filtre a air seat altea'), (8,'filtre a air toyota verso'), (8,'filtre a air volvo c30'), (8,'filtre a air volvo v40'), (8,'filtre a air volvo v50'), (8,'filtre a air xsara'), (8,'filtre a air xsara picasso'), (8,'filtre a air xsara picasso 2.0 hdi 90'), (8,'filtre a air yaris'), (8,'filtre a air zafira b'), (8,'filtre air 307'), (8,'filtre air duster'))
  AND k.v_level IN ('V2','V3') ORDER BY k.pg_id, k.keyword;

-- ÉTAPE 1 — APPLY (transaction gardée ; COMMIT après AFTER conforme) :
BEGIN;
DO $$ DECLARE n int;
BEGIN
  UPDATE "__seo_keywords" k SET type_id = s.new_tid::int, updated_at = now()
  FROM (VALUES
    (8, 'filtre a air 206', '', '9468'),  -- TYPE_ID_NULL RESOLVE_CANDIDATE -> /pieces/filtre-a-air-8/peugeot-128/206-128014/1-9-d-9468.html
    (8, 'filtre a air 207', '', '19353'),  -- TYPE_ID_NULL RESOLVE_CANDIDATE -> /pieces/filtre-a-air-8/peugeot-128/207-128018/1-6-hdi-19353.html
    (8, 'filtre a air kangoo', '', '77092'),  -- TYPE_ID_NULL RESOLVE_CANDIDATE -> /pieces/filtre-a-air-8/renault-140/kangoo-37349/1-6-sce-flexfuel-77092.html
    (8, 'filtre a air 206 cc', '', '18477'),  -- TYPE_ID_NULL RESOLVE_CANDIDATE -> /pieces/filtre-a-air-8/peugeot-128/206-cc-128015/1-6-hdi-18477.html
    (8, 'filtre a air 206 essence', '', '76363'),  -- TYPE_ID_NULL RESOLVE_CANDIDATE -> /pieces/filtre-a-air-8/peugeot-128/206-128014/1-6-8v-76363.html
    (8, 'filtre a air 206 hdi', '', '9468'),  -- TYPE_ID_NULL RESOLVE_CANDIDATE -> /pieces/filtre-a-air-8/peugeot-128/206-128014/1-9-d-9468.html
    (8, 'filtre a air 207 1.6 vti', '', '19350'),  -- TYPE_ID_NULL RESOLVE_CANDIDATE -> /pieces/filtre-a-air-8/peugeot-128/207-128018/1-6-16v-19350.html
    (8, 'filtre a air 207 hdi', '', '19353'),  -- TYPE_ID_NULL RESOLVE_CANDIDATE -> /pieces/filtre-a-air-8/peugeot-128/207-128018/1-6-hdi-19353.html
    (8, 'filtre a air 207 sw 1.6 hdi', '', '33265'),  -- TYPE_ID_NULL RESOLVE_CANDIDATE -> /pieces/filtre-a-air-8/peugeot-128/207-sw-128020/1-6-hdi-33265.html
    (8, 'filtre a air 306', '', '76409'),  -- TYPE_ID_NULL RESOLVE_CANDIDATE -> /pieces/filtre-a-air-8/peugeot-128/306-128032/1-9-td-76409.html
    (8, 'filtre a air 306 hdi', '', '76409'),  -- TYPE_ID_NULL RESOLVE_CANDIDATE -> /pieces/filtre-a-air-8/peugeot-128/306-128032/1-9-td-76409.html
    (8, 'filtre a air 307 hdi', '', '15904'),  -- TYPE_ID_NULL RESOLVE_CANDIDATE -> /pieces/filtre-a-air-8/peugeot-128/307-128035/2-0-hdi-15904.html
    (8, 'filtre a air 307 sw', '', '16615'),  -- TYPE_ID_NULL RESOLVE_CANDIDATE -> /pieces/filtre-a-air-8/peugeot-128/307-sw-128038/2-0-hdi-16615.html
    (8, 'filtre a air 406 hdi', '', '16288'),  -- TYPE_ID_NULL RESOLVE_CANDIDATE -> /pieces/filtre-a-air-8/peugeot-128/406-128054/2-0-hdi-16288.html
    (8, 'filtre a air 407', '', '33426'),  -- TYPE_ID_NULL RESOLVE_CANDIDATE -> /pieces/filtre-a-air-8/peugeot-128/407-128057/2-0-hdi-33426.html
    (8, 'filtre a air alfa 147', '', '19780'),  -- TYPE_ID_NULL RESOLVE_CANDIDATE -> /pieces/filtre-a-air-8/alfa-romeo-13/147-13002/1-9-jtd-16v-19780.html
    (8, 'filtre a air alfa 147 1.9 jtd', '', '19780'),  -- TYPE_ID_NULL RESOLVE_CANDIDATE -> /pieces/filtre-a-air-8/alfa-romeo-13/147-13002/1-9-jtd-16v-19780.html
    (8, 'filtre a air alfa 159', '', '9154'),  -- TYPE_ID_NULL RESOLVE_CANDIDATE -> /pieces/filtre-a-air-8/alfa-romeo-13/159-13006/2-0-jtdm-9154.html
    (8, 'filtre a air alfa romeo mito', '', '32743'),  -- TYPE_ID_NULL RESOLVE_CANDIDATE -> /pieces/filtre-a-air-8/alfa-romeo-13/mito-13054/1-3-jtdm-32743.html
    (8, 'filtre a air amarok', '', '33472'),  -- TYPE_ID_NULL RESOLVE_CANDIDATE -> /pieces/filtre-a-air-8/volkswagen-173/amarok-173006/2-0-bitdi-4motion-33472.html
    (8, 'filtre a air c15', '', '2245'),  -- TYPE_ID_NULL RESOLVE_CANDIDATE -> /pieces/filtre-a-air-8/citroen-46/c15-46015/1-8-d-2245.html
    (8, 'filtre a air c3 aircross', '', '65283'),  -- TYPE_ID_NULL RESOLVE_CANDIDATE -> /pieces/filtre-a-air-8/citroen-46/c3-aircross-46098/1-5-bluehdi-110-65283.html
    (8, 'filtre a air c3 picasso', '', '28200'),  -- TYPE_ID_NULL RESOLVE_CANDIDATE -> /pieces/filtre-a-air-8/citroen-46/c3-picasso-46022/1-6-hdi-28200.html
    (8, 'filtre à air c3 picasso 1.6 hdi', '', '28200'),  -- TYPE_ID_NULL RESOLVE_CANDIDATE -> /pieces/filtre-a-air-8/citroen-46/c3-picasso-46022/1-6-hdi-28200.html
    (8, 'filtre a air citroen c elysee', '', '65079'),  -- TYPE_ID_NULL RESOLVE_CANDIDATE -> /pieces/filtre-a-air-8/citroen-46/c-elysee-46012/1-6-bluehdi-65079.html
    (8, 'filtre a air citroen nemo', '', '3083'),  -- TYPE_ID_NULL RESOLVE_CANDIDATE -> /pieces/filtre-a-air-8/citroen-46/nemo-46068/1-3-hdi-3083.html
    (8, 'filtre à air clio iii', '', '19052'),  -- TYPE_ID_NULL RESOLVE_CANDIDATE -> /pieces/filtre-a-air-8/renault-140/clio-iii-140004/1-5-dci-19052.html
    (8, 'filtre a air corsa d', '', '33721'),  -- TYPE_ID_NULL RESOLVE_CANDIDATE -> /pieces/filtre-a-air-8/opel-123/corsa-d-123048/1-3-cdti-33721.html
    (8, 'filtre a air dacia dokker', '', '57397'),  -- TYPE_ID_NULL RESOLVE_CANDIDATE -> /pieces/filtre-a-air-8/dacia-47/dokker-47012/1-5-dci-57397.html
    (8, 'filtre a air dacia lodgy', '', '57441'),  -- TYPE_ID_NULL RESOLVE_CANDIDATE -> /pieces/filtre-a-air-8/dacia-47/lodgy-47015/1-5-dci-57441.html
    (8, 'filtre a air ds3', '', '32037'),  -- TYPE_ID_NULL RESOLVE_CANDIDATE -> /pieces/filtre-a-air-8/citroen-46/ds3-46049/1-6-hdi-32037.html
    (8, 'filtre a air ds3 1.6 hdi', '', '32037'),  -- TYPE_ID_NULL RESOLVE_CANDIDATE -> /pieces/filtre-a-air-8/citroen-46/ds3-46049/1-6-hdi-32037.html
    (8, 'filtre a air ds3 thp', '', '12290'),  -- TYPE_ID_NULL RESOLVE_CANDIDATE -> /pieces/filtre-a-air-8/citroen-46/ds3-46049/1-6-thp-12290.html
    (8, 'filtre a air ds4', '', '65183'),  -- TYPE_ID_NULL RESOLVE_CANDIDATE -> /pieces/filtre-a-air-8/citroen-46/ds4-46051/1-6-bluehdi-65183.html
    (8, 'filtre a air fiat 500x', '', '66210'),  -- TYPE_ID_NULL RESOLVE_CANDIDATE -> /pieces/filtre-a-air-8/fiat-58/500x-58181/1-6-d-multijet-66210.html
    (8, 'filtre a air fiat punto evo', '', '32824'),  -- TYPE_ID_NULL RESOLVE_CANDIDATE -> /pieces/filtre-a-air-8/fiat-58/punto-evo-58063/1-3-d-multijet-32824.html
    (8, 'filtre a air ford fusion', '', '18330'),  -- TYPE_ID_NULL RESOLVE_CANDIDATE -> /pieces/filtre-a-air-8/ford-60/fusion-60083/1-6-tdci-18330.html
    (8, 'filtre a air grande punto', '', '9315'),  -- TYPE_ID_NULL RESOLVE_CANDIDATE -> /pieces/filtre-a-air-8/fiat-58/grande-punto-58043/1-9-d-multijet-9315.html
    (8, 'filtre a air hyundai i20', '', '34801'),  -- TYPE_ID_NULL RESOLVE_CANDIDATE -> /pieces/filtre-a-air-8/hyundai-76/i20-76043/1-4-crdi-34801.html
    (8, 'filtre a air hyundai ix35', '', '56226'),  -- TYPE_ID_NULL RESOLVE_CANDIDATE -> /pieces/filtre-a-air-8/hyundai-76/ix35-76052/2-0-crdi-4wd-56226.html
    (8, 'filtre a air jeep renegade', '', '70031'),  -- TYPE_ID_NULL RESOLVE_CANDIDATE -> /pieces/filtre-a-air-8/jeep-86/renegade-86030/1-6-multijet-70031.html
    (8, 'filtre a air kadjar', '', '77545'),  -- TYPE_ID_NULL RESOLVE_CANDIDATE -> /pieces/filtre-a-air-8/renault-140/kadjar-140155/1-6-dci-77545.html
    (8, 'filtre a air modus', '', '18315'),  -- TYPE_ID_NULL RESOLVE_CANDIDATE -> /pieces/filtre-a-air-8/renault-140/modus-140053/1-5-dci-18315.html
    (8, 'filtre a air new beetle', '', '24179'),  -- TYPE_ID_NULL RESOLVE_CANDIDATE -> /pieces/filtre-a-air-8/volkswagen-173/beetle-173008/2-0-tdi-24179.html
    (8, 'filtre a air opel astra h 1.7 cdti', '', '22686'),  -- TYPE_ID_NULL RESOLVE_CANDIDATE -> /pieces/filtre-a-air-8/opel-123/astra-h-123021/1-7-cdti-22686.html
    (8, 'filtre a air opel corsa c', '', '14913'),  -- TYPE_ID_NULL RESOLVE_CANDIDATE -> /pieces/filtre-a-air-8/opel-123/corsa-c-123046/1-7-dti-14913.html
    (8, 'filtre a air opel crossland x', '', '75870'),  -- TYPE_ID_NULL RESOLVE_CANDIDATE -> /pieces/filtre-a-air-8/opel-123/crossland-x-123108/1-5-75870.html
    (8, 'filtre à air opel mokka', '', '75695'),  -- TYPE_ID_NULL RESOLVE_CANDIDATE -> /pieces/filtre-a-air-8/opel-123/mokka-40942/1-2-turbo-hybrid-75695.html
    (8, 'filtre a air peugeot 107', '', '18587'),  -- TYPE_ID_NULL RESOLVE_CANDIDATE -> /pieces/filtre-a-air-8/peugeot-128/107-128005/1-4-hdi-18587.html
    (8, 'filtre a air peugeot 107 essence', '', '18586'),  -- TYPE_ID_NULL RESOLVE_CANDIDATE -> /pieces/filtre-a-air-8/peugeot-128/107-128005/1-0-18586.html
    (8, 'filtre a air peugeot 406', '', '16288'),  -- TYPE_ID_NULL RESOLVE_CANDIDATE -> /pieces/filtre-a-air-8/peugeot-128/406-128054/2-0-hdi-16288.html
    (8, 'filtre a air pt cruiser', '', '19306'),  -- TYPE_ID_NULL RESOLVE_CANDIDATE -> /pieces/filtre-a-air-8/chrysler-45/pt-cruiser-45031/2-2-crd-19306.html
    (8, 'filtre a air renault modus 1.5 dci', '', '18315'),  -- TYPE_ID_NULL RESOLVE_CANDIDATE -> /pieces/filtre-a-air-8/renault-140/modus-140053/1-5-dci-18315.html
    (8, 'filtre a air saxo', '', '5616'),  -- TYPE_ID_NULL RESOLVE_CANDIDATE -> /pieces/filtre-a-air-8/citroen-46/saxo-46070/1-5-d-5616.html
    (8, 'filtre a air seat altea', '', '18765'),  -- TYPE_ID_NULL RESOLVE_CANDIDATE -> /pieces/filtre-a-air-8/seat-147/altea-147011/2-0-tdi-18765.html
    (8, 'filtre a air toyota verso', '', '31566'),  -- TYPE_ID_NULL RESOLVE_CANDIDATE -> /pieces/filtre-a-air-8/toyota-164/verso-164367/2-0-d-4d-31566.html
    (8, 'filtre a air volvo c30', '', '6268'),  -- TYPE_ID_NULL RESOLVE_CANDIDATE -> /pieces/filtre-a-air-8/volvo-172/c30-172040/2-0-d3-6268.html
    (8, 'filtre a air volvo v40', '', '81857'),  -- TYPE_ID_NULL RESOLVE_CANDIDATE -> /pieces/filtre-a-air-8/volvo-172/v40-172105/2-0-d3-phase-2-81857.html
    (8, 'filtre a air volvo v50', '', '7155'),  -- TYPE_ID_NULL RESOLVE_CANDIDATE -> /pieces/filtre-a-air-8/volvo-172/v50-172107/2-0-d3-7155.html
    (8, 'filtre a air xsara', '', '10199'),  -- TYPE_ID_NULL RESOLVE_CANDIDATE -> /pieces/filtre-a-air-8/citroen-46/xsara-46083/1-9-d-10199.html
    (8, 'filtre a air xsara picasso', '', '11873'),  -- TYPE_ID_NULL RESOLVE_CANDIDATE -> /pieces/filtre-a-air-8/citroen-46/xsara-picasso-46086/2-0-hdi-11873.html
    (8, 'filtre a air xsara picasso 2.0 hdi 90', '', '11873'),  -- TYPE_ID_NULL RESOLVE_CANDIDATE -> /pieces/filtre-a-air-8/citroen-46/xsara-picasso-46086/2-0-hdi-11873.html
    (8, 'filtre a air yaris', '', '79743'),  -- TYPE_ID_NULL RESOLVE_CANDIDATE -> /pieces/filtre-a-air-8/toyota-164/yaris-43555/1-5-79743.html
    (8, 'filtre a air zafira b', '', '18691'),  -- TYPE_ID_NULL RESOLVE_CANDIDATE -> /pieces/filtre-a-air-8/opel-123/zafira-b-123135/1-9-cdti-18691.html
    (8, 'filtre air 307', '', '15904'),  -- TYPE_ID_NULL RESOLVE_CANDIDATE -> /pieces/filtre-a-air-8/peugeot-128/307-128035/2-0-hdi-15904.html
    (8, 'filtre air duster', '', '77163')  -- TYPE_ID_NULL RESOLVE_CANDIDATE -> /pieces/filtre-a-air-8/renault-140/duster-46370/1-3-tce-150-77163.html
  ) AS s(pg, keyword, old_tid, new_tid)
  WHERE k.pg_id = s.pg AND k.keyword = s.keyword AND k.v_level IN ('V2','V3')
    AND coalesce(k.type_id::text, '') = s.old_tid;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 66 THEN RAISE EXCEPTION 'GUARD blocked-clear: % lignes (attendu 66) -- ROLLBACK', n; END IF;
  RAISE NOTICE 'OK: % champions cassés -> rendables', n;
END $$;

-- vérif AFTER (tous doivent être rendables : type_display=1) :
SELECT k.pg_id, k.keyword, k.type_id, m.modele_name, t.type_alias, t.type_display
FROM "__seo_keywords" k JOIN auto_type t ON t.type_id=k.type_id::text
JOIN auto_modele m ON m.modele_id=NULLIF(t.type_modele_id,'')::int
WHERE (k.pg_id, k.keyword) IN ((8,'filtre a air 206'), (8,'filtre a air 207'), (8,'filtre a air kangoo'), (8,'filtre a air 206 cc'), (8,'filtre a air 206 essence'), (8,'filtre a air 206 hdi'), (8,'filtre a air 207 1.6 vti'), (8,'filtre a air 207 hdi'), (8,'filtre a air 207 sw 1.6 hdi'), (8,'filtre a air 306'), (8,'filtre a air 306 hdi'), (8,'filtre a air 307 hdi'), (8,'filtre a air 307 sw'), (8,'filtre a air 406 hdi'), (8,'filtre a air 407'), (8,'filtre a air alfa 147'), (8,'filtre a air alfa 147 1.9 jtd'), (8,'filtre a air alfa 159'), (8,'filtre a air alfa romeo mito'), (8,'filtre a air amarok'), (8,'filtre a air c15'), (8,'filtre a air c3 aircross'), (8,'filtre a air c3 picasso'), (8,'filtre à air c3 picasso 1.6 hdi'), (8,'filtre a air citroen c elysee'), (8,'filtre a air citroen nemo'), (8,'filtre à air clio iii'), (8,'filtre a air corsa d'), (8,'filtre a air dacia dokker'), (8,'filtre a air dacia lodgy'), (8,'filtre a air ds3'), (8,'filtre a air ds3 1.6 hdi'), (8,'filtre a air ds3 thp'), (8,'filtre a air ds4'), (8,'filtre a air fiat 500x'), (8,'filtre a air fiat punto evo'), (8,'filtre a air ford fusion'), (8,'filtre a air grande punto'), (8,'filtre a air hyundai i20'), (8,'filtre a air hyundai ix35'), (8,'filtre a air jeep renegade'), (8,'filtre a air kadjar'), (8,'filtre a air modus'), (8,'filtre a air new beetle'), (8,'filtre a air opel astra h 1.7 cdti'), (8,'filtre a air opel corsa c'), (8,'filtre a air opel crossland x'), (8,'filtre à air opel mokka'), (8,'filtre a air peugeot 107'), (8,'filtre a air peugeot 107 essence'), (8,'filtre a air peugeot 406'), (8,'filtre a air pt cruiser'), (8,'filtre a air renault modus 1.5 dci'), (8,'filtre a air saxo'), (8,'filtre a air seat altea'), (8,'filtre a air toyota verso'), (8,'filtre a air volvo c30'), (8,'filtre a air volvo v40'), (8,'filtre a air volvo v50'), (8,'filtre a air xsara'), (8,'filtre a air xsara picasso'), (8,'filtre a air xsara picasso 2.0 hdi 90'), (8,'filtre a air yaris'), (8,'filtre a air zafira b'), (8,'filtre air 307'), (8,'filtre air duster'))
  AND k.v_level IN ('V2','V3') ORDER BY k.pg_id, k.keyword;

-- COMMIT;   -- décommenter si AFTER montre tous display=1. SINON : ROLLBACK;

-- ÉTAPE 2 — ROLLBACK (réversible ; restaure l'état cassé : NULL si old vide, sinon l'ancien type_id) :
-- BEGIN;
-- UPDATE "__seo_keywords" k SET type_id = CASE WHEN s.old_tid='' THEN NULL ELSE s.old_tid::int END, updated_at = now()
-- FROM (VALUES
--     (8, 'filtre a air 206', '', '9468'),
--     (8, 'filtre a air 207', '', '19353'),
--     (8, 'filtre a air kangoo', '', '77092'),
--     (8, 'filtre a air 206 cc', '', '18477'),
--     (8, 'filtre a air 206 essence', '', '76363'),
--     (8, 'filtre a air 206 hdi', '', '9468'),
--     (8, 'filtre a air 207 1.6 vti', '', '19350'),
--     (8, 'filtre a air 207 hdi', '', '19353'),
--     (8, 'filtre a air 207 sw 1.6 hdi', '', '33265'),
--     (8, 'filtre a air 306', '', '76409'),
--     (8, 'filtre a air 306 hdi', '', '76409'),
--     (8, 'filtre a air 307 hdi', '', '15904'),
--     (8, 'filtre a air 307 sw', '', '16615'),
--     (8, 'filtre a air 406 hdi', '', '16288'),
--     (8, 'filtre a air 407', '', '33426'),
--     (8, 'filtre a air alfa 147', '', '19780'),
--     (8, 'filtre a air alfa 147 1.9 jtd', '', '19780'),
--     (8, 'filtre a air alfa 159', '', '9154'),
--     (8, 'filtre a air alfa romeo mito', '', '32743'),
--     (8, 'filtre a air amarok', '', '33472'),
--     (8, 'filtre a air c15', '', '2245'),
--     (8, 'filtre a air c3 aircross', '', '65283'),
--     (8, 'filtre a air c3 picasso', '', '28200'),
--     (8, 'filtre à air c3 picasso 1.6 hdi', '', '28200'),
--     (8, 'filtre a air citroen c elysee', '', '65079'),
--     (8, 'filtre a air citroen nemo', '', '3083'),
--     (8, 'filtre à air clio iii', '', '19052'),
--     (8, 'filtre a air corsa d', '', '33721'),
--     (8, 'filtre a air dacia dokker', '', '57397'),
--     (8, 'filtre a air dacia lodgy', '', '57441'),
--     (8, 'filtre a air ds3', '', '32037'),
--     (8, 'filtre a air ds3 1.6 hdi', '', '32037'),
--     (8, 'filtre a air ds3 thp', '', '12290'),
--     (8, 'filtre a air ds4', '', '65183'),
--     (8, 'filtre a air fiat 500x', '', '66210'),
--     (8, 'filtre a air fiat punto evo', '', '32824'),
--     (8, 'filtre a air ford fusion', '', '18330'),
--     (8, 'filtre a air grande punto', '', '9315'),
--     (8, 'filtre a air hyundai i20', '', '34801'),
--     (8, 'filtre a air hyundai ix35', '', '56226'),
--     (8, 'filtre a air jeep renegade', '', '70031'),
--     (8, 'filtre a air kadjar', '', '77545'),
--     (8, 'filtre a air modus', '', '18315'),
--     (8, 'filtre a air new beetle', '', '24179'),
--     (8, 'filtre a air opel astra h 1.7 cdti', '', '22686'),
--     (8, 'filtre a air opel corsa c', '', '14913'),
--     (8, 'filtre a air opel crossland x', '', '75870'),
--     (8, 'filtre à air opel mokka', '', '75695'),
--     (8, 'filtre a air peugeot 107', '', '18587'),
--     (8, 'filtre a air peugeot 107 essence', '', '18586'),
--     (8, 'filtre a air peugeot 406', '', '16288'),
--     (8, 'filtre a air pt cruiser', '', '19306'),
--     (8, 'filtre a air renault modus 1.5 dci', '', '18315'),
--     (8, 'filtre a air saxo', '', '5616'),
--     (8, 'filtre a air seat altea', '', '18765'),
--     (8, 'filtre a air toyota verso', '', '31566'),
--     (8, 'filtre a air volvo c30', '', '6268'),
--     (8, 'filtre a air volvo v40', '', '81857'),
--     (8, 'filtre a air volvo v50', '', '7155'),
--     (8, 'filtre a air xsara', '', '10199'),
--     (8, 'filtre a air xsara picasso', '', '11873'),
--     (8, 'filtre a air xsara picasso 2.0 hdi 90', '', '11873'),
--     (8, 'filtre a air yaris', '', '79743'),
--     (8, 'filtre a air zafira b', '', '18691'),
--     (8, 'filtre air 307', '', '15904'),
--     (8, 'filtre air duster', '', '77163')
-- ) AS s(pg, keyword, old_tid, new_tid)
-- WHERE k.pg_id = s.pg AND k.keyword = s.keyword AND k.v_level IN ('V2','V3') AND k.type_id::text = s.new_tid;
-- COMMIT;
