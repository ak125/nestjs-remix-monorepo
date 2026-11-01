-- Rollback: 20261031_editorial_filtre_huile_pg7_images
-- FICHIER GÉNÉRÉ par docs/audits/editorial-filtre-huile-20261030/tools/build-publication-migration.cjs
-- depuis le dossier (integration/avant-textes.json, publication-batch.json,
-- r1.json, r3.json, assets.json). Ne pas l'éditer à la main : `--check`
-- échoue sur tout écart. Identifiant : 20261031_editorial_filtre_huile_pg7_images.
-- Remet, sur chaque ligne encore égale à l'état écrit par 20261031_editorial_filtre_huile_pg7_images.sql,
-- l'état relevé le 2026-10-31 : chemin, alt, légende, statut, sélection et, en
-- R1, rip_updated_at. Une ligne modifiée depuis arrête tout (DERIVE). Exige que
-- les anciens objets R1 soient encore dans le bucket avec leurs métadonnées
-- relevées, au rejeu compris. En R3, l'état relevé est pending sans image : le retour repasse ces
-- lignes de approved à pending (déclassement B5 déclaré). Les nouveaux objets
-- restent dans le bucket ; leur suppression est une étape manuelle distincte.
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
  SELECT string_agg(p.sig, ', ' ORDER BY p.sig COLLATE "C") INTO v_txt
    FROM (VALUES
      ('public.resolve_agent_write_scope()', '8d54b4884ba9d79d13ceb6e3efcf32ee|t|s|{search_path=public}'),
      ('public.check_agent_write_allowed(text,text)', '142e397a9c484acf71f7a165128f65b5|t|v|{search_path=public}'),
      ('public.enforce_agent_write_scope()', '89e28826419409a2bc47f63201946fa6|t|v|{search_path=public}'),
      ('public.trg_invalidate_r1_from_image_prompts()', '26d4f7c0fb578db5fc376196c0d069dd|t|v|{search_path=public}'),
      ('public.invalidate_r1_caches(integer,text,text)', '057683db298396024bcccbe8054627d3|t|v|{search_path=public}')
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
               AND t.tgrelid IN ('public.__seo_r1_image_prompts'::regclass, 'public.__seo_r3_image_prompts'::regclass, 'public.__gamme_page_cache'::regclass)) x;
  IF v_txt IS DISTINCT FROM $trg$O CREATE TRIGGER trg_gpc_invalidate_image_prompts AFTER INSERT OR DELETE OR UPDATE ON public.__seo_r1_image_prompts FOR EACH ROW EXECUTE FUNCTION trg_invalidate_r1_from_image_prompts()
O CREATE TRIGGER trg_write_scope___seo_r1_image_prompts BEFORE INSERT OR UPDATE ON public.__seo_r1_image_prompts FOR EACH ROW EXECUTE FUNCTION enforce_agent_write_scope()
O CREATE TRIGGER trg_write_scope___seo_r3_image_prompts BEFORE INSERT OR UPDATE ON public.__seo_r3_image_prompts FOR EACH ROW EXECUTE FUNCTION enforce_agent_write_scope()$trg$ THEN
    RAISE EXCEPTION 'ABORT: triggers de pg 7 (images) différents du relevé :%', E'\n' || coalesce(v_txt, '(aucun)');
  END IF;

  -- debut-controle-regles
  SELECT count(*), min(write_scope) INTO v_n, v_txt FROM agent_write_scopes WHERE agent_name = 'SEO-Content';
  IF v_n <> 1 OR v_txt IS DISTINCT FROM 'seo_content_tables' THEN
    RAISE EXCEPTION 'ABORT: agent SEO-Content : % ligne(s), scope %, attendu 1 ligne seo_content_tables', v_n, coalesce(v_txt, '-');
  END IF;
  SELECT string_agg(t, ', ' ORDER BY t COLLATE "C") INTO v_txt
    FROM unnest(ARRAY['__seo_r1_image_prompts', '__seo_r3_image_prompts']) t
   WHERE NOT EXISTS (SELECT 1 FROM agent_scope_table_rules r
                        WHERE r.scope = 'seo_content_tables'
                          AND 'update' = ANY (r.allowed_operations)
                          AND (t = r.table_pattern
                               OR (position('*' in r.table_pattern) > 0 AND t LIKE replace(r.table_pattern, '*', '%'))));
  IF v_txt IS NOT NULL THEN
    RAISE EXCEPTION 'ABORT: le scope seo_content_tables n''autorise pas UPDATE sur %', v_txt;
  END IF;
  -- fin-controle-regles
END
$precheck$;

DO $ecriture$
DECLARE
  v_plan   jsonb := $fhlot$[
{"tbl":"r1","rip_id":31,"slot":"HERO","section":null,"avant":{"path":"articles/gammes-produits/r1/filtre-a-huile.webp","alt":"Filtre à huile — pièce automobile neuve","caption":"Filtre à huile — vue détaillée","status":"approved","selected":true},"apres":{"path":"articles/gammes-produits/r1/filtre-a-huile-v20261031.webp","alt":"Filtre à huile vissé usagé, tenu d'une main gantée pendant une vidange","caption":null,"status":"approved","selected":true},"objet":{"path":"articles/gammes-produits/r1/filtre-a-huile-v20261031.webp","size":61176,"md5":"1d7788595e6187b328d1a4efbb11dd16"},"objet_avant":{"path":"articles/gammes-produits/r1/filtre-a-huile.webp","size":2369854,"md5":"c41bb7189cbad0d5f5c035ad344b8513","mimetype":"image/png","cache_control":"max-age=3600"},"maj_avant":"2026-03-25T01:51:24.179+00:00"},
{"tbl":"r1","rip_id":32,"slot":"TYPES","section":null,"avant":{"path":"articles/gammes-produits/r1/filtre-a-huile-2.webp","alt":"Types de filtre à huile — comparatif visuel","caption":"Comment distinguer les types de filtre à huile","status":"approved","selected":true},"apres":{"path":"articles/gammes-produits/r1/filtre-a-huile-2-v20261031.webp","alt":"Schéma comparant un filtre à huile vissé, changé en bloc, et une cartouche logée dans un boîtier démontable","caption":"Schéma de principe. La présence et la position des clapets varient selon le filtre et le moteur.","status":"approved","selected":true},"objet":{"path":"articles/gammes-produits/r1/filtre-a-huile-2-v20261031.webp","size":59616,"md5":"ee910bed34055380e6e9eb3875269733"},"objet_avant":{"path":"articles/gammes-produits/r1/filtre-a-huile-2.webp","size":1880806,"md5":"8b22b05554133f412ce3691c05bcafdb","mimetype":"image/png","cache_control":"max-age=3600"},"maj_avant":"2026-03-25T01:51:24.179+00:00"},
{"tbl":"r1","rip_id":33,"slot":"PRICE","section":null,"avant":{"path":"articles/gammes-produits/r1/filtre-a-huile-3.webp","alt":"Filtre à huile — comparatif qualité par gamme","caption":"Différences de qualité filtre à huile","status":"approved","selected":true},"apres":{"path":"articles/gammes-produits/r1/filtre-a-huile-3-v20261031.webp","alt":"Schéma des caractéristiques de qualité d'un filtre à huile : clapet anti-retour, papier filtrant, clapet de dérivation","caption":"Un filtre ne fonctionne correctement que s'il a été bien monté.","status":"approved","selected":true},"objet":{"path":"articles/gammes-produits/r1/filtre-a-huile-3-v20261031.webp","size":37152,"md5":"0df31d1f3e6e96d87f474b23d667036d"},"objet_avant":{"path":"articles/gammes-produits/r1/filtre-a-huile-3.webp","size":2255662,"md5":"c9ed766385e7b871359414c9aaedbd1f","mimetype":"image/png","cache_control":"max-age=3600"},"maj_avant":"2026-03-25T01:51:24.179+00:00"},
{"tbl":"r1","rip_id":34,"slot":"LOCATION","section":null,"avant":{"path":"articles/gammes-produits/r1/filtre-a-huile-4.webp","alt":"Emplacement du filtre à huile sur le véhicule","caption":"Où se trouve le filtre à huile sur le véhicule","status":"approved","selected":true},"apres":{"path":"articles/gammes-produits/r1/filtre-a-huile-4.webp","alt":"Emplacement du filtre à huile sur le véhicule","caption":"Où se trouve le filtre à huile sur le véhicule","status":"pending","selected":false},"objet":null,"objet_avant":{"path":"articles/gammes-produits/r1/filtre-a-huile-4.webp","size":2044795,"md5":"268671cd769bf78eff6488a3ef5e4d0e","mimetype":"image/png","cache_control":"max-age=3600"},"maj_avant":"2026-03-25T01:51:24.18+00:00"},
{"tbl":"r3","rip_id":13,"slot":"S2_SYMPTOM_IMAGE","section":"S2","avant":{"path":null,"alt":"Symptomes usure Filtre à huile : usure visible","caption":"Filtre à huile use — usure visible","status":"pending","selected":true},"apres":{"path":"articles/gammes-produits/r3/filtre-a-huile-s2-v20261031.webp","alt":"Schéma : filtre en bon état, puis filtre colmaté dont le clapet de dérivation laisse passer une huile non filtrée","caption":"Schéma de principe. La pression d'ouverture du clapet de dérivation dépend du moteur.","status":"approved","selected":true},"objet":{"path":"articles/gammes-produits/r3/filtre-a-huile-s2-v20261031.webp","size":53278,"md5":"5662a4bd68fd817bdc87450cb2af6e59"},"objet_avant":null,"maj_avant":null},
{"tbl":"r3","rip_id":14,"slot":"S3_SCHEMA_IMAGE","section":"S3","avant":{"path":null,"alt":"Schema comparatif Filtre à huile","caption":"Filtre à huile vs filtre-a-air — schema comparatif","status":"pending","selected":true},"apres":{"path":"articles/gammes-produits/r3/filtre-a-huile-s3-v20261031.webp","alt":"Vue en coupe de principe d'un filtre à huile vissé : joint, plaque de base, clapet anti-retour, média filtrant, tube central, clapet anti-siphon, clapet de dérivation","caption":"Schéma de principe. La présence, le nombre et la position des clapets varient selon le filtre et le moteur.","status":"approved","selected":true},"objet":{"path":"articles/gammes-produits/r3/filtre-a-huile-s3-v20261031.webp","size":57884,"md5":"c0595ede74c043ea47f4cbbe94a4264b"},"objet_avant":null,"maj_avant":null}
]$fhlot$::jsonb;
  v_prefix text;
  v_n      bigint;
  v_txt    text;
  v_prev   text;
  v_agent  uuid;
  r        record;
BEGIN
  PERFORM 1 FROM __seo_r1_image_prompts WHERE rip_pg_id = 7 AND rip_id IN (31, 32, 33, 34) FOR UPDATE;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 4 THEN RAISE EXCEPTION 'ABORT: % ligne(s) __seo_r1_image_prompts verrouillée(s), 4 attendue(s)', v_n; END IF;
  PERFORM 1 FROM __seo_r3_image_prompts WHERE rip_pg_id = 7 AND rip_id IN (13, 14) FOR UPDATE;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 2 THEN RAISE EXCEPTION 'ABORT: % ligne(s) __seo_r3_image_prompts verrouillée(s), 2 attendue(s)', v_n; END IF;

  SELECT substring(rip_image_url from '^(https://[^/]+/storage/v1/object/public/uploads/)') INTO v_prefix
    FROM __seo_r1_image_prompts WHERE rip_pg_id = 7 AND rip_id = 31;
  IF v_prefix IS NULL THEN
    RAISE EXCEPTION 'ABORT: préfixe d''URL illisible sur la ligne R1 rip_id 31';
  END IF;

  SELECT string_agg(tbl || ':' || rip_id || ' ' || classe, ', ' ORDER BY tbl, rip_id) FILTER (WHERE classe = 'DERIVE'),
         count(*) FILTER (WHERE classe = 'APRES')
    INTO v_txt, v_n
    FROM (SELECT p.tbl, p.rip_id,
           CASE WHEN cur.st IS NULL THEN 'DERIVE'
                WHEN cur.st = p.apres THEN 'APRES'
                WHEN cur.st = p.avant THEN 'AVANT'
                ELSE 'DERIVE' END AS classe
      FROM jsonb_to_recordset(v_plan) AS p(tbl text, rip_id integer, slot text, section text, avant jsonb, apres jsonb, objet jsonb, objet_avant jsonb, maj_avant timestamptz)
      LEFT JOIN (SELECT 'r1' AS tbl, i.rip_id, i.rip_slot_id AS slot, NULL::text AS section,
            jsonb_build_object('path', CASE WHEN i.rip_image_url IS NULL THEN NULL
                                            WHEN left(i.rip_image_url, length(v_prefix)) = v_prefix
                                            THEN substr(i.rip_image_url, length(v_prefix) + 1)
                                            ELSE '#hors-prefixe' END,
                               'alt', i.rip_alt_text, 'caption', i.rip_caption,
                               'status', i.rip_status, 'selected', i.rip_selected) AS st
       FROM __seo_r1_image_prompts i WHERE i.rip_pg_id = 7 AND i.rip_id IN (31, 32, 33, 34)
     UNION ALL
     SELECT 'r3' AS tbl, i.rip_id, i.rip_slot_id AS slot, i.rip_section_id AS section,
            jsonb_build_object('path', CASE WHEN i.rip_image_url IS NULL THEN NULL
                                            WHEN left(i.rip_image_url, length(v_prefix)) = v_prefix
                                            THEN substr(i.rip_image_url, length(v_prefix) + 1)
                                            ELSE '#hors-prefixe' END,
                               'alt', i.rip_alt_text, 'caption', i.rip_caption,
                               'status', i.rip_status, 'selected', i.rip_selected) AS st
       FROM __seo_r3_image_prompts i WHERE i.rip_pg_id = 7 AND i.rip_id IN (13, 14)) cur
        ON cur.tbl = p.tbl AND cur.rip_id = p.rip_id AND cur.slot = p.slot AND cur.section IS NOT DISTINCT FROM p.section) cl;
  IF v_txt IS NOT NULL THEN
    RAISE EXCEPTION 'ABORT: ligne(s) image modifiée(s) depuis l''écriture du lot : %', v_txt;
  END IF;

  -- Objets contrôlés avant la sortie du rejeu : « sans effet » n'est annoncé
  -- que si les objets que l'état présent sert sont là.
  SELECT string_agg(etat, ', ' ORDER BY etat COLLATE "C") INTO v_txt FROM (
    SELECT o.path || ' ' || CASE WHEN count(s.id) = 0 THEN 'absent'
                                  WHEN count(s.id) > 1 THEN 'multiple'
                                  ELSE 'non conforme' END AS etat
      FROM jsonb_to_recordset(v_plan) AS p(tbl text, rip_id integer, slot text, section text, avant jsonb, apres jsonb, objet jsonb, objet_avant jsonb, maj_avant timestamptz)
     CROSS JOIN LATERAL jsonb_to_record(p.objet_avant) AS o(path text, size bigint, md5 text, mimetype text, cache_control text)
      LEFT JOIN storage.objects s
        ON s.bucket_id = 'uploads' AND s.name = o.path AND NOT coalesce(s.is_delete_marker, false)
     WHERE p.objet_avant IS NOT NULL AND p.objet_avant <> 'null'::jsonb
     GROUP BY o.path, o.size, o.md5, o.mimetype, o.cache_control
    HAVING count(s.id) <> 1
        OR NOT bool_and(s.metadata->>'size' = o.size::text
                        AND s.metadata->>'mimetype' = o.mimetype
                        AND trim(both '"' from s.metadata->>'eTag') = o.md5
                        AND s.metadata->>'cacheControl' = o.cache_control)
  ) b;
  IF v_txt IS NOT NULL THEN RAISE EXCEPTION 'ABORT: ancien(s) objet(s) R1 absent(s) ou modifié(s) : %', v_txt; END IF;

  IF v_n = 0 THEN
    RAISE NOTICE 'retour 20261031_editorial_filtre_huile_pg7_images : aucune ligne écrite par le lot, sans effet';
    RETURN;
  END IF;

  v_prev := current_setting('request.headers', true);
  SELECT agent_id INTO STRICT v_agent FROM agent_write_scopes WHERE agent_name = 'SEO-Content';
  PERFORM set_config('request.headers', json_build_object('x-agent-id', v_agent)::text, true); -- identité-agent
  IF resolve_agent_write_scope() IS DISTINCT FROM 'seo_content_tables' THEN
    RAISE EXCEPTION 'ABORT: identité SEO-Content non résolue par resolve_agent_write_scope (scope %)', coalesce(resolve_agent_write_scope(), 'NULL');
  END IF;

  FOR r IN
    SELECT p.*
      FROM jsonb_to_recordset(v_plan) AS p(tbl text, rip_id integer, slot text, section text, avant jsonb, apres jsonb, objet jsonb, objet_avant jsonb, maj_avant timestamptz)
      JOIN (SELECT p.tbl, p.rip_id,
           CASE WHEN cur.st IS NULL THEN 'DERIVE'
                WHEN cur.st = p.apres THEN 'APRES'
                WHEN cur.st = p.avant THEN 'AVANT'
                ELSE 'DERIVE' END AS classe
      FROM jsonb_to_recordset(v_plan) AS p(tbl text, rip_id integer, slot text, section text, avant jsonb, apres jsonb, objet jsonb, objet_avant jsonb, maj_avant timestamptz)
      LEFT JOIN (SELECT 'r1' AS tbl, i.rip_id, i.rip_slot_id AS slot, NULL::text AS section,
            jsonb_build_object('path', CASE WHEN i.rip_image_url IS NULL THEN NULL
                                            WHEN left(i.rip_image_url, length(v_prefix)) = v_prefix
                                            THEN substr(i.rip_image_url, length(v_prefix) + 1)
                                            ELSE '#hors-prefixe' END,
                               'alt', i.rip_alt_text, 'caption', i.rip_caption,
                               'status', i.rip_status, 'selected', i.rip_selected) AS st
       FROM __seo_r1_image_prompts i WHERE i.rip_pg_id = 7 AND i.rip_id IN (31, 32, 33, 34)
     UNION ALL
     SELECT 'r3' AS tbl, i.rip_id, i.rip_slot_id AS slot, i.rip_section_id AS section,
            jsonb_build_object('path', CASE WHEN i.rip_image_url IS NULL THEN NULL
                                            WHEN left(i.rip_image_url, length(v_prefix)) = v_prefix
                                            THEN substr(i.rip_image_url, length(v_prefix) + 1)
                                            ELSE '#hors-prefixe' END,
                               'alt', i.rip_alt_text, 'caption', i.rip_caption,
                               'status', i.rip_status, 'selected', i.rip_selected) AS st
       FROM __seo_r3_image_prompts i WHERE i.rip_pg_id = 7 AND i.rip_id IN (13, 14)) cur
        ON cur.tbl = p.tbl AND cur.rip_id = p.rip_id AND cur.slot = p.slot AND cur.section IS NOT DISTINCT FROM p.section) cl ON cl.tbl = p.tbl AND cl.rip_id = p.rip_id
     WHERE cl.classe = 'APRES'
  LOOP
    IF r.tbl = 'r1' THEN
      UPDATE __seo_r1_image_prompts
         SET rip_image_url = CASE WHEN r.avant->>'path' IS NULL THEN NULL ELSE v_prefix || (r.avant->>'path') END,
               rip_alt_text = r.avant->>'alt', rip_caption = r.avant->>'caption',
               rip_status = r.avant->>'status', rip_selected = (r.avant->>'selected')::boolean,
               rip_updated_at = r.maj_avant
       WHERE rip_id = r.rip_id AND rip_pg_id = 7 AND rip_slot_id = r.slot;
    ELSE
      UPDATE __seo_r3_image_prompts
         SET rip_image_url = CASE WHEN r.avant->>'path' IS NULL THEN NULL ELSE v_prefix || (r.avant->>'path') END,
               rip_alt_text = r.avant->>'alt', rip_caption = r.avant->>'caption',
               rip_status = r.avant->>'status', rip_selected = (r.avant->>'selected')::boolean
       WHERE rip_id = r.rip_id AND rip_pg_id = 7 AND rip_slot_id = r.slot AND rip_section_id = r.section;
    END IF;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n <> 1 THEN RAISE EXCEPTION 'ABORT: % ligne(s) écrite(s) pour %:%, 1 attendue', v_n, r.tbl, r.rip_id; END IF;
  END LOOP;

  PERFORM set_config('request.headers', coalesce(v_prev, ''), true);

  PERFORM invalidate_r1_caches(7, 'editorial_filtre_huile_pg7:images:rollback', 'gpc');
  IF EXISTS (SELECT 1 FROM __gamme_page_cache WHERE pg_id = 7 AND NOT stale) THEN
    RAISE EXCEPTION 'ABORT: cache de pg 7 encore frais après invalidation';
  END IF;

  SELECT string_agg(tbl || ':' || rip_id || ' ' || classe, ', ' ORDER BY tbl, rip_id) INTO v_txt
    FROM (SELECT p.tbl, p.rip_id,
           CASE WHEN cur.st IS NULL THEN 'DERIVE'
                WHEN cur.st = p.apres THEN 'APRES'
                WHEN cur.st = p.avant THEN 'AVANT'
                ELSE 'DERIVE' END AS classe
      FROM jsonb_to_recordset(v_plan) AS p(tbl text, rip_id integer, slot text, section text, avant jsonb, apres jsonb, objet jsonb, objet_avant jsonb, maj_avant timestamptz)
      LEFT JOIN (SELECT 'r1' AS tbl, i.rip_id, i.rip_slot_id AS slot, NULL::text AS section,
            jsonb_build_object('path', CASE WHEN i.rip_image_url IS NULL THEN NULL
                                            WHEN left(i.rip_image_url, length(v_prefix)) = v_prefix
                                            THEN substr(i.rip_image_url, length(v_prefix) + 1)
                                            ELSE '#hors-prefixe' END,
                               'alt', i.rip_alt_text, 'caption', i.rip_caption,
                               'status', i.rip_status, 'selected', i.rip_selected) AS st
       FROM __seo_r1_image_prompts i WHERE i.rip_pg_id = 7 AND i.rip_id IN (31, 32, 33, 34)
     UNION ALL
     SELECT 'r3' AS tbl, i.rip_id, i.rip_slot_id AS slot, i.rip_section_id AS section,
            jsonb_build_object('path', CASE WHEN i.rip_image_url IS NULL THEN NULL
                                            WHEN left(i.rip_image_url, length(v_prefix)) = v_prefix
                                            THEN substr(i.rip_image_url, length(v_prefix) + 1)
                                            ELSE '#hors-prefixe' END,
                               'alt', i.rip_alt_text, 'caption', i.rip_caption,
                               'status', i.rip_status, 'selected', i.rip_selected) AS st
       FROM __seo_r3_image_prompts i WHERE i.rip_pg_id = 7 AND i.rip_id IN (13, 14)) cur
        ON cur.tbl = p.tbl AND cur.rip_id = p.rip_id AND cur.slot = p.slot AND cur.section IS NOT DISTINCT FROM p.section) cl
   WHERE classe <> 'AVANT';
  IF v_txt IS NOT NULL THEN RAISE EXCEPTION 'ABORT: relecture : %', v_txt; END IF;
  RAISE NOTICE 'retour 20261031_editorial_filtre_huile_pg7_images : 6 ligne(s) remises et relues';
END
$ecriture$;

COMMIT;
