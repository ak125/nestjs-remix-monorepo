-- =====================================================
-- Restaure l'EXECUTE `anon` sur 3 fonctions SECURITY DEFINER de rendu de page
-- Date: 2026-06-21
-- =====================================================
--
-- POURQUOI
-- En READ_ONLY (container PREPROD, ADR-028 Option D) le backend bascule TOUT son
-- client Supabase sur le rôle `anon` — donc chaque `.rpc()` du read-path s'exécute
-- en `anon`. La doctrine vague-5 (PR #1012, docs/security/vague5-rls-drift-tail-20260616.md)
-- classe ces fonctions de rendu de page parmi les "~114 fonctions référencées par le
-- backend qui DOIVENT rester anon-exécutables". Le gros REVOKE FROM PUBLIC (migration #5)
-- avait d'ailleurs été ABANDONNÉ précisément pour ne pas les casser.
--
-- DÉRIVE CONSTATÉE (2026-06-21, MCP read-only sur le projet partagé)
-- Ces 3 fonctions ont perdu l'EXECUTE `anon` (révocation du grant PUBLIC, hors de toute
-- migration versionnée) → gate requis `e2e-smoke` ROUGE à chaque merge (cold cache PREPROD
-- → 1ʳᵉ requête anon → `permission denied for function`). `authenticated` les exécute encore.
-- PROD non affecté (service_role). Cette migration RÉTABLIT la conformité repo↔DB.
--
-- SÛRETÉ (vérifiée — revue adversariale lecture-seule, 2026-06-21)
-- Les 3 fonctions ne renvoient QUE des données publiques : catalogue, SEO, et (pour
-- rm_get_page_complete_v2) des prix de VENTE déjà affichés sur le site. AUCUN prix d'achat /
-- marge, AUCUNE donnée client (___xtr_customer/order/invoice), AUCUN secret, AUCUNE écriture.
-- Elles sont SECURITY DEFINER : la fonction tourne en owner et contrôle sa sortie ; redonner
-- l'EXECUTE à anon n'élargit pas ce qu'anon peut atteindre au-delà de ce que la fonction renvoie.
--
-- FORME
-- Grant EXPLICITE au rôle `anon` (pas via PUBLIC) — pour résister à un futur REVOKE … FROM
-- PUBLIC (même pattern que get_soft_404_alternatives). Idempotent (GRANT) · réversible
-- (REVOKE EXECUTE … FROM anon). `authenticated` a déjà l'EXECUTE → inchangé.

GRANT EXECUTE ON FUNCTION public.get_homepage_data_optimized()                                                     TO anon;
GRANT EXECUTE ON FUNCTION public.get_brand_page_data_optimized(p_marque_id integer)                                TO anon;
GRANT EXECUTE ON FUNCTION public.rm_get_page_complete_v2(p_gamme_id integer, p_vehicle_id bigint, p_limit integer) TO anon;

-- ROLLBACK (manuel si besoin) :
--   REVOKE EXECUTE ON FUNCTION public.get_homepage_data_optimized()                                                     FROM anon;
--   REVOKE EXECUTE ON FUNCTION public.get_brand_page_data_optimized(p_marque_id integer)                                FROM anon;
--   REVOKE EXECUTE ON FUNCTION public.rm_get_page_complete_v2(p_gamme_id integer, p_vehicle_id bigint, p_limit integer) FROM anon;
