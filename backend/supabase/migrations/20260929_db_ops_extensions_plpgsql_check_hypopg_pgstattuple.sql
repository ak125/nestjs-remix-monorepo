-- =============================================================================
-- Migration : outillage opérateur DB — plpgsql_check, hypopg, pgstattuple
-- Date      : 2026-09-29
-- Severity  : LOW
-- Scope     : 3 CREATE EXTENSION dans le schéma `extensions`. Aucune table,
--             aucune fonction de `public`, aucun droit, aucun job pg_cron touché.
-- Forward-only. Rollback documentaire : fichier .down.sql voisin.
-- =============================================================================
--
-- POURQUOI
-- --------
-- L'audit du schéma massdoc (2026-09-29) bute sur trois angles morts que ces
-- extensions ferment, sans rien changer au runtime :
--   * plpgsql_check — vérifie statiquement les fonctions PL/pgSQL : références à
--     des tables ou colonnes absentes, variables jamais lues, casts implicites.
--     Exemple mesuré : prepare_shadow_tables / switch_to_next / rollback_switch
--     visent `pieces_marque_next` et `pieces_marque_backup`, qui n'existent pas ;
--     rien ne le signale aujourd'hui avant un appel.
--   * hypopg — index HYPOTHÉTIQUES : on mesure le plan qu'aurait une requête avec
--     ou sans un index (hypopg_create_index / hypopg_hide_index) AVANT tout
--     CREATE ou DROP INDEX réel sur pieces_relation_type (49 Go),
--     pieces_relation_criteria (30 Go) ou pieces_criteria (index = 4,6 × le tas).
--   * pgstattuple — mesure le gonflement réel (tuples morts, espace libre) des
--     tables et index, au lieu de l'estimer depuis pg_class.
--
-- IMPACT RUNTIME : NUL — raisons vérifiées le 2026-09-29 sur la base :
--   * plpgsql_check est DÉJÀ dans shared_preload_libraries, avec
--     plpgsql_check.mode = by_function, profiler = off, tracer = off. Le mode
--     passif (vérification au démarrage de chaque fonction) est donc inactif ;
--     CREATE EXTENSION n'ajoute que des fonctions qu'il faut appeler
--     explicitement. Le postcheck ci-dessous refuse d'appliquer si ce mode a
--     changé : c'est la prémisse de « impact nul ».
--   * hypopg : un index hypothétique n'existe que dans la session qui le crée ;
--     il ne touche ni le catalogue ni le planificateur des autres sessions.
--   * pgstattuple : fonctions de lecture. ATTENTION À L'USAGE, pas à la
--     migration : pgstattuple() lit la relation ENTIÈRE. Sur les trois tables
--     cœur, n'utiliser que pgstattuple_approx() (carte de visibilité) et
--     pgstatindex(), hors pointe.
--
-- DROITS — ce que cette migration N'ÉCRIT PAS, et pourquoi
-- --------------------------------------------------------
-- Répétition en transaction annulée (2026-09-29, rôle `postgres`) : sous
-- supautils, ces extensions sont créées par `supabase_admin`, qui POSSÈDE leurs
-- fonctions et y accorde lui-même EXECUTE à PUBLIC. `postgres` n'y détient que
-- EXECUTE avec option d'octroi. Or un non-propriétaire ne peut révoquer que ce
-- qu'il a lui-même accordé : `REVOKE EXECUTE … FROM PUBLIC, anon, authenticated`
-- émis par `postgres` est un NO-OP SILENCIEUX — mesuré : has_function_privilege
-- ('anon', …, 'execute') reste vrai sur hypopg_create_index,
-- plpgsql_check_function et plpgsql_profiler_reset_all après ce REVOKE.
-- Écrire ces REVOKE ici afficherait une fermeture qui n'a pas lieu. Ils sont
-- donc absents, délibérément.
--
-- Ce qui ferme réellement l'accès, vérifié le même jour :
--   1. PostgREST n'expose que `public` et `graphql_public` — réponse PGRST106
--      « Only the following schemas are exposed: public, graphql_public » à une
--      requête /rest/v1/rpc avec Content-Profile: extensions. Aucune fonction
--      du schéma `extensions` n'est appelable par l'API.
--   2. `anon` et `authenticated` sont NOLOGIN : ils ne sont joignables que par
--      PostgREST (via `authenticator`), jamais en SQL direct.
--   3. pgstattuple est fermée par défaut : EXECUTE à pg_stat_scan_tables
--      seulement, has_function_privilege('anon'|'authenticated') = faux.
-- C'est exactement le régime de pgcrypto et pg_stat_statements, déjà installées
-- dans `extensions` avec EXECUTE PUBLIC.
--
-- RISQUE RÉSIDUEL, à ne pas oublier : si `extensions` est un jour ajouté aux
-- schémas exposés de PostgREST, les fonctions de plpgsql_check et hypopg
-- deviendront appelables par la clé publishable — comme pgcrypto l'est déjà
-- dans ce cas. Ce réglage vit dans la configuration API du projet Supabase,
-- hors de ce dépôt.
--
-- APPLICATION : par le moteur du dépôt uniquement (Actions → « 🗄️ Apply
-- Supabase migrations (manual) », only_ids = cet identifiant), après fusion
-- sur main — jamais par un canal qui contourne infra.schema_migrations.
-- =============================================================================

-- La règle squawk `require-timeout-settings` : délais explicites. Omis, un GUC
-- hérite du défaut du rôle (60 s pour `postgres` sur ce projet).
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE EXTENSION IF NOT EXISTS plpgsql_check WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS hypopg WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgstattuple WITH SCHEMA extensions;

-- Postcheck fail-closed. `IF NOT EXISTS` saute en silence une extension déjà
-- créée AILLEURS (par exemple dans `public` depuis le tableau de bord) : on
-- refuse ce cas au lieu de l'accepter sans le voir.
DO $postcheck$
DECLARE
  v_ext  text;
  v_nsp  text;
  v_mode text := current_setting('plpgsql_check.mode', true);
  v_open integer;
BEGIN
  FOREACH v_ext IN ARRAY ARRAY['plpgsql_check', 'hypopg', 'pgstattuple'] LOOP
    SELECT n.nspname INTO v_nsp
    FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = v_ext;

    IF v_nsp IS NULL THEN
      RAISE EXCEPTION 'postcheck: extension % absente après CREATE EXTENSION', v_ext;
    ELSIF v_nsp <> 'extensions' THEN
      RAISE EXCEPTION 'postcheck: extension % installée dans le schéma %, attendu extensions', v_ext, v_nsp;
    END IF;
  END LOOP;

  -- Prémisse « impact runtime nul » : pas de vérification passive au démarrage.
  IF v_mode IS DISTINCT FROM 'by_function' AND v_mode IS DISTINCT FROM 'disabled' THEN
    RAISE EXCEPTION 'postcheck: plpgsql_check.mode = %, attendu by_function ou disabled', coalesce(v_mode, '<non défini>');
  END IF;

  -- pgstattuple doit rester fermée aux rôles de l'API (défaut de l'extension).
  SELECT count(*) INTO v_open
  FROM pg_extension e
  JOIN pg_depend d ON d.refobjid = e.oid
                  AND d.refclassid = 'pg_extension'::regclass
                  AND d.classid = 'pg_proc'::regclass
                  AND d.deptype = 'e'
  WHERE e.extname = 'pgstattuple'
    AND (has_function_privilege('anon', d.objid, 'execute')
         OR has_function_privilege('authenticated', d.objid, 'execute'));

  IF v_open > 0 THEN
    RAISE EXCEPTION 'postcheck: % fonction(s) pgstattuple exécutable(s) par anon ou authenticated', v_open;
  END IF;
END
$postcheck$;
