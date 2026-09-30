-- =============================================================================
-- Migration : fermeture de l'exécution `authenticated` sur 72 RPC SECURITY DEFINER de public
-- Date      : 2026-09-29
-- Severity  : HIGH (advisor authenticated_security_definer_function_executable)
-- Scope     : droits EXECUTE de 72 fonctions de `public`, pour PUBLIC / anon /
--             authenticated uniquement. AUCUN corps de fonction n'est réécrit,
--             aucune table n'est touchée, aucun job pg_cron n'est modifié, aucun
--             objet n'est supprimé, aucun GRANT n'est émis.
-- Forward-only. Ne réécrit AUCUNE migration historique.
-- Suite directe de 20260917_definer_rpc_anon_lockdown.sql, dont elle solde la
-- dette (a) « PÉRIMÈTRE EXPLICITE ET DETTE OUVERTE ».
-- =============================================================================
--
-- CONTEXTE
-- --------
-- Le lot du 17/09 a fermé `anon` sur 35 fonctions DEFINER et laissé 72 autres
-- exécutables par `authenticated` SEUL (ni PUBLIC, ni anon), « à arbitrer dans un
-- lot suivant ». Ces 72 empruntent le MÊME chemin que celles du 17/09 :
-- PostgREST les expose sur /rest/v1/rpc/<nom> à tout porteur d'un JWT de rôle
-- `authenticated`, en contournant entièrement le backend NestJS et ses gardes HTTP.
--
-- La prémisse du 17/09 — « l'état des inscriptions GoTrue n'est pas lisible en
-- SQL » — est levée. Mesure du 2026-09-29 sur /auth/v1/settings du projet :
--   disable_signup = false, fournisseur e-mail seul, mailer_autoconfirm = false,
--   anonymous_users = false.
-- Tout tiers peut donc créer un compte Supabase Auth ; une fois son adresse
-- confirmée, il reçoit un JWT `authenticated`. L'exploitabilité effective dépend
-- de l'acheminement de l'e-mail de confirmation (configuration SMTP du projet,
-- non lisible en SQL) ; la surface, elle, existe par construction. auth.users
-- comptait 0 ligne le même jour : aucun utilisateur légitime ne porte ce rôle.
--
-- CE QUE CES 72 FONCTIONS PERMETTENT — exemples lus dans leur corps (pg_proc) :
--   * create_index_async / create_composite_index_async : CREATE INDEX (sans
--     CONCURRENTLY) sur une table ARBITRAIRE passée en paramètre. Verrou SHARE,
--     donc écritures bloquées le temps du build — un déni de service sur des
--     tables de plusieurs dizaines de Go.
--   * switch_to_next / rollback_switch / prepare_shadow_tables : ALTER TABLE …
--     RENAME et CREATE TABLE … AS SELECT sur le référentiel des marques.
--   * cleanup_old_pipeline_logs(p_days) : DELETE sur pipeline_event_log ;
--     p_days = 0 vide le journal.
--   * grant_breakglass : délivre un jeton que lit check_agent_write_allowed —
--     contournement de la garde d'écriture des agents.
--   * run_import_pipeline(p_batch_id, p_skip_gates) : pipeline d'import, portes
--     de contrôle désactivables par paramètre.
-- Détection par motif sur les corps (borne basse) : au moins 4 exécutent du DDL,
-- au moins 26 écrivent (INSERT / UPDATE / DELETE).
--
-- POURQUOI RÉVOQUER `authenticated` NE PEUT RIEN CASSER — vérifié le 2026-09-29 :
--   * le backend ne s'authentifie qu'en service_role (PROD, DEV) ou en anon
--     (PREPROD READ_ONLY, ADR-028 Option D) — supabase-base.service.ts. Les 8
--     fonctions du lot appelées par le code (get_brand_bestsellers_optimized,
--     get_oem_refs_for_vehicle, get_pieces_for_type_gamme, get_pieces_for_type_
--     gamme_v3, rm_get_listing_page, rm_get_page_complete, rm_health, et
--     get_gamme_page_data_optimized via son schéma Zod) le sont depuis des
--     services qui étendent SupabaseBaseService : jamais avec un JWT utilisateur.
--   * service_role garde son EXECUTE (entrée EXPLICITE dans proacl, pas héritée) ;
--     anon ne l'avait déjà pas. Ni PROD, ni DEV, ni PREPROD ne change donc de
--     comportement.
--   * aucune dépendance catalogue sur ces fonctions (pg_depend : 0 vue, 0 défaut
--     de colonne, 0 contrainte, 0 trigger, 0 politique RLS), aucun job pg_cron ne
--     les nomme, aucune fonction INVOKER d'aucun schéma ne les appelle.
--   * deux fonctions HORS lot les appellent : build_gamme_page_payload →
--     get_gamme_page_data_optimized, et check_agent_write_allowed →
--     check_breakglass. Toutes deux sont SECURITY DEFINER et appartiennent à
--     postgres : l'appel imbriqué est contrôlé contre postgres, propriétaire des
--     72, et non contre l'appelant. §0 refuse d'appliquer si cette prémisse a
--     changé.
--   * postgres est membre (INHERIT) d'authenticated, mais il POSSÈDE les 72 : son
--     droit de propriétaire ne dépend pas de ce REVOKE. §2 le vérifie.
--
-- CE QUI N'EST PAS RETIRÉ : aucun rôle hors API. Les 72 ne portent aucune entrée
-- PUBLIC (`=X/postgres`) : `FROM PUBLIC` et `FROM anon` sont ici des no-op
-- idempotents, écrits pour la cohérence avec le 17/09 et la règle 1 de
-- scripts/lint/check-definer-anon-surface.sh. dev_readonly,
-- supabase_read_only_user et dashboard_user ne perdent donc rien.
--
-- HORS PÉRIMÈTRE — et pourquoi :
--   * les 12 fonctions de rendu laissées à anon (allowlist du 17/09) restent
--     exécutables par authenticated, en PUBLIC pour 7 d'entre elles : retirer
--     authenticated sans retirer anon n'ôte rien à un attaquant, qui dispose de
--     la clé publishable.
--   * aucun DROP des fonctions mortes (prepare_shadow_tables, switch_to_next,
--     rollback_switch visent des tables qui n'existent pas) : suppression = zone
--     DB destructive, décision owner distincte.
--   * les privilèges par défaut (`ALTER DEFAULT PRIVILEGES … REVOKE EXECUTE ON
--     FUNCTIONS FROM anon, authenticated`) ne sont pas modifiés : la récidive par
--     migration est déjà bloquée par scripts/lint/check-definer-anon-surface.sh
--     (règles 1 et 2) ; changer le défaut du schéma est une décision plus large.
--   * désactiver les inscriptions GoTrue (disable_signup) : réglage du projet
--     Supabase, hors de ce dépôt — recommandé à l'owner dans la PR.
--
-- IDEMPOTENT ET REJOUABLE : uniquement SET LOCAL, REVOKE et deux blocs DO en
-- lecture de catalogue. Un REVOKE sur un droit déjà retiré est un no-op.
--
-- APPLICATION : par le moteur du dépôt uniquement (Actions → « 🗄️ Apply
-- Supabase migrations (manual) », only_ids = cet identifiant), après fusion sur
-- main — jamais par un canal qui contourne infra.schema_migrations.
--
-- ROLLBACK : voir le bloc en fin de fichier.
-- =============================================================================

-- Pas de BEGIN/COMMIT explicite : le moteur applique ce fichier dans une
-- transaction (.squawk.toml `assume_in_transaction = true`). SET LOCAL borne les
-- délais à cette transaction. La règle squawk `require-timeout-settings` est
-- satisfaite par ces deux lignes ; aucune directive d'exemption n'est posée.
-- REVOKE n'écrit qu'une ligne de pg_proc et ne verrouille aucune table de
-- données : 30 s est un plafond large pour une attente de verrou sur pg_proc.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- -----------------------------------------------------------------------------
-- §0 — PRÉ-CONDITIONS FAIL-CLOSED (lecture de catalogue uniquement)
-- -----------------------------------------------------------------------------
-- (a) Les 12 fonctions de rendu public ont toujours EXECUTE pour anon : c'est
--     l'état de départ caractérisé le 17/09. S'il a changé, on avorte.
-- (b) Les deux appelantes imbriquées hors lot sont toujours SECURITY DEFINER et
--     possédées par postgres : c'est la prémisse de « impact nul » ci-dessus.
DO $precheck$
DECLARE
  v_fn regprocedure;
BEGIN
  FOREACH v_fn IN ARRAY ARRAY[
    'public.get_homepage_families()'::regprocedure,
    'public.get_homepage_data_optimized()'::regprocedure,
    'public.get_gamme_page_data_cached(integer)'::regprocedure,
    'public.get_vehicle_page_data_cached(integer)'::regprocedure,
    'public.get_r1_related_blocks_cached(integer)'::regprocedure,
    'public.get_piece_detail(integer)'::regprocedure,
    'public.get_brand_page_data_optimized(integer)'::regprocedure,
    'public.get_seo_reference_by_slug(text)'::regprocedure,
    'public.get_soft_404_alternatives(bigint, bigint, integer)'::regprocedure,
    'public.get_substitution_data(text, text, text, text, integer)'::regprocedure,
    'public.rm_get_page_complete_v2(integer, bigint, integer)'::regprocedure,
    'public.resolve_type_id_remap(integer)'::regprocedure
  ]
  LOOP
    IF NOT has_function_privilege('anon', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION
        'ABORT: % (chemin de rendu public) a deja perdu EXECUTE pour anon — etat de depart non caracterise, re-auditer avant d appliquer', v_fn;
    END IF;
  END LOOP;

  FOREACH v_fn IN ARRAY ARRAY[
    'public.build_gamme_page_payload(integer)'::regprocedure,
    'public.check_agent_write_allowed(text, text)'::regprocedure
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_proc p
      WHERE p.oid = v_fn
        AND p.prosecdef
        AND p.proowner = 'postgres'::regrole
    ) THEN
      RAISE EXCEPTION
        'ABORT: % n est plus SECURITY DEFINER possedee par postgres — ses appels imbriques dependraient de l appelant, re-auditer avant d appliquer', v_fn;
    END IF;
  END LOOP;
END
$precheck$;

-- -----------------------------------------------------------------------------
-- §1 — FERMETURE : 72 fonctions, révoquées pour PUBLIC / anon / authenticated
-- -----------------------------------------------------------------------------
-- Aucun GRANT à service_role : son entrée est déjà explicite dans proacl sur les
-- 72 ; §2 vérifie qu'elle est intacte au lieu de la ré-écrire.

-- §1.1 — DDL et opérations destructives (8)
REVOKE ALL ON FUNCTION public.create_index_async(text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_composite_index_async(text, text[], text[], text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_rm_listing_products_partition(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ensure_rm_partition(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.switch_to_next(character varying) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rollback_switch(character varying) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prepare_shadow_tables(integer, character varying) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cleanup_old_pipeline_logs(integer) FROM PUBLIC, anon, authenticated;

-- §1.2 — break-glass de la garde d'écriture des agents (4)
REVOKE ALL ON FUNCTION public.grant_breakglass(text, text, text, text[], integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.revoke_breakglass(bigint, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_breakglass(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.list_active_breakglass() FROM PUBLIC, anon, authenticated;

-- §1.3 — pipeline d'import : lots, décisions, quarantaine, portes (38)
REVOKE ALL ON FUNCTION public.acquire_import_lock() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_import_lock() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.run_import_pipeline(integer, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_import_batch(character varying, character varying, character varying, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finalize_import_batch(integer, character varying) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_batch_contract(integer, character varying, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_batch_contract_v2(integer, character varying, integer, text[], jsonb, jsonb, character varying) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_batch_contract(integer, integer, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.execute_diff_apply_workflow(integer, character varying, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_pipeline_step(integer, character varying, jsonb, character varying, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_pipeline_step(integer, character varying, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_pipeline_event(integer, character varying, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.build_article_decisions(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.build_brand_decisions(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_decisions_shadow(integer, character varying) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_shadow(integer, character varying) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.move_decisions_to_quarantine(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.add_to_quarantine(integer, character varying, character varying, character varying, jsonb, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_quarantine_rules(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resolve_quarantine_item(integer, character varying, character varying, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_quarantined(character varying, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.normalize_batch_brands(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resolve_batch_brands(integer, character varying) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resolve_brand_multilevel(character varying, character varying, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_or_create_brand_nk(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.populate_golden_set(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.init_import_gates(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_gate(integer, integer, boolean, jsonb, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_gate_g0(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_gate_g1(integer, character varying) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_gate_g2(integer, character varying) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_gate_g3(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_gate_g4(integer, character varying) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_all_gates(integer, character varying) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.all_gates_passed(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.can_merge_batch(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_manifest_complete(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_anti_purge(text, integer, numeric) FROM PUBLIC, anon, authenticated;

-- §1.4 — rapports et listes d'exclusion (9)
REVOKE ALL ON FUNCTION public.get_batch_report(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_decision_report(integer, character varying) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_import_gate_report(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_nk_stats() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_observe_only_impact_stats(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_quarantine_dashboard(character varying, character varying, integer, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_quarantine_stats() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_purchase_excluded_ids() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_seo_excluded_ids(character varying) FROM PUBLIC, anon, authenticated;

-- §1.5 — lecture catalogue, RM et diagnostic (13). Les appelants du backend
-- passent par SupabaseBaseService (service_role / anon) : inchangés.
REVOKE ALL ON FUNCTION public.get_gamme_page_data_optimized(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_brand_bestsellers_optimized(integer, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_oem_refs_for_vehicle(integer, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_pieces_for_type_gamme(integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_pieces_for_type_gamme_v2(integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_pieces_for_type_gamme_v3(integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_pieces_for_type_gamme_v4(integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rm_get_listing_page(integer, bigint, jsonb, text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rm_get_page_complete(integer, bigint, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rm_health() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.diagnose_symptoms(text[], jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_context_questions(character varying) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_symptoms_by_subsystem(character varying) FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- §2 — POST-CONDITIONS FAIL-CLOSED (annulent la transaction si l'état diffère)
-- -----------------------------------------------------------------------------
--   (a) les 72 ont perdu EXECUTE pour PUBLIC, anon et authenticated, et l'ont
--       CONSERVÉ pour service_role et postgres. Un REVOKE émis par un rôle qui
--       n'a pas accordé le droit est un NO-OP qui ne lève qu'un avertissement :
--       sans cette assertion, la migration passerait « verte » sans rien fermer.
--   (b) les 12 fonctions de rendu ont TOUJOURS EXECUTE pour anon — garde
--       anti-sur-révocation.
DO $postcheck$
DECLARE
  v_fn regprocedure;
  v_n  integer := 0;
BEGIN
  FOREACH v_fn IN ARRAY ARRAY[
    'public.create_index_async(text, text, text, text)'::regprocedure,
    'public.create_composite_index_async(text, text[], text[], text)'::regprocedure,
    'public.create_rm_listing_products_partition(integer)'::regprocedure,
    'public.ensure_rm_partition(integer)'::regprocedure,
    'public.switch_to_next(character varying)'::regprocedure,
    'public.rollback_switch(character varying)'::regprocedure,
    'public.prepare_shadow_tables(integer, character varying)'::regprocedure,
    'public.cleanup_old_pipeline_logs(integer)'::regprocedure,
    'public.grant_breakglass(text, text, text, text[], integer)'::regprocedure,
    'public.revoke_breakglass(bigint, text)'::regprocedure,
    'public.check_breakglass(text, text)'::regprocedure,
    'public.list_active_breakglass()'::regprocedure,
    'public.acquire_import_lock()'::regprocedure,
    'public.release_import_lock()'::regprocedure,
    'public.run_import_pipeline(integer, boolean)'::regprocedure,
    'public.create_import_batch(character varying, character varying, character varying, jsonb)'::regprocedure,
    'public.finalize_import_batch(integer, character varying)'::regprocedure,
    'public.create_batch_contract(integer, character varying, integer)'::regprocedure,
    'public.create_batch_contract_v2(integer, character varying, integer, text[], jsonb, jsonb, character varying)'::regprocedure,
    'public.update_batch_contract(integer, integer, integer, integer)'::regprocedure,
    'public.execute_diff_apply_workflow(integer, character varying, boolean)'::regprocedure,
    'public.complete_pipeline_step(integer, character varying, jsonb, character varying, text)'::regprocedure,
    'public.fail_pipeline_step(integer, character varying, text, jsonb)'::regprocedure,
    'public.log_pipeline_event(integer, character varying, jsonb)'::regprocedure,
    'public.build_article_decisions(integer)'::regprocedure,
    'public.build_brand_decisions(integer)'::regprocedure,
    'public.apply_decisions_shadow(integer, character varying)'::regprocedure,
    'public.validate_shadow(integer, character varying)'::regprocedure,
    'public.move_decisions_to_quarantine(integer)'::regprocedure,
    'public.add_to_quarantine(integer, character varying, character varying, character varying, jsonb, integer, integer)'::regprocedure,
    'public.apply_quarantine_rules(integer)'::regprocedure,
    'public.resolve_quarantine_item(integer, character varying, character varying, text, integer)'::regprocedure,
    'public.is_quarantined(character varying, integer)'::regprocedure,
    'public.normalize_batch_brands(integer)'::regprocedure,
    'public.resolve_batch_brands(integer, character varying)'::regprocedure,
    'public.resolve_brand_multilevel(character varying, character varying, text, integer)'::regprocedure,
    'public.get_or_create_brand_nk(text, integer)'::regprocedure,
    'public.populate_golden_set(integer)'::regprocedure,
    'public.init_import_gates(integer)'::regprocedure,
    'public.check_gate(integer, integer, boolean, jsonb, text)'::regprocedure,
    'public.check_gate_g0(integer)'::regprocedure,
    'public.check_gate_g1(integer, character varying)'::regprocedure,
    'public.check_gate_g2(integer, character varying)'::regprocedure,
    'public.check_gate_g3(integer)'::regprocedure,
    'public.check_gate_g4(integer, character varying)'::regprocedure,
    'public.check_all_gates(integer, character varying)'::regprocedure,
    'public.all_gates_passed(integer)'::regprocedure,
    'public.can_merge_batch(integer)'::regprocedure,
    'public.check_manifest_complete(integer)'::regprocedure,
    'public.check_anti_purge(text, integer, numeric)'::regprocedure,
    'public.get_batch_report(integer)'::regprocedure,
    'public.get_decision_report(integer, character varying)'::regprocedure,
    'public.get_import_gate_report(integer)'::regprocedure,
    'public.get_nk_stats()'::regprocedure,
    'public.get_observe_only_impact_stats(integer)'::regprocedure,
    'public.get_quarantine_dashboard(character varying, character varying, integer, integer, integer)'::regprocedure,
    'public.get_quarantine_stats()'::regprocedure,
    'public.get_purchase_excluded_ids()'::regprocedure,
    'public.get_seo_excluded_ids(character varying)'::regprocedure,
    'public.get_gamme_page_data_optimized(integer)'::regprocedure,
    'public.get_brand_bestsellers_optimized(integer, integer, integer)'::regprocedure,
    'public.get_oem_refs_for_vehicle(integer, integer, text)'::regprocedure,
    'public.get_pieces_for_type_gamme(integer, integer)'::regprocedure,
    'public.get_pieces_for_type_gamme_v2(integer, integer)'::regprocedure,
    'public.get_pieces_for_type_gamme_v3(integer, integer)'::regprocedure,
    'public.get_pieces_for_type_gamme_v4(integer, integer)'::regprocedure,
    'public.rm_get_listing_page(integer, bigint, jsonb, text, integer, integer)'::regprocedure,
    'public.rm_get_page_complete(integer, bigint, integer)'::regprocedure,
    'public.rm_health()'::regprocedure,
    'public.diagnose_symptoms(text[], jsonb)'::regprocedure,
    'public.get_context_questions(character varying)'::regprocedure,
    'public.get_symptoms_by_subsystem(character varying)'::regprocedure
  ]
  LOOP
    v_n := v_n + 1;
    IF has_function_privilege('public', v_fn, 'EXECUTE')
       OR has_function_privilege('anon', v_fn, 'EXECUTE')
       OR has_function_privilege('authenticated', v_fn, 'EXECUTE')
       OR NOT has_function_privilege('service_role', v_fn, 'EXECUTE')
       OR NOT has_function_privilege('postgres', v_fn, 'EXECUTE')
    THEN
      RAISE EXCEPTION 'ABORT: droits EXECUTE inattendus apres fermeture sur %', v_fn;
    END IF;
  END LOOP;

  -- La liste ci-dessus doit rester alignée sur §1 : 72 entrées, pas une de moins.
  IF v_n <> 72 THEN
    RAISE EXCEPTION 'ABORT: postcheck couvre % fonctions, 72 attendues', v_n;
  END IF;

  FOREACH v_fn IN ARRAY ARRAY[
    'public.get_homepage_families()'::regprocedure,
    'public.get_homepage_data_optimized()'::regprocedure,
    'public.get_gamme_page_data_cached(integer)'::regprocedure,
    'public.get_vehicle_page_data_cached(integer)'::regprocedure,
    'public.get_r1_related_blocks_cached(integer)'::regprocedure,
    'public.get_piece_detail(integer)'::regprocedure,
    'public.get_brand_page_data_optimized(integer)'::regprocedure,
    'public.get_seo_reference_by_slug(text)'::regprocedure,
    'public.get_soft_404_alternatives(bigint, bigint, integer)'::regprocedure,
    'public.get_substitution_data(text, text, text, text, integer)'::regprocedure,
    'public.rm_get_page_complete_v2(integer, bigint, integer)'::regprocedure,
    'public.resolve_type_id_remap(integer)'::regprocedure
  ]
  LOOP
    IF NOT has_function_privilege('anon', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION
        'ABORT: sur-revocation — % (chemin de rendu public) a perdu EXECUTE pour anon', v_fn;
    END IF;
  END LOOP;
END
$postcheck$;

-- =============================================================================
-- Vérification post-migration (lecture seule, à jouer après apply)
-- =============================================================================
--   -- 1. fonctions DEFINER de public encore exécutables par authenticated
--   SELECT p.oid::regprocedure AS fn,
--          has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_aussi
--     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--    WHERE n.nspname = 'public' AND p.prosecdef
--      AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
--    ORDER BY 1;
--   -- attendu : exactement les 12 fonctions de scripts/lint/definer-anon-allowlist.txt,
--   -- toutes avec anon_aussi = true. Toute autre ligne est une fonction apparue
--   -- depuis le 2026-09-29 (hors migration, puisque la garde CI bloque ce cas) :
--   -- à fermer par un lot forward, pas à ignorer.
--
--   -- 2. advisor Supabase « authenticated_security_definer_function_executable »
--   -- (get_advisors type security) : 72 entrées de moins qu'avant application.
--
-- =============================================================================
-- ROLLBACK — pas de .down.sql : un .down.sql rouvrirait à tout compte GoTrue
-- l'exécution de DDL et du break-glass, ce qui est exactement ce qu'on ferme.
-- Si un appelant légitime utilisant le rôle authenticated est identifié,
-- ré-accorder EXECUTE à son SEUL rôle réel, dans une migration forward, en
-- documentant l'appelant :
--   GRANT EXECUTE ON FUNCTION public.<fn>(<args>) TO <role de l appelant>;
-- Ne JAMAIS revenir à `TO PUBLIC` ni `TO authenticated` (règle 2 de
-- scripts/lint/check-definer-anon-surface.sh).
-- =============================================================================
