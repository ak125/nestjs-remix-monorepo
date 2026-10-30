-- =============================================================================
-- Migration : mettre en rupture le jeu émetteur/récepteur d'embrayage LUK 513 0041 10
-- Date      : 2026-10-21 (décision owner)
-- Scope     : public.pieces_price, une seule ligne (pièce 3283437, gamme 234) :
--             pri_dispo, pricing_state, pricing_state_reason, pricing_updated_by,
--             pricing_updated_source. Rien d'autre.
-- Forward-only. Ne réécrit AUCUNE migration historique.
-- =============================================================================
--
-- POURQUOI — rupture fournisseur confirmée par l'owner le 2026-10-21 : la réf
-- LUK 513 0041 10 n'est plus livrable par son fournisseur (ACR), et une commande
-- payée a dû être annulée avant encaissement. Une pièce en rupture qui reste
-- commandable produit une nouvelle commande impossible à livrer.
--
-- POURQUOI LA RUPTURE ET NON LE RETRAIT (piece_display = false) — mesure du
-- 2026-10-21 sur get_listing_products_extended_filtered(234, type) :
--   type 5354 : 1 pièce | 5627 : 2 | 7870 : 1 | 7871 : 2 | 9981 : 6 | 9982 : 6
-- La pièce est seule dans la grille de 2 pages véhicule × gamme (types 5354 et
-- 7870) : la retirer les ferait tomber à 0 pièce, donc en noindex. La rupture la
-- laisse dans la grille, affichée « Indisponible » :
--   * get_listing_products_extended_filtered ne lit que les tarifs pri_dispo
--     '1' à '3' : la pièce reste listée (filtre piece_display), sans prix,
--     stock_status 'OUT_OF_STOCK', dispo non vraie ;
--   * le site ne la propose plus à l'achat : le panier (PiecePriceDataService,
--     cart-data.service) n'accepte que pri_dispo = '1' à prix positif, la page
--     produit la marque non vendable, la recherche ne lit que pri_dispo = '1' ;
--   * indexabilité R2 (frontend r2-indexability.ts, règle servie tant que
--     SEO_R2_SELLABLE_NOINDEX_ENABLED est à false) : une pièce + qualité 80
--     (marque et image présentes, prix absent) reste au-dessus du seuil de 50 ;
--     les 2 pages restent indexables. Si ce flag passe un jour à true, une page
--     sans pièce vendable passe en noindex : ces 2 pages en feraient partie.
-- pricing_state = 'FROZEN' + motif lisible : l'import tarif (pricing_commit_chunk)
-- et l'activation (pricing_activate_chunk) sautent les lignes FROZEN, donc la
-- rupture tient au prochain import. Aucune ligne pieces_price_history ne porte
-- cette pièce : aucun retour arrière de lot ne peut remettre pri_dispo à '1'.
-- Pourquoi pas PUT /api/admin/stock/:pieceId/availability : il pose pri_dispo
-- sans motif, sans FROZEN ni retour arrière borné, et l'import suivant le défait.
-- Le module prix n'est pas modifié ici.
--
-- GARDE SEO : chaque page véhicule × gamme 234 qui liste la pièce doit garder le
-- même nombre de pièces, la pièce comprise et marquée 'OUT_OF_STOCK'. Contrôle
-- sur la fonction qui construit la grille servie, avant et après l'écriture.
--
-- EFFETS CONNUS (prix et badge des pages R2 : à l'expiration des caches Redis et
-- Cloudflare ; panier et recherche : immédiat, lecture en base) :
--   * la pièce reste visible sur les 6 pages véhicule, « Indisponible », sans prix ;
--   * elle n'est plus commandable depuis le site.
--
-- HORS LOT, VOLONTAIREMENT : piece_display (la pièce reste affichée), prix,
-- pieces_price_history, compatibilité (pieces_relation_type, pieces_ref_search),
-- panier, commandes. pieces_price ne porte aucun trigger.
--
-- IDEMPOTENT ET REJOUABLE : la ligne est acceptée dans son état mesuré (pri_dispo
-- '1', ACTIVE, sans motif) ou déjà mise en rupture par ce fichier (pri_dispo '0',
-- FROZEN, pricing_updated_source = ce fichier). Tout autre état interrompt la
-- migration. L'UPDATE ne touche la ligne que dans son état mesuré.
--
-- APPLICATION : par le moteur du dépôt uniquement (Actions → « 🗄️ Apply Supabase
-- migrations (manual) », dry_run puis confirm = APPLY, only_ids = cet
-- identifiant), après fusion sur main — jamais par un canal qui contourne
-- infra.schema_migrations. Le bloc $precheck$ se joue seul en lecture seule
-- avant la fusion. Zone STOP prix/stock : GO nominatif de l'owner du 2026-10-21.
--
-- ROLLBACK : 20261021_pricing_rupture_emetteur_embrayage_luk_5130041.down.sql, à
-- lancer à la main si le fournisseur reconfirme la dispo (le moteur est
-- forward-only).
-- =============================================================================

-- Pas de BEGIN/COMMIT explicite : le moteur applique ce fichier dans une
-- transaction (.squawk.toml `assume_in_transaction = true`). L'UPDATE prend un
-- verrou sur une seule ligne, aucune réécriture de table.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, pg_temp;

-- §0 — PRÉ-CONDITIONS, en lecture seule (rejouables avant la fusion) : la base
-- doit encore être celle du relevé, sinon la décision est à reprendre.
DO $precheck$
DECLARE
  c_piece  CONSTANT integer := 3283437;
  c_source CONSTANT text := 'backend/supabase/migrations/20261021_pricing_rupture_emetteur_embrayage_luk_5130041.sql';
  r        record;
  v_n      bigint;
  v_types  bigint;
  v_absent bigint;
BEGIN
  SELECT p.piece_ref, p.piece_pm_id, p.piece_pg_id, p.piece_display INTO r
    FROM public.pieces p
   WHERE p.piece_id = c_piece;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ABORT: pièce % introuvable', c_piece;
  END IF;
  IF r.piece_ref IS DISTINCT FROM '513 0041 10' OR r.piece_pm_id::integer IS DISTINCT FROM 2860
     OR r.piece_pg_id::integer IS DISTINCT FROM 234 THEN
    RAISE EXCEPTION 'ABORT: pièce % — réf/marque/gamme « 513 0041 10/2860/234 » attendues, « %/%/% » trouvées',
      c_piece, r.piece_ref, r.piece_pm_id, r.piece_pg_id;
  END IF;
  IF r.piece_display IS NOT TRUE THEN
    RAISE EXCEPTION 'ABORT: pièce % masquée (piece_display=%) : la rupture suppose une pièce affichée',
      c_piece, r.piece_display;
  END IF;

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
     OR r.pri_frs IS DISTINCT FROM 'ACR' THEN
    RAISE EXCEPTION 'ABORT: pièce % — ligne tarif « %/%/% », « %/%/ACR » attendue',
      c_piece, r.pri_piece_id_i, r.pri_piece_id, r.pri_frs, c_piece, c_piece;
  END IF;
  IF NOT ((r.pri_dispo = '1' AND r.pricing_state = 'ACTIVE' AND r.pricing_state_reason IS NULL
           AND r.pricing_updated_by IS NULL AND r.pricing_updated_source IS NULL)
          OR (r.pri_dispo = '0' AND r.pricing_state = 'FROZEN'
              AND r.pricing_updated_source = c_source)) THEN
    RAISE EXCEPTION 'ABORT: pièce % — tarif pri_dispo=% / % / source=% : ni mesuré ni mis en rupture par ce fichier, la base a changé depuis le relevé',
      c_piece, r.pri_dispo, r.pricing_state, r.pricing_updated_source;
  END IF;

  -- La pièce doit figurer dans la grille servie de chaque page qui la relie.
  WITH types AS (
    SELECT DISTINCT rt.rtp_type_id::bigint AS tid
      FROM public.pieces_relation_type rt
     WHERE rt.rtp_pg_id = 234
       AND rt.rtp_piece_id = c_piece
  ), grid AS (
    SELECT t.tid, count(g.id) FILTER (WHERE g.id = c_piece) AS listed
      FROM types t
      LEFT JOIN LATERAL public.get_listing_products_extended_filtered(234, t.tid, 1000) g ON true
     GROUP BY t.tid
  )
  SELECT count(*), count(*) FILTER (WHERE listed <> 1) INTO v_types, v_absent FROM grid;
  IF v_types = 0 OR v_absent > 0 THEN
    RAISE EXCEPTION 'ABORT: grille — % type(s) relié(s), pièce absente de % grille(s)', v_types, v_absent;
  END IF;

  RAISE NOTICE 'pré-condition rupture LUK 513 0041 10 : OK (% page(s) véhicule la listent)', v_types;
END
$precheck$;

-- §1 — ÉCRITURE ET POST-CONDITIONS : la grille de chaque page est relevée avant
-- et après, dans la même transaction ; tout écart annule l'écriture.
DO $rupture$
DECLARE
  c_piece  CONSTANT integer := 3283437;
  c_gamme  CONSTANT integer := 234;
  c_source CONSTANT text := 'backend/supabase/migrations/20261021_pricing_rupture_emetteur_embrayage_luk_5130041.sql';
  c_by     CONSTANT text := 'rupture-owner-go-2026-10-21';
  c_reason CONSTANT text := 'Rupture fournisseur confirmée par l''owner le 2026-10-21 : jeu émetteur/récepteur '
                         || 'd''embrayage LUK 513 0041 10, fournisseur ACR. Pièce laissée affichée (pages véhicule '
                         || 'gardées), non commandable. Réversible par le fichier .down.sql de cette migration.';
  v_before jsonb;
  v_set    bigint;
  v_n      bigint;
  v_types  bigint;
  v_bad    bigint;
BEGIN
  SELECT coalesce(jsonb_object_agg(x.tid::text, x.n), '{}') INTO v_before
    FROM (SELECT t.tid, count(g.id) AS n
            FROM (SELECT DISTINCT rt.rtp_type_id::bigint AS tid
                    FROM public.pieces_relation_type rt
                   WHERE rt.rtp_pg_id = c_gamme
                     AND rt.rtp_piece_id = c_piece) t
            LEFT JOIN LATERAL public.get_listing_products_extended_filtered(c_gamme, t.tid, 1000) g ON true
           GROUP BY t.tid) x;

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

  SELECT count(*) INTO v_n
    FROM public.pieces_price pp
   WHERE pp.pri_piece_id_i = c_piece
     AND pp.pri_dispo = '0'
     AND pp.pricing_state = 'FROZEN'
     AND pp.pricing_updated_source = c_source;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'ABORT: post-condition — % / 1 ligne tarif en rupture', v_n;
  END IF;

  -- Garde SEO : même nombre de pièces par page, la pièce toujours listée et
  -- marquée hors stock.
  WITH types AS (
    SELECT DISTINCT rt.rtp_type_id::bigint AS tid
      FROM public.pieces_relation_type rt
     WHERE rt.rtp_pg_id = c_gamme
       AND rt.rtp_piece_id = c_piece
  ), grid AS (
    SELECT t.tid,
           count(g.id) AS n,
           count(g.id) FILTER (WHERE g.id = c_piece AND g.stock_status = 'OUT_OF_STOCK'
                                 AND g.dispo IS NOT TRUE) AS out_of_stock
      FROM types t
      LEFT JOIN LATERAL public.get_listing_products_extended_filtered(c_gamme, t.tid, 1000) g ON true
     GROUP BY t.tid
  )
  SELECT count(*),
         count(*) FILTER (WHERE n IS DISTINCT FROM (v_before ->> tid::text)::bigint OR out_of_stock <> 1)
    INTO v_types, v_bad
    FROM grid;
  IF v_types = 0 OR v_types <> (SELECT count(*) FROM jsonb_object_keys(v_before)) OR v_bad > 0 THEN
    RAISE EXCEPTION 'ABORT: garde SEO — % page(s) relevée(s) avant, % après, % en écart (nombre de pièces changé ou pièce non listée hors stock)',
      (SELECT count(*) FROM jsonb_object_keys(v_before)), v_types, v_bad;
  END IF;

  RAISE NOTICE 'rupture LUK 513 0041 10 : % ligne tarif posée maintenant (0 = rejeu), % page(s) véhicule inchangée(s), pièce listée hors stock',
    v_set, v_types;
END
$rupture$;
