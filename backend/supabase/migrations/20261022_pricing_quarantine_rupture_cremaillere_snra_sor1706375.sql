-- =============================================================================
-- Migration : retirer de la vente la crémaillère de direction SNRA SOR1706375
-- Date      : 2026-10-22 (décision owner)
-- Scope     : public.pieces (piece_display) et public.pieces_price (pri_dispo,
--             pricing_state, pricing_state_reason, pricing_updated_by,
--             pricing_updated_source), une pièce (8415883, gamme 286) et sa
--             seule ligne tarif. Rien d'autre.
-- Forward-only. Ne réécrit AUCUNE migration historique.
-- =============================================================================
--
-- POURQUOI — rupture fournisseur confirmée par l'owner le 2026-10-22 : la réf
-- SNRA SOR1706375 n'est plus livrable par son fournisseur (SOREA), et une
-- commande payée a dû être annulée. Une pièce en rupture qui reste commandable
-- produit une nouvelle commande impossible à livrer.
--
-- POURQUOI LE RETRAIT ET NON LA SEULE MISE EN RUPTURE — mesure du 2026-10-22 sur
-- get_listing_products_extended_filtered(286, type), pièce comprise :
--   type 16206 : 12 pièces | 16500 : 12 | 16501 : 12 | 16502 : 11 | 18856 : 9
-- Retirée, chaque page véhicule × gamme garde au moins 8 pièces : aucune ne
-- tombe à 0, aucune ne passe sous le seuil d'indexabilité R2 (2 pièces). La
-- pièce sort donc de la grille (piece_display = false), comme les sphères C00282
-- (migration 20261018).
--
-- POURQUOI AUSSI pri_dispo = '0' — piece_display ne suffit pas à arrêter la
-- vente : le panier (cart-data.service, addCartItem) ne refuse qu'une pièce sans
-- tarif vendable, et PiecePriceDataService ne retient que pri_dispo = '1' à prix
-- positif ; aucun des deux ne lit piece_display. Une grille encore servie par
-- les caches Redis ou Cloudflare, ou un lien direct vers la pièce, laisserait
-- l'ajouter au panier. Avec pri_dispo = '0', l'ajout est refusé dès
-- l'application, en lecture directe de la base.
--
-- pricing_state = 'FROZEN' + motif lisible : l'import tarif (pricing_commit_chunk)
-- et l'activation (pricing_activate_chunk) sautent les lignes FROZEN, donc le
-- retrait tient au prochain import. Aucune ligne pieces_price_history ne porte
-- cette pièce : aucun retour arrière de lot ne peut la remettre en vente.
-- Pourquoi pas les outils du module prix : PUT /api/admin/stock/:pieceId/
-- availability pose pri_dispo sans motif, sans FROZEN ni retour arrière borné
-- (l'import suivant le défait) ; POST /api/admin/pricing/display/quarantine agit
-- sur une marque entière. Le module prix n'est pas modifié ici.
--
-- GARDE SEO : chaque page véhicule × gamme 286 qui listait la pièce doit la
-- perdre, et elle seule, en gardant au moins une pièce. Contrôle sur la fonction
-- qui construit la grille servie, avant et après l'écriture.
--
-- EFFETS CONNUS (grille des pages R2 : à l'expiration des caches Redis et
-- Cloudflare ; panier : immédiat, lecture en base) :
--   * la pièce disparaît des grilles R2 des 5 pages véhicule ;
--   * elle n'est plus commandable depuis le site.
--
-- HORS LOT, VOLONTAIREMENT : prix, pieces_price_history, compatibilité
-- (pieces_relation_type, pieces_ref_search), panier, commandes. Seul trigger
-- déclenché : pieces_search_vector_update (recalcul du vecteur de recherche de la
-- ligne pieces) ; pieces_price n'a aucun trigger.
--
-- IDEMPOTENT ET REJOUABLE : la pièce est acceptée dans son état mesuré (affichée,
-- tarif pri_dispo '1', ACTIVE, sans motif) ou déjà retirée par ce fichier
-- (masquée, tarif pri_dispo '0', FROZEN, pricing_updated_source = ce fichier).
-- Tout autre état interrompt la migration. Les UPDATE ne touchent que l'état
-- mesuré.
--
-- APPLICATION : par le moteur du dépôt uniquement (Actions → « 🗄️ Apply Supabase
-- migrations (manual) », dry_run puis confirm = APPLY, only_ids = cet
-- identifiant), après fusion sur main — jamais par un canal qui contourne
-- infra.schema_migrations. Le bloc $precheck$ se joue seul en lecture seule
-- avant la fusion. Zone STOP prix/stock : GO nominatif de l'owner du 2026-10-22.
--
-- ROLLBACK : 20261022_pricing_quarantine_rupture_cremaillere_snra_sor1706375.down.sql,
-- à lancer à la main si le fournisseur reconfirme la dispo (le moteur est
-- forward-only).
-- =============================================================================

-- Pas de BEGIN/COMMIT explicite : le moteur applique ce fichier dans une
-- transaction (.squawk.toml `assume_in_transaction = true`). Les UPDATE prennent
-- un verrou sur une ligne de chaque table, aucune réécriture de table.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, pg_temp;

-- §0 — PRÉ-CONDITIONS, en lecture seule (rejouables avant la fusion) : la base
-- doit encore être celle du relevé, sinon la décision est à reprendre.
DO $precheck$
DECLARE
  c_piece  CONSTANT integer := 8415883;
  c_source CONSTANT text := 'backend/supabase/migrations/20261022_pricing_quarantine_rupture_cremaillere_snra_sor1706375.sql';
  r        record;
  v_shown  boolean;
  v_n      bigint;
  v_types  bigint;
  v_absent bigint;
  v_min    bigint;
BEGIN
  SELECT p.piece_ref, p.piece_pm_id, p.piece_pg_id, p.piece_display INTO r
    FROM public.pieces p
   WHERE p.piece_id = c_piece;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ABORT: pièce % introuvable', c_piece;
  END IF;
  IF r.piece_ref IS DISTINCT FROM 'SOR1706375' OR r.piece_pm_id::integer IS DISTINCT FROM 4310
     OR r.piece_pg_id::integer IS DISTINCT FROM 286 THEN
    RAISE EXCEPTION 'ABORT: pièce % — réf/marque/gamme « SOR1706375/4310/286 » attendues, « %/%/% » trouvées',
      c_piece, r.piece_ref, r.piece_pm_id, r.piece_pg_id;
  END IF;
  v_shown := r.piece_display;

  -- Exactement une ligne tarif, par les deux colonnes d'identifiant (la grille lit
  -- pri_piece_id, le panier pri_piece_id_i) : une ligne oubliée laisserait la
  -- pièce vendable.
  SELECT count(*) INTO v_n
    FROM public.pieces_price pp
   WHERE pp.pri_piece_id_i = c_piece OR pp.pri_piece_id = c_piece::text;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'ABORT: pièce % — % ligne(s) pieces_price, 1 attendue', c_piece, v_n;
  END IF;

  SELECT pp.pri_piece_id_i, pp.pri_piece_id, pp.pri_frs, pp.pri_dispo, pp.pricing_state,
         pp.pricing_state_reason, pp.pricing_updated_by, pp.pricing_updated_source INTO r
    FROM public.pieces_price pp
   WHERE pp.pri_piece_id_i = c_piece OR pp.pri_piece_id = c_piece::text;
  IF r.pri_piece_id_i IS DISTINCT FROM c_piece OR r.pri_piece_id IS DISTINCT FROM c_piece::text
     OR r.pri_frs IS DISTINCT FROM 'SOREA' THEN
    RAISE EXCEPTION 'ABORT: pièce % — ligne tarif « %/%/% », « %/%/SOREA » attendue',
      c_piece, r.pri_piece_id_i, r.pri_piece_id, r.pri_frs, c_piece, c_piece;
  END IF;

  IF v_shown IS TRUE AND r.pri_dispo = '1' AND r.pricing_state = 'ACTIVE'
     AND r.pricing_state_reason IS NULL AND r.pricing_updated_by IS NULL
     AND r.pricing_updated_source IS NULL THEN
    -- État mesuré : la pièce doit figurer dans la grille servie de chaque page qui
    -- la relie, et chaque page garder au moins une autre pièce.
    WITH types AS (
      SELECT DISTINCT rt.rtp_type_id::bigint AS tid
        FROM public.pieces_relation_type rt
       WHERE rt.rtp_pg_id = 286
         AND rt.rtp_piece_id = c_piece
    ), grid AS (
      SELECT t.tid,
             count(g.id) FILTER (WHERE g.id = c_piece) AS listed,
             count(g.id) FILTER (WHERE g.id <> c_piece) AS others
        FROM types t
        LEFT JOIN LATERAL public.get_listing_products_extended_filtered(286, t.tid, 1000) g ON true
       GROUP BY t.tid
    )
    SELECT count(*), count(*) FILTER (WHERE listed <> 1), min(others)
      INTO v_types, v_absent, v_min
      FROM grid;
    IF v_types = 0 OR v_absent > 0 OR v_min < 1 THEN
      RAISE EXCEPTION 'ABORT: grille — % type(s) relié(s), pièce absente de % grille(s), minimum % autre(s) pièce(s) : une page tomberait à 0',
        v_types, v_absent, v_min;
    END IF;
    RAISE NOTICE 'pré-condition retrait SNRA SOR1706375 : OK (% page(s) véhicule la listent, au moins % autre(s) pièce(s) chacune)',
      v_types, v_min;
  ELSIF v_shown IS FALSE AND r.pri_dispo = '0' AND r.pricing_state = 'FROZEN'
        AND r.pricing_updated_source = c_source THEN
    RAISE NOTICE 'pré-condition retrait SNRA SOR1706375 : déjà retirée par ce fichier (rejeu)';
  ELSE
    RAISE EXCEPTION 'ABORT: pièce % — piece_display=%, tarif pri_dispo=% / % / source=% : ni mesuré ni retiré par ce fichier, la base a changé depuis le relevé',
      c_piece, v_shown, r.pri_dispo, r.pricing_state, r.pricing_updated_source;
  END IF;
END
$precheck$;

-- §1 — ÉCRITURE ET POST-CONDITIONS : la grille de chaque page est relevée avant
-- et après, dans la même transaction ; tout écart annule l'écriture.
DO $quarantine$
DECLARE
  c_piece  CONSTANT integer := 8415883;
  c_gamme  CONSTANT integer := 286;
  c_source CONSTANT text := 'backend/supabase/migrations/20261022_pricing_quarantine_rupture_cremaillere_snra_sor1706375.sql';
  c_by     CONSTANT text := 'quarantine-owner-go-2026-10-22';
  c_reason CONSTANT text := 'Rupture fournisseur confirmée par l''owner le 2026-10-22 : crémaillère de direction '
                         || 'SNRA SOR1706375, fournisseur SOREA. Pièce retirée de la grille et non commandable. '
                         || 'Réversible par le fichier .down.sql de cette migration.';
  v_before jsonb;
  v_hidden bigint;
  v_set    bigint;
  v_n      bigint;
  v_types  bigint;
  v_bad    bigint;
BEGIN
  -- Pièces autres que celle-ci, par page : la grille doit les garder toutes.
  SELECT coalesce(jsonb_object_agg(x.tid::text, x.others), '{}') INTO v_before
    FROM (SELECT t.tid, count(g.id) FILTER (WHERE g.id <> c_piece) AS others
            FROM (SELECT DISTINCT rt.rtp_type_id::bigint AS tid
                    FROM public.pieces_relation_type rt
                   WHERE rt.rtp_pg_id = c_gamme
                     AND rt.rtp_piece_id = c_piece) t
            LEFT JOIN LATERAL public.get_listing_products_extended_filtered(c_gamme, t.tid, 1000) g ON true
           GROUP BY t.tid) x;

  UPDATE public.pieces
     SET piece_display = false
   WHERE piece_id = c_piece
     AND piece_display = true;
  GET DIAGNOSTICS v_hidden = ROW_COUNT;            -- 1 maintenant, 0 au rejeu

  UPDATE public.pieces_price
     SET pri_dispo              = '0',
         pricing_state          = 'FROZEN',
         pricing_state_reason   = c_reason,
         pricing_updated_by     = c_by,
         pricing_updated_source = c_source
   WHERE pri_piece_id_i = c_piece
     AND pri_piece_id = c_piece::text
     AND pri_dispo = '1'
     AND pricing_state = 'ACTIVE'
     AND pricing_state_reason IS NULL
     AND pricing_updated_by IS NULL
     AND pricing_updated_source IS NULL;
  GET DIAGNOSTICS v_set = ROW_COUNT;               -- 1 maintenant, 0 au rejeu

  IF v_hidden <> v_set THEN
    RAISE EXCEPTION 'ABORT: post-condition — % pièce masquée, % ligne tarif retirée : les deux ou aucune',
      v_hidden, v_set;
  END IF;

  SELECT count(*) INTO v_n
    FROM public.pieces p
    JOIN public.pieces_price pp ON pp.pri_piece_id_i = p.piece_id
   WHERE p.piece_id = c_piece
     AND p.piece_display = false
     AND pp.pri_dispo = '0'
     AND pp.pricing_state = 'FROZEN'
     AND pp.pricing_updated_source = c_source;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'ABORT: post-condition — % / 1 pièce retirée de la vente', v_n;
  END IF;

  -- Garde SEO : chaque page perd la pièce et elle seule, et garde au moins une
  -- pièce.
  WITH types AS (
    SELECT DISTINCT rt.rtp_type_id::bigint AS tid
      FROM public.pieces_relation_type rt
     WHERE rt.rtp_pg_id = c_gamme
       AND rt.rtp_piece_id = c_piece
  ), grid AS (
    SELECT t.tid,
           count(g.id) AS n,
           count(g.id) FILTER (WHERE g.id = c_piece) AS listed
      FROM types t
      LEFT JOIN LATERAL public.get_listing_products_extended_filtered(c_gamme, t.tid, 1000) g ON true
     GROUP BY t.tid
  )
  SELECT count(*),
         count(*) FILTER (WHERE listed <> 0 OR n < 1
                             OR n IS DISTINCT FROM (v_before ->> tid::text)::bigint)
    INTO v_types, v_bad
    FROM grid;
  IF v_types = 0 OR v_types <> (SELECT count(*) FROM jsonb_object_keys(v_before)) OR v_bad > 0 THEN
    RAISE EXCEPTION 'ABORT: garde SEO — % page(s) relevée(s) avant, % après, % en écart (pièce encore listée, autre pièce perdue ou page vide)',
      (SELECT count(*) FROM jsonb_object_keys(v_before)), v_types, v_bad;
  END IF;

  RAISE NOTICE 'retrait SNRA SOR1706375 : % pièce retirée maintenant (0 = rejeu), % page(s) véhicule sans elle, chacune avec ses autres pièces',
    v_set, v_types;
END
$quarantine$;
