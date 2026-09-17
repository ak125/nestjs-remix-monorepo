-- =============================================================================
-- Migration : fermeture de l'exécution `anon` sur les RPC SECURITY DEFINER de public
-- Date      : 2026-09-17
-- Severity  : CRITICAL (advisor anon_/authenticated_security_definer_function_executable)
-- Scope     : droits EXECUTE de 35 fonctions de `public`, + search_path de 2 d'entre
--             elles. AUCUN corps de fonction n'est réécrit, aucune table n'est
--             touchée, aucun job pg_cron n'est modifié, aucun objet n'est supprimé.
-- Forward-only. Ne réécrit AUCUNE migration historique.
-- =============================================================================
--
-- CONTEXTE
-- --------
-- 47 fonctions SECURITY DEFINER de `public` sont exécutables par `anon`. La clé
-- anon est PUBLIQUE par construction : c'est une clé publishable
-- (`sb_publishable_…`, 35 car.) que PostgREST accepte de TOUT porteur. Dans CE
-- dépôt elle n'est pas dans le bundle navigateur — vérifié : 0 occurrence sur
-- frontend/build/client, aucune dépendance `@supabase/*` dans
-- frontend/package.json, 0 `.rpc(` dans frontend/app — mais rien n'empêche sa
-- diffusion, et le risque n'en dépend pas. PostgREST expose ces fonctions
-- sur /rest/v1/rpc/<nom> en CONTOURNANT
-- entièrement le backend NestJS : tout garde `@UseGuards(IsAdminGuard)` posé côté
-- HTTP est sans effet sur ce chemin.
--
-- CAUSE RACINE — ce n'est pas une décision, c'est un défaut de privilèges par
-- défaut. Preuve dans le dépôt : 20260529_seo_cwv_dashboard_rpcs.sql accorde
-- EXECUTE à service_role UNIQUEMENT (lignes 89 et 168) pour get_cwv_dashboard et
-- get_cwv_funnel_correlation ; ces deux fonctions portent pourtant aujourd'hui
-- `=X/postgres` (PUBLIC), anon et authenticated dans leur proacl. L'auteur avait
-- écrit la bonne chose ; les privilèges par défaut Supabase ont ajouté le reste.
-- 34 des 35 n'ont jamais reçu de GRANT anon explicite : leur entrée anon vient
-- des privilèges par défaut. LA 35e EST UNE EXCEPTION ASSUMÉE —
-- track_soft_404_event reçoit anon explicitement de
-- 20260518180000_soft_404_rpcs.sql:281-283 (balise soft-404 R2, ADR-076), et son
-- proacl ne porte AUCUNE entrée PUBLIC `=X/postgres` : la preuve que ce grant est
-- une décision, pas une dérive. Pour elle, §8 ne corrige pas un défaut de
-- privilège, il RENVERSE cette décision. C'est assumé (télémétrie PROD intacte en
-- service_role, perte en PREPROD seulement, cf. §8) et signalé nominativement à
-- l'owner dans le corps de la PR.
-- → garde anti-récidive : scripts/lint/check-definer-anon-surface.sh
--
-- CLASSEMENT — 47 = 35 fermées + 12 laissées publiques
-- ---------------------------------------------------
-- 12 fonctions restent exécutables par anon car elles SONT le chemin de rendu des
-- pages publiques (catalogue R1/R2/R8, home, fiche pièce, marque, encyclopédie) :
--   get_homepage_families, get_homepage_data_optimized, get_gamme_page_data_cached,
--   get_vehicle_page_data_cached, get_r1_related_blocks_cached, get_piece_detail,
--   get_brand_page_data_optimized, get_seo_reference_by_slug,
--   get_soft_404_alternatives, get_substitution_data, rm_get_page_complete_v2,
--   resolve_type_id_remap.
-- Elles sont listées, avec leur motif, dans scripts/lint/definer-anon-allowlist.txt.
-- `resolve_type_id_remap` n'est PAS touchée ici : sa surface a déjà été arbitrée et
-- durcie par 20260907_tecdoc_api_surface_lockdown.sql (PUBLIC et authenticated déjà
-- retirés, anon délibérément conservé pour le 301 legacy). Cette migration ne
-- rouvre ni ne referme cet arbitrage.
--
-- POURQUOI `anon` EST LE SEUL RÔLE RÉELLEMENT EMPRUNTÉ — et pourquoi révoquer
-- `authenticated` ne peut rien casser : le backend ne s'authentifie qu'en
-- service_role (PROD/DEV) ou en anon (PREPROD READ_ONLY, ADR-028 Option D,
-- backend/src/database/services/supabase-base.service.ts). L'authentification
-- applicative est Passport + express-session/Redis, jamais Supabase Auth, et le
-- frontend n'instancie aucun client supabase-js navigateur
-- (`grep -rn '\.rpc(' frontend/app` = 0 occurrence). Le rôle `authenticated`
-- n'est emprunté par aucun chemin du produit.
--
-- IMPACT PROD : NUL — mais PAS parce que « le container PROD s'authentifie avec
-- la service key », ce qui serait inexact. SupabaseBaseService, oui. En revanche
-- header.service.ts:48 et footer.service.ts:62 instancient un client ANON
-- INCONDITIONNEL, hors getEffectiveSupabaseKey(), et rendent le header/footer de
-- toutes les pages, y compris en PROD (deploy-prod.yml:249-251 réécrit bien
-- SUPABASE_ANON_KEY dans le .env du container). Ces clients n'atteignent que des
-- endpoints de TABLE — `.from('layout_sections')`, `.from(TABLES.footer_menu)`,
-- `.from('social_share_configs')`, `.from(TABLES.xtr_customer)` — et ZÉRO `.rpc()`,
-- donc aucune des 35. L'impact est nul pour CETTE raison. Les 35 conservent par
-- ailleurs EXECUTE pour service_role.
--
-- IMPACT PREPROD (container CI, anon) : un seul changement observable, sur
-- track_soft_404_event (étape « Soft-404 R2 smoke »). La chaîne dégrade proprement
-- à trois niveaux — le tracker capte l'erreur et se contente d'un `warn`
-- (rm-soft404-tracker.service.ts:81-84, warn l.82), le contrôleur répond 204 quoi qu'il
-- arrive, et l'appel front est fire-and-forget `.catch(() => {})`. Aucune
-- assertion de scripts/ci/assert-soft-404.py ne porte sur la balise. Conséquence
-- honnête : perte de la télémétrie soft-404 EN PREPROD UNIQUEMENT + de l'ordre de
-- 10 à 80 warns `Soft-404 track RPC failed` par run — PAS un par fixture. Le
-- throttle Redis de rm-soft404-tracker.service.ts n'est posé qu'APRÈS un appel
-- réussi : en échec aucune clé n'est écrite, donc aucun rendu suivant n'est
-- throttlé, et warm-soft-404-fixtures.sh interroge chaque fixture jusqu'à ~15 fois
-- (poll 2 s / deadline 30 s) avant la boucle d'assertion. Aucune assertion CI ne
-- tombe pour autant. C'est pourquoi cette fonction est révoquée en DERNIÈRE étape (§8) :
-- toute anomalie du smoke reste ainsi attribuable sans ambiguïté.
-- Les chemins __seo_outbox_claim_batch / __seo_r8_publish_snapshot ne sont PAS
-- exercés en PREPROD : la garde READ_ONLY est posée dans le processor appelant
-- (r8-enrichment.processor.ts:72 et :143, canon
-- `feedback_readonly_gate_at_processor_not_scheduler`), pas dans le scheduler.
--
-- ORDONNANCEMENT : §1 révoque auth_resolve_user SEULE, en tête, pour qu'un
-- rollback partiel après cette seule étape reste possible. Les étapes suivantes
-- sont sans dépendance entre elles (voir la note « appel imbriqué » en §5).
--
-- IDEMPOTENT ET REJOUABLE : uniquement SET LOCAL, REVOKE, GRANT, ALTER FUNCTION
-- ... SET search_path et deux blocs DO en lecture de catalogue. Un REVOKE sur un
-- droit déjà retiré est un no-op ; un GRANT déjà présent est un no-op ; un ALTER
-- SET search_path déjà posé est un no-op.
--
-- ROLLBACK : voir le bloc en fin de fichier.
-- =============================================================================

-- Pas de BEGIN/COMMIT explicite : le moteur applique ce fichier dans une
-- transaction (.squawk.toml `assume_in_transaction = true` ; chemin transactionnel
-- d'apply-supabase-migration.py). Un BEGIN ici serait imbriqué et squawk
-- `transaction-nesting` le refuserait, à raison. SET LOCAL borne les délais à
-- cette transaction et ne déborde pas sur les migrations suivantes du même run.
--
-- La règle squawk `require-timeout-settings` est satisfaite par les deux SET LOCAL
-- ci-dessous. AUCUNE directive d'exemption n'est posée dans ce fichier, nulle part :
-- la garde a été exécutée sur ce fichier et elle ne dit rien à faire taire
-- (`npx squawk -c .squawk.toml <fichier>` → 0 issue). Aucune opération de cette
-- migration n'est longue — REVOKE, GRANT et ALTER FUNCTION ... SET n'écrivent
-- qu'une ligne de pg_proc et ne prennent aucun verrou sur une table de données.
-- 30 s est donc un plafond large, pas une limite serrée : il borne une attente de
-- verrou sur pg_proc, pas un traitement lourd.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- -----------------------------------------------------------------------------
-- §0 — PRÉ-CONDITION FAIL-CLOSED
-- -----------------------------------------------------------------------------
-- Les 12 fonctions laissées publiques servent le rendu des pages. Si l'une avait
-- déjà perdu son EXECUTE anon avant ce run, l'état de départ n'est pas celui sur
-- lequel le classement a été fait : on avorte plutôt que d'empiler une seconde
-- modification sur un état non caractérisé. Lecture de catalogue uniquement —
-- aucune fonction applicative n'est appelée.
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
END
$precheck$;

-- -----------------------------------------------------------------------------
-- PÉRIMÈTRE EXPLICITE ET DETTE OUVERTE — à ne PAS lire comme fermé
-- -----------------------------------------------------------------------------
-- (a) Ce lot ferme les 47 fonctions DEFINER de `public` exécutables par `anon`. Il
--     ne traite PAS les 72 fonctions DEFINER de `public` exécutables par
--     `authenticated` SEUL — dont check_breakglass, grant_breakglass,
--     revoke_breakglass, list_active_breakglass, create_index_async et
--     create_composite_index_async (du DDL) — qui empruntent le MÊME chemin
--     PostgREST. Le fichier argue que `authenticated` n'est emprunté par aucun
--     chemin du PRODUIT : c'est vérifié, mais cela ne prouve pas qu'un tiers ne
--     peut pas obtenir un JWT `authenticated` (état des inscriptions GoTrue non
--     lisible en SQL). À arbitrer dans un lot suivant.
-- (b) 10 des 12 fonctions laissées ouvertes à anon portent `search_path=public`
--     SANS `pg_temp` explicite — toutes sauf rm_get_page_complete_v2 et
--     resolve_type_id_remap. Le vecteur décrit en §1 les concerne donc DAVANTAGE
--     que les 2 fonctions auth, qui perdent EXECUTE anon ici. Non traité : un
--     ALTER sur le chemin de rendu R1/R2/R8 exige sa propre vérification de rendu.
-- (c) Une seule des 12 porte un `statement_timeout` (get_piece_detail, 5 s).

-- -----------------------------------------------------------------------------
-- §1 — auth_resolve_user : LA PLUS GRAVE, RÉVOQUÉE SEULE ET EN PREMIER
-- -----------------------------------------------------------------------------
-- ZONE STOP : auth.
-- SECURITY DEFINER, SANS search_path figé, exécutable par anon, et son type de
-- retour contient `password_hash`. Le corps lit `___config_admin` (comptes ADMIN)
-- EN PRIORITÉ, puis `___xtr_customer` en repli. Soumettre une adresse e-mail à
-- /rest/v1/rpc/auth_resolve_user avec la clé anon publique rend l'empreinte du mot
-- de passe du compte, administrateur compris.
--
-- Callsite RPC unique : user-data-consolidated.service.ts:594 — mais TROIS chemins
-- produit y mènent, via auth.service.ts :
--   :113  resolveUserByEmail       → login
--   :486  via checkIfUserExists()  → POST /api/orders/guest (orders.controller.ts:433,
--         @UseGuards(OptionalAuthGuard) → CHECKOUT INVITÉ, atteignable SANS
--         authentification) et GET /profile (profile.controller.ts:42)
--   :230  register
-- ZONE STOP ADDITIONNELLE : panier/commande — signalée nominativement à l'owner,
-- comme l'est déjà check_payment_tunnel_health en §7. En PROD ces trois chemins
-- tournent en service_role et ne sont pas affectés. En PREPROD le client est anon,
-- mais aucune sonde du smoke n'exerce login, register ni POST /api/orders/guest
-- (vérifié : `grep -niE 'login|register|password|/auth'` sur les 3 specs E2E → 0).
--
-- `FROM PUBLIC` est OBLIGATOIRE ici : proacl porte `=X/postgres`, c'est-à-dire un
-- GRANT à PUBLIC. Un REVOKE limité à anon, authenticated serait un NO-OP — anon
-- conserverait EXECUTE via PUBLIC.
--
-- CE QUE `FROM PUBLIC` RETIRE EN PLUS D'ANON — choix explicite, pas effet de bord.
-- 29 des 35 portent `=X/postgres`. Trois rôles NON-API détiennent EXECUTE sur ces
-- 29 par ce SEUL titre (vérifié : aucune entrée explicite dans proacl ; dev_readonly
-- est NOINHERIT et membre d'aucun rôle privilégié) :
--   dev_readonly, supabase_read_only_user, dashboard_user.
-- Aucun n'est un rôle PostgREST. Le précédent du dépôt les préserve explicitement
-- (20260907_tecdoc_api_surface_lockdown.sql:89 : « dev_readonly n'est PAS révoqué :
-- ce n'est pas un rôle API »). ICI ILS SONT FERMÉS, ET C'EST VOULU : la majorité de
-- ces 29 sont des ÉCRITURES ou de la reconnaissance de schéma (rebuild_*_page_cache,
-- seo_apply_h1_write, __gov_m1..m6) — un rôle nommé « read-only » n'a pas à les
-- exécuter, et les lui re-accorder serait le vrai défaut. Impact runtime aujourd'hui :
-- NUL (DEV_KILL_SWITCH et DEV_SUPABASE_KEY absents de backend/.env, le chemin
-- dev_readonly du backend est éteint). La post-condition §9 n'assère que service_role
-- et postgres : elle NE PEUT PAS attraper cette perte — d'où cette déclaration.
--
-- Prior art étendu, pas réinventé : docs/security/vague5-rls-drift-tail-20260616.md
-- §7 porte déjà ce REVOKE, owner-gated, jamais appliqué. Ces deux fonctions auth
-- étaient un carve-out DÉLIBÉRÉ des migrations 20260616_vague5_* — c'est
-- précisément pourquoi elles sont, aujourd'hui encore, les deux seules des 47
-- sans search_path figé.
REVOKE ALL ON FUNCTION public.auth_resolve_user(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auth_resolve_user(text)
  TO service_role;

-- Cause racine du vecteur d'escalade, traitée ici et pas seulement contournée.
-- Le corps référence `___config_admin` et `___xtr_customer` SANS qualification de
-- schéma ; `SET search_path = ''` casserait donc la fonction. `SET search_path =
-- public` seul serait insuffisant : pg_temp resterait implicitement PRIORITAIRE,
-- et un appelant pourrait créer une table temporaire `___config_admin` détournant
-- une fonction qui s'exécute en tant que postgres. Nommer pg_temp EXPLICITEMENT
-- le place en DERNIER et supprime ce vecteur, corps inchangé. Motif déjà présent
-- dans la base : rm_get_page_complete_v2 porte `search_path=public, pg_temp`.
ALTER FUNCTION public.auth_resolve_user(text)
  SET search_path = public, pg_temp;

-- -----------------------------------------------------------------------------
-- §2 — auth_email_exists : oracle d'énumération d'adresses (même famille)
-- -----------------------------------------------------------------------------
-- ZONE STOP : auth.
-- `RETURN EXISTS (SELECT 1 FROM ___config_admin …) OR EXISTS (… ___xtr_customer …)`.
-- Couplée à §1, elle transforme une liste d'adresses en liste d'empreintes.
-- Callsite RPC unique : user-data-consolidated.service.ts:627, atteinte par
-- auth.service.ts:481 (checkIfUserExists) — donc par les MÊMES chemins qu'en §1,
-- checkout invité compris (ZONE STOP panier/commande). Même démonstration
-- d'innocuité PREPROD qu'en §1.
REVOKE ALL ON FUNCTION public.auth_email_exists(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auth_email_exists(text)
  TO service_role;

ALTER FUNCTION public.auth_email_exists(text)
  SET search_path = public, pg_temp;

-- -----------------------------------------------------------------------------
-- §3 — Écritures sur le contenu SEO INDEXÉ (zone STOP : SEO indexé)
-- -----------------------------------------------------------------------------
-- seo_apply_h1_write : construit un UPDATE dynamique
--   format('UPDATE %I SET %I = $1 WHERE %I::text = $2', …) EXECUTE … USING p_h1_value, p_target_id_value
-- La whitelist ne borne QUE le couple (table, colonne) ; p_target_id_value et
-- p_h1_value sont LIBRES. Un porteur de la clé anon réécrit donc le H1 indexé de
-- n'importe quelle page gamme et insère une fausse trace d'audit 'allow' dans
-- __seo_policy_evaluations et __seo_content_events. Zéro appelant runtime dans
-- tout le dépôt (seule occurrence : un type généré). Viole
-- `feedback_no_touch_meta_h1_if_optimized`.
--
-- __seo_r8_publish_snapshot : INSERT __seo_r8_snapshot_store, puis
--   repointe ensuite la colonne current_snapshot_id de `__seo_r8_pages`
--   (WHERE type_id = p_type_id),
-- puis INSERT __seo_outbox_event. __seo_r8_pages est une table SERVIE
-- (backend/src/config/field-catalog.constants.ts:1250-1307, champs r8_vehicle_main).
-- Un anon peut faire pointer la fiche véhicule indexée de n'importe quel type_id
-- vers un snapshot qu'il fabrique. Appelant : r8-parent-enrichment.service.ts:184,
-- worker BullMQ court-circuité en READ_ONLY.
--
-- append_gamme_alias : UPDATE __rag_knowledge SET gamme_aliases =
--   array_append(…) WHERE source LIKE p_source_prefix || '%' AND status='active'.
-- Le prédicat LIKE est contrôlé par l'appelant : p_source_prefix = '' touche TOUT
-- le corpus RAG actif en un appel. Contredit l'invariant RAW → WIKI → DB (ADR-046,
-- RAG = couche consommatrice, zéro autorité d'écriture contenu).
REVOKE ALL ON FUNCTION public.seo_apply_h1_write(text, text, text, text, text, text, text, text, jsonb, text, text, text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seo_apply_h1_write(text, text, text, text, text, text, text, text, jsonb, text, text, text, jsonb)
  TO service_role;

REVOKE ALL ON FUNCTION public.__seo_r8_publish_snapshot(bigint, text, jsonb, text, jsonb, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.__seo_r8_publish_snapshot(bigint, text, jsonb, text, jsonb, text)
  TO service_role;

REVOKE ALL ON FUNCTION public.append_gamme_alias(text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.append_gamme_alias(text, text)
  TO service_role;

-- -----------------------------------------------------------------------------
-- §4 — Surface de contrôle d'administration SEO (file de jobs + outbox)
-- -----------------------------------------------------------------------------
-- Les trois sont atteintes, côté HTTP, par des routes @UseGuards(IsAdminGuard)
-- (r2-r8-seed-runner.controller.ts:42-47). Ce garde ne protège RIEN sur le chemin
-- PostgREST, qui contourne NestJS — d'où la fermeture au niveau du privilège.
--   __seo_admin_job_accept    : INSERT __seo_admin_job, `p_actor` est une chaîne
--                               LIBRE → usurpation d'identité dans la piste d'audit.
--   __seo_admin_job_transition: UPDATE __seo_admin_job (status/result/error) et
--                               RETOURNE la ligne complète → pilotage et fuite.
--   __seo_outbox_claim_batch  : UPDATE __seo_outbox_event SET published_at = NOW()
--                               sur jusqu'à 500 lignes, et retourne leur payload →
--                               perte IRRÉVERSIBLE d'événements + exfiltration.
-- Ces trois n'ont PAS de grant PUBLIC dans proacl ; `FROM PUBLIC` reste écrit pour
-- l'uniformité et l'idempotence (no-op sur une entrée absente).
REVOKE ALL ON FUNCTION public.__seo_admin_job_accept(text, text, jsonb, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.__seo_admin_job_accept(text, text, jsonb, text, text)
  TO service_role;

REVOKE ALL ON FUNCTION public.__seo_admin_job_transition(uuid, text, jsonb, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.__seo_admin_job_transition(uuid, text, jsonb, text)
  TO service_role;

REVOKE ALL ON FUNCTION public.__seo_outbox_claim_batch(integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.__seo_outbox_claim_batch(integer)
  TO service_role;

-- -----------------------------------------------------------------------------
-- §5 — Écritures sur les caches de pages servies + payload builders
-- -----------------------------------------------------------------------------
-- POINT TECHNIQUE QUI REND CES SEPT RÉVOCATIONS SÛRES — et qui est exactement ce
-- que la migration large #5 de juin n'avait pas vérifié avant d'être abandonnée :
-- un appel IMBRIQUÉ à l'intérieur d'une fonction SECURITY DEFINER est contrôlé
-- contre le PROPRIÉTAIRE de l'appelante, pas contre l'appelant d'origine.
-- Vérifié sur la base : get_gamme_page_data_cached, get_vehicle_page_data_cached,
-- refresh_stale_*_cache, mark_stale_with_followup_rebuild et les 4 triggers
-- trg_invalidate_r1_* sont tous prosecdef = true et proowner = postgres. La
-- reconstruction paresseuse du cache R1/R8 sur le chemin de LECTURE public
-- continue donc de fonctionner à l'identique après ces révocations : elle passe
-- par les wrappers `get_*_page_data_cached`, qui restent exécutables par anon (§0).
-- Seuls les appels DIRECTS depuis un rôle API sont fermés.
--
--   rebuild_gamme_page_cache / rebuild_vehicle_page_cache : INSERT … ON CONFLICT
--     DO UPDATE, et `DELETE FROM __{gamme,vehicle}_page_cache WHERE …` quand le
--     payload est NULL — suppression d'entrées de cache de pages INDEXÉES, plus
--     amplification CPU (un rebuild complet par appel). Appelants applicatifs :
--     routes admin-guardées uniquement.
--   refresh_stale_gamme_cache / refresh_stale_vehicle_cache : bouclent
--     `PERFORM rebuild_*_page_cache(...)`. p_batch_size n'est borné QUE PAR LE BAS
--     (`LIMIT GREATEST(p_batch_size, 1)`) : les plafonds 500 / 2000 vivent dans les
--     contrôleurs HTTP et sont totalement contournés par un appel PostgREST direct.
--     refresh_stale_gamme_cache est aussi appelée par le job pg_cron
--     `refresh-stale-gamme-cache` (*/10 * * * *) — le scheduler s'exécute sous
--     postgres, PAS sous anon : le cron continue de tourner après ce REVOKE. C'est
--     le raisonnement déjà validé et APPLIQUÉ sans casse par
--     20260616_vague5_revoke_safe_trigger_cron_execute.sql:21-27 pour 6 fonctions cron.
--   mark_stale_with_followup_rebuild : UPDATE __vehicle_page_cache SET stale=TRUE
--     puis, si p_rebuild_immediately, une boucle FOREACH de rebuilds SYNCHRONES sur
--     un tableau de type_id non borné → déni de service CPU sur l'instance
--     Supabase PARTAGÉE entre PROD et PREPROD. Zéro appelant applicatif.
--   invalidate_r1_caches : marque stale __gamme_page_cache et
--     __seo_r1_related_blocks_cache. Zéro appelant applicatif ; ses 4 appelants
--     sont des triggers DEFINER owned=postgres, déjà révoqués en juin.
--   build_gamme_page_payload / build_vehicle_page_payload : maillons de la chaîne
--     de construction, jamais une API ; leur seul appelant est le corps SQL de
--     rebuild_*_page_cache. build_vehicle_page_payload était l'une des 8 fonctions
--     explicitement DIFFÉRÉES par 20260616_vague5_…:30-33 (« page-render! … need
--     per-function read-path verification … deferred, NOT guessed ») : la
--     vérification manquante est faite ici, et elle est négative.
-- Zone STOP effleurée : SEO indexé (payload servi des pages R1 et R8) — en
-- FERMETURE d'écriture, jamais en modification de contenu.
REVOKE ALL ON FUNCTION public.rebuild_gamme_page_cache(integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rebuild_gamme_page_cache(integer)
  TO service_role;

REVOKE ALL ON FUNCTION public.rebuild_vehicle_page_cache(integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rebuild_vehicle_page_cache(integer)
  TO service_role;

REVOKE ALL ON FUNCTION public.refresh_stale_gamme_cache(integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_stale_gamme_cache(integer)
  TO service_role;

REVOKE ALL ON FUNCTION public.refresh_stale_vehicle_cache(integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_stale_vehicle_cache(integer)
  TO service_role;

REVOKE ALL ON FUNCTION public.mark_stale_with_followup_rebuild(integer[], text, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_stale_with_followup_rebuild(integer[], text, boolean)
  TO service_role;

REVOKE ALL ON FUNCTION public.invalidate_r1_caches(integer, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.invalidate_r1_caches(integer, text, text)
  TO service_role;

REVOKE ALL ON FUNCTION public.build_gamme_page_payload(integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.build_gamme_page_payload(integer)
  TO service_role;

REVOKE ALL ON FUNCTION public.build_vehicle_page_payload(integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.build_vehicle_page_payload(integer)
  TO service_role;

-- -----------------------------------------------------------------------------
-- §6 — Garde d'écriture des agents, DDL, et vue matérialisée
-- -----------------------------------------------------------------------------
--   check_agent_write_allowed : c'est LA garde d'écriture des agents, et elle est
--     elle-même exposée à anon. Elle lit `request.headers ->> 'x-agent-id'` et
--     `->> 'x-breakglass-token'` — deux valeurs entièrement contrôlées par
--     l'appelant HTTP — puis INSERT dans `write_scope_violations` (le journal
--     forensique lui-même : un anon peut le noyer de lignes forgées) et appelle
--     `check_breakglass(...)`. ESCALADE INDIRECTE PROUVÉE : l'ACL de
--     check_breakglass ne contient PAS anon, mais cette fonction DEFINER
--     owned=postgres la rend joignable — oracle de test de jetons break-glass.
--   resolve_agent_write_scope : renvoie le write_scope de l'agent nommé par
--     l'en-tête, ou 'DENY_ALL' — oracle de reconnaissance sur le plan
--     d'autorisation. Son unique appelant est check_agent_write_allowed, en appel
--     imbriqué DEFINER : l'ordre des deux révocations est indifférent.
--     Ces deux fonctions faisaient partie des 8 DIFFÉRÉES en juin ; leur
--     vérification de read-path est faite ici et elle est négative.
--   ensure_next_quality_history_partition : la seule DDL du lot
--     (`CREATE TABLE … PARTITION OF __seo_quality_history`). Le blast radius est
--     borné (aucun paramètre, nom dérivé de now()+1 mois, idempotente), mais du
--     DDL atteignable par une clé publishable acceptée de tout porteur par PostgREST est
--     inacceptable par principe. Chemin applicatif : route admin-guardée, ET le job
--     pg_cron `quality-history-partition-rotation` (jobid 17, `50 2 * * *`,
--     `SELECT public.ensure_next_quality_history_partition()`), qui s'exécute sous
--     `postgres` — même raisonnement qu'en §5 pour refresh_stale_gamme_cache : le
--     REVOKE ne l'affecte pas.
--   refresh_gamme_seo_dashboard : l'inventaire la classe `lecture`, c'est FAUX —
--     son corps entier est `REFRESH MATERIALIZED VIEW CONCURRENTLY
--     v_gamme_seo_dashboard`. Un anon peut marteler cet appel et saturer CPU/IO
--     d'une base de 130 Go dont le plafond de dépenses est ACTIF. Zéro appelant,
--     zéro job cron. Également DIFFÉRÉE en juin.
REVOKE ALL ON FUNCTION public.check_agent_write_allowed(text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_agent_write_allowed(text, text)
  TO service_role;

REVOKE ALL ON FUNCTION public.resolve_agent_write_scope()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_agent_write_scope()
  TO service_role;

REVOKE ALL ON FUNCTION public.ensure_next_quality_history_partition()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_next_quality_history_partition()
  TO service_role;

REVOKE ALL ON FUNCTION public.refresh_gamme_seo_dashboard()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_gamme_seo_dashboard()
  TO service_role;

-- -----------------------------------------------------------------------------
-- §7 — Lectures d'observabilité, de renseignement commercial et d'introspection
-- -----------------------------------------------------------------------------
-- Aucune de ces 14 ne sert une page publique. Elles sont regroupées parce
-- qu'elles partagent la même nature : de la donnée d'exploitation, offerte à un
-- rôle dont la clé est publishable et acceptée de tout porteur par PostgREST.
--
--   check_payment_tunnel_health — ZONE STOP : panier/commande. Agrège
--     `___xtr_order` (volume de commandes, nombre d'encaissements, date du dernier
--     paiement). Renseignement commercial direct + oracle de disponibilité du
--     tunnel de paiement : on saurait que les paiements s'arrêtent avant
--     l'exploitant. Sortie agrégée — aucun montant, aucune identité client.
--     Appelant : scripts/monitoring/check-payment-tunnel.sh, en SERVICE_ROLE
--     (fail-fast ligne 50) → non affecté. Ce REVOKE ne modifie AUCUN code du
--     module payments/ : c'est un changement de privilège, pas une modification de
--     la zone STOP — mais il porte sur la table de commandes et doit être signalé
--     nominativement à l'owner. Ce REVOKE figure déjà, mot pour mot, dans
--     docs/security/vague5-rls-drift-tail-20260616.md §7, jamais appliqué.
--   check_error_logs_5xx_threshold — renvoie `top_urls` avec, par URL,
--     `last_message` et `last_code` bruts : les messages d'exception NestJS
--     (chemins internes, fragments SQL, noms de service) et les routes qui
--     échouent, en temps réel. Carte de reconnaissance. Appelant :
--     scripts/monitoring/check-error-logs-5xx.sh, en SERVICE_ROLE → non affecté.
--   __gov_m1..m6 — introspection de pg_stat_user_{tables,indexes} : noms réels des
--     20 plus grosses tables et de leurs index, cardinalités, tables sans index
--     efficace. C'est l'étape de reconnaissance qui rend les autres DEFINER
--     exploitables sans connaissance préalable du schéma. Chemin applicatif unique :
--     @Controller('api/admin/db-governance').
--   detect_quality_outliers, get_cwv_dashboard, get_cwv_funnel_correlation —
--     tableaux de bord internes, tous derrière IsAdminGuard côté HTTP.
--     get_cwv_funnel_correlation renvoie `sessions`, `conversion_count` et
--     `conversion_rate` par bucket d'INP : le TAUX DE CONVERSION du site. Les deux
--     RPC CWV n'ont JAMAIS été censées être publiques — leur migration créatrice
--     20260529_seo_cwv_dashboard_rpcs.sql (lignes 89 et 168) n'accorde EXECUTE
--     qu'à service_role. C'est la preuve la plus nette de la cause racine.
--   rpc_seo_action_outcomes_v1 — impressions, clics, CTR et position GSC par page,
--     en baseline et en fenêtre observée, avec le type d'action menée et
--     l'allégation causale : la stratégie SEO complète de l'entreprise. Lecture
--     seule, aucune page modifiée. Zéro appelant.
--   get_supplier_unified_stats — panel fournisseurs, `pm_display` (palier de
--     visibilité commerciale) et volumes d'articles ; le bloc `breakdown` agrège
--     PAR palier SANS filtre et révèle donc aussi les fournisseurs masqués.
--     Adjacente à la zone STOP prix/stock sans y entrer : aucune colonne de
--     pieces_price n'est lue, aucun prix d'achat ni de vente n'est renvoyé.
--     Zéro appelant runtime (DIFFÉRÉE en juin, vérification faite ici).
--   get_rag_coverage_summary — compteurs du pipeline de contenu (couverture
--     éditoriale, gammes non couvertes, taux d'échec d'ingestion). Zéro appelant.
REVOKE ALL ON FUNCTION public.check_payment_tunnel_health(integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_payment_tunnel_health(integer)
  TO service_role;

REVOKE ALL ON FUNCTION public.check_error_logs_5xx_threshold(integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_error_logs_5xx_threshold(integer, integer)
  TO service_role;

REVOKE ALL ON FUNCTION public.__gov_m1_table_sizes()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.__gov_m1_table_sizes()
  TO service_role;

REVOKE ALL ON FUNCTION public.__gov_m2_index_sizes()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.__gov_m2_index_sizes()
  TO service_role;

REVOKE ALL ON FUNCTION public.__gov_m3_stale_stats()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.__gov_m3_stale_stats()
  TO service_role;

REVOKE ALL ON FUNCTION public.__gov_m4_dead_tuples()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.__gov_m4_dead_tuples()
  TO service_role;

REVOKE ALL ON FUNCTION public.__gov_m5_seq_scans()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.__gov_m5_seq_scans()
  TO service_role;

REVOKE ALL ON FUNCTION public.__gov_m6_unused_indexes()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.__gov_m6_unused_indexes()
  TO service_role;

REVOKE ALL ON FUNCTION public.detect_quality_outliers(integer, numeric, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.detect_quality_outliers(integer, numeric, text, text)
  TO service_role;

REVOKE ALL ON FUNCTION public.get_cwv_dashboard(date, date, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_cwv_dashboard(date, date, text)
  TO service_role;

REVOKE ALL ON FUNCTION public.get_cwv_funnel_correlation(timestamp with time zone, timestamp with time zone)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_cwv_funnel_correlation(timestamp with time zone, timestamp with time zone)
  TO service_role;

REVOKE ALL ON FUNCTION public.rpc_seo_action_outcomes_v1(timestamp with time zone, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_seo_action_outcomes_v1(timestamp with time zone, integer, integer)
  TO service_role;

REVOKE ALL ON FUNCTION public.get_supplier_unified_stats(text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_supplier_unified_stats(text, text)
  TO service_role;

REVOKE ALL ON FUNCTION public.get_rag_coverage_summary()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_rag_coverage_summary()
  TO service_role;

-- -----------------------------------------------------------------------------
-- §8 — track_soft_404_event : LE SEUL CHANGEMENT OBSERVABLE EN PREPROD, EN DERNIER
-- -----------------------------------------------------------------------------
-- Placée seule et en fin de fichier volontairement : c'est la seule des 35 dont la
-- révocation modifie un comportement observé en PREPROD, donc toute anomalie du
-- smoke après application lui est attribuable sans ambiguïté.
--
-- Ce qui EST une balise publique ici, c'est la ROUTE HTTP
-- `POST /api/rm/alternatives/track-soft-404` (rm.controller.ts:329, sans
-- @UseGuards) — PAS la RPC. Le navigateur n'invoque jamais cette RPC : c'est un
-- loader SSR qui appelle la route, et le backend qui appelle la RPC. anon n'a donc
-- aucun besoin d'EXECUTE en PROD.
--
-- Coût du statu quo : le seul contrôle du corps est un RAISE EXCEPTION si
-- p_ua_class ∉ (bot|browser|unknown) ; p_pg_id, p_type_id et p_referrer sont libres
-- et non authentifiés → inondation de `__soft_404_events` avec de faux événements,
-- donc contamination du signal soft-404 R2 qui alimente des décisions SEO.
--
-- Conséquence honnête après application, déjà détaillée en tête de fichier : perte
-- de la télémétrie soft-404 DANS LE CONTAINER PREPROD + un `warn` par fixture.
-- Aucune assertion CI ne tombe. La télémétrie PROD est intacte (service_role).
REVOKE ALL ON FUNCTION public.track_soft_404_event(integer, integer, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.track_soft_404_event(integer, integer, text, text)
  TO service_role;

-- -----------------------------------------------------------------------------
-- §9 — POST-CONDITION FAIL-CLOSED (annule la transaction si l'état n'est pas celui attendu)
-- -----------------------------------------------------------------------------
-- Deux assertions distinctes :
--   (a) les 35 fermées ont bien perdu EXECUTE pour PUBLIC, anon et authenticated,
--       et l'ont CONSERVÉ pour service_role et postgres. PostgreSQL n'émet qu'un
--       avertissement quand un REVOKE porte sur un droit qu'il ne peut pas retirer :
--       sans cette assertion, la migration passerait « verte » en ne faisant rien.
--   (b) les 12 laissées publiques ont TOUJOURS EXECUTE pour anon — garde
--       anti-sur-révocation : si une fermeture avait débordé sur un chemin de rendu,
--       la transaction est annulée plutôt que de casser une page servie.
-- Lecture de catalogue uniquement, via has_function_privilege ; aucune fonction
-- applicative n'est appelée.
DO $postcheck$
DECLARE
  v_fn regprocedure;
BEGIN
  FOREACH v_fn IN ARRAY ARRAY[
    'public.auth_resolve_user(text)'::regprocedure,
    'public.auth_email_exists(text)'::regprocedure,
    'public.seo_apply_h1_write(text, text, text, text, text, text, text, text, jsonb, text, text, text, jsonb)'::regprocedure,
    'public.__seo_r8_publish_snapshot(bigint, text, jsonb, text, jsonb, text)'::regprocedure,
    'public.append_gamme_alias(text, text)'::regprocedure,
    'public.__seo_admin_job_accept(text, text, jsonb, text, text)'::regprocedure,
    'public.__seo_admin_job_transition(uuid, text, jsonb, text)'::regprocedure,
    'public.__seo_outbox_claim_batch(integer)'::regprocedure,
    'public.rebuild_gamme_page_cache(integer)'::regprocedure,
    'public.rebuild_vehicle_page_cache(integer)'::regprocedure,
    'public.refresh_stale_gamme_cache(integer)'::regprocedure,
    'public.refresh_stale_vehicle_cache(integer)'::regprocedure,
    'public.mark_stale_with_followup_rebuild(integer[], text, boolean)'::regprocedure,
    'public.invalidate_r1_caches(integer, text, text)'::regprocedure,
    'public.build_gamme_page_payload(integer)'::regprocedure,
    'public.build_vehicle_page_payload(integer)'::regprocedure,
    'public.check_agent_write_allowed(text, text)'::regprocedure,
    'public.resolve_agent_write_scope()'::regprocedure,
    'public.ensure_next_quality_history_partition()'::regprocedure,
    'public.refresh_gamme_seo_dashboard()'::regprocedure,
    'public.check_payment_tunnel_health(integer)'::regprocedure,
    'public.check_error_logs_5xx_threshold(integer, integer)'::regprocedure,
    'public.__gov_m1_table_sizes()'::regprocedure,
    'public.__gov_m2_index_sizes()'::regprocedure,
    'public.__gov_m3_stale_stats()'::regprocedure,
    'public.__gov_m4_dead_tuples()'::regprocedure,
    'public.__gov_m5_seq_scans()'::regprocedure,
    'public.__gov_m6_unused_indexes()'::regprocedure,
    'public.detect_quality_outliers(integer, numeric, text, text)'::regprocedure,
    'public.get_cwv_dashboard(date, date, text)'::regprocedure,
    'public.get_cwv_funnel_correlation(timestamp with time zone, timestamp with time zone)'::regprocedure,
    'public.rpc_seo_action_outcomes_v1(timestamp with time zone, integer, integer)'::regprocedure,
    'public.get_supplier_unified_stats(text, text)'::regprocedure,
    'public.get_rag_coverage_summary()'::regprocedure,
    'public.track_soft_404_event(integer, integer, text, text)'::regprocedure
  ]
  LOOP
    IF has_function_privilege('public', v_fn, 'EXECUTE')
       OR has_function_privilege('anon', v_fn, 'EXECUTE')
       OR has_function_privilege('authenticated', v_fn, 'EXECUTE')
       OR NOT has_function_privilege('service_role', v_fn, 'EXECUTE')
       OR NOT has_function_privilege('postgres', v_fn, 'EXECUTE')
    THEN
      RAISE EXCEPTION 'ABORT: droits EXECUTE inattendus apres fermeture sur %', v_fn;
    END IF;
  END LOOP;

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

  -- Les deux fonctions auth doivent porter un search_path figé après ce run.
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('auth_resolve_user', 'auth_email_exists')
      AND (p.proconfig IS NULL
           OR NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%'))
  ) THEN
    RAISE EXCEPTION 'ABORT: search_path non fige sur auth_resolve_user / auth_email_exists';
  END IF;
END
$postcheck$;

-- =============================================================================
-- Vérification post-migration (lecture seule, à jouer après apply)
-- =============================================================================
--   -- 1. plus aucune fonction DEFINER de public exécutable par anon hors allowlist
--   SELECT p.oid::regprocedure AS fn, p.proacl::text
--     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--    WHERE n.nspname = 'public' AND p.prosecdef
--      AND has_function_privilege('anon', p.oid, 'EXECUTE')
--    ORDER BY 1;
--   -- attendu : exactement les 12 lignes de scripts/lint/definer-anon-allowlist.txt
--
--   -- 2. search_path figé sur les deux fonctions auth
--   SELECT p.proname, p.proconfig
--     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--    WHERE n.nspname = 'public' AND p.proname IN ('auth_resolve_user','auth_email_exists');
--   -- attendu : {"search_path=public, pg_temp"} pour les deux
--
--   -- 3. le cron de rafraîchissement continue de tourner sous postgres
--   SELECT j.jobname, d.status, d.start_time
--     FROM cron.job_run_details d JOIN cron.job j USING (jobid)
--    WHERE j.jobname IN ('refresh-stale-gamme-cache','quality-history-partition-rotation')
--    ORDER BY d.start_time DESC LIMIT 3;
--   -- attendu : succeeded pour les exécutions postérieures à l'application
--
-- =============================================================================
-- ROLLBACK — pas de .down.sql (un .down.sql rendrait l'escalade, ce qui est
-- exactement ce qu'on ferme). Si un appelant légitime est identifié, ré-accorder
-- EXECUTE à son SEUL rôle réel, puis le consigner dans une migration forward :
--   GRANT EXECUTE ON FUNCTION public.<fn>(<args>) TO <role de l appelant>;
-- et ajouter <fn> à scripts/lint/definer-anon-allowlist.txt avec son motif si ce
-- rôle est anon. Ne JAMAIS revenir à `TO PUBLIC`.
--
-- Rollback de la seule §1 (auth_resolve_user), si le tunnel de login casse :
--   GRANT EXECUTE ON FUNCTION public.auth_resolve_user(text) TO anon;
-- Le `ALTER FUNCTION ... SET search_path` de §1 n'a PAS à être annulé : il ne
-- change aucun comportement observable, il supprime un vecteur d'escalade.
-- =============================================================================
