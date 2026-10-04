-- @non_transactional
--   DROP INDEX CONCURRENTLY est interdit DANS une transaction : le marqueur ci-dessus
--   fait exécuter ce fichier en autocommit par l'engine, une instruction à la fois
--   (gate A5 `--lint-markers`). La première instruction qui lève arrête le fichier et
--   marque la migration `failed` : le bloc de pré-conditions, placé avant tout DROP,
--   est donc réellement bloquant.
--
-- Migration: retirer 24 index ordinaires doublés par un index unique identique
-- (lot 2/3 : commerce, client, paiement, sécurité)
--
-- Restes de la conversion MySQL : chaque colonne déjà couverte par la clé primaire (ou
-- une contrainte UNIQUE) a reçu en plus un index ordinaire de MÊME définition. Sur 85
-- paires relevées le 2026-10-03, 74 sont de vrais doublons dans `public`, répartis en
-- 3 lots, un par zone, pour qu'un GO porte sur une zone et une seule :
--   lot 1 `20261003_drop_indexes_shadowed_by_unique_content`  — 37 index, hors STOP ;
--   lot 2 `20261003_drop_indexes_shadowed_by_unique_commerce` — 24 index, zone STOP ;
--   lot 3 `20261003_drop_indexes_shadowed_by_unique_catalog`  — 13 index, zone protégée.
-- Hors lots (11) : 1 index du schéma `auth` (géré par Supabase), 9 de `_archive`
-- (schéma archivé, à décider en bloc) et `idx_metrics_experiment_date`, dont l'ordre
-- de tri (`indoption`) diffère de celui de `crawl_budget_metrics_experiment_id_date_key` :
-- ce n'est pas un doublon.
--
-- ZONE STOP — commande, client, facture, livraison, fournisseur, retours de paiement
-- (`ic_postback`), codes promo, panier abandonné, réinitialisation de mot de passe,
-- configuration d'administration. Ce fichier ne s'applique qu'après un GO
-- NOMINATIF de l'owner portant sur CETTE liste de 24 index. Il ne touche ni une ligne,
-- ni une colonne, ni une fonction, ni une politique RLS : seulement des index
-- secondaires non uniques, chacun doublé par la clé primaire ou la contrainte
-- UNIQUE de même définition, qui reste en place. Aucun code du module `payments/`
-- n'est modifié.
--
-- PREUVE — structurelle. Elle ne repose pas sur l'absence d'usage : aucune fenêtre
-- d'observation ni aucun compteur figé n'est exigé.
--   1. Même définition. Pour chaque paire, `pg_get_indexdef` de l'index retiré et de
--      l'index unique conservé sont identiques au nom et au mot UNIQUE près : même
--      table, mêmes colonnes dans le même ordre, mêmes classes d'opérateurs, collations
--      et ordres de tri, btree, sans prédicat ni expression ni colonne INCLUDE.
--      Relevé le 2026-10-03 à 08:05Z ; la pré-condition §0 le revérifie à l'application.
--   2. Mêmes plans. Deux index de même définition offrent au planificateur les mêmes
--      chemins d'accès. Preuve par masquage (`hypopg_hide_index`, dans la seule session
--      de mesure, 2026-10-03 vers 08:00Z) sur les index de ce lot qui servent : une
--      requête d'égalité et une requête `= ANY`, planifiées (GENERIC_PLAN) avec puis
--      sans l'index ordinaire, donnent le même plan nœud pour nœud. Quand un index y
--      figure, seul son nom change, et c'est celui du jumeau unique.
--   3. Rien ne le nomme. L'index retiré ne porte ni contrainte, ni dépendance
--      `pg_depend`, ni identité de réplication, ni CLUSTER. Aucun corps de fonction,
--      job pg_cron, commentaire, ni fichier du dépôt (hors sa migration de création) ne
--      le cite ; l'instance n'a pas `pg_hint_plan`.
--   Ses parcours se reportent donc sur le jumeau, au même plan.
--
-- Index retirés (parcours depuis le démarrage de l'instance, 2026-09-17 01:14Z,
-- relevés le 2026-10-03 à 08:05Z) :
--
--   table                             index retiré                                   taille     parcours  jumeau conservé (parcours)
--   ___config                         idx____config_cnf_id                            16 ko            0  ___config_pkey (0)
--   ___config_admin                   idx____config_admin_cnfa_id                     16 ko           12  ___config_admin_pkey (0)
--   ___config_ip                      idx____config_ip_cnfip_id                       16 ko            0  ___config_ip_pkey (0)
--   ___xtr_customer                   idx____xtr_customer_cst_id                     2,2 Mo        7 793  ___xtr_customer_pkey (0)
--   ___xtr_customer_billing_address   idx____xtr_customer_billing_address_cba_id     2,2 Mo        2 834  ___xtr_customer_billing_address_pkey (0)
--   ___xtr_customer_delivery_address  idx____xtr_customer_delivery_address_cda_id    2,2 Mo        2 834  ___xtr_customer_delivery_address_pkey (0)
--   ___xtr_delivery_agent             idx____xtr_delivery_agent_da_id                 16 ko            0  ___xtr_delivery_agent_pkey (0)
--   ___xtr_delivery_ape_corse         idx____xtr_delivery_ape_corse_tpg_id            16 ko            0  ___xtr_delivery_ape_corse_pkey (0)
--   ___xtr_delivery_ape_domtom1       idx____xtr_delivery_ape_domtom1_tpg_id          16 ko            0  ___xtr_delivery_ape_domtom1_pkey (0)
--   ___xtr_delivery_ape_domtom2       idx____xtr_delivery_ape_domtom2_tpg_id          16 ko            0  ___xtr_delivery_ape_domtom2_pkey (0)
--   ___xtr_delivery_ape_france        idx____xtr_delivery_ape_france_tpg_id           16 ko            0  ___xtr_delivery_ape_france_pkey (0)
--   ___xtr_invoice                    idx____xtr_invoice_inv_id                       16 ko            0  ___xtr_invoice_pkey (0)
--   ___xtr_invoice_line               idx____xtr_invoice_line_invl_id                 16 ko            0  ___xtr_invoice_line_pkey (0)
--   ___xtr_order                      idx____xtr_order_ord_id                         96 ko       29 764  ___xtr_order_pkey (0)
--   ___xtr_order_line                 idx____xtr_order_line_orl_id                   120 ko            0  ___xtr_order_line_pkey (0)
--   ___xtr_order_line_equiv_ticket    idx____xtr_order_line_equiv_ticket_orlet_id     16 ko            0  ___xtr_order_line_equiv_ticket_pkey (0)
--   ___xtr_order_line_status          idx____xtr_order_line_status_orls_id            16 ko            0  ___xtr_order_line_status_pkey (0)
--   ___xtr_order_status               idx____xtr_order_status_ords_id                 16 ko            2  ___xtr_order_status_pkey (0)
--   ___xtr_supplier                   idx____xtr_supplier_spl_id                      16 ko            0  ___xtr_supplier_pkey (0)
--   ___xtr_supplier_link_pm           idx____xtr_supplier_link_pm_slpm_id             16 ko            0  ___xtr_supplier_link_pm_pkey (0)
--   __abandoned_cart_emails           idx_ace_recovery_token                           8 ko            0  __abandoned_cart_emails_recovery_token_key (0)
--   ic_postback                       idx_ic_postback_id_ic_postback                 256 ko            1  ic_postback_pkey (2)
--   password_resets                   idx_password_resets_token                       16 ko            0  password_resets_token_key (0)
--   promo_codes                       idx_promo_codes_code                            16 ko            0  promo_codes_code_key (0)
--
-- Gain : 7,3 Mo (7 684 096 octets), 24 index de moins à maintenir à chaque
-- écriture. Index qui servaient, dont les parcours passent au jumeau : 7.
--
-- Timeouts EXPLICITES à 0 : un GUC omis hérite des 60 s du rôle `postgres` (incident
-- 20260529, PR #1395). DROP INDEX CONCURRENTLY ne relit pas la heap, mais il attend la
-- fin des transactions qui voient la table ; ces attentes comptent contre
-- lock_timeout. Il ne bloque ni les lectures ni les écritures. Le job CI borne le run.
-- `IF EXISTS` rend le fichier rejouable : un DROP CONCURRENTLY interrompu laisse un
-- index INVALIDE, qu'une seconde exécution retire.
--
-- Effet de bord attendu : chaque DROP déclenche l'event trigger `pgrst_drop_watch`
-- (`sql_drop`), qui recharge le cache de schéma de PostgREST — 24 rechargements, sans
-- changement de l'API exposée (un index n'y figure pas).
--
-- Retour arrière : `20261003_drop_indexes_shadowed_by_unique_commerce.down.sql`
-- recrée les 24 index à l'identique (CONCURRENTLY). L'engine est forward-only : ce
-- fichier se lance à la main.
SET lock_timeout = 0;
SET statement_timeout = 0;

-- -----------------------------------------------------------------------------
-- §0 — PRÉ-CONDITIONS FAIL-CLOSED (lecture de catalogue uniquement)
-- -----------------------------------------------------------------------------
-- Pour chaque paire [table, index retiré, jumeau unique conservé], si l'index retiré
-- est encore là (absent = déjà retiré, rejeu) :
--   * le jumeau existe sur la même table, est unique, immédiat, valide, prêt et vivant ;
--   * l'index retiré n'est ni unique, ni primaire, ni d'exclusion, ni identité de
--     réplication, ni CLUSTER, ne porte aucune contrainte et n'a aucun objet dépendant ;
--   * les deux définitions (`pg_get_indexdef`) sont identiques au nom et à UNIQUE près.
-- Un seul écart = ABORT avant tout DROP : la preuve 1 ne tient plus pour cette paire.
DO $precheck$
DECLARE
  v_pair  text[];
  v_tbl   oid;
  v_plain oid;
  v_twin  oid;
  v_pdef  text;
  v_tdef  text;
BEGIN
  FOREACH v_pair SLICE 1 IN ARRAY ARRAY[
    ['___config', 'idx____config_cnf_id', '___config_pkey'],
    ['___config_admin', 'idx____config_admin_cnfa_id', '___config_admin_pkey'],
    ['___config_ip', 'idx____config_ip_cnfip_id', '___config_ip_pkey'],
    ['___xtr_customer', 'idx____xtr_customer_cst_id', '___xtr_customer_pkey'],
    ['___xtr_customer_billing_address', 'idx____xtr_customer_billing_address_cba_id', '___xtr_customer_billing_address_pkey'],
    ['___xtr_customer_delivery_address', 'idx____xtr_customer_delivery_address_cda_id', '___xtr_customer_delivery_address_pkey'],
    ['___xtr_delivery_agent', 'idx____xtr_delivery_agent_da_id', '___xtr_delivery_agent_pkey'],
    ['___xtr_delivery_ape_corse', 'idx____xtr_delivery_ape_corse_tpg_id', '___xtr_delivery_ape_corse_pkey'],
    ['___xtr_delivery_ape_domtom1', 'idx____xtr_delivery_ape_domtom1_tpg_id', '___xtr_delivery_ape_domtom1_pkey'],
    ['___xtr_delivery_ape_domtom2', 'idx____xtr_delivery_ape_domtom2_tpg_id', '___xtr_delivery_ape_domtom2_pkey'],
    ['___xtr_delivery_ape_france', 'idx____xtr_delivery_ape_france_tpg_id', '___xtr_delivery_ape_france_pkey'],
    ['___xtr_invoice', 'idx____xtr_invoice_inv_id', '___xtr_invoice_pkey'],
    ['___xtr_invoice_line', 'idx____xtr_invoice_line_invl_id', '___xtr_invoice_line_pkey'],
    ['___xtr_order', 'idx____xtr_order_ord_id', '___xtr_order_pkey'],
    ['___xtr_order_line', 'idx____xtr_order_line_orl_id', '___xtr_order_line_pkey'],
    ['___xtr_order_line_equiv_ticket', 'idx____xtr_order_line_equiv_ticket_orlet_id', '___xtr_order_line_equiv_ticket_pkey'],
    ['___xtr_order_line_status', 'idx____xtr_order_line_status_orls_id', '___xtr_order_line_status_pkey'],
    ['___xtr_order_status', 'idx____xtr_order_status_ords_id', '___xtr_order_status_pkey'],
    ['___xtr_supplier', 'idx____xtr_supplier_spl_id', '___xtr_supplier_pkey'],
    ['___xtr_supplier_link_pm', 'idx____xtr_supplier_link_pm_slpm_id', '___xtr_supplier_link_pm_pkey'],
    ['__abandoned_cart_emails', 'idx_ace_recovery_token', '__abandoned_cart_emails_recovery_token_key'],
    ['ic_postback', 'idx_ic_postback_id_ic_postback', 'ic_postback_pkey'],
    ['password_resets', 'idx_password_resets_token', 'password_resets_token_key'],
    ['promo_codes', 'idx_promo_codes_code', 'promo_codes_code_key']
  ] LOOP
    v_plain := to_regclass('public.' || v_pair[2]);
    CONTINUE WHEN v_plain IS NULL;  -- déjà retiré (rejeu après interruption)

    v_tbl  := to_regclass('public.' || v_pair[1]);
    v_twin := to_regclass('public.' || v_pair[3]);

    IF v_tbl IS NULL OR v_twin IS NULL OR NOT EXISTS (
      SELECT 1
        FROM pg_index u
       WHERE u.indexrelid = v_twin
         AND u.indrelid = v_tbl
         AND u.indisunique
         AND u.indimmediate
         AND u.indisvalid
         AND u.indisready
         AND u.indislive
    ) THEN
      RAISE EXCEPTION 'ABORT: jumeau public.% absent, non unique ou non valide sur public.% — public.% conservé',
        v_pair[3], v_pair[1], v_pair[2];
    END IF;

    IF NOT EXISTS (
      SELECT 1
        FROM pg_index i
       WHERE i.indexrelid = v_plain
         AND i.indrelid = v_tbl
         AND NOT i.indisunique
         AND NOT i.indisprimary
         AND NOT i.indisexclusion
         AND NOT i.indisreplident
         AND NOT i.indisclustered
    ) THEN
      RAISE EXCEPTION 'ABORT: public.% n''est plus un index ordinaire de public.% (table, unicité, réplication ou CLUSTER)',
        v_pair[2], v_pair[1];
    END IF;

    v_pdef := pg_get_indexdef(v_plain);
    v_tdef := pg_get_indexdef(v_twin);
    IF v_pdef !~ '^CREATE INDEX \S+ ON '
       OR v_tdef !~ '^CREATE UNIQUE INDEX \S+ ON '
       OR regexp_replace(v_pdef, '^CREATE INDEX \S+ ON ', '')
          <> regexp_replace(v_tdef, '^CREATE UNIQUE INDEX \S+ ON ', '')
    THEN
      RAISE EXCEPTION 'ABORT: public.% et public.% n''ont plus la même définition (% | %)',
        v_pair[2], v_pair[3], v_pdef, v_tdef;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_constraint k WHERE k.conindid = v_plain) THEN
      RAISE EXCEPTION 'ABORT: public.% porte une contrainte', v_pair[2];
    END IF;

    IF EXISTS (
      SELECT 1 FROM pg_depend d
       WHERE d.refclassid = 'pg_class'::regclass
         AND d.refobjid = v_plain
    ) THEN
      RAISE EXCEPTION 'ABORT: un objet dépend de public.%', v_pair[2];
    END IF;
  END LOOP;
END
$precheck$;

-- -----------------------------------------------------------------------------
-- §1 — RETRAIT DES 24 INDEX (un DROP par instruction, en autocommit)
-- -----------------------------------------------------------------------------

DROP INDEX CONCURRENTLY IF EXISTS public.idx____config_cnf_id;

DROP INDEX CONCURRENTLY IF EXISTS public.idx____config_admin_cnfa_id;

DROP INDEX CONCURRENTLY IF EXISTS public.idx____config_ip_cnfip_id;

DROP INDEX CONCURRENTLY IF EXISTS public.idx____xtr_customer_cst_id;

DROP INDEX CONCURRENTLY IF EXISTS public.idx____xtr_customer_billing_address_cba_id;

DROP INDEX CONCURRENTLY IF EXISTS public.idx____xtr_customer_delivery_address_cda_id;

DROP INDEX CONCURRENTLY IF EXISTS public.idx____xtr_delivery_agent_da_id;

DROP INDEX CONCURRENTLY IF EXISTS public.idx____xtr_delivery_ape_corse_tpg_id;

DROP INDEX CONCURRENTLY IF EXISTS public.idx____xtr_delivery_ape_domtom1_tpg_id;

DROP INDEX CONCURRENTLY IF EXISTS public.idx____xtr_delivery_ape_domtom2_tpg_id;

DROP INDEX CONCURRENTLY IF EXISTS public.idx____xtr_delivery_ape_france_tpg_id;

DROP INDEX CONCURRENTLY IF EXISTS public.idx____xtr_invoice_inv_id;

DROP INDEX CONCURRENTLY IF EXISTS public.idx____xtr_invoice_line_invl_id;

DROP INDEX CONCURRENTLY IF EXISTS public.idx____xtr_order_ord_id;

DROP INDEX CONCURRENTLY IF EXISTS public.idx____xtr_order_line_orl_id;

DROP INDEX CONCURRENTLY IF EXISTS public.idx____xtr_order_line_equiv_ticket_orlet_id;

DROP INDEX CONCURRENTLY IF EXISTS public.idx____xtr_order_line_status_orls_id;

DROP INDEX CONCURRENTLY IF EXISTS public.idx____xtr_order_status_ords_id;

DROP INDEX CONCURRENTLY IF EXISTS public.idx____xtr_supplier_spl_id;

DROP INDEX CONCURRENTLY IF EXISTS public.idx____xtr_supplier_link_pm_slpm_id;

DROP INDEX CONCURRENTLY IF EXISTS public.idx_ace_recovery_token;

DROP INDEX CONCURRENTLY IF EXISTS public.idx_ic_postback_id_ic_postback;

DROP INDEX CONCURRENTLY IF EXISTS public.idx_password_resets_token;

DROP INDEX CONCURRENTLY IF EXISTS public.idx_promo_codes_code;

-- -----------------------------------------------------------------------------
-- §2 — POST-CONDITIONS FAIL-CLOSED
-- -----------------------------------------------------------------------------
-- Les 24 index ont disparu ; chaque jumeau unique est toujours là, valide et prêt.
DO $postcheck$
DECLARE
  v_pair text[];
BEGIN
  FOREACH v_pair SLICE 1 IN ARRAY ARRAY[
    ['___config', 'idx____config_cnf_id', '___config_pkey'],
    ['___config_admin', 'idx____config_admin_cnfa_id', '___config_admin_pkey'],
    ['___config_ip', 'idx____config_ip_cnfip_id', '___config_ip_pkey'],
    ['___xtr_customer', 'idx____xtr_customer_cst_id', '___xtr_customer_pkey'],
    ['___xtr_customer_billing_address', 'idx____xtr_customer_billing_address_cba_id', '___xtr_customer_billing_address_pkey'],
    ['___xtr_customer_delivery_address', 'idx____xtr_customer_delivery_address_cda_id', '___xtr_customer_delivery_address_pkey'],
    ['___xtr_delivery_agent', 'idx____xtr_delivery_agent_da_id', '___xtr_delivery_agent_pkey'],
    ['___xtr_delivery_ape_corse', 'idx____xtr_delivery_ape_corse_tpg_id', '___xtr_delivery_ape_corse_pkey'],
    ['___xtr_delivery_ape_domtom1', 'idx____xtr_delivery_ape_domtom1_tpg_id', '___xtr_delivery_ape_domtom1_pkey'],
    ['___xtr_delivery_ape_domtom2', 'idx____xtr_delivery_ape_domtom2_tpg_id', '___xtr_delivery_ape_domtom2_pkey'],
    ['___xtr_delivery_ape_france', 'idx____xtr_delivery_ape_france_tpg_id', '___xtr_delivery_ape_france_pkey'],
    ['___xtr_invoice', 'idx____xtr_invoice_inv_id', '___xtr_invoice_pkey'],
    ['___xtr_invoice_line', 'idx____xtr_invoice_line_invl_id', '___xtr_invoice_line_pkey'],
    ['___xtr_order', 'idx____xtr_order_ord_id', '___xtr_order_pkey'],
    ['___xtr_order_line', 'idx____xtr_order_line_orl_id', '___xtr_order_line_pkey'],
    ['___xtr_order_line_equiv_ticket', 'idx____xtr_order_line_equiv_ticket_orlet_id', '___xtr_order_line_equiv_ticket_pkey'],
    ['___xtr_order_line_status', 'idx____xtr_order_line_status_orls_id', '___xtr_order_line_status_pkey'],
    ['___xtr_order_status', 'idx____xtr_order_status_ords_id', '___xtr_order_status_pkey'],
    ['___xtr_supplier', 'idx____xtr_supplier_spl_id', '___xtr_supplier_pkey'],
    ['___xtr_supplier_link_pm', 'idx____xtr_supplier_link_pm_slpm_id', '___xtr_supplier_link_pm_pkey'],
    ['__abandoned_cart_emails', 'idx_ace_recovery_token', '__abandoned_cart_emails_recovery_token_key'],
    ['ic_postback', 'idx_ic_postback_id_ic_postback', 'ic_postback_pkey'],
    ['password_resets', 'idx_password_resets_token', 'password_resets_token_key'],
    ['promo_codes', 'idx_promo_codes_code', 'promo_codes_code_key']
  ] LOOP
    IF to_regclass('public.' || v_pair[2]) IS NOT NULL THEN
      RAISE EXCEPTION 'postcheck: public.% toujours présent', v_pair[2];
    END IF;
    IF NOT EXISTS (
      SELECT 1
        FROM pg_index u
       WHERE u.indexrelid = to_regclass('public.' || v_pair[3])
         AND u.indrelid = to_regclass('public.' || v_pair[1])
         AND u.indisunique
         AND u.indisvalid
         AND u.indisready
    ) THEN
      RAISE EXCEPTION 'postcheck: jumeau public.% absent ou invalide', v_pair[3];
    END IF;
  END LOOP;
END
$postcheck$;

-- =============================================================================
-- Vérification après application (lecture seule, catalogue uniquement)
-- =============================================================================
--   SELECT n, to_regclass('public.' || n) FROM unnest(ARRAY[
--     'idx____config_cnf_id', 'idx____config_admin_cnfa_id',
--     'idx____config_ip_cnfip_id', 'idx____xtr_customer_cst_id',
--     'idx____xtr_customer_billing_address_cba_id', 'idx____xtr_customer_delivery_address_cda_id',
--     'idx____xtr_delivery_agent_da_id', 'idx____xtr_delivery_ape_corse_tpg_id',
--     'idx____xtr_delivery_ape_domtom1_tpg_id', 'idx____xtr_delivery_ape_domtom2_tpg_id',
--     'idx____xtr_delivery_ape_france_tpg_id', 'idx____xtr_invoice_inv_id',
--     'idx____xtr_invoice_line_invl_id', 'idx____xtr_order_ord_id',
--     'idx____xtr_order_line_orl_id', 'idx____xtr_order_line_equiv_ticket_orlet_id',
--     'idx____xtr_order_line_status_orls_id', 'idx____xtr_order_status_ords_id',
--     'idx____xtr_supplier_spl_id', 'idx____xtr_supplier_link_pm_slpm_id',
--     'idx_ace_recovery_token', 'idx_ic_postback_id_ic_postback',
--     'idx_password_resets_token', 'idx_promo_codes_code'
--   ]) AS n;                                         -- attendu : 24 × NULL
-- =============================================================================
