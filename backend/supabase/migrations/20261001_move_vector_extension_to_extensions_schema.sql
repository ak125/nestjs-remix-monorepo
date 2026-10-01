-- =============================================================================
-- Migration : extension vector déplacée du schéma `public` vers `extensions`
-- Date      : 2026-10-01
-- Severity  : LOW
-- Scope     : ALTER EXTENSION vector SET SCHEMA extensions. Aucune table, aucune
--             donnée, aucun droit, aucun job pg_cron touché.
-- Forward-only. Rollback documentaire : fichier .down.sql voisin.
-- =============================================================================
--
-- POURQUOI
-- --------
-- L'advisor Supabase `extension_in_public` signale trois extensions installées
-- dans `public` : vector, pg_trgm et unaccent. Cette migration traite vector
-- seule. pg_trgm et unaccent forment un lot séparé, parce que des fonctions de
-- `public` les appellent sans qualification de schéma.
--
-- `public` est le schéma de l'API et celui de l'application. vector y dépose
-- 118 fonctions (dont les agrégats avg(vector) et sum(vector)), 6 types,
-- 40 opérateurs, 24 classes et 24 familles d'opérateurs, à côté des tables et
-- des RPC du projet. Le déplacement les range avec les autres extensions
-- (pgcrypto, pg_stat_statements, hypopg…) et retire de `public` tout risque de
-- collision de nom avec une fonction de l'application.
--
-- Ce que la migration NE ferme PAS, mesuré le 2026-10-01 : aucune fonction de
-- vector n'est appelable par l'API. Toutes ont des paramètres sans nom, que
-- PostgREST ne publie pas ; GET /rest/v1/rpc/vector_dims, /l2_distance et
-- /vector_norm répondent 404 PGRST202 (absente du cache de schéma), alors que
-- le témoin /rpc/show_limit (pg_trgm, sans paramètre) répond 200. 98 de ces
-- fonctions sont exécutables par `anon` en SQL, mais `anon` est NOLOGIN.
-- Le déplacement est de l'hygiène de schéma, pas la fermeture d'une fuite.
--
-- IMPACT RUNTIME : NUL — raisons vérifiées le 2026-10-01 sur la base :
--   * Hors de l'extension, deux objets seulement dépendent de vector : la
--     colonne public.__seo_r2_embeddings.embedding (vector(1536)) et son index
--     ivfflat idx_r2_embeddings_cosine. Le catalogue les relie au type et à la
--     classe d'opérateurs par OID : ils suivent le déplacement, sans réécriture
--     de la table ni reconstruction de l'index.
--   * La table est vide (0 ligne) et n'a aucun lecteur ni écrivain : aucun
--     usage dans le code (audit/db-usage-map.json : used_by = []), seulement
--     deux commentaires dans r2-diversity.schema.ts. Aucune vue, aucun corps de
--     fonction ne cite vector.
--   * Aucun objet de même nom n'existe dans `extensions` (types, fonctions de
--     même signature, opérateurs, classes et familles d'opérateurs : 0).
--   * À savoir pour un futur consommateur : les opérateurs de distance (<=>,
--     <->, <#>) se résolvent par le search_path. `postgres` les trouve
--     (search_path "$user", public, extensions) ; un rôle sans `extensions`
--     dans son search_path doit écrire OPERATOR(extensions.<=>).
--
-- DROITS
-- ------
-- vector appartient à `supabase_admin` ; `postgres` n'est pas superutilisateur.
-- supautils, chargé dans chaque session, exécute `ALTER EXTENSION … SET SCHEMA`
-- d'une extension listée dans supautils.privileged_extensions (c'est le cas de
-- vector) sous supautils.privileged_extensions_superuser (`supabase_admin`) —
-- fonction présente depuis supautils v2.5.0. Les droits portés par chaque objet
-- déplacé ne changent pas. `extensions` accorde USAGE à anon, authenticated,
-- service_role et postgres.
-- Si l'élévation était refusée, l'ALTER échouerait et la transaction entière
-- serait annulée : aucun état intermédiaire.
--
-- APPLICATION : par le moteur du dépôt uniquement (Actions → « 🗄️ Apply
-- Supabase migrations (manual) », only_ids = cet identifiant), après fusion
-- sur main — jamais par un canal qui contourne infra.schema_migrations.
-- =============================================================================

-- La règle squawk `require-timeout-settings` : délais explicites. Omis, un GUC
-- hérite du défaut du rôle (60 s pour `postgres` sur ce projet).
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- Sans effet si l'extension est déjà dans `extensions` (rejeu).
ALTER EXTENSION vector SET SCHEMA extensions;

-- Postcheck fail-closed : l'extension, tous ses membres et leurs types tableau
-- sont dans `extensions`, et chaque index qui utilise une de ses classes
-- d'opérateurs est resté valide.
DO $postcheck$
DECLARE
  v_ext_oid oid;
  v_nsp     text;
  v_left    integer;
  v_invalid integer;
BEGIN
  SELECT e.oid, n.nspname INTO v_ext_oid, v_nsp
  FROM pg_extension e
  JOIN pg_namespace n ON n.oid = e.extnamespace
  WHERE e.extname = 'vector';

  IF v_ext_oid IS NULL THEN
    RAISE EXCEPTION 'postcheck: extension vector absente';
  ELSIF v_nsp <> 'extensions' THEN
    RAISE EXCEPTION 'postcheck: extension vector dans le schéma %, attendu extensions', v_nsp;
  END IF;

  SELECT count(*) INTO v_left
  FROM pg_depend d
  CROSS JOIN LATERAL pg_identify_object(d.classid, d.objid, d.objsubid) o
  WHERE d.refclassid = 'pg_extension'::regclass
    AND d.refobjid = v_ext_oid
    AND d.deptype = 'e'
    AND o.schema IS DISTINCT FROM 'extensions'
    AND o.schema IS NOT NULL;

  v_left := v_left + (
    SELECT count(*)
    FROM pg_type arr
    JOIN pg_depend d ON d.classid = 'pg_type'::regclass
                    AND d.objid = arr.typelem
                    AND d.refclassid = 'pg_extension'::regclass
                    AND d.refobjid = v_ext_oid
                    AND d.deptype = 'e'
    WHERE arr.typnamespace <> 'extensions'::regnamespace
  );

  IF v_left > 0 THEN
    RAISE EXCEPTION 'postcheck: % objet(s) de vector hors du schéma extensions', v_left;
  END IF;

  SELECT count(*) INTO v_invalid
  FROM pg_index i
  WHERE NOT (i.indisvalid AND i.indisready)
    AND EXISTS (
      SELECT 1
      FROM unnest(i.indclass::oid[]) AS c(opc)
      JOIN pg_depend d ON d.classid = 'pg_opclass'::regclass
                      AND d.objid = c.opc
                      AND d.refclassid = 'pg_extension'::regclass
                      AND d.refobjid = v_ext_oid
                      AND d.deptype = 'e'
    );

  IF v_invalid > 0 THEN
    RAISE EXCEPTION 'postcheck: % index sur une classe d''opérateurs de vector non valide(s)', v_invalid;
  END IF;
END
$postcheck$;
