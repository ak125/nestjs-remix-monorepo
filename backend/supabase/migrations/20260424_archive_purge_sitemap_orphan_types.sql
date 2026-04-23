-- ════════════════════════════════════════════════════════════════════════
-- Migration : Archive + purge des type_ids orphelins dans __sitemap_p_link
-- ════════════════════════════════════════════════════════════════════════
--
-- Date      : 2026-04-24 (à appliquer après merge + validation DEV des
--             monorepo PRs #133, #134, #135 — cf. INC-2026-012)
-- Owner     : @fafa / owner SEO
-- Scope     : non-destructif au niveau des données (archive avant delete)
-- Rollback  : INSERT FROM archive + DROP archive (scripts en fin de fichier)
--
-- CONTEXTE (INC-2026-012) :
--   Le remap TecDoc V1→V2 a capé auto_type.type_id_i <= 83456. La table
--   __sitemap_p_link (472,917 rows) contient ~99,912 rows avec map_type_id
--   ∈ [100001, 134362] qui n'existent plus dans auto_type. Ces rows génèrent
--   ~75-85% des 411k GSC 404s observés le 2026-04-23.
--
--   La monorepo PR #135 filtre déjà ces orphelins à la génération du sitemap
--   XML (via helper getValidTypeIds cached). Cette migration complète en
--   nettoyant physiquement la table : économie ~20 MB + lisibilité des
--   requêtes DB + cohérence avec auto_type.
--
-- ÉTAPES (à exécuter via mcp__supabase__apply_migration ou psql supervisé) :
--   1. Archive  (CREATE TABLE AS SELECT orphans)  — idempotent, non-destructif
--   2. Validate (SELECT COUNT)                    — à valider manuellement
--   3. Delete   (DELETE ... WHERE orphan)         — destructif, irréversible
--                                                   sans l'archive de l'étape 1
--
-- PRÉREQUIS :
--   [ ] Monorepo PR #133 mergée + déployée DEV + smoke-tested
--   [ ] Monorepo PR #134 mergée + déployée DEV + smoke-tested
--   [ ] Monorepo PR #135 mergée + déployée DEV + smoke-tested
--   [ ] Backup/snapshot Supabase récent (<24h) confirmé
--   [ ] Owner SEO a validé l'exécution (pas en auto-mode)
-- ════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────
-- ÉTAPE 1 : Archive (non-destructive, idempotent)
-- ───────────────────────────────────────────────────────────────────────
-- Crée une copie complète des rows orphelines. Exécutable plusieurs fois
-- sans risque (IF NOT EXISTS). Taille attendue ~20 MB, ~99,912 rows.

CREATE TABLE IF NOT EXISTS public.__sitemap_p_link_archive_20260423 AS
SELECT spl.*
FROM public.__sitemap_p_link spl
WHERE NOT EXISTS (
  SELECT 1
  FROM public.auto_type at
  WHERE at.type_id_i = spl.map_type_id
    AND at.type_display = '1'
);

COMMENT ON TABLE public.__sitemap_p_link_archive_20260423 IS
  'INC-2026-012 archive : rows orphelines de __sitemap_p_link dont map_type_id est absent de auto_type (type_display=1). Créée 2026-04-24 avant purge. Rollback : INSERT FROM + DROP.';

-- Indexes pour un rollback rapide si besoin
CREATE INDEX IF NOT EXISTS idx_archive_20260423_type_id
  ON public.__sitemap_p_link_archive_20260423 (map_type_id);


-- ───────────────────────────────────────────────────────────────────────
-- ÉTAPE 2 : Validation (à exécuter MANUELLEMENT avant l'étape 3)
-- ───────────────────────────────────────────────────────────────────────
-- Les 4 checks ci-dessous doivent être exécutés en SQL interactif par
-- l'owner SEO. NE PAS passer à l'étape 3 si un check échoue.
--
-- Check A : nombre de rows archivées (attendu ≈ 99,912, tolérance ±5%)
--   SELECT COUNT(*) FROM public.__sitemap_p_link_archive_20260423;
--
-- Check B : nombre total avant delete (attendu ≈ 472,917)
--   SELECT COUNT(*) FROM public.__sitemap_p_link;
--
-- Check C : aucun orphelin n'a échappé à l'archive
--   SELECT COUNT(*) FROM public.__sitemap_p_link spl
--   WHERE NOT EXISTS (
--     SELECT 1 FROM public.auto_type at
--     WHERE at.type_id_i = spl.map_type_id AND at.type_display = '1'
--   )
--   AND NOT EXISTS (
--     SELECT 1 FROM public.__sitemap_p_link_archive_20260423 arc
--     WHERE arc.map_pg_id = spl.map_pg_id
--       AND arc.map_marque_id = spl.map_marque_id
--       AND arc.map_modele_id = spl.map_modele_id
--       AND arc.map_type_id = spl.map_type_id
--   );
--   -- Attendu : 0
--
-- Check D : la PR #135 est bien déployée (filtre in-memory actif)
--   - Trigger une génération sitemap en DEV
--   - Vérifier logs : "🧹 Filtered out N URLs with orphan type_ids"
--   - N doit matcher approximativement le COUNT du Check A


-- ───────────────────────────────────────────────────────────────────────
-- ÉTAPE 3 : DELETE (destructif — exécuter SEULEMENT après validation)
-- ───────────────────────────────────────────────────────────────────────
-- COMMENTÉE par défaut pour forcer une revue explicite. Décommenter +
-- apply uniquement après que les checks A-D passent.

-- BEGIN;
--
-- DELETE FROM public.__sitemap_p_link spl
-- WHERE NOT EXISTS (
--   SELECT 1
--   FROM public.auto_type at
--   WHERE at.type_id_i = spl.map_type_id
--     AND at.type_display = '1'
-- );
--
-- -- Vérifier que le count post-delete correspond à l'attendu
-- -- avant de COMMIT. Si divergence, ROLLBACK et investiguer.
-- --
-- -- Expected : (COUNT avant delete) - (COUNT archive) = (COUNT après delete)
-- -- Soit ~472,917 - 99,912 = ~373,005 rows restantes
--
-- COMMIT;


-- ───────────────────────────────────────────────────────────────────────
-- ROLLBACK : Si l'étape 3 pose problème (inattendu mais au cas où)
-- ───────────────────────────────────────────────────────────────────────
-- Rapatrie intégralement les rows archivées. Exécuter manuellement.
--
-- BEGIN;
-- INSERT INTO public.__sitemap_p_link
-- SELECT * FROM public.__sitemap_p_link_archive_20260423;
-- -- Vérifier le count rétabli
-- COMMIT;


-- ───────────────────────────────────────────────────────────────────────
-- CLEANUP : Quand la purge est validée en prod depuis ≥ 30 jours et que
-- le backlog GSC a décru significativement, l'archive peut être supprimée.
-- ───────────────────────────────────────────────────────────────────────
-- DROP TABLE IF EXISTS public.__sitemap_p_link_archive_20260423;  -- APPROVED: INC-2026-012 archive table cleanup after 30d+ stability, execute manually only
