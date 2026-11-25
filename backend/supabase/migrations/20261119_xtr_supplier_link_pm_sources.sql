-- =============================================================================
-- Migration : sources d'achat ordonnées par marque (mandat DQ)
-- Date      : 2026-11-19 (décisions de Marwane du 18/11 14:30 et du 19/11
--             14:45, 14:50, 14:57, 15:04, 15:08)
-- Scope     : - public.___xtr_supplier_link_pm, ADD COLUMN : rang de la source
--               pour la marque, point de livraison, nature stock / commande,
--               surcoût fixe en centimes, auteur et date de la dernière écriture
--             - public.___xtr_supplier, ADD COLUMN spl_fallback_mode (repli
--               quand la pièce n'est pas au dépôt)
--             - CHECK nommés, index unique partiel (marque, rang), clé étrangère
--               du point de livraison
--             - fonction supplier_brand_sources_put (écriture atomique de la
--               liste ordonnée d'une marque)
--             Toutes les colonnes sont NULLABLES, sans DEFAULT. Aucune ligne
--             écrite par la migration, aucune RLS ni aucun GRANT de table modifié.
-- Forward-only. Ne réécrit AUCUNE migration historique.
-- squawk-ignore-file require-concurrent-index-creation
--   Justification : table de 108 lignes (relevé du 19/11) ; l'index reste dans
--   la transaction de la migration pour garder l'atomicité (CONCURRENTLY interdit
--   en transaction), le verrou dure le temps de lire 108 lignes.
-- =============================================================================
--
-- POURQUOI ÉTENDRE ___xtr_supplier_link_pm (et pas une table voisine) : le lien
-- marque × fournisseur existe déjà là (108 lignes, lu par supplier-truth, la
-- fiche fournisseur et le tableau de bord). Une source d'achat EST ce lien,
-- complété de son rang et de sa livraison. Une seconde table recopierait le
-- couple (marque, fournisseur) et ferait deux vérités divergentes.
--
-- ÉTAT RELEVÉ (lecture seule, 2026-11-19, base partagée) : slpm_id text PK
-- (valeurs '1'..'108', toutes numériques), slpm_pm_id, slpm_spl_id, slpm_display
-- text nullables, index sur display / pm_id / spl_id, aucune autre contrainte,
-- aucun trigger, aucune vue dépendante. RLS active, politique unique
-- ___xtr_supplier_link_pm_service_role_all, GRANT au seul service_role. Un ADD
-- COLUMN hérite des droits de la table : anon et authenticated n'obtiennent rien.
--
-- SENS DES COLONNES :
--   slpm_rank            1, 2, … : ordre d'achat de la marque. NULL = lien non
--                        classé (les 108 lignes existantes) ; il reste lu comme
--                        avant par les lecteurs historiques.
--   slpm_delivery_spl_id fiche fournisseur où la pièce arrive (ex. CS pour
--                        MEAT & DORIA en direct). NULL = chez la source elle-même,
--                        selon son spl_supply_mode. Jamais égal à la source.
--   slpm_stock_kind      'stock' (la pièce est tenue au point de livraison) ou
--                        'commande' (commandée à la demande).
--   slpm_surcharge_cents surcoût fixe par commande de la source, en centimes
--                        (ex. 300). 0 si aucun.
--   spl_fallback_mode    repli de la fiche quand la pièce n'est pas au dépôt :
--                        'transporteur' (livraison par transporteur) ou 'aucun'.
--                        NULL = non renseigné.
-- Les remises restent dans supplier_price_profiles : aucune n'est recopiée ici.
--
-- CONTRÔLES :
--   - rang unique par marque : index unique partiel (slpm_pm_id, slpm_rank) ;
--   - surcoût >= 0 : CHECK ;
--   - lien classé => nature et surcoût renseignés ; lien non classé => aucune
--     colonne de source : CHECK de cohérence ;
--   - source et point de livraison actifs (spl_status 'actif') : vérifiés par
--     supplier_brand_sources_put, seule voie d'écriture du backend.
-- Les CHECK de table et la clé étrangère sont posés NOT VALID (règles squawk
-- constraint-missing-not-valid et adding-foreign-key-constraint) : ils
-- s'appliquent à toute écriture nouvelle ; les lignes existantes ont toutes ces
-- colonnes à NULL et les satisfont.
--
-- Entiers : bigint et non integer (squawk prefer-bigint-over-int, .squawk.toml).
--
-- APPLICATION : réservée à Marwane, workflow « Apply Supabase migrations
-- (manual) », à blanc puis réel. Le code de la PR qui lit ou écrit ces colonnes
-- échoue explicitement (colonne ou fonction inconnue) tant que la migration
-- n'est pas appliquée.
-- =============================================================================

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, pg_temp;

-- Repli de la fiche fournisseur ---------------------------------------------------
ALTER TABLE public.___xtr_supplier
  ADD COLUMN IF NOT EXISTS spl_fallback_mode text
    CONSTRAINT ___xtr_supplier_spl_fallback_mode_check
    CHECK (spl_fallback_mode IN ('transporteur', 'aucun'));

-- Source d'achat sur le lien marque × fournisseur ------------------------------
ALTER TABLE public.___xtr_supplier_link_pm
  ADD COLUMN IF NOT EXISTS slpm_rank bigint
    CONSTRAINT ___xtr_supplier_link_pm_slpm_rank_check
    CHECK (slpm_rank >= 1 AND slpm_rank <= 50);

ALTER TABLE public.___xtr_supplier_link_pm
  ADD COLUMN IF NOT EXISTS slpm_delivery_spl_id text;

ALTER TABLE public.___xtr_supplier_link_pm
  ADD COLUMN IF NOT EXISTS slpm_stock_kind text
    CONSTRAINT ___xtr_supplier_link_pm_slpm_stock_kind_check
    CHECK (slpm_stock_kind IN ('stock', 'commande'));

ALTER TABLE public.___xtr_supplier_link_pm
  ADD COLUMN IF NOT EXISTS slpm_surcharge_cents bigint
    CONSTRAINT ___xtr_supplier_link_pm_slpm_surcharge_cents_check
    CHECK (slpm_surcharge_cents >= 0 AND slpm_surcharge_cents <= 100000);

ALTER TABLE public.___xtr_supplier_link_pm
  ADD COLUMN IF NOT EXISTS slpm_updated_at timestamptz;

ALTER TABLE public.___xtr_supplier_link_pm
  ADD COLUMN IF NOT EXISTS slpm_updated_by text;

-- Cohérence d'une source classée.
ALTER TABLE public.___xtr_supplier_link_pm
  DROP CONSTRAINT IF EXISTS ___xtr_supplier_link_pm_source_shape;
ALTER TABLE public.___xtr_supplier_link_pm
  ADD CONSTRAINT ___xtr_supplier_link_pm_source_shape
  CHECK (
    (slpm_rank IS NULL
      AND slpm_delivery_spl_id IS NULL
      AND slpm_stock_kind IS NULL
      AND slpm_surcharge_cents IS NULL)
    OR
    (slpm_rank IS NOT NULL
      AND slpm_stock_kind IS NOT NULL
      AND slpm_surcharge_cents IS NOT NULL
      AND slpm_delivery_spl_id IS DISTINCT FROM slpm_spl_id)
  )
  NOT VALID;

-- Une écriture porte toujours son auteur et sa date ensemble.
ALTER TABLE public.___xtr_supplier_link_pm
  DROP CONSTRAINT IF EXISTS ___xtr_supplier_link_pm_updated_pair;
ALTER TABLE public.___xtr_supplier_link_pm
  ADD CONSTRAINT ___xtr_supplier_link_pm_updated_pair
  CHECK ((slpm_updated_at IS NULL) = (slpm_updated_by IS NULL))
  NOT VALID;

-- Le point de livraison est une fiche fournisseur existante (spl_id text PK ;
-- l'archivage n'efface jamais une fiche, il passe spl_status à 'archive').
ALTER TABLE public.___xtr_supplier_link_pm
  DROP CONSTRAINT IF EXISTS ___xtr_supplier_link_pm_delivery_spl_fkey;
ALTER TABLE public.___xtr_supplier_link_pm
  ADD CONSTRAINT ___xtr_supplier_link_pm_delivery_spl_fkey
  FOREIGN KEY (slpm_delivery_spl_id) REFERENCES public.___xtr_supplier (spl_id)
  NOT VALID;

-- Rang unique par marque (les liens non classés, rang NULL, n'entrent pas).
CREATE UNIQUE INDEX IF NOT EXISTS ___xtr_supplier_link_pm_brand_rank_uniq
  ON public.___xtr_supplier_link_pm (slpm_pm_id, slpm_rank)
  WHERE slpm_rank IS NOT NULL;

COMMENT ON COLUMN public.___xtr_supplier.spl_fallback_mode IS
  'Repli quand la pièce n''est pas au dépôt de la fiche : transporteur (livraison par transporteur) ou aucun. NULL = non renseigné. Saisi par l''écran de fiche (mandat DQ).';
COMMENT ON COLUMN public.___xtr_supplier_link_pm.slpm_rank IS
  'Rang d''achat de la source pour la marque (1 = première). NULL = lien non classé. Unique par marque. Écrit par supplier_brand_sources_put seulement.';
COMMENT ON COLUMN public.___xtr_supplier_link_pm.slpm_delivery_spl_id IS
  'Fiche fournisseur où la pièce arrive (ex. CS). NULL = chez la source elle-même, selon son spl_supply_mode.';
COMMENT ON COLUMN public.___xtr_supplier_link_pm.slpm_stock_kind IS
  'stock (pièce tenue au point de livraison) ou commande (commandée à la demande). Renseigné sur toute source classée.';
COMMENT ON COLUMN public.___xtr_supplier_link_pm.slpm_surcharge_cents IS
  'Surcoût fixe de la source en centimes (ex. 300). 0 si aucun. Les remises restent dans supplier_price_profiles.';
COMMENT ON COLUMN public.___xtr_supplier_link_pm.slpm_updated_by IS
  'Auteur de la dernière écriture de source (identifiant du compte admin), avec slpm_updated_at.';

-- Écriture atomique de la liste ordonnée d'une marque ----------------------------
--
-- p_sources : tableau JSON ordonné ; la position donne le rang (1, 2, …).
-- Chaque élément : {"spl_id": "45", "link_id": "97" | null,
--   "delivery_spl_id": "21" | null, "stock_kind": "stock" | "commande",
--   "surcharge_cents": 300}
-- link_id absent : le lien (marque, source) affiché et non encore utilisé par
-- cet appel est repris ; s'il n'y en a pas, un lien est créé (slpm_display '1',
-- slpm_id = plus grand id numérique + 1). Un tableau vide déclasse toutes les
-- sources de la marque. Les liens déclassés gardent leur ligne (rang NULL) :
-- aucune ligne n'est jamais supprimée.
CREATE OR REPLACE FUNCTION public.supplier_brand_sources_put(
  p_pm_id   text,
  p_sources jsonb,
  p_by      text
) RETURNS TABLE (link_id text, source_rank bigint, created boolean)
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item     jsonb;
  v_rank     bigint;
  v_spl      text;
  v_link     text;
  v_delivery text;
  v_kind     text;
  v_cents    bigint;
  v_status   text;
  v_display  text;
  v_link_pm  text;
  v_link_spl text;
  v_created  boolean;
  v_used     text[] := ARRAY[]::text[];
BEGIN
  IF p_pm_id IS NULL OR p_pm_id !~ '^[0-9]{1,9}$'
     OR p_by IS NULL OR btrim(p_by) = '' THEN
    RAISE EXCEPTION 'supplier_brand_sources_put: marque et auteur requis'
      USING ERRCODE = '22023';
  END IF;
  IF p_sources IS NULL OR jsonb_typeof(p_sources) <> 'array' THEN
    RAISE EXCEPTION 'supplier_brand_sources_put: liste de sources attendue'
      USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_sources) > 50 THEN
    RAISE EXCEPTION 'supplier_brand_sources_put: 50 sources au plus'
      USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.pieces_marque m WHERE m.pm_id = p_pm_id::integer
  ) THEN
    RAISE EXCEPTION 'supplier_brand_sources_put: marque % inconnue', p_pm_id
      USING ERRCODE = '22023';
  END IF;

  -- Écritures d'une même marque l'une après l'autre (libéré en fin de tx).
  PERFORM pg_advisory_xact_lock(
    hashtextextended('supplier_brand_sources|' || p_pm_id, 0)
  );

  -- Déclasse d'abord toute la marque : la liste reçue la remplace en entier et
  -- l'index unique (marque, rang) ne voit jamais deux rangs égaux.
  UPDATE public.___xtr_supplier_link_pm l
  SET slpm_rank = NULL,
      slpm_delivery_spl_id = NULL,
      slpm_stock_kind = NULL,
      slpm_surcharge_cents = NULL,
      slpm_updated_at = now(),
      slpm_updated_by = p_by
  WHERE l.slpm_pm_id = p_pm_id
    AND l.slpm_rank IS NOT NULL;

  FOR v_item, v_rank IN
    SELECT e.value, e.ordinality
    FROM jsonb_array_elements(p_sources) WITH ORDINALITY AS e(value, ordinality)
  LOOP
    IF jsonb_typeof(v_item) <> 'object' THEN
      RAISE EXCEPTION 'supplier_brand_sources_put: rang % : objet attendu', v_rank
        USING ERRCODE = '22023';
    END IF;
    v_spl      := v_item->>'spl_id';
    v_link     := nullif(v_item->>'link_id', '');
    v_delivery := nullif(v_item->>'delivery_spl_id', '');
    v_kind     := v_item->>'stock_kind';
    IF coalesce(v_item->>'surcharge_cents', '0') !~ '^[0-9]{1,6}$' THEN
      RAISE EXCEPTION 'supplier_brand_sources_put: rang % : surcoût entier >= 0 attendu', v_rank
        USING ERRCODE = '22023';
    END IF;
    v_cents := coalesce(v_item->>'surcharge_cents', '0')::bigint;
    IF v_kind IS NULL OR v_kind NOT IN ('stock', 'commande') THEN
      RAISE EXCEPTION 'supplier_brand_sources_put: rang % : nature stock ou commande attendue', v_rank
        USING ERRCODE = '22023';
    END IF;

    -- Source : fiche existante et active.
    SELECT s.spl_status INTO v_status
    FROM public.___xtr_supplier s WHERE s.spl_id = v_spl;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'supplier_brand_sources_put: rang % : fournisseur % inconnu', v_rank, v_spl
        USING ERRCODE = '22023';
    END IF;
    IF v_status IS DISTINCT FROM 'actif' THEN
      RAISE EXCEPTION 'supplier_brand_sources_put: rang % : fournisseur % non actif (%)',
        v_rank, v_spl, coalesce(v_status, 'non renseigné')
        USING ERRCODE = '22023';
    END IF;

    -- Point de livraison : autre fiche, existante et active.
    IF v_delivery IS NOT NULL THEN
      IF v_delivery = v_spl THEN
        v_delivery := NULL;
      ELSE
        SELECT s.spl_status INTO v_status
        FROM public.___xtr_supplier s WHERE s.spl_id = v_delivery;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'supplier_brand_sources_put: rang % : point de livraison % inconnu', v_rank, v_delivery
            USING ERRCODE = '22023';
        END IF;
        IF v_status IS DISTINCT FROM 'actif' THEN
          RAISE EXCEPTION 'supplier_brand_sources_put: rang % : point de livraison % non actif (%)',
            v_rank, v_delivery, coalesce(v_status, 'non renseigné')
            USING ERRCODE = '22023';
        END IF;
      END IF;
    END IF;

    v_created := false;
    IF v_link IS NOT NULL THEN
      SELECT l.slpm_pm_id, l.slpm_spl_id, l.slpm_display
        INTO v_link_pm, v_link_spl, v_display
      FROM public.___xtr_supplier_link_pm l
      WHERE l.slpm_id = v_link
      FOR UPDATE;
      IF NOT FOUND OR v_link_pm IS DISTINCT FROM p_pm_id
         OR v_link_spl IS DISTINCT FROM v_spl THEN
        RAISE EXCEPTION 'supplier_brand_sources_put: rang % : le lien % ne relie pas la marque % au fournisseur %',
          v_rank, v_link, p_pm_id, v_spl
          USING ERRCODE = '22023';
      END IF;
      IF v_display IS DISTINCT FROM '1' THEN
        RAISE EXCEPTION 'supplier_brand_sources_put: rang % : le lien % est masqué', v_rank, v_link
          USING ERRCODE = '22023';
      END IF;
      IF v_link = ANY (v_used) THEN
        RAISE EXCEPTION 'supplier_brand_sources_put: rang % : le lien % est déjà classé', v_rank, v_link
          USING ERRCODE = '22023';
      END IF;
    ELSE
      SELECT l.slpm_id INTO v_link
      FROM public.___xtr_supplier_link_pm l
      WHERE l.slpm_pm_id = p_pm_id
        AND l.slpm_spl_id = v_spl
        AND l.slpm_display = '1'
        AND NOT (l.slpm_id = ANY (v_used))
      ORDER BY l.slpm_id::bigint
      LIMIT 1
      FOR UPDATE;
      IF v_link IS NULL THEN
        IF EXISTS (
          SELECT 1 FROM public.___xtr_supplier_link_pm l
          WHERE l.slpm_pm_id = p_pm_id AND l.slpm_spl_id = v_spl
            AND l.slpm_display IS DISTINCT FROM '1'
            AND NOT (l.slpm_id = ANY (v_used))
        ) THEN
          RAISE EXCEPTION 'supplier_brand_sources_put: rang % : le lien de la marque % avec le fournisseur % est masqué',
            v_rank, p_pm_id, v_spl
            USING ERRCODE = '22023';
        END IF;
        -- Allocation d'id sérialisée (slpm_id text, valeurs numériques).
        PERFORM pg_advisory_xact_lock(hashtextextended('xtr_supplier_link_pm|id', 0));
        SELECT (coalesce(max(l.slpm_id::bigint), 0) + 1)::text INTO v_link
        FROM public.___xtr_supplier_link_pm l
        WHERE l.slpm_id ~ '^[0-9]{1,18}$';
        INSERT INTO public.___xtr_supplier_link_pm (slpm_id, slpm_pm_id, slpm_spl_id, slpm_display)
        VALUES (v_link, p_pm_id, v_spl, '1');
        v_created := true;
      END IF;
    END IF;

    UPDATE public.___xtr_supplier_link_pm l
    SET slpm_rank = v_rank,
        slpm_delivery_spl_id = v_delivery,
        slpm_stock_kind = v_kind,
        slpm_surcharge_cents = v_cents,
        slpm_updated_at = now(),
        slpm_updated_by = p_by
    WHERE l.slpm_id = v_link;

    v_used := v_used || v_link;
    link_id := v_link;
    source_rank := v_rank;
    created := v_created;
    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.supplier_brand_sources_put(text, jsonb, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.supplier_brand_sources_put(text, jsonb, text)
  TO service_role;

COMMENT ON FUNCTION public.supplier_brand_sources_put(text, jsonb, text) IS
  'Remplace en une transaction la liste ordonnée des sources d''achat d''une marque (___xtr_supplier_link_pm : rang, point de livraison, stock/commande, surcoût, auteur). Sources et points de livraison actifs seulement ; crée le lien manquant, ne supprime aucune ligne. SECURITY INVOKER, appelée par le backend (service_role) depuis l''écran admin (mandat DQ).';
