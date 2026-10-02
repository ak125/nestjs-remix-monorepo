-- =============================================================================
-- Migration : get_r6_guide_link_snapshot() — lecture SECURITY DEFINER de la
--             politique de liens vers les guides d'achat (ADR-103 D5)
-- Date      : 2026-10-01
-- Scope     : UNE fonction créée, en lecture seule. Aucune table modifiée,
--             aucune donnée écrite, aucune autre fonction touchée.
-- Forward-only. Ne réécrit AUCUNE migration historique.
-- =============================================================================
--
-- CONTEXTE
-- --------
-- #1683 (3e66bc83a) a ajouté R6GuideLinkPolicyService : au rendu d'une page gamme
-- R1, le backend décide quels liens « guide d'achat » / « conseils » afficher. Le
-- service lit QUATRE tables en direct (`.from()`) : __seo_gamme_purchase_guide,
-- __blog_guide, __blog_advice et pieces_gamme.
--
-- Le container PREPROD tourne en `anon` (READ_ONLY, ADR-028 Option D) et la base
-- a `row_security=off` : une lecture directe d'une table sous RLS ne filtre pas,
-- elle LÈVE 42501. Chaîne observée en PREPROD après la fusion de #1683 :
-- snapshot en échec → R6_GUIDE_LINK_SNAPSHOT_FAILED → /api/gamme-rest/:id/page-data-rpc-v2
-- répond 503 → le frontend retombe sur l'endpoint classique, dont la réponse n'a
-- pas de hero → pieces.$slug.tsx renvoie 404. Les 5 pages gamme R1 sondées en
-- 200 BLOQUANT par scripts/ci/preprod-response-suite.sh tombent donc en 404, et
-- aucun tag PROD n'est possible tant que main n'a pas de Deploy PREPROD vert.
-- PROD et DEV (service_role) ne sont pas touchés.
--
-- Même défaut, même remède que get_homepage_families (20260621, PR #1072) : une
-- fonction SECURITY DEFINER fait les lectures et renvoie le résultat. Le service
-- l'appellera par callRpc au lieu des `.from()` directs (PR de code séparée,
-- fusionnée APRÈS l'application de cette migration).
--
-- CE QUE RENVOIE LA FONCTION — exactement ce que calcule loadSnapshot() de #1683
-- --------------------------------------------------------------------------------
--   {
--     "published_guide_aliases": [...],  -- alias des gammes qui ont un guide
--                                        -- d'achat publié (sgpg_is_draft = false),
--                                        -- UNION les bg_alias non dépréciés de
--                                        -- __blog_guide ; dédoublonnés, triés
--     "conseils_aliases": [...]          -- alias des gammes qui ont au moins un
--                                        -- article __blog_advice ; dédoublonnés,
--                                        -- triés
--   }
-- Un alias vide ou NULL est écarté (le service écartait les alias « falsy »).
-- Tri `COLLATE "C"` = ordre par code, celui d'Array.prototype.sort() sur des
-- chaînes ASCII. Les jointures comparent en texte (`pg_id::text`), comme le
-- service comparait `String(pg_id)` : sgpg_pg_id (varchar) et ba_pg_id (text)
-- ne sont jamais convertis en entier.
--
-- ÉQUIVALENCE VÉRIFIÉE le 2026-10-01, sur les données réelles, en lecture seule :
-- les lignes brutes des 4 tables exportées en JSON, la logique TypeScript de
-- loadSnapshot() rejouée en Node à l'identique, puis comparée à la sortie de ce
-- corps : 224 alias publiés et 73 alias conseils, IDENTIQUES ordre compris ;
-- aucun identifiant non numérique dans sgpg_pg_id ni ba_pg_id.
--
-- SÛRETÉ
-- ------
--   * lecture seule (STABLE, aucun INSERT/UPDATE/DELETE) ; données publiques :
--     des alias d'URL déjà présents dans le maillage des pages publiques ;
--   * search_path = public, pg_temp (pg_temp en dernier) ; toutes les relations
--     du corps sont qualifiées `public.` ;
--   * EXECUTE retiré à PUBLIC, anon et authenticated (privilèges par défaut
--     Supabase), puis accordé à anon (chemin de rendu des pages R1 dans le
--     container PREPROD READ_ONLY, qui casse sans lui — cf. CONTEXTE) et à
--     service_role (PROD, DEV).
--   * PAS d'entrée dans scripts/lint/definer-anon-allowlist.txt, délibérément :
--     le REVOKE écrit ci-dessous satisfait déjà la règle 1 de
--     check-definer-anon-surface.sh (vérifié : la garde sort 0 avec et sans
--     l'entrée). L'entrée serait une exemption morte, et elle laisserait une
--     future migration recréer la fonction SANS REVOKE sans que la garde le voie.
--
-- assume_in_transaction (squawk) : pas de BEGIN/COMMIT explicite. Timeouts requis
-- (squawk require-timeout-settings) avant CREATE FUNCTION.
--
-- RETOUR ARRIÈRE : 20261001_get_r6_guide_link_snapshot_definer_rpc.down.sql, à ne
-- lancer qu'APRÈS le retrait du code qui appelle la fonction.
SET lock_timeout = '5s';
SET statement_timeout = '30s';

CREATE OR REPLACE FUNCTION public.get_r6_guide_link_snapshot()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'published_guide_aliases', COALESCE((
      SELECT jsonb_agg(s.alias ORDER BY s.alias COLLATE "C")
      FROM (
        SELECT pg.pg_alias AS alias
        FROM public.pieces_gamme pg
        WHERE pg.pg_alias <> ''
          AND EXISTS (
            SELECT 1 FROM public.__seo_gamme_purchase_guide g
            WHERE g.sgpg_is_draft = false AND g.sgpg_pg_id = pg.pg_id::text
          )
        UNION
        SELECT bg.bg_alias
        FROM public.__blog_guide bg
        WHERE bg.bg_alias <> '' AND bg.bg_deprecated IS DISTINCT FROM true
      ) s
    ), '[]'::jsonb),
    'conseils_aliases', COALESCE((
      SELECT jsonb_agg(s.alias ORDER BY s.alias COLLATE "C")
      FROM (
        SELECT DISTINCT pg.pg_alias AS alias
        FROM public.pieces_gamme pg
        WHERE pg.pg_alias <> ''
          AND EXISTS (
            SELECT 1 FROM public.__blog_advice ba
            WHERE ba.ba_pg_id = pg.pg_id::text
          )
      ) s
    ), '[]'::jsonb)
  )
$$;

REVOKE ALL ON FUNCTION public.get_r6_guide_link_snapshot() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_r6_guide_link_snapshot() TO anon, service_role;
