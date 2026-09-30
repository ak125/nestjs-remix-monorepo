-- @non_transactional
-- squawk-ignore-file ban-concurrent-index-creation-in-transaction
--   CREATE / DROP INDEX CONCURRENTLY sont interdits DANS une transaction : le marqueur
--   ci-dessus fait exécuter ce fichier en autocommit par l'engine, une instruction à la
--   fois (gate A5 `--lint-markers`). Sans l'exemption, squawk 2.52.1 lève sur les deux
--   CREATE : « this is not allowed when the `CONCURRENTLY` option is used » — parce que
--   `.squawk.toml` pose `assume_in_transaction = true`. Le défaut décrit ne peut pas se
--   produire ici : le marqueur, réconcilié par `--lint-markers`, garantit l'autocommit.
--   Même couple marqueur + exemption que 20260907_xtr_msg_crm_indexes_align_to_leads_query.
--
-- Migration: index sur l'expression `type_id::integer` de auto_type_motor_code et de
-- auto_type_number_code, lue par `rm_get_page_complete_v2`
--
-- CONSTAT (mesuré en lecture seule le 2026-09-30 vers 15:10Z) :
--   `rm_get_page_complete_v2` est la RPC de la page pièces (R2) : 448 186 appels
--   depuis le démarrage de l'instance re-provisionnée (2026-09-17 01:14Z), 158,7 ms en
--   moyenne (pg_stat_statements). Elle lit les codes moteur et les codes mine/CNIT du
--   véhicule par :
--     FROM auto_type_motor_code  WHERE tmc_type_id::INTEGER = p_vehicle_id::INTEGER
--     FROM auto_type_number_code WHERE tnc_type_id::INTEGER = p_vehicle_id::INTEGER
--   Les colonnes sont en `text`. Les index existants (`idx_auto_type_motor_code_tmc_type_id`,
--   `idx_atnc_type_id`, les deux clés primaires) indexent le texte : aucun ne peut servir
--   un prédicat sur le texte converti en entier. Chaque appel parcourt donc les deux
--   tables en entier :
--     table                    lignes    seq_scan   tuples lus (seq)   heap
--     auto_type_motor_code      63 091   425 656     26,9 milliards    2 840 kB
--     auto_type_number_code    165 027   425 663     70,2 milliards    9 784 kB
--   EXPLAIN ANALYZE, cache chaud, véhicule 33300 : 6,2 ms (Seq Scan, 350 pages) +
--   18,7 ms (Parallel Seq Scan, 1 256 pages) ≈ 25 ms par appel, pour 1 et 2 lignes utiles.
--
-- CORRECTIF : un index sur l'expression EXACTE du prédicat, `(col::integer)`. Preuve
--   hypopg (index hypothétiques, même session, puis `hypopg_reset()`) : le planificateur
--   les choisit en plan générique (`plan_cache_mode = force_generic_plan`, le plan que
--   PL/pgSQL finit par réutiliser) comme en plan personnalisé — Bitmap Index Scan, coût
--   estimé 237 contre un parcours complet.
--   Additif et réversible : ni le corps de la RPC, ni le type des colonnes, ni l'API ne
--   changent. Les deux alternatives ont été écartées :
--   - réécrire le prédicat en égalité de texte modifie le corps de la RPC la plus
--     appelée du site, et une égalité de texte ne verrait plus un identifiant écrit
--     autrement (zéros en tête, espaces) que la conversion accepte aujourd'hui ;
--   - passer les colonnes en `integer` réécrit les tables et casse les lecteurs qui
--     comparent du texte (`build_vehicle_page_payload` : `tmc_type_id = p_type_id::TEXT`,
--     services supabase-js du module vehicles).
--
-- EFFET DE BORD, assumé : l'index évalue `col::integer` à chaque écriture. Un INSERT ou
--   UPDATE portant un identifiant non entier échouera (22P02). Mesuré : 0 valeur non
--   entière (1 à 5 chiffres, max 83 456), 0 NULL, 0 écriture depuis le 2026-09-17
--   (n_tup_ins/upd/del = 0) ; le seul écrivain du dépôt, `scripts/fix-vehicles-massdoc.py`
--   (remap ponctuel TecDoc), écrit des identifiants entiers. Surtout, une telle ligne
--   casse DÉJÀ la page aujourd'hui : le Seq Scan évalue la conversion sur CHAQUE ligne,
--   donc une seule valeur non entière ferait échouer tous les appels de la RPC. L'index
--   déplace l'échec de chaque lecture vers l'écriture fautive.
--
-- COÛT : quelques Mo d'index, construits en quelques secondes (tables de 2,8 et 9,8 Mo).
--   Aucune écriture à ralentir (0 depuis le 2026-09-17).
--
-- ANALYZE : les statistiques d'un index sur expression ne sont collectées que par un
--   ANALYZE de sa table. L'autoanalyze ne le fera jamais ici : il se déclenche sur des
--   modifications, et ces tables n'en reçoivent aucune. Sans statistique, le planificateur
--   estime 0,5 % des lignes (315 et 825, mesuré par hypopg) au lieu de 1 à 2.
--
-- HORS PÉRIMÈTRE : `get_pieces_for_type_gamme_v2/v3/v4` filtrent sur
--   `NULLIF(tmc_type_id, '')::INTEGER`, une autre expression que ces index ne servent pas.
--   `build_vehicle_page_payload` compare du texte et reste servie par les index existants.
--   Le doublon `auto_type_motor_code_uniq` / `auto_type_motor_code_pkey` n'est pas traité
--   ici (retirer l'un des deux déplace les plans : décision séparée).
--
-- Timeouts EXPLICITES à 0 : un GUC omis hérite des 60 s du rôle `postgres` (incident
-- 20260529, PR #1395). DROP CONCURRENTLY avant chaque CREATE : un build interrompu laisse
-- un index INVALIDE que `CREATE … IF NOT EXISTS` sauterait en silence (leçon 20260529).
-- Le postcheck final échoue si l'un des deux index n'est pas valide : la migration n'est
-- marquée « applied » que si les deux index servent réellement.
--
-- Retour arrière : `20260930_auto_type_codes_type_id_int_expr_indexes.down.sql`
-- (DROP INDEX CONCURRENTLY des deux index), à lancer à la main (engine forward-only).
--
-- Vérification après application (lecture seule) :
--   EXPLAIN SELECT tmc_code FROM public.auto_type_motor_code WHERE tmc_type_id::integer = 33300;
--   EXPLAIN SELECT tnc_code FROM public.auto_type_number_code WHERE tnc_type_id::integer = 33300;
--     -- attendu : Index Scan / Bitmap Index Scan sur les deux nouveaux index
--   SELECT relname, seq_scan, idx_scan FROM pg_stat_user_tables
--   WHERE relname IN ('auto_type_motor_code', 'auto_type_number_code');
--     -- attendu : seq_scan cesse de croître au rythme des appels de la RPC
SET lock_timeout = 0;
SET statement_timeout = 0;

-- INDEX: idx_auto_type_motor_code_tmc_type_id_int_expr
-- Table: public.auto_type_motor_code (63 091 rows, 2 840 kB)
-- Pattern: WHERE tmc_type_id::INTEGER = p_vehicle_id::INTEGER (codes moteur du véhicule)
-- Gain attendu: Seq Scan complet (≈ 6 ms, 350 pages) remplacé par un Index Scan sur 1 à 2 lignes
-- RPC concernees: rm_get_page_complete_v2 (448 186 appels depuis le 2026-09-17)
DROP INDEX CONCURRENTLY IF EXISTS public.idx_auto_type_motor_code_tmc_type_id_int_expr;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_auto_type_motor_code_tmc_type_id_int_expr
  ON public.auto_type_motor_code ((tmc_type_id::integer));

-- INDEX: idx_auto_type_number_code_tnc_type_id_int_expr
-- Table: public.auto_type_number_code (165 027 rows, 9 784 kB)
-- Pattern: WHERE tnc_type_id::INTEGER = p_vehicle_id::INTEGER (codes mine et CNIT du véhicule)
-- Gain attendu: Parallel Seq Scan complet (≈ 19 ms, 1 256 pages) remplacé par un Index Scan sur 1 à 2 lignes
-- RPC concernees: rm_get_page_complete_v2 (448 186 appels depuis le 2026-09-17)
DROP INDEX CONCURRENTLY IF EXISTS public.idx_auto_type_number_code_tnc_type_id_int_expr;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_auto_type_number_code_tnc_type_id_int_expr
  ON public.auto_type_number_code ((tnc_type_id::integer));

COMMENT ON INDEX public.idx_auto_type_motor_code_tmc_type_id_int_expr IS
  'Sert le prédicat tmc_type_id::INTEGER = p_vehicle_id::INTEGER de rm_get_page_complete_v2 (page pièces R2). Sans lui : Seq Scan complet à chaque appel (mesuré 2026-09-30).';

COMMENT ON INDEX public.idx_auto_type_number_code_tnc_type_id_int_expr IS
  'Sert le prédicat tnc_type_id::INTEGER = p_vehicle_id::INTEGER de rm_get_page_complete_v2 (page pièces R2). Sans lui : Parallel Seq Scan complet à chaque appel (mesuré 2026-09-30).';

ANALYZE public.auto_type_motor_code;

ANALYZE public.auto_type_number_code;

DO $postcheck$
DECLARE
  v_name text;
BEGIN
  FOREACH v_name IN ARRAY ARRAY[
    'idx_auto_type_motor_code_tmc_type_id_int_expr',
    'idx_auto_type_number_code_tnc_type_id_int_expr'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_index i
      JOIN pg_class c ON c.oid = i.indexrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = v_name
        AND i.indisvalid
        AND i.indisready
    ) THEN
      RAISE EXCEPTION 'postcheck: index public.% absent ou invalide après construction', v_name;
    END IF;
  END LOOP;
END;
$postcheck$;
