-- @non_transactional
--   DROP INDEX CONCURRENTLY est interdit DANS une transaction : le marqueur ci-dessus
--   fait exécuter ce fichier en autocommit par l'engine, une instruction à la fois
--   (gate A5 `--lint-markers`). La première instruction qui lève arrête le fichier et
--   marque la migration `failed` : le bloc de pré-conditions, placé avant tout DROP,
--   est donc réellement bloquant.
--
-- Migration: retirer 26 index jamais lus sur `pieces_price`
--
-- Suite de `20260930_drop_pieces_price_duplicate_indexes` (PR #1623), qui laissait ces
-- index hors lot. `pieces_price` est en zone STOP prix : ce fichier ne s'applique
-- qu'après un GO nominatif de l'owner portant sur CETTE liste de 26 index. Il ne touche
-- ni une ligne ni une colonne de la table, seulement des index secondaires non uniques.
--
-- Source : lot B de l'audit d'hygiène de la base du 2026-09-15. Ce document n'est pas
-- versionné : la preuve utile est recopiée ci-dessous, et le fichier se suffit à lui-même.
--
-- PREUVE — deux vies de l'instance, sans aucune lecture de ces index :
--   1. preuve scellée du 2026-09-15 07:42Z (PG 17.4, `stats_reset` 2025-06-06) :
--      0 parcours et 0 tuple lu sur les 26, OID 29157 à 29196, soit plus de 15 mois ;
--   2. instance re-provisionnée (PG 17.6, `pg_postmaster_start_time()` 2026-09-17
--      01:14Z, `stats_reset` nul) : `idx_scan = 0` sur les 26, relevé le 2026-09-30
--      à 22:57Z, soit près de 14 jours de trafic réel. Mêmes OID : ce sont les mêmes
--      objets.
--   Chacun est un btree monocolonne non unique, valide, sans prédicat ni expression,
--   ne porte aucune contrainte, n'a aucun objet dépendant (`pg_depend`), n'est ni
--   identité de réplication ni CLUSTER.
--
-- POURQUOI AUCUNE REQUÊTE NE LES UTILISE :
--   * 21 index legacy (`pri_code_fam_nu` … `pri_xls`, liste ci-dessous) : aucune des 21
--     fonctions SQL qui lisent la table ne cite ces colonnes (relevé `pg_proc.prosrc` du
--     2026-10-01 ; 0 vue, 0 vue matérialisée sur la table). Dans le code applicatif,
--     `pri_qte_vente` et `pri_consigne_ht` n'apparaissent que dans des listes `select`
--     (projection de colonnes, sans index) ; les filtres et tris portent sur `pri_ref`,
--     `pri_des`, `pri_dispo`, `pri_vente_ttc_n`, `pri_piece_id_i`, `pri_active` ;
--   * `pri_date_to` : colonne entièrement NULL (`pg_stats.null_frac = 1`), citée nulle
--     part ;
--   * `pri_achat_ht`, `pri_gros_ht`, `pri_remise`, `pri_vente_ht` : colonnes TEXT
--     écrites en miroir des colonnes numériques `_n` par `pricing_commit_chunk`
--     (`UPDATE … SET` et `INSERT`) et `pricing_rollback_batch` (`UPDATE … SET`). Aucune
--     fonction ni aucun code ne les filtre ni ne les trie : les prédicats portent sur les
--     `_n` ou sur `pri_piece_id_i`. Un index ne sert pas à écrire une colonne ; il ne fait
--     que ralentir chaque écriture de ces deux fonctions.
--
-- PREUVE PAR MASQUAGE (hypopg `hypopg_hide_index`, session de mesure seule, EXPLAIN sans
-- ANALYZE, 2026-09-30 22:47Z-22:48Z) : 15 formes de requête relevées dans le code et les
-- fonctions (recherche, stock, pricing, fiche pièce, flux Merchant Center, aperçu prix de
-- gamme, pièces par type et gamme, command center) donnent des plans IDENTIQUES avec et
-- sans ces 26 index. Aucune, tous index visibles, n'en choisit un. Les chemins servis
-- passent par `idx_pieces_price_piece_id_int_expr` (9,5 M parcours),
-- `idx_pieces_price_piece_id_int_full`, `idx_pieces_price_piece_id_i` et
-- `idx_pprice_piece_id`, que ce lot ne touche pas.
--
-- HORS LOT, VOLONTAIREMENT :
--   * `idx_pieces_price_pri_type` : prédicat réellement exécuté mais jamais choisi par le
--     planificateur ; preuve seulement inférentielle en zone STOP. Différé à T+30 jours
--     de compteurs post-upgrade (2026-10-17) ;
--   * `idx_pieces_price_pri_qte_cond` : seul lecteur = `getReorderList`
--     (`stock.service.ts`), mort si le mode de stock de PROD est UNLIMITED. Conditionnel
--     à la lecture de ce mode dans le journal de démarrage PROD ;
--   * les 14 autres index `idx_pieces_price_pri_*` à 0 parcours : l'audit ne les a pas
--     retenus au lot B. Certaines de leurs colonnes sont filtrées par du code
--     (`pri_ref`, `pri_dispo`, `pri_marge`…), et le planificateur choisit
--     `idx_pieces_price_pri_ref` et `idx_pieces_price_pri_dispo` dans les plans relevés.
--     Les retirer demanderait leur propre preuve ;
--   * `idx_pprice_pm_id` : jumeau conservé par #1623, choisi par le planificateur.
--
-- GAIN : 218 Mo de disque (228 220 928 octets), 48 → 22 index sur la table. Aucun gain
-- d'écriture mesurable aujourd'hui : 0 insertion, mise à jour ou suppression sur la
-- table depuis le 2026-09-17. À l'import tarif suivant, 26 index de moins à maintenir à
-- chaque ligne écrite.
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
-- (`sql_drop`), qui recharge le cache de schéma de PostgREST — 26 rechargements, sans
-- changement de l'API exposée (un index n'y figure pas).
--
-- Retour arrière : `20261001_drop_pieces_price_unused_indexes.down.sql` recrée les 26
-- index à l'identique (CONCURRENTLY). L'engine est forward-only : ce fichier se lance à
-- la main.
SET lock_timeout = 0;
SET statement_timeout = 0;

-- -----------------------------------------------------------------------------
-- §0 — PRÉ-CONDITIONS FAIL-CLOSED (lecture de catalogue uniquement)
-- -----------------------------------------------------------------------------
-- Pour chaque index encore présent : définition exacte attendue, sur public.pieces_price,
-- non unique, sans contrainte ni objet dépendant, ni identité de réplication ni CLUSTER,
-- et TOUJOURS jamais parcouru depuis le démarrage de l'instance. Un seul parcours
-- enregistré entre la mesure et l'application = ABORT : l'index a trouvé un lecteur, la
-- preuve est à refaire. Attention, un EXPLAIN sans ANALYZE avec un prédicat d'intervalle
-- peut à lui seul incrémenter `idx_scan` : ne pas sonder la table avant l'APPLY.
DO $precheck$
DECLARE
  v_col   text;
  v_name  text;
  v_oid   oid;
  v_scan  bigint;
BEGIN
  IF to_regclass('public.pieces_price') IS NULL THEN
    RAISE EXCEPTION 'ABORT: table public.pieces_price introuvable';
  END IF;

  FOREACH v_col IN ARRAY ARRAY[
    'code_fam_nu', 'code_metier', 'code_sfam_nu', 'consigne_ht', 'frais_port_ht',
    'frais_supp_ht', 'frs_2', 'frs_3', 'frs_4', 'hauteur', 'insert_type', 'largeur',
    'longueur', 'qte_vente', 'ref_comp', 'remise_2', 'remise_3', 'remise_4', 'tva',
    'udm_dimentions', 'xls',
    'date_to',
    'achat_ht', 'gros_ht', 'remise', 'vente_ht'
  ] LOOP
    v_name := 'idx_pieces_price_pri_' || v_col;
    v_oid  := to_regclass('public.' || v_name);
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
             format('CREATE INDEX %I ON public.pieces_price USING btree (%I)',
                    v_name, 'pri_' || v_col)
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

    SELECT s.idx_scan INTO v_scan
      FROM pg_stat_user_indexes s
     WHERE s.indexrelid = v_oid;
    IF v_scan IS NULL OR v_scan <> 0 THEN
      RAISE EXCEPTION 'ABORT: public.% a été parcouru % fois depuis la mesure (0 attendu) — preuve à refaire', v_name, v_scan;
    END IF;
  END LOOP;
END
$precheck$;

-- -----------------------------------------------------------------------------
-- §1 — RETRAIT, un DROP par instruction (autocommit)
-- -----------------------------------------------------------------------------
-- 21 index legacy
DROP INDEX CONCURRENTLY IF EXISTS public.idx_pieces_price_pri_code_fam_nu;

DROP INDEX CONCURRENTLY IF EXISTS public.idx_pieces_price_pri_code_metier;

DROP INDEX CONCURRENTLY IF EXISTS public.idx_pieces_price_pri_code_sfam_nu;

DROP INDEX CONCURRENTLY IF EXISTS public.idx_pieces_price_pri_consigne_ht;

DROP INDEX CONCURRENTLY IF EXISTS public.idx_pieces_price_pri_frais_port_ht;

DROP INDEX CONCURRENTLY IF EXISTS public.idx_pieces_price_pri_frais_supp_ht;

DROP INDEX CONCURRENTLY IF EXISTS public.idx_pieces_price_pri_frs_2;

DROP INDEX CONCURRENTLY IF EXISTS public.idx_pieces_price_pri_frs_3;

DROP INDEX CONCURRENTLY IF EXISTS public.idx_pieces_price_pri_frs_4;

DROP INDEX CONCURRENTLY IF EXISTS public.idx_pieces_price_pri_hauteur;

DROP INDEX CONCURRENTLY IF EXISTS public.idx_pieces_price_pri_insert_type;

DROP INDEX CONCURRENTLY IF EXISTS public.idx_pieces_price_pri_largeur;

DROP INDEX CONCURRENTLY IF EXISTS public.idx_pieces_price_pri_longueur;

DROP INDEX CONCURRENTLY IF EXISTS public.idx_pieces_price_pri_qte_vente;

DROP INDEX CONCURRENTLY IF EXISTS public.idx_pieces_price_pri_ref_comp;

DROP INDEX CONCURRENTLY IF EXISTS public.idx_pieces_price_pri_remise_2;

DROP INDEX CONCURRENTLY IF EXISTS public.idx_pieces_price_pri_remise_3;

DROP INDEX CONCURRENTLY IF EXISTS public.idx_pieces_price_pri_remise_4;

DROP INDEX CONCURRENTLY IF EXISTS public.idx_pieces_price_pri_tva;

DROP INDEX CONCURRENTLY IF EXISTS public.idx_pieces_price_pri_udm_dimentions;

DROP INDEX CONCURRENTLY IF EXISTS public.idx_pieces_price_pri_xls;

-- colonne entièrement NULL
DROP INDEX CONCURRENTLY IF EXISTS public.idx_pieces_price_pri_date_to;

-- colonnes TEXT miroirs des `_n`
DROP INDEX CONCURRENTLY IF EXISTS public.idx_pieces_price_pri_achat_ht;

DROP INDEX CONCURRENTLY IF EXISTS public.idx_pieces_price_pri_gros_ht;

DROP INDEX CONCURRENTLY IF EXISTS public.idx_pieces_price_pri_remise;

DROP INDEX CONCURRENTLY IF EXISTS public.idx_pieces_price_pri_vente_ht;

-- -----------------------------------------------------------------------------
-- §2 — POST-CONDITIONS FAIL-CLOSED
-- -----------------------------------------------------------------------------
-- Les 26 index ont disparu ; les index qui servent la table (ceux que les plans
-- relevés choisissent, et la clé primaire) sont toujours là, valides et prêts.
DO $postcheck$
DECLARE
  v_name text;
BEGIN
  FOREACH v_name IN ARRAY ARRAY[
    'code_fam_nu', 'code_metier', 'code_sfam_nu', 'consigne_ht', 'frais_port_ht',
    'frais_supp_ht', 'frs_2', 'frs_3', 'frs_4', 'hauteur', 'insert_type', 'largeur',
    'longueur', 'qte_vente', 'ref_comp', 'remise_2', 'remise_3', 'remise_4', 'tva',
    'udm_dimentions', 'xls',
    'date_to',
    'achat_ht', 'gros_ht', 'remise', 'vente_ht'
  ] LOOP
    IF to_regclass('public.idx_pieces_price_pri_' || v_name) IS NOT NULL THEN
      RAISE EXCEPTION 'postcheck: public.idx_pieces_price_pri_% toujours présent', v_name;
    END IF;
  END LOOP;

  FOREACH v_name IN ARRAY ARRAY[
    'pieces_price_pkey',
    'idx_pieces_price_piece_id_int_expr',
    'idx_pieces_price_piece_id_int_full',
    'idx_pieces_price_piece_id_i',
    'idx_pprice_piece_id',
    'idx_pprice_pm_id',
    'idx_pieces_price_pri_ref',
    'idx_pieces_price_pri_dispo'
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
--   SELECT count(*) FROM pg_index WHERE indrelid = 'public.pieces_price'::regclass;  -- 22
--   SELECT pg_size_pretty(pg_indexes_size('public.pieces_price'));                   -- ≈ 273 MB
--   SELECT count(*) FROM pg_class
--    WHERE relnamespace = 'public'::regnamespace
--      AND relname LIKE 'idx\_pieces\_price\_pri\_%' ESCAPE '\';                        -- 16
--   Advisor performance `unused_index` : 26 entrées pieces_price de moins.
-- =============================================================================
