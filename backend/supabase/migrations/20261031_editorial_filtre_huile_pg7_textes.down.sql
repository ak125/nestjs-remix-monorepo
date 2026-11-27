-- Rollback: 20261031_editorial_filtre_huile_pg7_textes
-- FICHIER GÉNÉRÉ par docs/audits/editorial-filtre-huile-20261030/tools/build-publication-migration.cjs
-- depuis le dossier (integration/avant-textes.json, publication-batch.json,
-- r1.json, r3.json, assets.json). Ne pas l'éditer à la main : `--check`
-- échoue sur tout écart. Identifiant : 20261031_editorial_filtre_huile_pg7_textes.
-- Remet la valeur relevée le 2026-10-31 dans chaque cellule encore égale à la
-- valeur écrite par 20261031_editorial_filtre_huile_pg7_textes.sql ; une cellule modifiée
-- depuis arrête tout (DERIVE). Mêmes pré-conditions et même identité
-- SEO-Content que l'écriture. Le trigger d'accents repasse sur les valeurs
-- remises : une valeur relevée qui n'en est pas un point fixe revient sous sa
-- forme accentuée (état RETOUR), r1s_updated_at prend la date du retour. Retour
-- à l'octet impossible sans désactiver un trigger, ce que le lot s'interdit.
-- Caches de pg 7 invalidés dans la transaction ; caches Redis et CDN comme
-- pour l'écriture (publication-batch.json).
-- L'engine est forward-only : ce fichier se lance à la main, sur GO owner.
-- Auto-transactionnel : BEGIN / COMMIT portés par le fichier, SET LOCAL bornés à lui.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, pg_temp;

DO $precheck$
DECLARE
  v_n   bigint;
  v_txt text;
BEGIN
  SELECT format('%s|%s|%s|%s', md5(p.prosrc), p.prosecdef, p.provolatile, p.proconfig) INTO v_txt
    FROM pg_proc p WHERE p.oid = to_regprocedure('public.restore_french_accents(text)');
  IF v_txt IS DISTINCT FROM '300d4e4c2f502c0eb9e52b92fde60769|f|i|{search_path=public}' THEN
    RAISE EXCEPTION 'ABORT: restore_french_accents n''est pas la version de 20261031_accents_protected_segments : appliquer d''abord 20261031_accents_protected_segments';
  END IF;

  SELECT string_agg(p.sig, ', ' ORDER BY p.sig COLLATE "C") INTO v_txt
    FROM (VALUES
      ('public.resolve_agent_write_scope()', '8d54b4884ba9d79d13ceb6e3efcf32ee|t|s|{search_path=public}'),
      ('public.check_agent_write_allowed(text,text)', '142e397a9c484acf71f7a165128f65b5|t|v|{search_path=public}'),
      ('public.enforce_agent_write_scope()', '89e28826419409a2bc47f63201946fa6|t|v|{search_path=public}'),
      ('public.fn_auto_restore_accents_r1_meta()', '915d378f1e261bb82cfa21aef6a9e7b6|f|v|{search_path=public}'),
      ('public.fn_auto_restore_accents_r1_slots()', 'cd5d47fef335dfa46477c2d71a415b48|f|v|{search_path=public}'),
      ('public.fn_auto_restore_accents_r3()', 'b0e3095435d02d2c3c2cc409a9e14f8a|f|v|{search_path=public}'),
      ('public.invalidate_r1_caches(integer,text,text)', '057683db298396024bcccbe8054627d3|t|v|{search_path=public}'),
      ('public.trg_invalidate_r1_from_seo_gamme()', 'efaea1eeaa1c4a3a069a89f3a546c8b2|t|v|{search_path=public}'),
      ('public.trg_r1_gamme_slots_updated_at()', '62b1882b8f6a782028d50a26efa3b702|f|v|{search_path=public}')
    ) p(sig, attendu)
    LEFT JOIN pg_proc f ON f.oid = to_regprocedure(p.sig)
   WHERE format('%s|%s|%s|%s', md5(f.prosrc), f.prosecdef, f.provolatile, f.proconfig) IS DISTINCT FROM p.attendu;
  IF v_txt IS NOT NULL THEN
    RAISE EXCEPTION 'ABORT: fonction(s) absente(s) ou différente(s) du relevé du 2026-10-31 : %', v_txt;
  END IF;

  SELECT string_agg(x.d, E'\n' ORDER BY x.d COLLATE "C") INTO v_txt
    FROM (SELECT t.tgenabled::text || ' ' || pg_get_triggerdef(t.oid) AS d
              FROM pg_trigger t
             WHERE NOT t.tgisinternal
               AND t.tgrelid IN ('public.__seo_gamme'::regclass, 'public.__seo_gamme_conseil'::regclass, 'public.__seo_r1_gamme_slots'::regclass, 'public.__gamme_page_cache'::regclass, 'public.__seo_r1_related_blocks_cache'::regclass)) x;
  IF v_txt IS DISTINCT FROM $trg$O CREATE TRIGGER trg_auto_restore_accents_r1_meta BEFORE INSERT OR UPDATE ON public.__seo_gamme FOR EACH ROW EXECUTE FUNCTION fn_auto_restore_accents_r1_meta()
O CREATE TRIGGER trg_auto_restore_accents_r1_slots BEFORE INSERT OR UPDATE ON public.__seo_r1_gamme_slots FOR EACH ROW EXECUTE FUNCTION fn_auto_restore_accents_r1_slots()
O CREATE TRIGGER trg_auto_restore_accents_r3 BEFORE INSERT OR UPDATE ON public.__seo_gamme_conseil FOR EACH ROW EXECUTE FUNCTION fn_auto_restore_accents_r3()
O CREATE TRIGGER trg_gpc_invalidate_seo_gamme AFTER INSERT OR DELETE OR UPDATE ON public.__seo_gamme FOR EACH ROW EXECUTE FUNCTION trg_invalidate_r1_from_seo_gamme()
O CREATE TRIGGER trg_r1_slots_updated BEFORE UPDATE ON public.__seo_r1_gamme_slots FOR EACH ROW EXECUTE FUNCTION trg_r1_gamme_slots_updated_at()
O CREATE TRIGGER trg_warn_orphan_r1_meta BEFORE INSERT ON public.__seo_gamme FOR EACH ROW EXECUTE FUNCTION fn_warn_orphan_pg_id()
O CREATE TRIGGER trg_warn_orphan_r1_slots BEFORE INSERT ON public.__seo_r1_gamme_slots FOR EACH ROW EXECUTE FUNCTION fn_warn_orphan_pg_id()
O CREATE TRIGGER trg_warn_orphan_r3_conseils BEFORE INSERT ON public.__seo_gamme_conseil FOR EACH ROW EXECUTE FUNCTION fn_warn_orphan_pg_id()
O CREATE TRIGGER trg_write_scope___seo_gamme BEFORE INSERT OR UPDATE ON public.__seo_gamme FOR EACH ROW EXECUTE FUNCTION enforce_agent_write_scope()
O CREATE TRIGGER trg_write_scope___seo_gamme_conseil BEFORE INSERT OR UPDATE ON public.__seo_gamme_conseil FOR EACH ROW EXECUTE FUNCTION enforce_agent_write_scope()
O CREATE TRIGGER trg_write_scope___seo_r1_gamme_slots BEFORE INSERT OR UPDATE ON public.__seo_r1_gamme_slots FOR EACH ROW EXECUTE FUNCTION enforce_agent_write_scope()$trg$ THEN
    RAISE EXCEPTION 'ABORT: triggers de pg 7 (textes) différents du relevé :%', E'\n' || coalesce(v_txt, '(aucun)');
  END IF;

  -- debut-controle-regles
  SELECT count(*), min(write_scope) INTO v_n, v_txt FROM agent_write_scopes WHERE agent_name = 'SEO-Content';
  IF v_n <> 1 OR v_txt IS DISTINCT FROM 'seo_content_tables' THEN
    RAISE EXCEPTION 'ABORT: agent SEO-Content : % ligne(s), scope %, attendu 1 ligne seo_content_tables', v_n, coalesce(v_txt, '-');
  END IF;
  SELECT string_agg(t, ', ' ORDER BY t COLLATE "C") INTO v_txt
    FROM unnest(ARRAY['__seo_gamme', '__seo_gamme_conseil', '__seo_r1_gamme_slots']) t
   WHERE NOT EXISTS (SELECT 1 FROM agent_scope_table_rules r
                        WHERE r.scope = 'seo_content_tables'
                          AND 'update' = ANY (r.allowed_operations)
                          AND (t = r.table_pattern
                               OR (position('*' in r.table_pattern) > 0 AND t LIKE replace(r.table_pattern, '*', '%'))));
  IF v_txt IS NOT NULL THEN
    RAISE EXCEPTION 'ABORT: le scope seo_content_tables n''autorise pas UPDATE sur %', v_txt;
  END IF;
  -- fin-controle-regles

  SELECT string_agg(nom, ', ' ORDER BY nom COLLATE "C") INTO v_txt FROM (
    SELECT x.nom
      FROM (VALUES
      ('r1s_h1_override', (SELECT r1s_h1_override::text FROM __seo_r1_gamme_slots WHERE r1s_pg_id = '7'),
       '1d4e252a8874eef4e11dc11ff6069366e864476bb8935f3d7f67ff214ef2b4dc', true),
      ('sg_title', (SELECT sg_title FROM __seo_gamme WHERE sg_pg_id = '7' AND sg_id = '4'),
       'e6de4da9221481a0ced79c6af9c733f208b50cc80590b68772caca88627847bc', true),
      ('sg_descrip', (SELECT sg_descrip FROM __seo_gamme WHERE sg_pg_id = '7' AND sg_id = '4'),
       '30f5becf870fd786fec55a9dd2da95746e06daa8953be0f911dfbb51f6d74d2f', true),
      ('sgc_content:META', (SELECT sgc_content FROM __seo_gamme_conseil WHERE sgc_pg_id = '7' AND sgc_id = 'conseil-7-META-20260321'),
       '71872ad253d983dfeb45a0fd8a31beaacf801b433f03afcfa7e0ad7ba5a1f07b', false),
      ('sgc_title:META', (SELECT sgc_title FROM __seo_gamme_conseil WHERE sgc_pg_id = '7' AND sgc_id = 'conseil-7-META-20260321'),
       '21b852fca2b57b2bd107742cf31ea30416f2e9b3bdd7a39be5c5408ae2ce789d', false)
      ) x(nom, val, sha, fixe)
     WHERE x.val IS NULL
        OR encode(sha256(convert_to(x.val, 'UTF8')), 'hex') <> x.sha
        OR (x.fixe AND restore_french_accents(x.val) IS DISTINCT FROM x.val)
  ) b;
  IF v_txt IS NOT NULL THEN
    RAISE EXCEPTION 'ABORT: champ(s) protégé(s) différent(s) du relevé ou réécrit(s) par le trigger d''accents : %', v_txt;
  END IF;
END
$precheck$;

DO $ecriture$
DECLARE
  v_cells jsonb;
  v_n     bigint;
  v_txt   text;
  v_prev  text;
  v_agent uuid;
BEGIN
  PERFORM 1 FROM __seo_r1_gamme_slots WHERE r1s_pg_id = '7' FOR UPDATE;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 1 THEN RAISE EXCEPTION 'ABORT: % ligne(s) __seo_r1_gamme_slots pg 7, 1 attendue', v_n; END IF;
  PERFORM 1 FROM __seo_gamme WHERE sg_pg_id = '7' FOR UPDATE;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 1 THEN RAISE EXCEPTION 'ABORT: % ligne(s) __seo_gamme pg 7, 1 attendue', v_n; END IF;
  IF NOT EXISTS (SELECT 1 FROM __seo_gamme WHERE sg_pg_id = '7' AND sg_id = '4') THEN
    RAISE EXCEPTION 'ABORT: la ligne __seo_gamme de pg 7 n''a plus sg_id 4';
  END IF;
  PERFORM 1 FROM __seo_gamme_conseil WHERE sgc_pg_id = '7' FOR UPDATE;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 12 THEN RAISE EXCEPTION 'ABORT: % ligne(s) __seo_gamme_conseil pg 7, 12 attendues', v_n; END IF;
  SELECT string_agg(sgc_id || ':' || sgc_section_type, ',' ORDER BY sgc_id || ':' || sgc_section_type COLLATE "C") INTO v_txt
    FROM __seo_gamme_conseil WHERE sgc_pg_id = '7';
  IF v_txt IS DISTINCT FROM '18:S1,20:S2,21:S4_DEPOSE,22:S4_REPOSE,conseil-7-META-20260321:META,conseil-7-S2_DIAG-1774724299375:S2_DIAG,conseil-7-S3-1771371936696:S3,conseil-7-S5-1771371936739:S5,conseil-7-S6-1771938637895:S6,conseil-7-S7-1771371936783:S7,conseil-7-S8-1771509122681:S8,conseil-7-S_GARAGE-1772504383540:S_GARAGE' THEN
    RAISE EXCEPTION 'ABORT: sections __seo_gamme_conseil de pg 7 différentes du relevé : %', v_txt;
  END IF;

  v_cells := (SELECT jsonb_object_agg(v.k, jsonb_build_object('trig', v.trig, 'avant', v.avant, 'apres', v.apres, 'h_avant', v.h_avant, 'h_apres', v.h_apres))
    FROM (VALUES
      ('r1s/r1s_hero_subtitle', true, $fhlot$Trouvez votre Filtre à huile au meilleur prix$fhlot$,
       $fhlot$Sélectionnez votre véhicule : seuls les filtres à huile rattachés à sa motorisation s'affichent, vissés ou cartouches.$fhlot$,
       '6562ca846f969b172332eb07f46cdd372a3511ce9adb706ee74e4248e3a252b2', '4c11b7a792503cddc0f4f74f31fd7aee656488972db34cfba480429704dd7172'),
      ('r1s/r1s_selector_microcopy', false, $fhlot${"Sélectionnez votre véhicule","Trouvez votre filtre à huile compatible"}$fhlot$,
       $fhlot${"Marque, modèle, année, puis motorisation exacte","Deux versions d'un même modèle ne reçoivent pas toujours le même filtre."}$fhlot$,
       '5bbe249bc3e5867243902be4e3bb4610907d3dea6404b6ccff3670a4d681f927', 'cba742baa9c696fb545d578da1c3dd22f38bff08281ea663d4c3a2f2e107e230'),
      ('r1s/r1s_arg1_title', false, $fhlot$Compatibilite verifiee$fhlot$,
       $fhlot$Choix par motorisation$fhlot$,
       'f78cc1ced0bef31d284f5e38466d4573b920e2ed3926c6dcc9897b8de44df624', 'a73e9f1301ed7bcb1f09c2c36598dff720d9c60de37effcd055ac437a2322fc1'),
      ('r1s/r1s_arg1_content', true, $fhlot$Selection guidee par vehicule et references techniques.$fhlot$,
       $fhlot$Chaque filtre est rattaché à des motorisations précises du catalogue.$fhlot$,
       'f4bf72b6839b433b069ed91e19c94b5ee10252b14cd6a6314925f9e6f5177220', 'f9948be2be0861a9eae35b633551def244a14ef59fca8d6b7e97bf6c08a05040'),
      ('r1s/r1s_arg2_title', false, $fhlot$Priorite securite$fhlot$,
       $fhlot$Vissé ou cartouche$fhlot$,
       '50338e22c75aadd0a7a199b0127635f55ba003f98b6d49349bf94cc85d1cc8bc', 'ce5178da977396bcfe9161b749640e5f73b2854312850c89daf7d49eedc5e1bb'),
      ('r1s/r1s_arg2_content', true, $fhlot$Un remplacement a temps limite les risques de panne secondaire.$fhlot$,
       $fhlot$La forme dépend du moteur : elle ne se choisit pas.$fhlot$,
       '9c1404e0d5ab417bbd6a5fd05274aaf935af860ad8d0da3356e8f955a6943710', 'ebf146cea104fc31fc1fc42711f52da7bd313a10ed13b7b8931ac5a472218bb1'),
      ('r1s/r1s_arg3_title', false, $fhlot$Decision rapide$fhlot$,
       $fhlot$Référence d'origine$fhlot$,
       'a750822583f4394bee707ca6ff414044c7669a499516d7d745a15fb2c4ea2223', '295c0afa8e2b025cd768ce967f4d737c3c9c032c420ed5fc4ee223e007477597'),
      ('r1s/r1s_arg3_content', true, $fhlot$Le guide structure les controles avant commande.$fhlot$,
       $fhlot$Indiquée sur la page du véhicule quand elle est connue, pour comparer.$fhlot$,
       'de6ef5f65520dfe45f6c126e431384a465129ecd925f0c2c36db17a1dc4cba61', '54ad36c40609cedf7ab64367bc5ef7be2ebc9498cbd6e5bb3db98acd71c88290'),
      ('r1s/r1s_arg4_title', false, $fhlot$Montage maitrise$fhlot$,
       $fhlot$Guide de remplacement$fhlot$,
       '3f09cb735d37bb255d4bfa5af17d23ac13e2a834e2866c40c68c720b17598f27', 'c07aca936549c2018a33cf9ae4ae0210427ce716377b2f4edaed8719aa9ca86a'),
      ('r1s/r1s_arg4_content', true, $fhlot$La verification des pieces associees reduit les retours atelier.$fhlot$,
       $fhlot$Échéances et étapes du remplacement dans le guide du filtre à huile.$fhlot$,
       'a4032d2e4643540103f1d166a0425a424b5389f6940a4eaa2a20bbef9dde38ab', '25f0b340aa9828590c80c3700b88f5c131b22d3ae00756222045d87ea183bcd0'),
      ('r1s/r1s_compatibilities_intro', true, $fhlot$Sélectionnez votre marque pour afficher les filtres à huile compatibles avec votre véhicule — Citroën, Renault, Peugeot, Volkswagen et plus de 50 marques référencées.$fhlot$,
       $fhlot$Chaque page de motorisation liste les filtres à huile rattachés à cette version précise. Vérifiez la motorisation exacte, puissance comprise, avant de choisir.$fhlot$,
       '69444cc7177df2bbbe7cafa025aee339a610fb9ff5f950504397423a25407187', 'dad07b892e988f5196de69a3e11d59dbf5376f5f3d642e3b70ad02b27d4f0b6a'),
      ('r1s/r1s_equipementiers_line', true, $fhlot$Bosch, Mann Filter, Mahle, Purflux, WIX — équipementiers de premier montage avec homologations constructeur vérifiables.$fhlot$,
       $fhlot$Les marques présentées viennent du catalogue, où chaque référence est rattachée à des motorisations précises. La marque ne remplace pas la vérification de compatibilité.$fhlot$,
       'f6f139df6827436c76e8cc75ae55645be448130ea45171665cd8ec317f05c60c', '6bbfc8086ea61be463900248cd490d9ee16f5f7fe4b2574acd5a3d924d9da761'),
      ('r1s/r1s_family_cross_sell_intro', true, $fhlot$Complétez votre entretien moteur : retrouvez également nos huiles moteur, joints de vidange carter et filtres à air compatibles avec votre véhicule.$fhlot$,
       $fhlot$Les autres filtres du véhicule, à air, à carburant et d'habitacle, filtrent d'autres fluides et ont chacun leur propre référence.$fhlot$,
       '2158313f76327df8df76e6db81ed15de4d3d460c985a32662decef907b40634f', '4fd6b2cbbe65dd64acae623ebfdbb5f9327d62d083e626f3d925d72712ccaad4'),
      ('r1s/r1s_safe_table_rows', false, $fhlot$[{"element": "Type de filtre", "howToCheck": "Vissant (spin-on) ou cartouche — vérifiez la référence OEM de votre véhicule"}, {"element": "Marque et motorisation", "howToCheck": "Saisissez marque, modèle et motorisation dans le sélecteur pour filtrer les références compatibles"}, {"element": "Compatibilité huile longlife", "howToCheck": "Moteurs VW/BMW longlife : vérifiez l'approbation VW 502.00 ou BMW LL-01 sur la fiche produit"}, {"element": "Présence clapet anti-retour", "howToCheck": "Certains moteurs modernes l'exigent — consultez la fiche technique du véhicule"}, {"element": "Ne pas confondre avec", "howToCheck": "Filtre à air, filtre à carburant, filtre à huile de boîte automatique — ce sont des pièces distinctes"}]$fhlot$,
       $fhlot$[{"element": "Identifiant", "howToCheck": "Marque, modèle, année et motorisation exacte du véhicule, puissance comprise."}, {"element": "Référence / équivalence", "howToCheck": "Comparez la référence d'origine indiquée sur la page de votre véhicule avec celles proposées pour sa motorisation."}, {"element": "Connectique", "howToCheck": "Filtre vissé : même filetage de raccordement. Cartouche : même boîtier, seul l'élément filtrant change."}, {"element": "Ne pas confondre avec", "howToCheck": "Filtre à air, filtre à carburant, filtre d'habitacle : ils filtrent d'autres fluides et ont leur propre référence."}]$fhlot$,
       '8049c9e0a317135a0b62f3b63001569ba46f0eac2a58fb97bcbe7ea0139d3fb9', 'bfe41f3b068899fef5c045c87fdc39807e869476a987550b2ac6a98337a5a909'),
      ('r1s/r1s_faq', false, $fhlot$[{"a": "Les filtres OES (Bosch) ou adaptables (Mann, Mahle) offrent une qualité équivalente à l'OE pour moins cher. Vérifiez", "q": "Filtre à huile OE ou adaptable : que choisir ?"}, {"a": "Voyant huile allumé, bruit de cliquetis moteur, huile noire et épaisse à la jauge, consommation d'huile excessive.", "q": "Comment savoir si mon filtre à huile est bouché ?"}, {"a": "À chaque vidange, soit entre 15 000 et 30 000 km ou 1 an. Ne jamais réutiliser un ancien filtre même récent.", "q": "Tous les combien changer le filtre à huile ?"}, {"a": "Oui, opération simple lors de la vidange. Clé à filtre nécessaire. Graisser le joint neuf avec de l'huile. Serrage", "q": "Peut-on changer le filtre à huile soi-même ?"}, {"a": "Ne pas trop serrer (écrase le joint). Ne pas oublier de retirer l'ancien joint collé sur le bloc. Toujours pré-remplir", "q": "Quelle erreur éviter avec le filtre à huile ?"}, {"a": "Techniquement possible mais déconseillé. Retirer le filtre entraîne une perte d'huile. Le filtre neuf dans de", "q": "Peut-on changer le filtre à huile sans faire la vidange ?"}]$fhlot$,
       $fhlot$[{"answer": "Renseignez la marque, le modèle, l'année et la motorisation dans le sélecteur : seules les références rattachées à cette motorisation s'affichent. Ne partez pas de l'apparence de l'ancien filtre, car des filtres semblables peuvent différer à l'intérieur selon le moteur.", "question": "Comment trouver le filtre à huile compatible avec ma voiture ?"}, {"answer": "Celui que prévoit votre moteur : la forme ne se choisit pas. Un filtre vissé se remplace en bloc. Une cartouche est l'élément filtrant d'un boîtier démontable, et le boîtier est conservé.", "question": "Filtre vissé ou cartouche, lequel choisir ?"}, {"answer": "Pas toujours, car le filtre dépend du moteur. Vérifiez la motorisation exacte, puissance et année comprises, avant de choisir.", "question": "Deux versions du même modèle ont-elles le même filtre ?"}, {"answer": "Les références affichées pour votre motorisation lui sont rattachées dans notre catalogue, quelle que soit leur marque. En cas de doute, comparez-les avec la référence d'origine indiquée sur la page de votre véhicule.", "question": "Une autre marque que celle d'origine convient-elle ?"}, {"answer": "Aux échéances d'entretien fixées par le constructeur de votre véhicule ; aucun kilométrage ne vaut pour tous les véhicules. Le guide du filtre à huile détaille le remplacement.", "question": "Quand faut-il remplacer le filtre à huile ?"}]$fhlot$,
       '0ae4e74d57ddcc117751927255710cfbc72302318dcb82cf8b49601372054d63', '815f438580141245cfe42aa1e9e626a86aef3cd6386c38e1b704b264d47748d8'),
      ('r1s/r1s_micro_seo_block', true, $fhlot$<p>Notre sélection de filtres à huile couvre les principales marques de véhicules : Citroën, Renault, Peugeot, Volkswagen, BMW et plus de 50 autres marques. Compatibilité vérifiée par immatriculation ou saisie manuelle marque/modèle/motorisation.</p>
<p>Les filtres à huile disponibles couvrent les motorisations essence et diesel, du moteur urbain compact aux motorisations longlife (VW 502.00, BMW LL-01). Filtres OEM ou équipementiers — Mann Filter, Mahle, Bosch, Purflux, WIX — qualité équivalente à l'origine, homologations constructeur vérifiables.</p>
<p>Filtrez par marque de véhicule, modèle et motorisation pour identifier le filtre à huile moteur correspondant à votre véhicule. La sélection inclut les deux types principaux : filtre vissant spin-on et filtre cartouche à élément filtrant.</p>$fhlot$,
       $fhlot$<p>Le bon filtre à huile se choisit à partir du véhicule, jamais d'après l'apparence de l'ancien. Des filtres qui se ressemblent peuvent être très différents à l'intérieur selon le moteur : clapet anti-retour présent ou non, filetage de raccordement, pression d'ouverture du clapet de dérivation (by-pass), média filtrant, finesse de filtration, surpression admissible. Deux versions d'un même modèle ne reçoivent donc pas toujours la même référence.</p>
<p>Filtre vissé ou cartouche : la forme découle du moteur. Le filtre vissé réunit le boîtier et l'élément filtrant en un seul bloc ; la cartouche est l'élément filtrant d'un boîtier démontable, qui reste en place. Le sélecteur ne retient que les références rattachées à la motorisation choisie : renseignez la marque, le modèle, l'année et la motorisation exacte.</p>
<p>Chaque page de motorisation liste les références qui lui sont rattachées, avec la référence d'origine quand elle est connue : comparez-la avec celles qui vous sont proposées. Plus l'intervalle de remplacement prévu par le constructeur est long, plus la qualité du filtre compte : le papier filtrant, le clapet de dérivation et le clapet anti-retour en font partie. Même un bon filtre ne fonctionne correctement que s'il a été bien monté.</p>
<p>Ne confondez pas le filtre à huile avec le filtre à air, le filtre à carburant ou le filtre d'habitacle : ils filtrent d'autres fluides et ont chacun leur propre référence. Le guide du filtre à huile traite de son remplacement aux échéances du constructeur. Pour chercher l'origine d'un défaut, commencez par le diagnostic.</p>$fhlot$,
       'd82d4b590e1ed729cd00c7ae4903b8d7de7a86908f561ef2508103fd1c41becb', 'de2d3f101fcdcaee5bf7a9e807f9bf1f610fcade588f46881ce2085c31bf6820'),
      ('sg/sg_content', true, $fhlot$<h2>Filtre à huile voiture : rôle, types de montage et références</h2>
<p>Le <strong>filtre à huile</strong> est une pièce d'usure essentielle du circuit de lubrification de votre moteur. Sa fonction principale est de <strong>retenir les impuretés métalliques</strong>, les résidus de combustion et les microparticules qui circulent dans l'huile moteur. Sans filtration efficace, ces contaminants attaquent les surfaces internes — pistons, bielles, arbre à cames, coussinets — et provoquent une usure prématurée pouvant réduire la durée de vie du moteur de 30 à 50 %. Le <strong>filtre à huile moteur</strong> se remplace systématiquement à chaque vidange, soit entre 15 000 et 30 000 km selon les préconisations constructeur, ou au minimum une fois par an. <a href="/reference-auto/filtre-a-huile">En savoir plus sur le filtre à huile</a>.</p>
<p>Deux grandes familles de montage existent : le filtre <strong>vissable</strong> (spin-on), qui se visse directement sur le bloc moteur, et le filtre <strong>cartouche</strong> (élément filtrant), inséré dans un boîtier fixe. Le type de montage dépend du constructeur et de la motorisation. Les moteurs diesel modernes (1.5 dCi, 1.6 HDI, 2.0 TDI) utilisent majoritairement des filtres cartouche, tandis que les moteurs essence plus anciens conservent souvent le montage vissable. La <strong>pression différentielle</strong> supportée, le diamètre du filetage et la présence d'un clapet anti-retour varient d'une référence à l'autre — d'où l'importance de sélectionner la pièce exacte pour votre véhicule.</p>

<h2>Filtre à huile : trouvez la référence compatible avec votre véhicule</h2>
<p>Un même modèle de voiture peut nécessiter des filtres à huile différents selon la motorisation et l'année de fabrication. Par exemple, une Renault Clio équipée d'un 1.5 dCi n'utilise pas le même filtre qu'une version 1.2 essence. C'est pourquoi notre sélecteur de compatibilité est indispensable : saisissez votre <strong>marque</strong>, votre <strong>modèle</strong> et votre <strong>motorisation</strong> pour afficher uniquement les références 100 % compatibles. En cas de doute, le <strong>code moteur</strong> figure sur votre carte grise (case D.2).</p>
<ul>
<li>Un même modèle peut avoir jusqu'à 8 montages différents selon la motorisation (1.5 dCi, 1.6 HDI, 2.0 TDI, 1.2 PureTech…)</li>
<li>Le sélecteur affiche uniquement les <strong>filtres à huile</strong> vérifiés compatibles avec votre moteur</li>
<li>Plus de <strong>22 450 références</strong> disponibles couvrant plus de 5 200 motorisations</li>
<li>Compatibilité constructeur vérifiée : Renault, Peugeot, Citroën, Volkswagen, BMW, Audi, Fiat, Dacia et 50+ marques</li>
</ul>

<h2>Marques de filtre à huile : BOSCH, MANN FILTER, PURFLUX</h2>
<p>Les <strong>équipementiers de première monte</strong> (OE) fabriquent les filtres installés en usine par les constructeurs automobiles. Sur notre catalogue, vous retrouvez les marques de confiance qui fournissent directement les chaînes de production :</p>
<ul>
<li><strong>BOSCH</strong> (1 237 références) — équipementier OE pour Renault, Volkswagen, Mercedes. Technologie de filtration multi-couches, clapet anti-retour intégré, certifié ISO 4548-12</li>
<li><strong>MANN FILTER</strong> (1 913 références) — leader mondial de la filtration, fournisseur OE BMW, Audi, Porsche. Média filtrant haute efficacité, résistance pression jusqu'à 2 bars</li>
<li><strong>PURFLUX</strong> — spécialiste français, fournisseur OE Renault et PSA. Cartouches à élément filtrant avec joint torique pré-positionné</li>
<li><strong>KNECHT/MAHLE</strong> (505 références) — équipementier OE Mercedes, BMW. Double filtration brevetée</li>
<li><strong>WIX FILTERS</strong> (808 références) — alternative OES reconnue, bon rapport qualité-prix</li>
</ul>
<p>Tous les filtres proposés respectent les normes <strong>ISO 4548-12</strong> (efficacité de filtration multi-pass) et <strong>ISO 4548-1</strong> (résistance pression différentielle). Pour les moteurs avec spécification huile longlife (VW 502.00, BMW LL-01), vérifiez que le filtre est certifié compatible sur la fiche produit.</p>

<h2>Filtre à huile prix : fourchettes selon le type et la marque</h2>
<p>Le <strong>prix d'un filtre à huile</strong> varie de 5 € à 30 € selon la marque, le type de montage et le véhicule. Voici les fourchettes constatées :</p>
<ul>
<li><strong>Éco (4-9 €)</strong> — marques alternatives, filtration standard, convient pour un usage quotidien sans exigence longlife</li>
<li><strong>Standard OES (9-15 €)</strong> — BOSCH, MANN FILTER, PURFLUX : qualité équivalente première monte, rapport qualité-prix optimal</li>
<li><strong>Premium (15-30 €)</strong> — filtres haute performance, double filtration, compatibilité huile longlife, clapet anti-drain back renforcé</li>
<li><strong>OE/Spécial (30 €+)</strong> — référence constructeur exacte, concessions et ateliers agréés</li>
</ul>
<p>Le coût d'une <strong>vidange complète en atelier</strong> (huile + filtre + main d'œuvre) se situe entre 80 et 150 € selon le véhicule et la viscosité d'huile requise. <a href="/blog-pieces-auto/guide-achat/filtre-a-huile">Guide d'achat filtre à huile : critères, budget et marques recommandées</a>.</p>

<h2>Types de filtre à huile : vissable, cartouche et centrifuge</h2>
<p>Le choix du type de filtre dépend de votre moteur. Ne confondez pas les trois familles principales :</p>
<ul>
<li><strong>Filtre vissable (spin-on)</strong> — boîtier métallique intégral qui se visse sur le bloc moteur. Remplacement simple : dévisser l'ancien, graisser le joint du neuf, visser à la main + ¾ de tour. Courant sur les moteurs essence et diesel anciens</li>
<li><strong>Filtre cartouche (élément filtrant)</strong> — média filtrant remplaçable dans un boîtier plastique ou alu fixe. Nécessite l'ouverture du couvercle et le remplacement du joint torique. Moteurs diesel modernes (HDI, dCi, TDI, JTDM) et essence récents (PureTech, TSI)</li>
<li><strong>Filtre centrifuge</strong> — utilisé en complément sur certains moteurs industriels ou poids lourds, rare en automobile légère</li>
</ul>
<p>Attention à ne pas confondre le <strong>filtre à huile moteur</strong> avec le <a href="/pieces/filtre-a-air">filtre à air</a> (circuit admission), le <a href="/pieces/filtre-a-carburant">filtre à carburant</a> (circuit essence/diesel) ou le <a href="/pieces/filtre-de-boite-auto">filtre à huile de boîte automatique</a> (transmission). Ce sont des pièces distinctes avec des références différentes.</p>

<h2>Commander votre filtre à huile en stock — livraison rapide</h2>
<p>Sélectionnez votre <strong>marque → modèle → motorisation</strong> dans le sélecteur ci-dessus. Le sélecteur affiche instantanément les filtres à huile compatibles avec votre véhicule, avec le prix, la disponibilité et la marque. Votre <strong>filtre à huile neuf</strong> est expédié le jour même pour toute commande passée avant 15h, avec livraison sous 24 à 48h partout en France.</p>
<p>Pensez à commander en même temps les pièces associées pour votre vidange complète : <a href="/pieces/bouchon-de-vidange">bouchon de vidange</a>, <a href="/pieces/filtre-a-air">filtre à air</a> et huile moteur adaptée à votre spécification constructeur. <a href="/blog-pieces-auto/conseils/comment-changer-un-filtre-a-huile">Conseils : changer un filtre à huile étape par étape</a>.</p>

<h2>Questions fréquentes sur le filtre à huile</h2>
<details><summary>Combien coûte un filtre à huile ?</summary>
<p>Entre 5 € et 30 € selon la marque et le type (vissable ou cartouche). Un filtre OES (BOSCH, MANN FILTER) coûte en moyenne 9 à 15 €. La vidange complète en atelier (huile + filtre + main d'œuvre) revient entre 80 et 150 €.</p>
</details>
<details><summary>Quel est le prix d'un filtre à huile ?</summary>
<p>Le prix dépend de la marque et du véhicule. Comptez 4-9 € en éco, 9-15 € en standard OES, 15-30 € en premium. Les filtres cartouche sont généralement plus chers que les vissables.</p>
</details>
<details><summary>Quel filtre à huile pour ma voiture ?</summary>
<p>Utilisez le sélecteur en haut de page : saisissez marque, modèle et motorisation. Le sélecteur affiche uniquement les références 100 % compatibles avec votre moteur. En cas de doute, le code moteur est indiqué case D.2 de votre carte grise.</p>
</details>
<details><summary>Où acheter un filtre à huile ?</summary>
<p>Directement sur AutoMecanik.com : plus de 22 450 références en stock, prix dégressifs, livraison 24-48h. Sélectionnez votre véhicule pour voir les filtres compatibles.</p>
</details>
<details><summary>Combien de temps pour la livraison d'un filtre à huile ?</summary>
<p>Expédition le jour même avant 15h, livraison sous 24 à 48h en France métropolitaine. Suivi de colis inclus.</p>
</details>
<details><summary>Quel est le prix d'un filtre à huile diesel ?</summary>
<p>Les filtres diesel (cartouche) coûtent en moyenne 10 à 20 €. Les motorisations 1.5 dCi, 1.6 HDI ou 2.0 TDI nécessitent souvent un filtre cartouche plus large que les versions essence.</p>
</details>
<p class="mt-3 text-sm"><a href="/diagnostic-auto/filtre-a-huile">Diagnostic filtre à huile : symptômes et causes de défaillance</a></p>$fhlot$,
       $fhlot$<h2>Filtre vissé ou cartouche : la différence</h2>
<p>Le filtre à huile existe sous deux formes, et c'est le moteur qui impose la sienne. Le filtre vissé réunit le boîtier et l'élément filtrant en un seul bloc : il se change en entier. La cartouche se loge dans un boîtier démontable : seul l'élément filtrant est remplacé, le boîtier est conservé.</p>
<h2>Critères qui distinguent deux filtres semblables</h2>
<p>Deux filtres de même taille et de même aspect peuvent être très différents à l'intérieur. Selon le moteur, un filtre vissé comporte ou non un clapet anti-retour, qui garde l'huile dans le filtre quand le moteur est arrêté. Son clapet de dérivation (by-pass) s'ouvre à une pression qui varie d'un moteur à l'autre. Le filetage de raccordement, le média filtrant, la finesse de filtration et la surpression admissible changent aussi.</p>
<p>Ces écarts ne se voient pas de l'extérieur. Le catalogue part donc de la motorisation, jamais de l'apparence de l'ancien filtre.</p>
<h2>Qualité d'un filtre à huile : ce qui compte</h2>
<p>Le papier filtrant, le clapet de dérivation et le clapet anti-retour font partie des caractéristiques de qualité d'un filtre à huile. Plus l'intervalle de remplacement prévu par le constructeur est long, plus cette qualité compte.</p>
<p>Le montage compte aussi : même un bon filtre ne fonctionne correctement que s'il a été bien monté, en suivant les instructions du constructeur du véhicule et du fabricant du filtre.</p>
<p>Les marques présentées ci-dessous viennent du catalogue. Quelle que soit la marque, la référence doit d'abord être celle prévue pour votre motorisation.</p>
<h2>Rôle du filtre à huile et moment du remplacement</h2>
<p>Le filtre à huile empêche les impuretés d'entrer dans le circuit de lubrification du moteur. Il aide ainsi à préserver la qualité de l'huile, les performances et le rendement du moteur.</p>
<p>Son emplacement dépend du moteur : cette page n'en indique pas un valable pour tous. Sur certains moteurs, le filtre est monté à l'horizontale ou tête en bas ; un clapet anti-retour y empêche l'huile de quitter le filtre à l'arrêt.</p>
<p>Il se remplace aux échéances d'entretien fixées par le constructeur du véhicule. Aucune durée ni aucun kilométrage ne vaut pour tous les véhicules. Un filtre gardé trop longtemps peut se colmater : son clapet de dérivation s'ouvre alors pour continuer d'alimenter le moteur, avec une huile qui n'est plus filtrée.</p>
<p>Les étapes du remplacement sont détaillées dans le <a href="/blog-pieces-auto/conseils/filtre-a-huile">guide du filtre à huile</a>.</p>
<h2>Trouver la référence de votre véhicule</h2>
<p>Un même modèle peut recevoir des filtres différents selon sa motorisation. Pour afficher ceux qui conviennent :</p>
<ol>
<li>Renseignez la marque, le modèle, l'année et la motorisation exacte, puissance comprise.</li>
<li>Sur la page de votre motorisation, comparez les références proposées avec la référence d'origine quand elle est indiquée.</li>
<li>Vérifiez la forme : un filtre vissé remplace un filtre vissé, une cartouche remplace l'élément filtrant d'un boîtier.</li>
</ol>
<p>Pour chercher l'origine d'un défaut, commencez par le <a href="/diagnostic-auto">diagnostic</a>.</p>$fhlot$,
       'ee42b52e2d85d9a223ff21c70db2d5578472cd5e67215869c9f2e2c839dce17f', '1e779f2cbd74ff538ca5f549f7ba9b1cb7dd5eb3f2e47c46e885ece3e3c2970b'),
      ('sgc/18/sgc_title', true, $fhlot$Fonction du filtre à huile :$fhlot$,
       $fhlot$Avant de remplacer le filtre à huile$fhlot$,
       '423216c2ec9edefbe4d4721f34b6426d902d64b31543fcc805dbc83261c66fca', '3015aca62f52ba60b71f730353bb98db536812a12c13dbbbdc320db348a4170c'),
      ('sgc/18/sgc_content', true, $fhlot$Filtre l'huile moteur pour retenir les impuretés métalliques et résidus de combustion, protégeant pistons, bielles et arbre à cames. ## Trouvez le type de filtre à huile adéquat Les véhicules, les conditions de conduite et les applications spécifiques nécessitent des solutions sur...<br>Pièces liées : <b>huile moteur</b>, <b>joint de vidange carter</b>, <b>filtre à air</b>, <b>filtre à carburant</b>, <b>filtre d habitacle</b>, <b>bouchon de vidange #LinkGamme_593#</b>.
<p>Le filtre retient les particules metalliques issues de l usure des pistons et des bielles</p>
<p>Sans filtration efficace, les impuretes abrasives circulent dans le circuit et accelerent l usure du moteur</p>
<p>Fonctionne en série avec la pompe à huile pour maintenir une pression constante dans les galeries</p>$fhlot$,
       $fhlot$<p>Le filtre à huile empêche les impuretés d'entrer dans le circuit de lubrification du moteur, et il se remplace aux échéances fixées par le constructeur du véhicule.</p>
<p>Avant de commencer, réunissez :</p>
<ul>
<li><strong>la référence prévue pour votre motorisation</strong>, choisie à partir du véhicule et non d'après l'apparence de l'ancien filtre ;</li>
<li><strong>les instructions du constructeur du véhicule et du fabricant du filtre</strong> : ce guide ne donne pas de consigne de serrage valable pour tous les filtres ;</li>
<li><strong>la forme prévue</strong> : un filtre vissé se change en entier ; avec une cartouche, seul l'élément filtrant est renouvelé et le boîtier reste en place.</li>
</ul>
<p>Sans ces instructions, confiez l'intervention à un professionnel.</p>$fhlot$,
       '8ab85675c41646aa3e946529812becc9bd1d9c5151ebf318009fd7c5b36caedb', 'b407e222e21712510286ddd266bcb543be949d87c4aa4a6049ce70293326790b'),
      ('sgc/18/sgc_sources', false, $fhlot$[{"type":"rag","ref":"gammes/filtre-a-huile.md","field":"domain.role"},{"type":"web","ref":"web/7377bedb9c7e-s001.md","field":"supplementary"},{"type":"web","ref":"web/777af1b0088d-s001.md","field":"supplementary"},{"type":"web","ref":"web/777af1b0088d-s002.md","field":"supplementary"},{"type":"web","ref":"web/777af1b0088d-s003.md","field":"supplementary"},{"type":"web","ref":"web/777af1b0088d-s004.md","field":"supplementary"},{"type":"web","ref":"web/777af1b0088d-s005.md","field":"supplementary"},{"type":"web","ref":"web/777af1b0088d-s006.md","field":"supplementary"},{"type":"web","ref":"web/777af1b0088d-s007.md","field":"supplementary"},{"type":"web","ref":"web/777af1b0088d-s008.md","field":"supplementary"},{"type":"web","ref":"web/777af1b0088d-s009.md","field":"supplementary"},{"type":"web","ref":"web/777af1b0088d-s010.md","field":"supplementary"},{"type":"web","ref":"web/777af1b0088d-s011.md","field":"supplementary"},{"type":"web","ref":"web-catalog/f693354c7bf0-s001.md","field":"supplementary"},{"type":"web","ref":"web-catalog/f693354c7bf0-s002.md","field":"supplementary"},{"type":"web","ref":"web-catalog/f693354c7bf0-s003.md","field":"supplementary"},{"type":"web","ref":"web-catalog/f693354c7bf0-s004.md","field":"supplementary"},{"type":"web","ref":"web-catalog/f693354c7bf0-s005.md","field":"supplementary"},{"type":"web","ref":"web-catalog/d2e427d74f38-s001.md","field":"supplementary"},{"type":"web","ref":"web-catalog/d2e427d74f38-s002.md","field":"supplementary"},{"type":"web","ref":"web-catalog/d2e427d74f38-s003.md","field":"supplementary"},{"type":"web","ref":"web-catalog/d2e427d74f38-s004.md","field":"supplementary"},{"type":"web","ref":"web-catalog/d2e427d74f38-s005.md","field":"supplementary"},{"type":"web","ref":"web-catalog/d2e427d74f38-s006.md","field":"supplementary"},{"type":"web","ref":"web-catalog/d2e427d74f38-s007.md","field":"supplementary"},{"type":"web","ref":"web-catalog/d2e427d74f38-s008.md","field":"supplementary"},{"type":"web","ref":"web-catalog/d2e427d74f38-s009.md","field":"supplementary"},{"type":"web","ref":"web-catalog/8c1a4aa61267-s001.md","field":"supplementary"},{"type":"web","ref":"web-catalog/8c1a4aa61267-s002.md","field":"supplementary"},{"type":"web","ref":"web-catalog/8c1a4aa61267-s003.md","field":"supplementary"},{"type":"web","ref":"web-catalog/8c1a4aa61267-s004.md","field":"supplementary"},{"type":"web","ref":"web-catalog/8c1a4aa61267-s005.md","field":"supplementary"}]$fhlot$,
       $fhlot$[{"type":"wiki","ref":"wiki/gamme/filtre-a-huile.md","field":"S1"}]$fhlot$,
       'd17ea0d502ce2cd6026f6355500fed7e56f4bf2bbfe3dbe747d3629a514ef113', '9efb9ddf9d48dd25fd9a79703d852c82894608cb65883ebac3ebcee69b576776'),
      ('sgc/20/sgc_title', true, $fhlot$Quand changer les filtre à huile :$fhlot$,
       $fhlot$Quand remplacer le filtre à huile$fhlot$,
       '38b3ef36c9388491625512ac737ac8e0779b871efae143a718a4eb5182fe2c21', '2edefe7d2b89cc63afa9477e8ed94a78f935ad1348ade059a07c637fafd6fc15'),
      ('sgc/20/sgc_content', true, $fhlot$Les <b>filtre à huile</b> sont à remplacer tous les 10 000 à 30 000 km environ.<br>Essence classique 10 000-15 000 km (ou 1 an). Diesel moderne 15 000-20 000 km. Longlife (VW/BMW) jusqu'à 30 000 km. Se change à chaque vidange.<br><b>Symptômes d'usure :</b><br>- Voyant huile qui s allume ou clignote<br>- Bruit de claquement ou de cliquetis au ralenti<br>- Huile tres noire avant echeance vidange<br>- Baisse du niveau d huile plus rapide<br>- Odeur d huile brulee dans l habitacle$fhlot$,
       $fhlot$<p>Le filtre à huile se remplace aux échéances d'entretien fixées par le constructeur du véhicule : reportez-vous au carnet d'entretien ou à la notice. Aucune durée ni aucun kilométrage ne vaut pour tous les véhicules.</p>
<p>Un filtre gardé trop longtemps peut se colmater. Son clapet de dérivation (by-pass) s'ouvre alors pour continuer d'alimenter le moteur, avec une huile qui n'est plus filtrée. Plus l'intervalle prévu par le constructeur est long, plus la qualité du filtre compte.</p>$fhlot$,
       '550ecaef78b24664c6c9b11c8e00d6bf1fbeb73de535e8b6398178d56738b793', 'f2ce2384eb5fe7c50da9a18d52895cc72f656f0e1f27f3bf5359616fe15dc88e'),
      ('sgc/20/sgc_sources', false, $fhlot$[{"type":"rag","ref":"gammes/filtre-a-huile.md","field":"maintenance.interval"}]$fhlot$,
       $fhlot$[{"type":"wiki","ref":"wiki/gamme/filtre-a-huile.md","field":"S2"}]$fhlot$,
       '5f061a8dac251dcad9cb4c39d0b053d472786c37c839d522c44af537859eb6f9', 'fe0d8475afca82411c2dd55c80bea37d4b627860430e3bda7139c7efe6dd7fc7'),
      ('sgc/conseil-7-S2_DIAG-1774724299375/sgc_title', true, $fhlot$Diagnostic rapide du filtre à huile :$fhlot$,
       $fhlot$Voyant d'huile ou autre signe : par où commencer$fhlot$,
       '938debfa493a0da81bd0f4cdc23ffbd9ce891a1105eb09f64d2e023936868e58', '55b15153c97b9d9e99540cb5487fa3c2abd7f46222a9d38a63add8d962900e90'),
      ('sgc/conseil-7-S2_DIAG-1774724299375/sgc_content', true, $fhlot$<table><thead><tr><th>Symptôme</th><th>Cause probable</th><th>Action</th></tr></thead><tbody><tr><td>Voyant huile qui s allume ou clignote</td><td>Filtre colmate par accumulation d impuretes metalliques et residus de combustion</td><td>Voyant huile qui s allume ou clignote ?</td></tr><tr><td>Bruit de claquement ou de cliquetis au ralenti</td><td>Intervalle de vidange depasse ou huile de mauvaise viscosite</td><td>Bruit de claquement ou de cliquetis au ralenti ?</td></tr><tr><td>Huile tres noire avant echeance vidange</td><td>Joint torique defaillant ou ancien joint reste colle causant une fuite</td><td>Observer : huile tres noire avant echeance vidange ?</td></tr><tr><td>Baisse du niveau d huile plus rapide</td><td>Clapet by-pass bloque en position ouverte laissant passer l huile non filtree</td><td>Observer : baisse du niveau d huile plus rapide ?</td></tr><tr><td>Odeur d huile brulee dans l habitacle</td><td>Filtre colmate par accumulation d impuretes metalliques et residus de combustion</td><td>Voyant huile qui s allume ou clignote ?</td></tr></tbody></table>$fhlot$,
       $fhlot$<p>Un symptôme seul ne désigne pas le filtre à huile. Les deux premières lignes du tableau donnent la consigne d'un véhicule précis ; pour un autre véhicule, suivez sa propre notice.</p>
<table><thead><tr><th>Situation</th><th>À faire</th></tr></thead><tbody>
<tr><td>Renault Clio 5 phase 1 : le témoin de pression d'huile s'allume à la mise du contact, puis s'éteint après quelques secondes.</td><td>C'est le fonctionnement décrit par la notice de ce véhicule.</td></tr>
<tr><td>Renault Clio 5 phase 1 : le témoin s'allume en roulant, avec le témoin d'arrêt impératif et un signal sonore.</td><td>S'arrêter impérativement, couper le contact et vérifier le niveau d'huile. Si le niveau est normal, l'alerte a une autre cause : la notice demande de faire appel à un représentant de la marque.</td></tr>
<tr><td>Autre véhicule : témoin de pression d'huile allumé.</td><td>Suivre la notice du véhicule. Pour orienter la recherche avant d'acheter une pièce, commencer par le <a href="/diagnostic-auto">diagnostic</a>.</td></tr>
<tr><td>Fuite, bruit, odeur ou vibration, quel que soit le véhicule.</td><td>Un de ces signes, seul, ne désigne pas le filtre à huile. Pour en rechercher la cause, commencer par le <a href="/diagnostic-auto">diagnostic</a>.</td></tr>
</tbody></table>$fhlot$,
       '804702ae02e9cf31e3af606dc9e723022aec423af2addd00ea5da5f356e34070', '815bc2d375e43e527ff3b312d683fdca9286b72a43ca0de1a936d5f573b95f13'),
      ('sgc/conseil-7-S2_DIAG-1774724299375/sgc_sources', false, $fhlot$[{"type":"rag","ref":"gammes/filtre-a-huile.md","field":"diagnostic.symptoms"}]$fhlot$,
       $fhlot$[{"type":"wiki","ref":"wiki/gamme/filtre-a-huile.md","field":"S2_DIAG"}]$fhlot$,
       '4d309143dda1dee00d8ce4033d139d8c91375176b5e262d045e6bfaf1ff1fbc7', 'dfd5e223990a44068310068533739928c268047b53e1970ac935c9dc3ceee388'),
      ('sgc/conseil-7-S3-1771371936696/sgc_title', true, $fhlot$Comment choisir vos filtre à huile :$fhlot$,
       $fhlot$Choisir le bon filtre à huile$fhlot$,
       '59dce471ed72469a5ca36e5c02e401877f99b1e962e899efcc8d6abb51f52b75', '9e1b5cd8be271b45004a5270ef14e479fd27e2ac1f7930d0be81f011de06392e'),
      ('sgc/conseil-7-S3-1771371936696/sgc_content', true, $fhlot$Pour choisir les bons filtre à huile pour votre véhicule :<br>- Marque de votre vehicule<br>- Modele de votre vehicule<br>- Motorisation de votre vehicule<br>- Type de filtre monté (vissant spin-on ou cartouche élément filtrant)<br>- Reference constructeur OEM (si disponible)<br>- Diametre du filetage et joint torique<br>- Pression differentielle supportee (bar)<br>- Presence clapet anti-retour (obligatoire moteurs modernes)<br>- Presence clapet by-pass (protection moteur si colmatage)<br>- Compatibilite huile longlife (VW 502.00, BMW LL-01)$fhlot$,
       $fhlot$<p>Le filtre à huile se choisit à partir du véhicule, jamais d'après son aspect ou une dimension approchée.</p>
<ol>
<li><strong>Partez du véhicule.</strong> Dans le catalogue, sélectionnez la marque, le modèle, l'année et la motorisation exacte. Deux versions d'un même modèle peuvent recevoir des références différentes.</li>
<li><strong>Prenez la forme prévue</strong> par le moteur : filtre vissé ou cartouche.</li>
<li><strong>Ne vous fiez pas à l'apparence.</strong> Beaucoup de filtres se ressemblent mais diffèrent à l'intérieur selon le moteur : clapet anti-retour, filetage de raccordement, pression d'ouverture du by-pass, média filtrant, finesse de filtration, surpression admissible.</li>
<li><strong>Regardez la qualité.</strong> Le papier filtrant, le by-pass et le clapet anti-retour font partie des caractéristiques de qualité d'un filtre.</li>
</ol>
<h3>Les clapets d'un filtre vissé</h3>
<p>Selon sa conception, fixée par le constructeur du moteur ou du véhicule, un filtre vissé peut comporter trois types de clapets :</p>
<ul>
<li><strong>anti-retour</strong> : le plus souvent une membrane en caoutchouc, il empêche l'huile de quitter le filtre moteur arrêté, surtout quand le filtre est monté à l'horizontale ou tête en bas ;</li>
<li><strong>de dérivation (by-pass)</strong> : quand le filtre est colmaté ou que l'huile froide est trop épaisse, il s'ouvre pour que le moteur reste alimenté, même avec une huile non filtrée. Sa pression d'ouverture diffère selon le moteur ;</li>
<li><strong>anti-siphon</strong> : placé côté huile propre, il garde le filtre plein ; au démarrage, l'huile arrive vite au moteur, ce qui réduit fortement le frottement à sec.</li>
</ul>
<p>Ces différences ne se voient pas de l'extérieur. Les filtres rattachés à votre motorisation sont listés sur la page <a href="/pieces/filtre-a-huile-7.html">filtre à huile</a> du catalogue.</p>$fhlot$,
       '4fb33ea7c70c9fb9ae46419eac8b5dc2c2a84ab069dac65fbb7db20fffc2186e', '51386d25ccfaae43e303e90fe271c6370c241a9625863acd23e8117e79bc1f42'),
      ('sgc/conseil-7-S3-1771371936696/sgc_sources', false, $fhlot$[{"type":"rag","ref":"gammes/filtre-a-huile.md","field":"selection.criteria"}]$fhlot$,
       $fhlot$[{"type":"wiki","ref":"wiki/gamme/filtre-a-huile.md","field":"S3"}]$fhlot$,
       '9d0562f67ba5c4eadcda583de53b777fa674eab9685ab73e2efe8edd6297c10c', 'e116a5052927ba76aeca46ddc9dfe7310c6d974f3eb4290c4d47308ca637a68b'),
      ('sgc/21/sgc_title', true, $fhlot$Procédure de remplacement du filtre à huile :$fhlot$,
       $fhlot$Déposer l'ancien filtre$fhlot$,
       'a9f2bedd7b09e4c1a3c916a136ef37729eb36eeefca8a86dcd3a4e3dd3ffb4a7', '0ff319d0778aa0a8b39ddef155b156e513a7124c1529bb25fc6a38282131c41f'),
      ('sgc/21/sgc_content', true, $fhlot$<b>1.</b> # Filtres à huile pour voitures et cartouches de filtre à huile – Automobile – WIX Filters - FILTRES À HUILE The engine’s combustion chamber must remain clean, and therefore it also must be protected by a filter which prevents pollutants reaching the oil. The oil filter reduces the wear of close...<br><b>2.</b> ### Gaskets and Seals The primary function of a gasket is to create a tight seal between the filter and the engine block. This prevents engine oil from leaking out, which could starve the engine of lubrication and cause damage. While gaskets are designed to last for the life of the oil filter, they...<br><b>3.</b> ## Différentes opérations Ces deux structures différentes entraînent également des méthodes d’installation différentes. Pour installer le filtre à immersion, il faut d’abord appliquer de l’huile neuve sur le joint d’étanchéité. Ensuite, le filtre est vissé dans la base, en veillant à le serrer de...<br><b>4.</b> ## Intervalles corrigés Pour garantir son efficacité, le filtre à huile du moteur doit être remplacé régulièrement, aux intervalles spécifiés par les constructeurs automobiles. La plupart d’entre eux recommandent cette intervention tous les 15 000 kilomètres pour les moteurs à essence et tous les...$fhlot$,
       $fhlot$<p>La dépose dépend de la forme du filtre et du moteur : suivez les instructions du constructeur du véhicule et du fabricant du filtre.</p>
<ol>
<li>Vérifiez que le filtre neuf est la référence prévue pour votre motorisation.</li>
<li>Repérez la forme : un filtre vissé se dépose en entier ; avec une cartouche, seul l'élément filtrant sort du boîtier, qui reste en place.</li>
<li>Déposez l'ancien filtre ou l'ancien élément en suivant l'instruction du constructeur du véhicule.</li>
</ol>$fhlot$,
       'f28eba39697e7ab9dbc29e4c387737026d05941a99948abfa54da3316aa83b27', '1d10bc37296f5cab3d87de7d3ffc5d6d7189f8a3e45e3790420544ffdaf07872'),
      ('sgc/21/sgc_sources', false, $fhlot$[{"type":"rag","ref":"gammes/filtre-a-huile.md","field":"diagnostic.causes"}]$fhlot$,
       $fhlot$[{"type":"wiki","ref":"wiki/gamme/filtre-a-huile.md","field":"S4_DEPOSE"}]$fhlot$,
       'eb3b2af35e594b11f2e8aed21d511c60e1e0d419bf021bac9166cad80fc780e2', 'd940be41db32ef5dcf2a24c34e859be95dc2b51bb55b8a807df88fab8ff9645f'),
      ('sgc/22/sgc_title', true, $fhlot$Remontage d'un filtre à huile :$fhlot$,
       $fhlot$Monter le filtre neuf$fhlot$,
       '0f1c6f9d344b297881c47896c3e349c4e42b33e1c8a0517899e67091dbcf71a6', '482fcad5b27a55b323348353bcf73d042e35f77e2af6c581879e80f25a6c957d'),
      ('sgc/22/sgc_content', true, $fhlot$- Vérifiez que le <b>filtre à huile</b> neuf est identique à celui démonté.<br>- Remplacez les joints d'étanchéité du <b>filtre à huile</b>.<br>- Lubrifiez les joints neufs avec de l'huile avant de les remontés.<br>- Lubrifiez le <b>filtre à huile</b>.<br>- Mettre en place le <b>filtre à huile</b>.<br>- Dans le cas d'un <b>filtre à huile</b> vissé, serrez ce dernier au coupleprescrit.<br>- Dans le cas d'un élément filtrant, mettre le <b>filtre à huile </b>dans sonboîtier et serrez le couvercle au couple prescrit.<br>- Ouvrir le bouchon du remplissage d'huile moteur.<br>- Remplissez l'huile avec la quantité préconisée par le constructeur.<br>- Contrôlez le niveau d'huile avec la jauge d'huile.<br>- Rajoutez de l'huile si nécessaire.<br>- Recontrôler le niveau d'huile.<br>- Démarrez le moteur et le laissez tourner un peu au ralentie.<br>- Arrêtez le moteur et le laissez refroidir.<br>- Contrôlez de nouveau le niveau d'huile.
<p class="text-sm mt-3">✅ Après remontage, vérifiez les spécifications dans la <a href="/reference-auto/filtre-a-huile">fiche technique Filtre à huile</a>.</p>$fhlot$,
       $fhlot$<p>Même un filtre de qualité ne fonctionne correctement que s'il a été bien monté.</p>
<ol>
<li>Montez le filtre neuf en suivant les instructions du constructeur du véhicule et du fabricant du filtre : ce guide ne donne pas de consigne de serrage valable pour tous les filtres.</li>
</ol>$fhlot$,
       'c842c5e5388542fd1695b571a48150820a9646466f81f5f63c285888a6402cd1', '87dba1bd7fa7cc9a86c05e0c56a592bbecaf791d69274900fa1bfb86d94afd8c'),
      ('sgc/22/sgc_sources', false, $fhlot$[{"type":"rag","ref":"gammes/filtre-a-huile.md","field":"installation.steps"}]$fhlot$,
       $fhlot$[{"type":"wiki","ref":"wiki/gamme/filtre-a-huile.md","field":"S4_REPOSE"}]$fhlot$,
       'b775d3e6c3735b144052ec424286605b08037b2eb23723bb231248cedef81b0e', '6933916fc212ff0b35a40e51f90dd130006f704ffdd7b9188894bb129062a039'),
      ('sgc/conseil-7-S5-1771371936739/sgc_title', true, $fhlot$Erreurs à éviter avec les filtre à huile :$fhlot$,
       $fhlot$Erreurs à éviter$fhlot$,
       '691cc7245179f35d0be8a366f97f24700240d1c2d076efc94e1589d7379e552c', '88287933c89498ed47fa40324942c3e52028cad7216dfc0c32eb1504a8b1623e'),
      ('sgc/conseil-7-S5-1771371936739/sgc_content', true, $fhlot$<p>Le filtre à huile est remplacé à chaque vidange. Des erreurs simples peuvent pourtant compromettre la lubrification du moteur et générer des dommages coûteux.</p>
<ol>
  <li><strong>Oubli de lubrifier le joint torique avant le montage</strong> — un joint sec se déforme inégalement au serrage et peut fuir dès le démarrage → enduire légèrement le joint torique du filtre neuf avec de l'huile moteur propre avant le montage</li>
  <li><strong>Serrage excessif du filtre à la clé</strong> — le joint écrasé provoque une fuite difficile à stopper et peut rendre le filtre impossible à dévisser à la vidange suivante → serrer à la main puis d'un demi-tour à trois quarts de tour seulement</li>
  <li><strong>Filtre non adapté à la spécification huile du moteur</strong> — sur les moteurs dont la vidange est longue durée (VW 502.00, BMW LL-01), un filtre standard n'a pas la tenue thermique requise → choisir un filtre certifié pour la spécification huile du constructeur</li>
  <li><strong>Démarrage immédiat sans vérification du niveau après la vidange</strong> — un circuit d'huile vide au démarrage peut causer une usure précoce sur arbres à cames et paliers → vérifier le niveau sur la jauge avant de démarrer et après une minute de fonctionnement</li>
  <li><strong>Mauvais type de filtre (vissable vs cartouche) commandé</strong> — les deux types ne sont pas interchangeables selon le moteur → identifier le type exact avant commande (filtre à visser ou cartouche dans boîtier)</li>
</ol>$fhlot$,
       $fhlot$<ul>
<li>Choisir le filtre d'après son apparence ou une dimension approchée, au lieu de partir du véhicule.</li>
<li>Dépasser l'échéance du constructeur : le filtre peut se colmater et laisser passer, par le by-pass, une huile non filtrée.</li>
<li>Attribuer un voyant d'huile au filtre sans rechercher la cause.</li>
</ul>$fhlot$,
       '7b86da978bfc022a4f591fab04da410a06a0745b84ddf52223e00442df8775ef', '3231a4e6fa71eebe8684b6e5989623e63a1dc732e93f69f50bda4814671a163d'),
      ('sgc/conseil-7-S5-1771371936739/sgc_sources', false, $fhlot$[{"type":"rag","ref":"gammes/filtre-a-huile.md","field":"selection.anti_mistakes"}]$fhlot$,
       $fhlot$[{"type":"wiki","ref":"wiki/gamme/filtre-a-huile.md","field":"S5"}]$fhlot$,
       '89ab7e312757976256b1466b02e2325b7e63939a59c11bd6f03180cace046bc4', '25081e8020745de2cf6e88e668412d0ebb9323272ddb26c0d58e9e0d0aef3f04'),
      ('sgc/conseil-7-S6-1771938637895/sgc_title', true, $fhlot$Vérifications après remplacement du filtre à huile :$fhlot$,
       $fhlot$Après le remplacement$fhlot$,
       '132f132e303f8a6d89efb96f6a0b20767fd41e1f77b5b6db5c3d3d303f0a7377', 'd55ff54e64f3fdee561ab8a218b94b4c829edaad7af31793439d8126e749ae87'),
      ('sgc/conseil-7-S6-1771938637895/sgc_content', true, $fhlot$- <strong>Niveau d huile à la jauge</strong> : vérifier le niveau 5 minutes après le premier démarrage — l huile a rempli le filtre neuf et le niveau a baissé. Compléter si nécessaire entre les repères MIN et MAX.<br>- <strong>Étanchéité du filtre</strong> : inspecter sous le filtre et sous la vis de vidange après 2 minutes de ralenti — aucune goutte ne doit apparaître. Si suintement, resserrer d un quart de tour maximum.<br>- <strong>Étanchéité du joint torique</strong> : vérifier qu aucune trace d huile ne coule le long du bloc moteur au niveau du plan de joint. Cause fréquente : ancien joint resté collé sous le filtre neuf.<br>- <strong>Voyant huile éteint</strong> : après démarrage moteur, le voyant huile doit s éteindre en moins de 5 secondes. S il reste allumé, couper le moteur immédiatement et vérifier le serrage du filtre et le niveau.<br>- <strong>Essai moteur au ralenti</strong> : laisser tourner 2-3 minutes au ralenti et écouter — aucun cliquetis ni bruit anormal ne doit apparaître. Un cliquetis indiquerait un problème de pression d huile.<br>- <strong>Remise à zéro indicateur maintenance</strong> : sur véhicules équipés, réinitialiser le compteur de vidange selon la procédure constructeur — sinon le voyant reste allumé jusqu à la prochaine intervention.<br>- <strong>Essai route progressif</strong> : effectuer un trajet de 5-10 km en montant progressivement en régime. Revérifier le niveau d huile à froid et inspecter le filtre une dernière fois.$fhlot$,
       $fhlot$<p>Après le remplacement, si le témoin de pression d'huile s'allume, suivez la notice de votre véhicule.</p>$fhlot$,
       '832407318e8f1072d87cc1b2329e5748a8c72e59a3d1b087f23e5ed29daf0b36', '2552720c9e542c16474717288631c87e79db8b86f6d99f08efe049978ea8c474'),
      ('sgc/conseil-7-S6-1771938637895/sgc_sources', false, $fhlot$[{"type":"rag","ref":"gammes/filtre-a-huile.md","field":"diagnostic.symptoms"},{"type":"rag","ref":"gammes/filtre-a-huile.md","field":"rendering.faq[4]"},{"type":"kp","ref":"skp_id:12","field":"S6.micro_phrases"}]$fhlot$,
       $fhlot$[{"type":"wiki","ref":"wiki/gamme/filtre-a-huile.md","field":"S6"}]$fhlot$,
       '74a360ea45a94c476778f8e46e76a6b47d4ae3d27fe4749b434ea5bf9361fd8b', '32a51154d5d2de72fea590be711ec1466af224dd9b9ffa161f1941a035a721d4'),
      ('sgc/conseil-7-S_GARAGE-1772504383540/sgc_title', true, $fhlot$Quand confier le remplacement du filtre à huile à un professionnel :$fhlot$,
       $fhlot$Quand confier l'intervention à un professionnel$fhlot$,
       'a72592e3105f82f385c14f3d242dd74c1a03de3c033ff178293b65df6e5206b2', '246b756f5bbff2bc91ba6ab3d05744b6f1e0778912b72698d217d2f118f631f0'),
      ('sgc/conseil-7-S_GARAGE-1772504383540/sgc_content', true, $fhlot$<div class="garage-callout"><p><strong>Nous vous recommandons de confier cette intervention à un professionnel :</strong></p><br>- Plusieurs causes possibles de défaillance (4 identifiées) nécessitent un diagnostic professionnel<br><br><p>Un garagiste qualifié dispose de l'outillage et de l'expérience nécessaires pour effectuer cette opération en toute sécurité.</p></div>$fhlot$,
       $fhlot$<p>Si vous n'avez pas les instructions de montage du constructeur et du fabricant du filtre, confiez l'intervention à un professionnel.</p>
<p>Si le témoin de pression d'huile s'allume en roulant, suivez la notice du véhicule. Celle de la Renault Clio 5 phase 1 demande, si le niveau d'huile est normal, de faire appel à un représentant de la marque.</p>$fhlot$,
       '6fb3bd7c391c2ad7f32a3b51aeefc2c3f6c28d0630c690f3a84816006e53556c', '18371c4c7520c7729c852ddaa1dbe99a9d1534c1a4e9df86e3f0df6fb286f0f6'),
      ('sgc/conseil-7-S_GARAGE-1772504383540/sgc_sources', false, $fhlot$[{"type":"rag","ref":"gammes/filtre-a-huile.md","field":"installation.difficulty"}]$fhlot$,
       $fhlot$[{"type":"wiki","ref":"wiki/gamme/filtre-a-huile.md","field":"S_GARAGE"}]$fhlot$,
       '7f260f53518d0b812014a50b024490914bce3d151a01d285e0cf364f9a74e8c4', 'c60686004163541050e449009da2ab203cf0ddb8ddb5fb1fc4a885ac33a2cb87'),
      ('sgc/conseil-7-S7-1771371936783/sgc_title', true, $fhlot$Pièces à contrôler et à remplacer avec les filtre à huile :$fhlot$,
       $fhlot$Pièces liées au filtre à huile$fhlot$,
       'c7d4442e43c00a79778dcf49de19c59884f7df715351b7c3d08cd752cde48756', '2b859a824b2f056a534ccfe382a3d3e4eb5526d4bde9914280d2f5a731332f2c'),
      ('sgc/conseil-7-S7-1771371936783/sgc_content', true, $fhlot$- <b><a href="/pieces/huile-moteur">huile moteur</a></b><br>- <b><a href="/pieces/joint-de-vidange-carter">joint de vidange carter</a></b><br>- <b><a href="/pieces/filtre-a-air">filtre à air</a></b><br>- <b><a href="/pieces/filtre-a-carburant">filtre à carburant</a></b><br>- <b><a href="/pieces/filtre-d-habitacle">filtre d habitacle</a></b><br>- <b><a href="/pieces/bouchon-de-vidange">bouchon de vidange</a></b>$fhlot$,
       $fhlot$<ul>
<li><a href="/pieces/bouchon-de-vidange-593.html">Bouchon de vidange</a></li>
<li><a href="/pieces/filtre-a-air-8.html">Filtre à air</a></li>
<li><a href="/pieces/filtre-a-carburant-9.html">Filtre à carburant</a></li>
<li><a href="/pieces/filtre-d-habitacle-424.html">Filtre d'habitacle</a></li>
</ul>
<p>Ces filtres traitent d'autres fluides que l'huile et ont chacun leur propre référence.</p>$fhlot$,
       '68883c9f954ad228dcb24b4b66f9b443d95eeaea9fe34e93a535b028f247b579', '7536ce41fab2f259a27cfdc64da51ab6351f9a151be1ba261ff2d9eed7c0c1b9'),
      ('sgc/conseil-7-S7-1771371936783/sgc_sources', false, $fhlot$[{"type":"rag","ref":"gammes/filtre-a-huile.md","field":"domain.related_parts"}]$fhlot$,
       $fhlot$[{"type":"wiki","ref":"wiki/gamme/filtre-a-huile.md","field":"S7"}]$fhlot$,
       '9b922cf4ed68a4d48cd77cd8e16254e5c3b732fd6a8f33a2807f77931a6ff024', 'cd12309cf574f4d8df9897025722147457659a6042bbeb4e20c8e47179e94ba4'),
      ('sgc/conseil-7-S8-1771509122681/sgc_title', true, $fhlot$Questions fréquentes sur les filtre à huile :$fhlot$,
       $fhlot$Questions fréquentes sur le filtre à huile$fhlot$,
       'ed240fba314d5f4929cef8eb8afc0a8e2137fc26c2fc05454a3ec0a336053dc9', '2e8c9a7f93d0ecbaa98c5b6596dbbcae3bacc64d9755d7894bab346200c56e60'),
      ('sgc/conseil-7-S8-1771509122681/sgc_content', true, $fhlot$<details><summary><b>Filtre à huile OE ou adaptable : que choisir ?</b></summary><p>Les filtres OES (Bosch) ou adaptables (Mann, Mahle) offrent une qualité équivalente à l'OE pour moins cher. Vérifiez le filetage et le diamètre du joint.</p></details>
<details><summary><b>Comment savoir si mon filtre à huile est bouché ?</b></summary><p>Voyant huile allumé, bruit de cliquetis moteur, huile noire et épaisse à la jauge, consommation d'huile excessive.</p></details>
<details><summary><b>Tous les combien changer le filtre à huile ?</b></summary><p>À chaque vidange, soit entre 15 000 et 30 000 km ou 1 an. Ne jamais réutiliser un ancien filtre même récent.</p></details>
<details><summary><b>Peut-on changer le filtre à huile soi-même ?</b></summary><p>Oui, opération simple lors de la vidange. Clé à filtre nécessaire. Graisser le joint neuf avec de l'huile. Serrage à la main + 3/4 de tour.</p></details>
<details><summary><b>Quelle erreur éviter avec le filtre à huile ?</b></summary><p>Ne pas trop serrer (écrase le joint). Ne pas oublier de retirer l'ancien joint collé sur le bloc. Toujours pré-remplir le filtre si possible.</p></details>
<details><summary><b>Peut-on changer le filtre à huile sans faire la vidange ?</b></summary><p>Techniquement possible mais déconseillé. Retirer le filtre entraîne une perte d'huile. Le filtre neuf dans de l'huile usagée ne remplit pas pleinement son rôle.</p></details>
<details><summary><b>Le joint torique se change-t-il en même temps que le filtre ?</b></summary><p>Oui, systématiquement. Sur filtre cartouche, le joint torique est souvent fourni. Erreur fréquente — toujours vérifier que l'ancien joint n'est pas resté collé sur le bloc.</p></details>$fhlot$,
       $fhlot$<details><summary><b>Que remplace-t-on lors de l'entretien ?</b></summary><p>Un filtre vissé se change en entier, car son boîtier et son élément filtrant forment un seul bloc. Avec une cartouche, seul l'élément filtrant est renouvelé.</p></details>
<details><summary><b>Quand remplacer le filtre à huile ?</b></summary><p>Aux échéances d'entretien prévues par le constructeur du véhicule. Aucune durée ni aucun kilométrage ne vaut pour tous les véhicules.</p></details>
<details><summary><b>Peut-on choisir un filtre à sa taille ou à son apparence ?</b></summary><p>Non. Des filtres qui se ressemblent peuvent être très différents à l'intérieur selon le moteur. Le choix se fait à partir du véhicule.</p></details>
<details><summary><b>Le voyant de pression d'huile vient-il du filtre ?</b></summary><p>Ce voyant ne désigne pas à lui seul le filtre. Suivez la notice du véhicule, puis faites rechercher la cause.</p></details>
<details><summary><b>À quoi sert le clapet anti-retour ?</b></summary><p>Il empêche l'huile de quitter le filtre quand le moteur est arrêté, surtout quand le filtre est monté à l'horizontale ou tête en bas. Tous les filtres vissés n'en ont pas : cela dépend du moteur.</p></details>$fhlot$,
       'cb1e55fdf473e31011507c1fbed3fbb3f284c73bc858d43a8744dfe800d1df99', '6242910241b088baaba0dec529a8fdc85727ffd425f94ba67b07df737b9f03c9'),
      ('sgc/conseil-7-S8-1771509122681/sgc_sources', false, $fhlot$[{"type":"rag","ref":"gammes/filtre-a-huile.md","field":"rendering.faq"}]$fhlot$,
       $fhlot$[{"type":"wiki","ref":"wiki/gamme/filtre-a-huile.md","field":"S8"}]$fhlot$,
       '9ff33e45b634df8a5f76dee27b086e11ad798c181fcbf68bda8f4d75d8a110a5', '54c99ccf9fd15dc03c2e2de49255e596a27384d3d259388c888962f6d0bd07ac')
    ) v(k, trig, avant, apres, h_avant, h_apres));
  SELECT count(*) INTO v_n FROM jsonb_each(v_cells);
  IF v_n <> 50 THEN RAISE EXCEPTION 'ABORT: % cellule(s), 50 attendues', v_n; END IF;
  SELECT string_agg(e.key, ', ' ORDER BY e.key COLLATE "C") INTO v_txt
    FROM jsonb_each(v_cells) e
   WHERE encode(sha256(convert_to(e.value->>'avant', 'UTF8')), 'hex') <> e.value->>'h_avant'
      OR encode(sha256(convert_to(e.value->>'apres', 'UTF8')), 'hex') <> e.value->>'h_apres';
  IF v_txt IS NOT NULL THEN RAISE EXCEPTION 'ABORT: cellule(s) altérée(s) dans le fichier : %', v_txt; END IF;

  SELECT string_agg(k || ' ' || classe, ', ' ORDER BY k COLLATE "C") FILTER (WHERE classe = 'DERIVE'),
         count(*) FILTER (WHERE classe = 'APRES')
    INTO v_txt, v_n
    FROM (SELECT v.k,
           CASE WHEN cur.k IS NULL THEN 'DERIVE'
                WHEN cur.v IS NOT DISTINCT FROM v.apres THEN 'APRES'
                WHEN cur.v IS NOT DISTINCT FROM v.avant THEN 'AVANT'
                WHEN v.trig AND cur.v IS NOT DISTINCT FROM restore_french_accents(v.avant) THEN 'RETOUR'
                ELSE 'DERIVE' END AS classe
      FROM (SELECT e.key AS k, (e.value->>'trig')::boolean AS trig, e.value->>'avant' AS avant, e.value->>'apres' AS apres FROM jsonb_each(v_cells) e) v
      LEFT JOIN (SELECT 'r1s/' || x.col AS k, x.val AS v
       FROM __seo_r1_gamme_slots s
      CROSS JOIN LATERAL (VALUES
        ('r1s_hero_subtitle', s.r1s_hero_subtitle::text),
        ('r1s_selector_microcopy', s.r1s_selector_microcopy::text),
        ('r1s_arg1_title', s.r1s_arg1_title::text),
        ('r1s_arg1_content', s.r1s_arg1_content::text),
        ('r1s_arg2_title', s.r1s_arg2_title::text),
        ('r1s_arg2_content', s.r1s_arg2_content::text),
        ('r1s_arg3_title', s.r1s_arg3_title::text),
        ('r1s_arg3_content', s.r1s_arg3_content::text),
        ('r1s_arg4_title', s.r1s_arg4_title::text),
        ('r1s_arg4_content', s.r1s_arg4_content::text),
        ('r1s_compatibilities_intro', s.r1s_compatibilities_intro::text),
        ('r1s_equipementiers_line', s.r1s_equipementiers_line::text),
        ('r1s_family_cross_sell_intro', s.r1s_family_cross_sell_intro::text),
        ('r1s_safe_table_rows', s.r1s_safe_table_rows::text),
        ('r1s_faq', s.r1s_faq::text),
        ('r1s_micro_seo_block', s.r1s_micro_seo_block::text)
      ) x(col, val)
      WHERE s.r1s_pg_id = '7'
     UNION ALL
     SELECT 'sg/sg_content', g.sg_content
       FROM __seo_gamme g
      WHERE g.sg_pg_id = '7' AND g.sg_id = '4'
     UNION ALL
     SELECT 'sgc/' || c.sgc_id || '/' || x.col, x.val
       FROM __seo_gamme_conseil c
      CROSS JOIN LATERAL (VALUES ('sgc_title', c.sgc_title), ('sgc_content', c.sgc_content), ('sgc_sources', c.sgc_sources)) x(col, val)
      WHERE c.sgc_pg_id = '7' AND c.sgc_id IN ('conseil-7-S_GARAGE-1772504383540', '18', '20', 'conseil-7-S2_DIAG-1774724299375', 'conseil-7-S3-1771371936696', '21', '22', 'conseil-7-S5-1771371936739', 'conseil-7-S6-1771938637895', 'conseil-7-S7-1771371936783', 'conseil-7-S8-1771509122681')) cur ON cur.k = v.k) cl;
  IF v_txt IS NOT NULL THEN
    RAISE EXCEPTION 'ABORT: cellule(s) modifiée(s) depuis l''écriture du lot : %', v_txt;
  END IF;
  IF v_n = 0 THEN
    RAISE NOTICE 'retour textes pg 7 : aucune cellule écrite par le lot, sans effet';
    RETURN;
  END IF;

  v_prev := current_setting('request.headers', true);
  SELECT agent_id INTO STRICT v_agent FROM agent_write_scopes WHERE agent_name = 'SEO-Content';
  PERFORM set_config('request.headers', json_build_object('x-agent-id', v_agent)::text, true); -- identité-agent
  IF resolve_agent_write_scope() IS DISTINCT FROM 'seo_content_tables' THEN
    RAISE EXCEPTION 'ABORT: identité SEO-Content non résolue par resolve_agent_write_scope (scope %)', coalesce(resolve_agent_write_scope(), 'NULL');
  END IF;

  UPDATE __seo_r1_gamme_slots SET
    r1s_hero_subtitle = CASE WHEN r1s_hero_subtitle::text IS NOT DISTINCT FROM v_cells->'r1s/r1s_hero_subtitle'->>'apres' THEN (v_cells->'r1s/r1s_hero_subtitle'->>'avant') ELSE r1s_hero_subtitle END,
    r1s_selector_microcopy = CASE WHEN r1s_selector_microcopy::text IS NOT DISTINCT FROM v_cells->'r1s/r1s_selector_microcopy'->>'apres' THEN (v_cells->'r1s/r1s_selector_microcopy'->>'avant')::text[] ELSE r1s_selector_microcopy END,
    r1s_arg1_title = CASE WHEN r1s_arg1_title::text IS NOT DISTINCT FROM v_cells->'r1s/r1s_arg1_title'->>'apres' THEN (v_cells->'r1s/r1s_arg1_title'->>'avant') ELSE r1s_arg1_title END,
    r1s_arg1_content = CASE WHEN r1s_arg1_content::text IS NOT DISTINCT FROM v_cells->'r1s/r1s_arg1_content'->>'apres' THEN (v_cells->'r1s/r1s_arg1_content'->>'avant') ELSE r1s_arg1_content END,
    r1s_arg2_title = CASE WHEN r1s_arg2_title::text IS NOT DISTINCT FROM v_cells->'r1s/r1s_arg2_title'->>'apres' THEN (v_cells->'r1s/r1s_arg2_title'->>'avant') ELSE r1s_arg2_title END,
    r1s_arg2_content = CASE WHEN r1s_arg2_content::text IS NOT DISTINCT FROM v_cells->'r1s/r1s_arg2_content'->>'apres' THEN (v_cells->'r1s/r1s_arg2_content'->>'avant') ELSE r1s_arg2_content END,
    r1s_arg3_title = CASE WHEN r1s_arg3_title::text IS NOT DISTINCT FROM v_cells->'r1s/r1s_arg3_title'->>'apres' THEN (v_cells->'r1s/r1s_arg3_title'->>'avant') ELSE r1s_arg3_title END,
    r1s_arg3_content = CASE WHEN r1s_arg3_content::text IS NOT DISTINCT FROM v_cells->'r1s/r1s_arg3_content'->>'apres' THEN (v_cells->'r1s/r1s_arg3_content'->>'avant') ELSE r1s_arg3_content END,
    r1s_arg4_title = CASE WHEN r1s_arg4_title::text IS NOT DISTINCT FROM v_cells->'r1s/r1s_arg4_title'->>'apres' THEN (v_cells->'r1s/r1s_arg4_title'->>'avant') ELSE r1s_arg4_title END,
    r1s_arg4_content = CASE WHEN r1s_arg4_content::text IS NOT DISTINCT FROM v_cells->'r1s/r1s_arg4_content'->>'apres' THEN (v_cells->'r1s/r1s_arg4_content'->>'avant') ELSE r1s_arg4_content END,
    r1s_compatibilities_intro = CASE WHEN r1s_compatibilities_intro::text IS NOT DISTINCT FROM v_cells->'r1s/r1s_compatibilities_intro'->>'apres' THEN (v_cells->'r1s/r1s_compatibilities_intro'->>'avant') ELSE r1s_compatibilities_intro END,
    r1s_equipementiers_line = CASE WHEN r1s_equipementiers_line::text IS NOT DISTINCT FROM v_cells->'r1s/r1s_equipementiers_line'->>'apres' THEN (v_cells->'r1s/r1s_equipementiers_line'->>'avant') ELSE r1s_equipementiers_line END,
    r1s_family_cross_sell_intro = CASE WHEN r1s_family_cross_sell_intro::text IS NOT DISTINCT FROM v_cells->'r1s/r1s_family_cross_sell_intro'->>'apres' THEN (v_cells->'r1s/r1s_family_cross_sell_intro'->>'avant') ELSE r1s_family_cross_sell_intro END,
    r1s_safe_table_rows = CASE WHEN r1s_safe_table_rows::text IS NOT DISTINCT FROM v_cells->'r1s/r1s_safe_table_rows'->>'apres' THEN (v_cells->'r1s/r1s_safe_table_rows'->>'avant')::jsonb ELSE r1s_safe_table_rows END,
    r1s_faq = CASE WHEN r1s_faq::text IS NOT DISTINCT FROM v_cells->'r1s/r1s_faq'->>'apres' THEN (v_cells->'r1s/r1s_faq'->>'avant')::jsonb ELSE r1s_faq END,
    r1s_micro_seo_block = CASE WHEN r1s_micro_seo_block::text IS NOT DISTINCT FROM v_cells->'r1s/r1s_micro_seo_block'->>'apres' THEN (v_cells->'r1s/r1s_micro_seo_block'->>'avant') ELSE r1s_micro_seo_block END
   WHERE r1s_pg_id = '7';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 1 THEN RAISE EXCEPTION 'ABORT: % ligne(s) R1 remise(s), 1 attendue', v_n; END IF;

  UPDATE __seo_gamme SET
    sg_content = CASE WHEN sg_content IS NOT DISTINCT FROM v_cells->'sg/sg_content'->>'apres'
                      THEN v_cells->'sg/sg_content'->>'avant' ELSE sg_content END
   WHERE sg_pg_id = '7' AND sg_id = '4';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 1 THEN RAISE EXCEPTION 'ABORT: % ligne(s) sg remise(s), 1 attendue', v_n; END IF;

  UPDATE __seo_gamme_conseil AS c SET
    sgc_title = CASE WHEN c.sgc_title IS NOT DISTINCT FROM v_cells->('sgc/' || c.sgc_id || '/sgc_title')->>'apres' THEN v_cells->('sgc/' || c.sgc_id || '/sgc_title')->>'avant' ELSE c.sgc_title END,
    sgc_content = CASE WHEN c.sgc_content IS NOT DISTINCT FROM v_cells->('sgc/' || c.sgc_id || '/sgc_content')->>'apres' THEN v_cells->('sgc/' || c.sgc_id || '/sgc_content')->>'avant' ELSE c.sgc_content END,
    sgc_sources = CASE WHEN c.sgc_sources IS NOT DISTINCT FROM v_cells->('sgc/' || c.sgc_id || '/sgc_sources')->>'apres' THEN v_cells->('sgc/' || c.sgc_id || '/sgc_sources')->>'avant' ELSE c.sgc_sources END
   WHERE c.sgc_pg_id = '7' AND c.sgc_id IN ('conseil-7-S_GARAGE-1772504383540', '18', '20', 'conseil-7-S2_DIAG-1774724299375', 'conseil-7-S3-1771371936696', '21', '22', 'conseil-7-S5-1771371936739', 'conseil-7-S6-1771938637895', 'conseil-7-S7-1771371936783', 'conseil-7-S8-1771509122681');
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 11 THEN RAISE EXCEPTION 'ABORT: % section(s) R3 remise(s), 11 attendues', v_n; END IF;

  PERFORM set_config('request.headers', coalesce(v_prev, ''), true);

  PERFORM invalidate_r1_caches(7, 'editorial_filtre_huile_pg7:textes:rollback', 'both');
  IF EXISTS (SELECT 1 FROM __gamme_page_cache WHERE pg_id = 7 AND NOT stale)
     OR EXISTS (SELECT 1 FROM __seo_r1_related_blocks_cache WHERE pg_id = 7 AND NOT stale) THEN
    RAISE EXCEPTION 'ABORT: cache de pg 7 encore frais après invalidation';
  END IF;

  SELECT string_agg(k || ' ' || classe, ', ' ORDER BY k COLLATE "C") INTO v_txt
    FROM (SELECT v.k,
           CASE WHEN cur.k IS NULL THEN 'DERIVE'
                WHEN cur.v IS NOT DISTINCT FROM v.apres THEN 'APRES'
                WHEN cur.v IS NOT DISTINCT FROM v.avant THEN 'AVANT'
                WHEN v.trig AND cur.v IS NOT DISTINCT FROM restore_french_accents(v.avant) THEN 'RETOUR'
                ELSE 'DERIVE' END AS classe
      FROM (SELECT e.key AS k, (e.value->>'trig')::boolean AS trig, e.value->>'avant' AS avant, e.value->>'apres' AS apres FROM jsonb_each(v_cells) e) v
      LEFT JOIN (SELECT 'r1s/' || x.col AS k, x.val AS v
       FROM __seo_r1_gamme_slots s
      CROSS JOIN LATERAL (VALUES
        ('r1s_hero_subtitle', s.r1s_hero_subtitle::text),
        ('r1s_selector_microcopy', s.r1s_selector_microcopy::text),
        ('r1s_arg1_title', s.r1s_arg1_title::text),
        ('r1s_arg1_content', s.r1s_arg1_content::text),
        ('r1s_arg2_title', s.r1s_arg2_title::text),
        ('r1s_arg2_content', s.r1s_arg2_content::text),
        ('r1s_arg3_title', s.r1s_arg3_title::text),
        ('r1s_arg3_content', s.r1s_arg3_content::text),
        ('r1s_arg4_title', s.r1s_arg4_title::text),
        ('r1s_arg4_content', s.r1s_arg4_content::text),
        ('r1s_compatibilities_intro', s.r1s_compatibilities_intro::text),
        ('r1s_equipementiers_line', s.r1s_equipementiers_line::text),
        ('r1s_family_cross_sell_intro', s.r1s_family_cross_sell_intro::text),
        ('r1s_safe_table_rows', s.r1s_safe_table_rows::text),
        ('r1s_faq', s.r1s_faq::text),
        ('r1s_micro_seo_block', s.r1s_micro_seo_block::text)
      ) x(col, val)
      WHERE s.r1s_pg_id = '7'
     UNION ALL
     SELECT 'sg/sg_content', g.sg_content
       FROM __seo_gamme g
      WHERE g.sg_pg_id = '7' AND g.sg_id = '4'
     UNION ALL
     SELECT 'sgc/' || c.sgc_id || '/' || x.col, x.val
       FROM __seo_gamme_conseil c
      CROSS JOIN LATERAL (VALUES ('sgc_title', c.sgc_title), ('sgc_content', c.sgc_content), ('sgc_sources', c.sgc_sources)) x(col, val)
      WHERE c.sgc_pg_id = '7' AND c.sgc_id IN ('conseil-7-S_GARAGE-1772504383540', '18', '20', 'conseil-7-S2_DIAG-1774724299375', 'conseil-7-S3-1771371936696', '21', '22', 'conseil-7-S5-1771371936739', 'conseil-7-S6-1771938637895', 'conseil-7-S7-1771371936783', 'conseil-7-S8-1771509122681')) cur ON cur.k = v.k) cl
   WHERE classe NOT IN ('AVANT', 'RETOUR');
  IF v_txt IS NOT NULL THEN RAISE EXCEPTION 'ABORT: relecture du retour : %', v_txt; END IF;
  SELECT string_agg(nom, ', ' ORDER BY nom COLLATE "C") INTO v_txt FROM (
    SELECT x.nom
      FROM (VALUES
      ('r1s_h1_override', (SELECT r1s_h1_override::text FROM __seo_r1_gamme_slots WHERE r1s_pg_id = '7'),
       '1d4e252a8874eef4e11dc11ff6069366e864476bb8935f3d7f67ff214ef2b4dc', true),
      ('sg_title', (SELECT sg_title FROM __seo_gamme WHERE sg_pg_id = '7' AND sg_id = '4'),
       'e6de4da9221481a0ced79c6af9c733f208b50cc80590b68772caca88627847bc', true),
      ('sg_descrip', (SELECT sg_descrip FROM __seo_gamme WHERE sg_pg_id = '7' AND sg_id = '4'),
       '30f5becf870fd786fec55a9dd2da95746e06daa8953be0f911dfbb51f6d74d2f', true),
      ('sgc_content:META', (SELECT sgc_content FROM __seo_gamme_conseil WHERE sgc_pg_id = '7' AND sgc_id = 'conseil-7-META-20260321'),
       '71872ad253d983dfeb45a0fd8a31beaacf801b433f03afcfa7e0ad7ba5a1f07b', false),
      ('sgc_title:META', (SELECT sgc_title FROM __seo_gamme_conseil WHERE sgc_pg_id = '7' AND sgc_id = 'conseil-7-META-20260321'),
       '21b852fca2b57b2bd107742cf31ea30416f2e9b3bdd7a39be5c5408ae2ce789d', false)
      ) x(nom, val, sha, fixe)
     WHERE x.val IS NULL
        OR encode(sha256(convert_to(x.val, 'UTF8')), 'hex') <> x.sha
        OR (x.fixe AND restore_french_accents(x.val) IS DISTINCT FROM x.val)
  ) b;
  IF v_txt IS NOT NULL THEN RAISE EXCEPTION 'ABORT: relecture des champs protégés : %', v_txt; END IF;
  RAISE NOTICE 'retour textes pg 7 : cellules remises à la valeur relevée';
END
$ecriture$;

COMMIT;
