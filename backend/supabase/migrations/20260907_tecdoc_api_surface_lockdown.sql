-- =============================================================================
-- Migration : TecDoc — fermeture de la surface d'accès depuis les rôles API
-- Date      : 2026-09-07
-- Severity  : HIGH (contournement de l'isolation de schéma)
-- Scope     : 5 objets de `public` qui franchissent l'absence de USAGE sur tecdoc_*
-- Forward-only. Ne réécrit AUCUNE migration historique.
-- =============================================================================
--
-- CONTEXTE
-- --------
-- Les rôles API (anon, authenticated, service_role) n'ont pas USAGE sur les six
-- schémas tecdoc_*. Cette isolation est réelle mais NON SUFFISANTE : une vue en
-- sémantique DEFINER (reloptions sans security_invoker, propriétaire postgres) et
-- une fonction SECURITY DEFINER s'exécutent avec les droits du propriétaire et
-- traversent donc le refus de USAGE.
--
-- Vérifié le 2026-09-07 sur la base live, en lecture seule :
--   SET LOCAL ROLE service_role;
--   SELECT ... FROM public.v_tecdoc_dlnr_reconciliation LIMIT 3;  -- rend 3 lignes
-- La lecture de tecdoc_raw.t400 (17 Go) et tecdoc_map.source_linkages (90 Go) a
-- physiquement eu lieu, sans erreur 42501.
--
-- La migration 20260422_views_invoker_special_cases.sql avait fermé anon et
-- authenticated (état reconfirmé : anon_sel=false, auth_sel=false) et documenté
-- le maintien du motif DEFINER « pour ne pas casser les consommateurs
-- service_role ». Cette migration-ci constate qu'il n'existe aucun consommateur
-- service_role, et ferme donc ce dernier accès. Elle N'ANNULE PAS la précédente :
-- elle la prolonge.
--
-- PREUVE D'ABSENCE DE CONSOMMATEUR (2026-09-07)
-- ---------------------------------------------
--   • dépôt        : 0 référence hors packages/database-types (projection PostgREST)
--   • cron.job     : 0 job citant tecdoc
--   • pg_depend    : 0 vue dépendant de ces 3 vues
--   • pg_proc      : 0 fonction citant ces objets
--   • pipeline     : les loaders récupérés (PR #1412) utilisent COPY et __exec_sql,
--                    jamais __load_tecdoc_raw
--
-- CE QUE CETTE MIGRATION NE FAIT PAS
-- ----------------------------------
-- Aucun DROP de table, aucune donnée touchée, aucun VACUUM, aucun changement de
-- compute. tecdoc_raw, tecdoc_map.source_linkages et tecdoc_rebuild sont intacts.
-- La seule suppression est celle d'une FONCTION morte (porte 1).
--
-- ROLLBACK : voir le bloc en fin de fichier.
-- =============================================================================

-- Pas de BEGIN/COMMIT explicite : l'outil de migration ouvre déjà la transaction
-- (.squawk.toml : assume_in_transaction = true). Un BEGIN ici serait imbriqué et
-- squawk `transaction-nesting` le refuse — à raison. L'atomicité est donc celle du
-- runner ; le DO $guard$ ci-dessous avorte l'ensemble s'il lève.
SET lock_timeout = '5s';
SET statement_timeout = '60s';

-- -----------------------------------------------------------------------------
-- PORTE 1 — public.__load_tecdoc_raw(text, jsonb) : SUPPRESSION
-- -----------------------------------------------------------------------------
-- SECURITY DEFINER, VOLATILE, EXECUTE à PUBLIC (donc anon). Son unique branche
-- (`IF p_table_id = '200'`) insère dans tecdoc_raw.t200 — table qui N'EXISTE PLUS.
-- Aujourd'hui : p_table_id='200' → 42P01 ; toute autre valeur → no-op renvoyant 0.
-- API morte, exposée en écriture à anon. On la retire plutôt que de la garder
-- « au cas où » : la ressusciter demanderait de toute façon de recréer t200.
--
-- Garde fail-closed : si t200 est revenue, c'est que le chemin d'import a été
-- réactivé — on refuse alors de supprimer et on laisse l'opérateur trancher.
DO $guard$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'tecdoc_raw' AND c.relname = 't200'
  ) THEN
    RAISE EXCEPTION
      'ABORT: tecdoc_raw.t200 existe — __load_tecdoc_raw n''est plus morte. Revoir la décision avant de supprimer.';
  END IF;
END
$guard$;

DROP FUNCTION IF EXISTS public.__load_tecdoc_raw(text, jsonb);

-- -----------------------------------------------------------------------------
-- PORTES 2, 3, 4 — les trois vues DEFINER de public sur tecdoc_*
-- -----------------------------------------------------------------------------
-- Deux verrous indépendants, volontairement redondants :
--   (a) security_invoker = true  → la vue s'exécute avec les droits de l'appelant,
--       qui n'a pas USAGE sur tecdoc_* : la traversée devient impossible même si
--       un GRANT réapparaissait un jour par accident.
--   (b) REVOKE ALL des rôles API → l'accès est refusé avant même d'évaluer la vue.
--
-- dev_readonly n'est PAS révoqué : ce n'est pas un rôle API (PostgREST ne bascule
-- que vers anon/authenticated/service_role). Avec security_invoker il ne traverse
-- plus non plus. Le diagnostic passe désormais par un rôle qui détient réellement
-- USAGE sur tecdoc_* (postgres, supabase_read_only_user).

ALTER VIEW public.__tecdoc_losch_log              SET (security_invoker = true);
ALTER VIEW public.v_tecdoc_dlnr_reconciliation    SET (security_invoker = true);
ALTER VIEW public.v_tecdoc_unlinked_pieces_reason SET (security_invoker = true);

REVOKE ALL ON public.__tecdoc_losch_log              FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON public.v_tecdoc_dlnr_reconciliation    FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON public.v_tecdoc_unlinked_pieces_reason FROM PUBLIC, anon, authenticated, service_role;

-- PORTE 4, précision : __tecdoc_losch_log est auto-updatable
-- (pg_relation_is_updatable = 28 → INSERT|UPDATE|DELETE), projection simple d'une
-- seule table. service_role détenait arwdDxtm : il pouvait donc ÉCRIRE dans
-- tecdoc_map.losch_log à travers la vue. Le REVOKE ci-dessus retire ces trois
-- droits ; security_invoker ferme la traversée en second rideau.

-- -----------------------------------------------------------------------------
-- PORTE 5 — public.resolve_type_id_remap(integer) : DURCIE, PAS FERMÉE
-- -----------------------------------------------------------------------------
-- Runtime réel : 16 369 appels cumulés (pg_stat_statements). Sert la redirection
-- 301 des anciennes URLs TecDoc (type_id >= 100000) vers les URLs MassDoc —
-- backend/src/modules/vehicles/services/vehicle-rpc.service.ts:265, consommé par
-- frontend/app/routes/constructeurs.$brand.$model.$type.tsx:236. La fermer
-- casserait le SEO. On la durcit.
--
-- SECURITY DEFINER reste NÉCESSAIRE : la fonction lit tecdoc_map.type_id_remap et
-- aucun rôle API n'a USAGE sur tecdoc_map. C'est le seul franchissement conservé,
-- et il est borné à une table de 3 Mo qui est une donnée primaire.
--
-- Durcissement : search_path vidé + tous les noms qualifiés. Avec
-- `SET search_path TO 'public'`, pg_temp reste implicitement prioritaire : un
-- appelant pouvait créer une table temporaire `auto_type` et détourner la jointure
-- d'une fonction qui s'exécute en postgres. `SET search_path = ''` supprime ce
-- vecteur. Le corps est INCHANGÉ par ailleurs — mêmes jointures, même LIMIT 1,
-- même signature, même type de retour.

CREATE OR REPLACE FUNCTION public.resolve_type_id_remap(p_old_id integer)
 RETURNS TABLE(new_id integer, type_alias text, type_name text, modele_alias text, modele_id integer, marque_alias text, marque_id smallint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = ''
AS $function$
  SELECT r.new_id, at.type_alias, at.type_name,
         am.modele_alias, am.modele_id,
         amarq.marque_alias, amarq.marque_id
  FROM tecdoc_map.type_id_remap r
  JOIN public.auto_type at ON at.type_id = r.new_id::text
  JOIN public.auto_modele am ON am.modele_id::text = at.type_modele_id
  JOIN public.auto_marque amarq ON amarq.marque_id = am.modele_marque_id
  WHERE r.old_id = p_old_id LIMIT 1;
$function$;

ALTER FUNCTION public.resolve_type_id_remap(integer) OWNER TO postgres;

-- Rôles conservés, et pourquoi :
--   • anon         — le container PREPROD tourne READ_ONLY=true et s'authentifie en
--                    anon (backend/src/common/utils/supabase-key.util.ts:43-52).
--                    Sans ce GRANT, le smoke E2E du 301 casse en CI.
--   • service_role — le container PROD s'authentifie avec la service key
--                    (docker-compose.prod.yml:185, app.config.ts:61).
-- Retirés :
--   • PUBLIC        — grant par défaut, jamais requis.
--   • authenticated — le backend n'emprunte jamais ce rôle ; aucun appel direct
--                     depuis le frontend (aucun supabase-js côté navigateur).
REVOKE ALL ON FUNCTION public.resolve_type_id_remap(integer) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_type_id_remap(integer) TO anon, service_role;

-- =============================================================================
-- Vérification post-migration (à jouer après apply)
-- =============================================================================
--   -- 1. la fonction morte n'existe plus
--   SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
--    WHERE n.nspname='public' AND p.proname='__load_tecdoc_raw';           -- 0
--
--   -- 2. les 3 vues sont invoker et sans grant API
--   SELECT relname, reloptions::text, relacl::text FROM pg_class
--    WHERE relname IN ('__tecdoc_losch_log','v_tecdoc_dlnr_reconciliation',
--                      'v_tecdoc_unlinked_pieces_reason');
--   -- attendu : reloptions = {security_invoker=true}, pas d'anon/authenticated/service_role
--
--   -- 3. comportement réel (et pas seulement les ACL)
--   BEGIN; SET LOCAL ROLE service_role;
--     SELECT 1 FROM public.v_tecdoc_dlnr_reconciliation LIMIT 1;  -- permission denied
--   ROLLBACK;
--
--   -- 4. le 301 fonctionne toujours
--   BEGIN; SET LOCAL ROLE anon;
--     SELECT * FROM public.resolve_type_id_remap(<un old_id connu>);  -- 1 ligne
--     SELECT * FROM public.resolve_type_id_remap(999999999);          -- 0 ligne
--   ROLLBACK;
--
--   -- 5. l'isolation de schéma est intacte
--   SELECT has_schema_privilege('service_role','tecdoc_map','USAGE');  -- false
--
-- =============================================================================
-- ROLLBACK
-- =============================================================================
--   ALTER VIEW public.__tecdoc_losch_log              SET (security_invoker = false);
--   ALTER VIEW public.v_tecdoc_dlnr_reconciliation    SET (security_invoker = false);
--   ALTER VIEW public.v_tecdoc_unlinked_pieces_reason SET (security_invoker = false);
--   GRANT ALL ON public.__tecdoc_losch_log              TO service_role;
--   GRANT ALL ON public.v_tecdoc_dlnr_reconciliation    TO service_role;
--   GRANT ALL ON public.v_tecdoc_unlinked_pieces_reason TO service_role;
--   GRANT EXECUTE ON FUNCTION public.resolve_type_id_remap(integer) TO PUBLIC;
--   -- __load_tecdoc_raw : recréation depuis ce dépôt uniquement si tecdoc_raw.t200
--   -- est recréée ; sa définition d'origine est citée dans le corps de la PR.
-- =============================================================================
