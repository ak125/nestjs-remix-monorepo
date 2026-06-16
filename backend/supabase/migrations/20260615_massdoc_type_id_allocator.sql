-- ============================================================================
-- Massdoc-sequential internal type_id allocator (Vehicle id consolidation)
-- ADR: ADR-085 (governance-vault, à merger) · Spec: audit/id-internal-massdoc-sequential-consolidation-2026-06-15.md
-- ----------------------------------------------------------------------------
-- Grave l'invariant: auto_type.type_id = séquence globale MASSDOC monotone. Tout
-- nouvel id interne = nextval >= max(type_id)+1 (high-water 83456 -> 83457),
-- monotone. Le KTYPNR TecDoc est une clé SOURCE uniquement, enregistrée dans
-- tecdoc_map.type_id_remap (old_id=source -> new_id=interne) pour 301 + traçabilité.
-- Jamais adopter le KTYPNR comme id ; jamais réutiliser un trou legacy 0-59999 ;
-- jamais renuméroter l'existant.
--
-- Propriétés: ADDITIVE · IDEMPOTENT · REVERSIBLE · touche SEULEMENT le schéma
--             tecdoc_map (zéro ligne auto_type modifiée). Objets inertes tant que
--             le flux d'ajout unifié ne les appelle pas. Étend le pont existant.
-- ============================================================================
SET lock_timeout = '5s';
SET statement_timeout = '60s';

-- 1) High-water mark de la séquence globale Massdoc type_id.
CREATE SEQUENCE IF NOT EXISTS tecdoc_map.type_id_seq
  AS bigint
  START WITH 83457
  INCREMENT BY 1
  MINVALUE 83457
  NO MAXVALUE
  NO CYCLE;

COMMENT ON SEQUENCE tecdoc_map.type_id_seq IS
  'High-water mark de la séquence globale auto_type.type_id (Massdoc). Nouveaux ids véhicule alloués ici (MONOTONE, >= max+1 ; micro-trous possibles sur rollback de tx — acceptables, jamais réutilisés). Jamais adopter le KTYPNR TecDoc comme id ; jamais réutiliser les trous legacy 0-59999. Voir ADR-085 + audit/id-internal-massdoc-sequential-consolidation-2026-06-15.md';

-- Robustesse: aligner la séquence au high-water LIVE à l'apply (jamais de collision si
-- max(type_id_i) a avancé). is_called=false => le prochain nextval renvoie EXACTEMENT cette valeur
-- (>= MINVALUE 83457). Pas de is_called=true ici: setval(83456) violerait MINVALUE.
SELECT setval('tecdoc_map.type_id_seq',
              GREATEST(83457, (SELECT coalesce(max(type_id_i), 83456) + 1 FROM public.auto_type)), false);

-- 2) Allocateur gouverné, idempotent. SEULE voie sanctionnée pour minter un type_id.
CREATE OR REPLACE FUNCTION tecdoc_map.allocate_massdoc_type_id(p_source_ktypnr integer)
  RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = tecdoc_map, public
AS $$
DECLARE
  v_new integer;
BEGIN
  IF p_source_ktypnr IS NULL OR p_source_ktypnr <= 0 THEN
    RAISE EXCEPTION 'allocate_massdoc_type_id: source KTYPNR must be a positive integer (got %)', p_source_ktypnr;
  END IF;

  -- Idempotent: une source déjà mappée retourne son id interne existant.
  SELECT new_id INTO v_new FROM tecdoc_map.type_id_remap WHERE old_id = p_source_ktypnr;
  IF v_new IS NOT NULL THEN
    RETURN v_new;
  END IF;

  -- Allouer le prochain id Massdoc et enregistrer le pont source atomiquement.
  v_new := nextval('tecdoc_map.type_id_seq')::integer;
  INSERT INTO tecdoc_map.type_id_remap (old_id, new_id) VALUES (p_source_ktypnr, v_new);
  RETURN v_new;
END;
$$;

COMMENT ON FUNCTION tecdoc_map.allocate_massdoc_type_id(integer) IS
  'Alloue (ou retourne l existant) un auto_type.type_id interne Massdoc-séquentiel pour un KTYPNR TecDoc source. Idempotent. Enregistre source->interne dans type_id_remap. Owner-gated. Voir ADR-085.';

-- Sécurité: cette fonction MINTE des ids — réservée au rôle gouverné.
REVOKE EXECUTE ON FUNCTION tecdoc_map.allocate_massdoc_type_id(integer) FROM PUBLIC;
-- GRANT EXECUTE ON FUNCTION tecdoc_map.allocate_massdoc_type_id(integer) TO service_role;  -- owner: décommenter si besoin runtime
