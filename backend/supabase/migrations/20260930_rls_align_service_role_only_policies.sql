-- =============================================================================
-- Migration : aligner les politiques RLS « service_role seul » de 17 tables sur
--             la convention du projet (FOR ALL TO service_role USING (true)
--             WITH CHECK (true))
-- Date      : 2026-09-30
-- Severity  : WARN (advisors Supabase auth_rls_initplan ×18,
--             multiple_permissive_policies ×24) + une politique qui se fie à des
--             métadonnées modifiables par l'utilisateur (seo_link_metrics_daily)
-- Scope     : politiques RLS de 17 tables (public, _archive, tecdoc_norm).
--             AUCUN droit (GRANT/REVOKE) modifié, aucune donnée lue ni écrite,
--             aucune table créée ni supprimée, RLS reste activée partout.
-- Forward-only. Ne réécrit AUCUNE migration historique.
-- Zone RLS : GO owner nominatif du 2026-09-30 (« RLS 18 politiques »).
-- =============================================================================
--
-- CONSTAT (mesure du 2026-09-30, pg_policies)
-- --------------------------------------------
-- 689 des 741 politiques du projet suivent la convention
--   FOR ALL TO service_role USING (true) WITH CHECK (true).
-- 17 politiques expriment la même intention autrement :
--   FOR ALL TO public USING (auth.role() = 'service_role') [WITH CHECK (idem)]
-- et une 18e, sur seo_link_metrics_daily, ouvre la lecture à tout utilisateur
-- Supabase Auth dont raw_user_meta_data->>'isAdmin' vaut 'true'.
--
-- Parmi les 17, trois doublonnent une politique déjà conforme de la même table :
--   * _archive.__agentic_chain_rules : service_role_only (sans WITH CHECK)
--     doublonne service_role_only_chain_rules — cause des 24
--     multiple_permissive_policies ;
--   * public.__pipeline_chain_queue : service_only_pcq doublonne service_role_all ;
--   * public.__seo_brand_editorial : editorial_write_service_role doublonne
--     __seo_brand_editorial_service_role_all (créée par
--     20260423_drop_public_using_true_catalog.sql).
-- Ces trois-là sont RETIRÉES (les aligner créerait deux politiques identiques).
-- Les 14 autres sont ALIGNÉES par ALTER POLICY (nom conservé).
--
-- POURQUOI LE RÉSULTAT DES REQUÊTES NE CHANGE PAS — vérifié le 2026-09-30
-- ----------------------------------------------------------------------
--   * service_role, postgres et supabase_read_only_user ont BYPASSRLS : aucune
--     politique n'est évaluée pour eux, avant comme après. Le backend (PROD, DEV)
--     s'authentifie en service_role (supabase-base.service.ts).
--   * anon et authenticated (sans BYPASSRLS) : auth.role() renvoie le rôle du
--     JWT, donc jamais 'service_role' pour eux → 0 ligne visible, 0 écriture
--     admise. Après : aucune politique ne les vise → refus par défaut de RLS,
--     soit le même résultat (0 ligne, pas d'erreur). Le backend PREPROD
--     (READ_ONLY, clé anon, ADR-028 Option D) garde donc exactement les mêmes
--     réponses vides sur ces tables.
--   * autres rôles sans BYPASSRLS (authenticator, dashboard_user, dev_readonly,
--     supabase_privileged_role) : aucune revendication JWT hors PostgREST, donc
--     auth.role() vaut NULL → 0 ligne ; après : 0 ligne.
--   * Chemins où current_user n'est pas l'appelant — c'est là que
--     `auth.role() = 'service_role'` et `TO service_role` pourraient diverger :
--       - les 17 tables appartiennent à postgres (BYPASSRLS), aucune n'est en
--         FORCE ROW LEVEL SECURITY ;
--       - vues qui les lisent : v_kw_pipeline_status et la vue matérialisée
--         v_gamme_seo_dashboard appartiennent à postgres ; v_gamme_content_orphans
--         est security_invoker (même règle que l'appelant) ;
--       - fonctions et triggers qui les nomment (8 fonctions, 5 triggers) : tous
--         appartiennent à postgres ;
--       - aucune n'est publiée par Realtime (pg_publication_tables : 0 ligne).
--     §0 revérifie ces prémisses et ABANDONNE si l'une d'elles ne tient plus.
--
-- CE QUE LA MIGRATION CORRIGE
-- ---------------------------
--   (a) auth_rls_initplan ×18 : auth.role() / auth.uid() réévalués à chaque
--       ligne. Les politiques d'arrivée n'appellent plus aucune fonction.
--   (b) multiple_permissive_policies ×24 : retrait du doublon de
--       _archive.__agentic_chain_rules (et des deux doublons que l'advisor ne
--       compte pas parce qu'ils ne visent que service_role, qui a BYPASSRLS).
--   (c) seo_link_metrics_daily : la politique « Allow admin read » (issue de
--       migrations/002_create_seo_link_tracking.sql) accorde la lecture sur la
--       foi de raw_user_meta_data, que tout utilisateur peut réécrire pour son
--       propre compte (auth.updateUser). Les inscriptions GoTrue sont ouvertes
--       (disable_signup = false, mesure du 2026-09-29) : la porte existe par
--       construction, même si auth.users compte 0 ligne aujourd'hui. Aucun code
--       ne lit cette table par JWT utilisateur : son seul écrivain est
--       aggregate_seo_link_metrics(), appelée par seo-link-tracking.service.ts
--       en service_role. Ses deux tables sœurs (seo_link_clicks,
--       seo_link_impressions) portent déjà <table>_service_role_all
--       (20260422_rls_policies_cleanup.sql) ; celle-ci avait été oubliée. On
--       reprend le même nom.
--
-- CE QUI N'EST PAS FAIT, ET POURQUOI
-- ----------------------------------
--   * aucun REVOKE des droits de table d'anon / authenticated : en PREPROD le
--     backend tourne en anon ; une lecture qui rend aujourd'hui 0 ligne (RLS)
--     lèverait demain 42501 (permission denied). Ce serait un changement de
--     comportement, hors de ce lot.
--   * les 14 politiques alignées gardent leur nom (ALTER POLICY) : l'historique
--     reste lisible et aucune fenêtre sans politique n'existe.
--
-- VERROUS : ALTER / DROP / CREATE POLICY prennent un verrou ACCESS EXCLUSIVE sur
-- la table, tenu jusqu'au COMMIT (aucune réécriture : quelques millisecondes).
-- lock_timeout court : si une requête longue tient une des tables, la migration
-- échoue en bloc (rien n'est appliqué) au lieu de faire patienter le trafic ; il
-- suffit de relancer.
--
-- IDEMPOTENT ET REJOUABLE : §0 accepte l'état de départ OU l'état d'arrivée de
-- chaque politique, et refuse toute autre définition.
--
-- APPLICATION : par le moteur du dépôt uniquement (Actions → « 🗄️ Apply
-- Supabase migrations (manual) », only_ids = cet identifiant), après fusion sur
-- main — jamais par un canal qui contourne infra.schema_migrations.
--
-- ROLLBACK : 20260930_rls_align_service_role_only_policies.down.sql, à lancer à
-- la main (le moteur est forward-only). Il restaure les 18 définitions de départ
-- à l'identique — y compris la politique « Allow admin read », donc la porte
-- décrite en (c) : ne le jouer que si cette migration a cassé un usage réel.
-- =============================================================================

-- Pas de BEGIN/COMMIT explicite : le moteur applique ce fichier dans une
-- transaction (.squawk.toml `assume_in_transaction = true`).
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';

-- -----------------------------------------------------------------------------
-- §0 — PRÉ-CONDITIONS FAIL-CLOSED (lecture de catalogue uniquement)
-- -----------------------------------------------------------------------------
DO $precheck$
DECLARE
  r record;
  v_legacy constant text := '(auth.role() = ''service_role''::text)';
BEGIN
  -- (1) Prémisse du « résultat inchangé » : les rôles qui lisent et écrivent ces
  --     tables contournent RLS.
  IF (SELECT count(*) FROM pg_roles
       WHERE rolname IN ('postgres', 'service_role') AND rolbypassrls) <> 2 THEN
    RAISE EXCEPTION 'ABORT: postgres ou service_role sans BYPASSRLS';
  END IF;

  -- (2) Les 17 tables existent, ont RLS activée, et leur propriétaire (celui des
  --     vues et fonctions qui les lisent) contourne RLS.
  FOR r IN
    SELECT t.rel, c.relrowsecurity, o.rolbypassrls
      FROM (VALUES
        ('public.__admin_audit_log'), ('public.__claims'), ('public.__db_governance_snapshots'),
        ('public.__pipeline_chain_queue'), ('public.__quote_requests'), ('public.__quotes'),
        ('public.__refunds'), ('public.__seo_brand_editorial'), ('public.__seo_r1_gamme_slots'),
        ('public.__video_execution_log'), ('public.seo_link_metrics_daily'),
        ('_archive.__agentic_chain_rules'), ('tecdoc_norm.t001'), ('tecdoc_norm.t100'),
        ('tecdoc_norm.t200'), ('tecdoc_norm.t209'), ('tecdoc_norm.t210')
      ) AS t(rel)
      LEFT JOIN pg_class c ON c.oid = to_regclass(t.rel)
      LEFT JOIN pg_roles o ON o.oid = c.relowner
  LOOP
    IF r.relrowsecurity IS NOT TRUE OR r.rolbypassrls IS NOT TRUE THEN
      RAISE EXCEPTION 'ABORT: % absente, sans RLS activée, ou propriétaire sans BYPASSRLS', r.rel;
    END IF;
  END LOOP;

  -- (3) Chaque politique attendue est dans son état de départ ou d'arrivée.
  --     kind = alter  : départ (legacy) OU arrivée (convention)
  --            drop   : départ (legacy) OU absente
  --            keep   : conforme, présente (c'est elle qui reste)
  --            admin  : « Allow admin read » telle que mesurée, OU absente
  --            create : absente OU conforme
  FOR r IN
    SELECT e.*, p.policyname IS NOT NULL AS present,
           p.permissive, p.cmd, p.roles, p.qual, p.with_check
      FROM (VALUES
        ('public',      '__admin_audit_log',         'service_role_aal',                                 'alter',  false),
        ('public',      '__claims',                  'service_role_claims',                              'alter',  false),
        ('public',      '__db_governance_snapshots', 'service_role_only',                                'alter',  true),
        ('public',      '__quote_requests',          'service_role_qr',                                  'alter',  false),
        ('public',      '__quotes',                  'service_role_qt',                                  'alter',  false),
        ('public',      '__refunds',                 'service_role_refunds',                             'alter',  false),
        ('public',      '__seo_r1_gamme_slots',      'Service role full access on __seo_r1_gamme_slots', 'alter',  false),
        ('public',      '__video_execution_log',     'Service role full access',                         'alter',  false),
        ('_archive',    '__agentic_chain_rules',     'service_role_only_chain_rules',                    'alter',  true),
        ('tecdoc_norm', 't001',                      'service_role_only',                                'alter',  false),
        ('tecdoc_norm', 't100',                      'service_role_only',                                'alter',  false),
        ('tecdoc_norm', 't200',                      'service_role_only',                                'alter',  false),
        ('tecdoc_norm', 't209',                      'service_role_only',                                'alter',  false),
        ('tecdoc_norm', 't210',                      'service_role_only',                                'alter',  false),
        ('_archive',    '__agentic_chain_rules',     'service_role_only',                                'drop',   false),
        ('public',      '__pipeline_chain_queue',    'service_only_pcq',                                 'drop',   false),
        ('public',      '__seo_brand_editorial',     'editorial_write_service_role',                     'drop',   true),
        ('public',      '__pipeline_chain_queue',    'service_role_all',                                 'keep',   NULL),
        ('public',      '__seo_brand_editorial',     '__seo_brand_editorial_service_role_all',           'keep',   NULL),
        ('public',      'seo_link_metrics_daily',    'Allow admin read on seo_link_metrics_daily',       'admin',  NULL),
        ('public',      'seo_link_metrics_daily',    'seo_link_metrics_daily_service_role_all',          'create', NULL)
      ) AS e(sch, tbl, pol, kind, has_check)
      LEFT JOIN pg_policies p
        ON p.schemaname = e.sch AND p.tablename = e.tbl AND p.policyname = e.pol
  LOOP
    IF NOT (
      CASE
        WHEN NOT r.present THEN r.kind IN ('drop', 'admin', 'create')
        WHEN r.kind = 'admin' THEN
             r.permissive = 'PERMISSIVE' AND r.cmd = 'SELECT' AND r.roles = '{public}'
         AND r.qual LIKE '%auth.users%auth.uid()%raw_user_meta_data%isAdmin%'
         AND r.with_check IS NULL
        ELSE r.permissive = 'PERMISSIVE' AND r.cmd = 'ALL'
         AND (
               -- conforme (arrivée d'un alter, keep, create)
               (r.kind IN ('alter', 'keep', 'create')
                AND r.roles = '{service_role}' AND r.qual = 'true' AND r.with_check = 'true')
            OR -- départ legacy (alter, drop)
               (r.kind IN ('alter', 'drop')
                AND r.roles = '{public}' AND r.qual = v_legacy
                AND r.with_check IS NOT DISTINCT FROM
                    CASE WHEN r.has_check THEN v_legacy END)
             )
      END
    ) THEN
      RAISE EXCEPTION 'ABORT: politique %.%.« % » (%) absente ou définition inattendue',
        r.sch, r.tbl, r.pol, r.kind;
    END IF;
  END LOOP;

  -- (4) Aucune autre politique sur ces 17 tables : une politique inconnue
  --     changerait le raisonnement ci-dessus.
  FOR r IN
    SELECT p.schemaname, p.tablename, p.policyname
      FROM pg_policies p
     WHERE (p.schemaname, p.tablename) IN (
             ('public','__admin_audit_log'), ('public','__claims'), ('public','__db_governance_snapshots'),
             ('public','__pipeline_chain_queue'), ('public','__quote_requests'), ('public','__quotes'),
             ('public','__refunds'), ('public','__seo_brand_editorial'), ('public','__seo_r1_gamme_slots'),
             ('public','__video_execution_log'), ('public','seo_link_metrics_daily'),
             ('_archive','__agentic_chain_rules'), ('tecdoc_norm','t001'), ('tecdoc_norm','t100'),
             ('tecdoc_norm','t200'), ('tecdoc_norm','t209'), ('tecdoc_norm','t210'))
       AND (p.schemaname, p.tablename, p.policyname) NOT IN (
             ('public','__admin_audit_log','service_role_aal'),
             ('public','__claims','service_role_claims'),
             ('public','__db_governance_snapshots','service_role_only'),
             ('public','__pipeline_chain_queue','service_only_pcq'),
             ('public','__pipeline_chain_queue','service_role_all'),
             ('public','__quote_requests','service_role_qr'),
             ('public','__quotes','service_role_qt'),
             ('public','__refunds','service_role_refunds'),
             ('public','__seo_brand_editorial','editorial_write_service_role'),
             ('public','__seo_brand_editorial','__seo_brand_editorial_service_role_all'),
             ('public','__seo_r1_gamme_slots','Service role full access on __seo_r1_gamme_slots'),
             ('public','__video_execution_log','Service role full access'),
             ('public','seo_link_metrics_daily','Allow admin read on seo_link_metrics_daily'),
             ('public','seo_link_metrics_daily','seo_link_metrics_daily_service_role_all'),
             ('_archive','__agentic_chain_rules','service_role_only'),
             ('_archive','__agentic_chain_rules','service_role_only_chain_rules'),
             ('tecdoc_norm','t001','service_role_only'),
             ('tecdoc_norm','t100','service_role_only'),
             ('tecdoc_norm','t200','service_role_only'),
             ('tecdoc_norm','t209','service_role_only'),
             ('tecdoc_norm','t210','service_role_only'))
  LOOP
    RAISE EXCEPTION 'ABORT: politique inattendue %.%.« % »',
      r.schemaname, r.tablename, r.policyname;
  END LOOP;
END
$precheck$;

-- -----------------------------------------------------------------------------
-- §1 — 14 politiques alignées : même nom, même commande (ALL), rôle
--      service_role, prédicats constants.
-- -----------------------------------------------------------------------------
ALTER POLICY service_role_aal ON public.__admin_audit_log
  TO service_role USING (true) WITH CHECK (true);
ALTER POLICY service_role_claims ON public.__claims
  TO service_role USING (true) WITH CHECK (true);
ALTER POLICY service_role_only ON public.__db_governance_snapshots
  TO service_role USING (true) WITH CHECK (true);
ALTER POLICY service_role_qr ON public.__quote_requests
  TO service_role USING (true) WITH CHECK (true);
ALTER POLICY service_role_qt ON public.__quotes
  TO service_role USING (true) WITH CHECK (true);
ALTER POLICY service_role_refunds ON public.__refunds
  TO service_role USING (true) WITH CHECK (true);
ALTER POLICY "Service role full access on __seo_r1_gamme_slots" ON public.__seo_r1_gamme_slots
  TO service_role USING (true) WITH CHECK (true);
ALTER POLICY "Service role full access" ON public.__video_execution_log
  TO service_role USING (true) WITH CHECK (true);
ALTER POLICY service_role_only_chain_rules ON _archive.__agentic_chain_rules
  TO service_role USING (true) WITH CHECK (true);
ALTER POLICY service_role_only ON tecdoc_norm.t001
  TO service_role USING (true) WITH CHECK (true);
ALTER POLICY service_role_only ON tecdoc_norm.t100
  TO service_role USING (true) WITH CHECK (true);
ALTER POLICY service_role_only ON tecdoc_norm.t200
  TO service_role USING (true) WITH CHECK (true);
ALTER POLICY service_role_only ON tecdoc_norm.t209
  TO service_role USING (true) WITH CHECK (true);
ALTER POLICY service_role_only ON tecdoc_norm.t210
  TO service_role USING (true) WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- §2 — 3 doublons retirés : chaque table garde sa politique conforme (§0 (3)
--      a vérifié qu'elle est présente, ou §1 vient de l'aligner).
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS service_role_only ON _archive.__agentic_chain_rules;
DROP POLICY IF EXISTS service_only_pcq ON public.__pipeline_chain_queue;
DROP POLICY IF EXISTS editorial_write_service_role ON public.__seo_brand_editorial;

-- -----------------------------------------------------------------------------
-- §3 — seo_link_metrics_daily : politique de ses tables sœurs
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow admin read on seo_link_metrics_daily" ON public.seo_link_metrics_daily;
DO $create_policy$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                  WHERE schemaname = 'public' AND tablename = 'seo_link_metrics_daily'
                    AND policyname = 'seo_link_metrics_daily_service_role_all') THEN
    CREATE POLICY seo_link_metrics_daily_service_role_all ON public.seo_link_metrics_daily
      AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END
$create_policy$;

-- -----------------------------------------------------------------------------
-- §4 — POST-CONDITIONS FAIL-CLOSED
-- -----------------------------------------------------------------------------
-- Chacune des 17 tables porte exactement UNE politique, et c'est la convention
-- service_role (donc aucune n'appelle plus auth.* ni ne lit de métadonnées
-- utilisateur).
DO $postcheck$
DECLARE
  v_n int;
BEGIN
  SELECT count(*) INTO v_n
    FROM (VALUES
      ('public','__admin_audit_log'), ('public','__claims'), ('public','__db_governance_snapshots'),
      ('public','__pipeline_chain_queue'), ('public','__quote_requests'), ('public','__quotes'),
      ('public','__refunds'), ('public','__seo_brand_editorial'), ('public','__seo_r1_gamme_slots'),
      ('public','__video_execution_log'), ('public','seo_link_metrics_daily'),
      ('_archive','__agentic_chain_rules'), ('tecdoc_norm','t001'), ('tecdoc_norm','t100'),
      ('tecdoc_norm','t200'), ('tecdoc_norm','t209'), ('tecdoc_norm','t210')
    ) AS t(sch, tbl)
   WHERE (SELECT count(*) FROM pg_policies p
           WHERE p.schemaname = t.sch AND p.tablename = t.tbl) = 1
     AND EXISTS (SELECT 1 FROM pg_policies p
                  WHERE p.schemaname = t.sch AND p.tablename = t.tbl
                    AND p.permissive = 'PERMISSIVE' AND p.cmd = 'ALL'
                    AND p.roles = '{service_role}'
                    AND p.qual = 'true' AND p.with_check = 'true');
  IF v_n <> 17 THEN
    RAISE EXCEPTION 'ABORT: % tables sur 17 dans l''état attendu', v_n;
  END IF;
END
$postcheck$;

-- =============================================================================
-- Vérification post-migration (lecture seule, à jouer après apply)
-- =============================================================================
--   SELECT count(*) FILTER (WHERE coalesce(qual,'') || ' ' || coalesce(with_check,'')
--                                 ~* '(auth\.(role|uid|jwt)\(\)|user_meta)') AS auth_calls,
--          count(*) FILTER (WHERE roles = '{service_role}' AND cmd = 'ALL'
--                             AND qual = 'true' AND with_check = 'true') AS convention,
--          count(*) AS total
--     FROM pg_policies;
--   -- mesure de départ : 18 | 689 | 741
--   -- attendu          :  0 | 704 | 738  (14 alignées + 1 créée ; 4 retirées)
--
--   -- advisors Supabase (performance) : auth_rls_initplan 18 → 0,
--   -- multiple_permissive_policies 24 → 0.
-- =============================================================================
