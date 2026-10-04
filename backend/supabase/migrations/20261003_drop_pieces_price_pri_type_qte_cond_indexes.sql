-- @non_transactional
--   DROP INDEX CONCURRENTLY est interdit DANS une transaction : le marqueur ci-dessus
--   fait exécuter ce fichier en autocommit par l'engine, une instruction à la fois
--   (gate A5 `--lint-markers`). La première instruction qui lève arrête le fichier et
--   marque la migration `failed` : le bloc de pré-conditions, placé avant tout DROP,
--   est donc réellement bloquant.
--
-- Migration: retirer `idx_pieces_price_pri_type` et `idx_pieces_price_pri_qte_cond`
--
-- Suite de `20261001_drop_pieces_price_unused_indexes` (PR #1649), qui laissait ces deux
-- index HORS LOT : le premier jusqu'à 30 jours de compteurs post-upgrade, le second
-- jusqu'à la preuve que son seul lecteur ne le choisit pas. `pieces_price` est en zone
-- STOP prix : ce fichier ne s'applique qu'après un GO nominatif de l'owner portant sur
-- CES deux index. Il ne touche ni une ligne ni une colonne de la table, seulement deux
-- index secondaires non uniques.
--
-- NE PAS FUSIONNER NI APPLIQUER AVANT LE 2026-10-17 (instance démarrée le 2026-09-17
-- 01:14Z) : la pré-condition §0.1 l'interdit d'elle-même tant que les compteurs couvrent
-- moins de 30 jours. Appliquée trop tôt, la migration s'arrête AVANT tout DROP, mais sa
-- ligne `failed` bloque ensuite TOUS les runs de l'engine jusqu'à `--retry` : fusionnée
-- avant cette date, elle serait tentée par le premier apply sans `only_ids`.
--
-- PREUVE — `idx_pieces_price_pri_type` (btree (pri_type), 8 962 048 octets) :
--   1. instance précédente (PG 17.4, `stats_reset` 2025-06-06), preuve scellée du
--      2026-09-15 07:42Z : 0 parcours, 0 tuple lu, soit plus de 15 mois ;
--   2. instance re-provisionnée (PG 17.6, `pg_postmaster_start_time()` 2026-09-17
--      01:14Z, `stats_reset` nul) : `idx_scan = 0`, `last_idx_scan` nul, relevé le
--      2026-10-03 à 07:23Z. Même OID 29160 : c'est le même objet.
--   POURQUOI LE PLANIFICATEUR NE LE CHOISIT PAS : `pri_type` n'a que 2 valeurs
--   (`pg_stats` : '0' 99,3 %, '1' 0,7 %, 476 086 lignes). Chaque prédicat réel sur
--   `pri_type` est accompagné d'un prédicat bien plus sélectif, servi par un autre index :
--     * `PiecePriceDataService` (autorité du tarif) et la recherche
--       (`search-enhanced-existing.service.ts`) : `pri_piece_id_i = ANY(…) AND
--       pri_dispo = '1' ORDER BY pri_type DESC` → `idx_pieces_price_piece_id_i`, tri
--       en mémoire de quelques lignes ;
--     * `get_piece_detail` : `pri_piece_id = … AND pri_type = '0'` → `idx_pprice_piece_id` ;
--     * `pricing_commit_chunk` / `pricing_activate_chunk` : `pri_piece_id_i = … AND
--       pri_pm_id = … AND pri_type = …` → `idx_pieces_price_piece_id_i` ;
--     * `PricingRepository.fetchExistingByBrand` : `pri_pm_id = … AND pri_type = '0'`
--       → `idx_pprice_pm_id` ;
--     * `pricing_cost_bucket_aggregates` : `pri_type = '0'` (99,3 % des lignes) →
--       parcours séquentiel.
--   Aucun code ni aucune fonction ne filtre `pri_type = '1'` seul (relevé du code et de
--   `pg_proc.prosrc`, 2026-10-03).
--
-- PREUVE — `idx_pieces_price_pri_qte_cond` (btree (pri_qte_cond), 8 880 128 octets) :
--   1. instance précédente : 1 parcours, le 2026-09-15 07:23Z = la session d'audit ;
--   2. instance actuelle : 1 parcours, le 2026-10-03 07:12:27.547784Z = la sonde de
--      mesure de cette PR (EXPLAIN sans ANALYZE de `pri_qte_cond <= '20'`, lancé à
--      07:12:26.8Z : sur un prédicat d'intervalle, le planificateur lit l'extrémité de
--      l'index pour estimer la sélectivité, ce qui compte un parcours). Aucune autre
--      lecture depuis le 2026-09-17.
--   Seul lecteur filtrant : `StockService.getReorderList` (`stock.service.ts`,
--   `.lte('pri_qte_cond', '20')`). Il rend la main avant la requête quand STOCK_MODE vaut
--   UNLIMITED (valeur par défaut). En mode TRACKED, la comparaison est TEXTUELLE et
--   couvre ~92 % de la table (estimation 437 580 lignes sur 476 086) : le plan relevé
--   est un parcours séquentiel, avec ou sans l'index. Les autres usages
--   (`StockService.getStock`, `mcp-query.service.ts`) ne font que lire la colonne d'une
--   ligne trouvée par `pri_piece_id_i`.
--
-- PREUVE PAR MASQUAGE (hypopg `hypopg_hide_index` des deux index, session de mesure
-- seule, EXPLAIN sans ANALYZE) : `pri_qte_cond <= '20'` (2026-10-03 07:12Z) et les 6
-- formes ci-dessus, en prédicats d'égalité (07:26Z), donnent des plans IDENTIQUES avec
-- et sans ces deux index. Tous index visibles, aucune ne les choisit. La mesure de
-- 07:26Z n'a fait bouger aucun compteur.
--
-- Chacun est un btree monocolonne non unique, valide, sans prédicat ni expression, ne
-- porte aucune contrainte, n'a aucun objet dépendant (`pg_depend`), n'est ni identité de
-- réplication ni CLUSTER (relevé du 2026-10-03).
--
-- GAIN : 17,0 Mo de disque (17 842 176 octets), 22 → 20 index sur la table, deux index
-- de moins à maintenir à chaque ligne écrite par l'import tarif.
--
-- Timeouts EXPLICITES à 0 : un GUC omis hérite des 60 s du rôle `postgres` (incident
-- 20260529, PR #1395). DROP INDEX CONCURRENTLY ne relit pas la heap, mais il attend la
-- fin des transactions qui voient la table ; ces attentes comptent contre lock_timeout.
-- Il ne bloque ni les lectures ni les écritures. Le job CI borne le run. Appliquer hors
-- d'un import tarif : un import en cours retarderait chaque DROP jusqu'à sa fin.
--
-- REJOUABLE : `IF EXISTS` sur chaque DROP. Un DROP CONCURRENTLY interrompu laisse un
-- index INVALIDE, qu'une seconde exécution retire. Les pré-conditions acceptent donc un
-- index déjà absent ; elles ne contrôlent que ceux qui restent.
--
-- Effet de bord attendu : chaque DROP déclenche l'event trigger `pgrst_drop_watch`
-- (`sql_drop`), qui recharge le cache de schéma de PostgREST — 2 rechargements, sans
-- changement de l'API exposée (un index n'y figure pas).
--
-- Retour arrière : `20261003_drop_pieces_price_pri_type_qte_cond_indexes.down.sql`
-- recrée les deux index à l'identique (CONCURRENTLY). L'engine est forward-only : ce
-- fichier se lance à la main.
SET lock_timeout = 0;
SET statement_timeout = 0;

-- -----------------------------------------------------------------------------
-- §0 — PRÉ-CONDITIONS FAIL-CLOSED (lecture de catalogue uniquement)
-- -----------------------------------------------------------------------------
-- §0.1 Fenêtre de preuve : les compteurs d'usage doivent couvrir au moins 30 jours.
--   Leur origine est le plus récent de deux instants : le démarrage de l'instance et la
--   dernière remise à zéro des statistiques de la base. Un redémarrage propre conserve
--   les compteurs depuis PG 15 ; le compter quand même comme une origine ne peut que
--   retarder l'application, jamais l'avancer.
-- §0.2 Par index encore présent : définition exacte attendue, sur public.pieces_price,
--   non unique, sans contrainte ni objet dépendant, ni identité de réplication ni
--   CLUSTER, et compteur FIGÉ depuis la mesure — `idx_scan` ET `last_idx_scan`
--   identiques aux valeurs relevées. Une seule lecture entre la mesure et l'application
--   = ABORT : l'index a trouvé un lecteur, la preuve est à refaire. Attention : un
--   EXPLAIN, même sans ANALYZE, d'un prédicat d'intervalle sur `pri_type` ou
--   `pri_qte_cond` incrémente `idx_scan` à lui seul. Ne pas sonder ces colonnes avant
--   l'APPLY.
DO $precheck$
DECLARE
  v_origin    timestamptz;
  v_name      text;
  v_col       text;
  v_scan      bigint;
  v_last      timestamptz;
  v_exp_scan  bigint;
  v_exp_last  timestamptz;
  v_oid       oid;
BEGIN
  IF to_regclass('public.pieces_price') IS NULL THEN
    RAISE EXCEPTION 'ABORT: table public.pieces_price introuvable';
  END IF;

  SELECT GREATEST(pg_postmaster_start_time(), COALESCE(d.stats_reset, '-infinity'))
    INTO v_origin
    FROM pg_stat_database d
   WHERE d.datname = current_database();
  IF v_origin IS NULL OR v_origin > now() - interval '30 days' THEN
    RAISE EXCEPTION 'ABORT: les compteurs d''usage ne couvrent que depuis % (30 jours requis, soit jusqu''au %) — ne pas appliquer avant',
      v_origin, v_origin + interval '30 days';
  END IF;

  FOR v_name, v_col, v_exp_scan, v_exp_last IN
    SELECT * FROM (VALUES
      ('idx_pieces_price_pri_type',     'pri_type',     0::bigint, NULL::timestamptz),
      ('idx_pieces_price_pri_qte_cond', 'pri_qte_cond', 1::bigint, '2026-10-03 07:12:27.547784+00'::timestamptz)
    ) AS t(name, col, exp_scan, exp_last)
  LOOP
    v_oid := to_regclass('public.' || v_name);
    CONTINUE WHEN v_oid IS NULL;  -- déjà retiré (rejeu après interruption)

    IF NOT EXISTS (
      SELECT 1
        FROM pg_index i
       WHERE i.indexrelid = v_oid
         AND i.indrelid = 'public.pieces_price'::regclass
         AND NOT i.indisunique
         AND NOT i.indisprimary
         AND NOT i.indisexclusion
         AND NOT i.indisreplident
         AND NOT i.indisclustered
         AND pg_get_indexdef(i.indexrelid) =
             format('CREATE INDEX %I ON public.pieces_price USING btree (%I)', v_name, v_col)
    ) THEN
      RAISE EXCEPTION 'ABORT: public.% ne correspond plus à la définition mesurée (table, unicité, définition, réplication ou CLUSTER)', v_name;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_constraint k WHERE k.conindid = v_oid) THEN
      RAISE EXCEPTION 'ABORT: public.% porte une contrainte', v_name;
    END IF;

    IF EXISTS (
      SELECT 1 FROM pg_depend d
       WHERE d.refclassid = 'pg_class'::regclass
         AND d.refobjid = v_oid
    ) THEN
      RAISE EXCEPTION 'ABORT: un objet dépend de public.%', v_name;
    END IF;

    SELECT s.idx_scan, s.last_idx_scan INTO v_scan, v_last
      FROM pg_stat_user_indexes s
     WHERE s.indexrelid = v_oid;
    IF v_scan IS DISTINCT FROM v_exp_scan OR v_last IS DISTINCT FROM v_exp_last THEN
      RAISE EXCEPTION 'ABORT: public.% a été parcouru depuis la mesure (idx_scan %, dernier %, attendu %, %) — preuve à refaire',
        v_name, v_scan, v_last, v_exp_scan, v_exp_last;
    END IF;
  END LOOP;
END
$precheck$;

-- -----------------------------------------------------------------------------
-- §1 — RETRAIT, un DROP par instruction (autocommit)
-- -----------------------------------------------------------------------------
DROP INDEX CONCURRENTLY IF EXISTS public.idx_pieces_price_pri_type;

DROP INDEX CONCURRENTLY IF EXISTS public.idx_pieces_price_pri_qte_cond;

-- -----------------------------------------------------------------------------
-- §2 — POST-CONDITIONS FAIL-CLOSED
-- -----------------------------------------------------------------------------
-- Les deux index ont disparu ; les index qui servent les formes relevées (et la clé
-- primaire, qui porte (pri_piece_id, pri_type)) sont toujours là, valides et prêts.
DO $postcheck$
DECLARE
  v_name text;
BEGIN
  FOREACH v_name IN ARRAY ARRAY['idx_pieces_price_pri_type', 'idx_pieces_price_pri_qte_cond'] LOOP
    IF to_regclass('public.' || v_name) IS NOT NULL THEN
      RAISE EXCEPTION 'postcheck: public.% toujours présent', v_name;
    END IF;
  END LOOP;

  FOREACH v_name IN ARRAY ARRAY[
    'pieces_price_pkey',
    'idx_pieces_price_piece_id_i',
    'idx_pprice_piece_id',
    'idx_pprice_pm_id'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1
        FROM pg_index i
       WHERE i.indexrelid = to_regclass('public.' || v_name)
         AND i.indrelid = 'public.pieces_price'::regclass
         AND i.indisvalid
         AND i.indisready
    ) THEN
      RAISE EXCEPTION 'postcheck: index conservé public.% absent ou invalide', v_name;
    END IF;
  END LOOP;
END
$postcheck$;

-- =============================================================================
-- Vérification après application (lecture seule, catalogue uniquement)
-- =============================================================================
--   SELECT count(*) FROM pg_index WHERE indrelid = 'public.pieces_price'::regclass;  -- 20
--   SELECT to_regclass('public.idx_pieces_price_pri_type'),
--          to_regclass('public.idx_pieces_price_pri_qte_cond');                       -- NULL, NULL
--   Advisor performance `unused_index` : 2 entrées pieces_price de moins.
-- =============================================================================
