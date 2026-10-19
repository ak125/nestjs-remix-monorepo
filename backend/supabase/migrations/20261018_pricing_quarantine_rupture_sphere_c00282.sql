-- =============================================================================
-- Migration : retirer de la vente 6 sphères de suspension en rupture fournisseur
-- Date      : 2026-10-18 (décision owner) — rédigée le 2026-10-19
-- Scope     : public.pieces (piece_display) et public.pieces_price (pricing_state
--             + pricing_state_reason / pricing_updated_by / pricing_updated_source),
--             6 pièces de la gamme 1718, une ligne tarif chacune. Rien d'autre.
-- Forward-only. Ne réécrit AUCUNE migration historique.
-- =============================================================================
--
-- POURQUOI — rupture fournisseur confirmée par l'owner le 2026-10-18 :
--   * la réf SNRA C00282 est en rupture chez SOREA ;
--   * ses réfs d'origine constructeur (OEM) ont été relevées sur TecDoc, puis
--     chaque correspondance des autres marques a été interrogée au portail des
--     fournisseurs : seules FEBI (chez PAP) et CEVAM (chez CEVAM) sont livrables ;
--   * une pièce en rupture qui reste en vente produit une commande payée puis
--     annulée « pas dispo ». On la retire donc de la vente.
--
-- PÉRIMÈTRE (relevé en lecture seule le 2026-10-18, revérifié le 2026-10-19) :
-- les 6 pièces AFFICHÉES qui partagent au moins une réf OEM de C00282
-- (pieces_ref_search, prs_kind = '3') et ne sont ni FEBI ni CEVAM :
--   5660748 SNRA C00282   (fournisseur SOREA)       — la réf en rupture
--   9613328 SNRA XA230RZ  (fournisseur SOREA)
--   1008195 RCA  1202     (fournisseur RCA France)
--   1011020 RCA  1204     (fournisseur RCA France)
--   1303637 RCA  1603     (fournisseur RCA France)
--   1306850 RCA  1609     (fournisseur RCA France)
-- Restent en vente : FEBI 22493 et 22496 (PAP), CEVAM 0020, 0035, 0043 et 0089.
--
-- MÉCANISME — celui du pilote du 2026-05-31 (audit/unavailable-quarantine-plan.md,
-- niveau N1 « retrait du flux de vente »), sans nouveau système :
--   * pieces.piece_display = false retire la pièce de la grille R2
--     (get_listing_products_extended_filtered, lue par rm_get_page_complete_v2,
--     filtre sur piece_display) et du flux marchand. pri_dispo = '0' ne la
--     retirerait PAS de la grille ;
--   * pieces_price.pricing_state = 'FROZEN' + raison lisible : l'import tarif
--     (pricing_commit_chunk) et l'activation (pricing_activate_chunk) sautent les
--     lignes FROZEN, donc le retrait tient au prochain import.
-- Pourquoi pas les outils du module prix : POST /api/admin/pricing/display/
-- quarantine agit sur une marque entière et seulement sur les réfs déjà non
-- vendables (pri_dispo hors 1-3) ; or ces 6 lignes portent pri_dispo = '1'.
-- Aucun endpoint ne pose FROZEN. Le module prix n'est pas modifié ici.
--
-- GARDE SEO : aucune page véhicule × gamme 1718 ne doit tomber à 0 pièce (elle
-- passerait en noindex). Le contrôle appelle la fonction qui construit la grille
-- servie, get_listing_products_extended_filtered, pour chaque type touché. Mesure
-- du 2026-10-19 : 65 types touchés, minimum 7 pièces avant, 6 après, 0 page à 0.
--
-- EFFETS CONNUS (à l'expiration des caches Redis et Cloudflare des pages R2) :
--   * les 6 pièces disparaissent des grilles R2 des 65 types touchés ;
--   * elles ne sont plus commandables depuis le site.
--
-- HORS LOT, VOLONTAIREMENT : prix, pri_dispo, pieces_price_history (aucun prix
-- ni dispo ne change), compatibilité (pieces_relation_type, pieces_ref_search),
-- panier, commandes. Seul trigger déclenché : pieces_search_vector_update
-- (recalcul du vecteur de recherche de la ligne pieces).
--
-- IDEMPOTENT ET REJOUABLE : chaque pièce est acceptée dans son état mesuré
-- (affichée, tarif ACTIVE, pri_dispo '1', sans motif) ou déjà retirée par ce
-- fichier (masquée, FROZEN, pricing_updated_source = ce fichier). Tout autre état
-- interrompt la migration. Les UPDATE ne touchent que les pièces encore à retirer.
--
-- APPLICATION : par le moteur du dépôt uniquement (Actions → « 🗄️ Apply Supabase
-- migrations (manual) », dry_run puis confirm = APPLY, only_ids = cet
-- identifiant), après fusion sur main — jamais par un canal qui contourne
-- infra.schema_migrations. Zone STOP prix/stock : GO nominatif de l'owner du
-- 2026-10-19.
--
-- ROLLBACK : 20261018_pricing_quarantine_rupture_sphere_c00282.down.sql, à lancer
-- à la main si un fournisseur reconfirme la dispo (le moteur est forward-only).
-- =============================================================================

-- Pas de BEGIN/COMMIT explicite : le moteur applique ce fichier dans une
-- transaction (.squawk.toml `assume_in_transaction = true`). Les UPDATE prennent
-- des verrous de ligne sur 6 + 6 lignes, aucune réécriture de table.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, pg_temp;

-- Pré-conditions, écriture et post-conditions dans un seul bloc : la liste
-- n'existe qu'une fois, et tout écart l'interrompt avant ou après les UPDATE.
DO $quarantine$
DECLARE
  c_source CONSTANT text := 'backend/supabase/migrations/20261018_pricing_quarantine_rupture_sphere_c00282.sql';
  c_by     CONSTANT text := 'quarantine-owner-go-2026-10-18';
  c_reason CONSTANT text := 'Quarantaine rupture fournisseur confirmée par l''owner le 2026-10-18 : '
                         || 'correspondances OEM de la sphère de suspension SNRA C00282, seules FEBI (PAP) '
                         || 'et CEVAM (CEVAM) disponibles. Réversible par le fichier .down.sql de cette migration.';
  c_rows   CONSTANT jsonb := $json$
    [{"piece_id":5660748,"pm_id":4310,"ref":"C00282","frs":"SOREA"}
    ,{"piece_id":9613328,"pm_id":4310,"ref":"XA230RZ","frs":"SOREA"}
    ,{"piece_id":1008195,"pm_id":3900,"ref":"1202","frs":"RCA France"}
    ,{"piece_id":1011020,"pm_id":3900,"ref":"1204","frs":"RCA France"}
    ,{"piece_id":1303637,"pm_id":3900,"ref":"1603","frs":"RCA France"}
    ,{"piece_id":1306850,"pm_id":3900,"ref":"1609","frs":"RCA France"}
    ]
  $json$::jsonb;
  c_gamme  CONSTANT integer := 1718;
  r          record;
  v_ids      bigint[];
  v_pending  bigint[] := '{}';
  v_n        bigint;
  v_types    bigint;
  v_min_left bigint;
  v_hidden   bigint;
  v_frozen   bigint;
BEGIN
  -- §0 — PRÉ-CONDITIONS FAIL-CLOSED
  SELECT array_agg(DISTINCT e.piece_id) INTO v_ids
    FROM jsonb_to_recordset(c_rows) AS e(piece_id bigint);
  IF cardinality(v_ids) <> 6 OR jsonb_array_length(c_rows) <> 6 THEN
    RAISE EXCEPTION 'ABORT: liste — 6 pièces distinctes attendues, % distinctes / % lignes',
      cardinality(v_ids), jsonb_array_length(c_rows);
  END IF;

  FOR r IN
    SELECT e.piece_id, e.pm_id, e.ref, e.frs,
           p.piece_id AS found_id, p.piece_ref, p.piece_pm_id, p.piece_pg_id, p.piece_display
      FROM jsonb_to_recordset(c_rows) AS e(piece_id bigint, pm_id integer, ref text, frs text)
      LEFT JOIN public.pieces p ON p.piece_id = e.piece_id
  LOOP
    IF r.found_id IS NULL THEN
      RAISE EXCEPTION 'ABORT: pièce % introuvable', r.piece_id;
    END IF;
    IF r.piece_ref IS DISTINCT FROM r.ref OR r.piece_pm_id::integer IS DISTINCT FROM r.pm_id
       OR r.piece_pg_id::integer IS DISTINCT FROM c_gamme THEN
      RAISE EXCEPTION 'ABORT: pièce % — réf/marque/gamme « %/%/% » attendues, « %/%/% » trouvées',
        r.piece_id, r.ref, r.pm_id, c_gamme, r.piece_ref, r.piece_pm_id, r.piece_pg_id;
    END IF;

    -- Exactement une ligne tarif, du fournisseur relevé : sinon une ligne oubliée
    -- laisserait la pièce vendable, ou la liste ne décrit plus la base.
    SELECT count(*) INTO v_n FROM public.pieces_price pp WHERE pp.pri_piece_id_i = r.piece_id;
    IF v_n <> 1 THEN
      RAISE EXCEPTION 'ABORT: pièce % — % ligne(s) pieces_price, 1 attendue', r.piece_id, v_n;
    END IF;

    IF r.piece_display
       AND EXISTS (SELECT 1 FROM public.pieces_price pp
                    WHERE pp.pri_piece_id_i = r.piece_id
                      AND pp.pri_frs = r.frs
                      AND pp.pri_dispo = '1'
                      AND pp.pricing_state = 'ACTIVE'
                      AND pp.pricing_state_reason IS NULL
                      AND pp.pricing_updated_by IS NULL
                      AND pp.pricing_updated_source IS NULL) THEN
      v_pending := v_pending || r.piece_id;          -- état mesuré : à retirer
    ELSIF NOT r.piece_display
       AND EXISTS (SELECT 1 FROM public.pieces_price pp
                    WHERE pp.pri_piece_id_i = r.piece_id
                      AND pp.pri_frs = r.frs
                      AND pp.pricing_state = 'FROZEN'
                      AND pp.pricing_updated_source = c_source) THEN
      NULL;                                          -- déjà retirée par ce fichier : rejeu
    ELSE
      RAISE EXCEPTION 'ABORT: pièce % (% %) — état ni mesuré ni retiré par ce fichier (piece_display=%) : la base a changé depuis le relevé',
        r.piece_id, r.ref, r.frs, r.piece_display;
    END IF;
  END LOOP;

  -- Garde SEO, sur la grille servie elle-même : chaque page véhicule × gamme
  -- touchée doit garder au moins une pièce une fois les 6 retirées.
  IF cardinality(v_pending) > 0 THEN
    WITH types AS (
      SELECT DISTINCT r2.rtp_type_id::bigint AS tid
        FROM public.pieces_relation_type r2
       WHERE r2.rtp_pg_id = c_gamme
         AND r2.rtp_piece_id = ANY (v_ids)
    ), grid AS (
      SELECT t.tid,
             count(g.id) FILTER (WHERE g.id::bigint <> ALL (v_ids)) AS left_displayed
        FROM types t
        LEFT JOIN LATERAL public.get_listing_products_extended_filtered(c_gamme, t.tid, 1000) g ON true
       GROUP BY t.tid
    )
    SELECT count(*), min(left_displayed) INTO v_types, v_min_left FROM grid;
    IF v_types = 0 OR v_min_left < 1 THEN
      RAISE EXCEPTION 'ABORT: garde SEO — % type(s) touché(s), minimum restant % pièce(s) dans la grille : une page tomberait à 0',
        v_types, v_min_left;
    END IF;
  END IF;

  -- §1 — ÉCRITURE (pièces encore à retirer uniquement)
  UPDATE public.pieces
     SET piece_display = false
   WHERE piece_id = ANY (v_pending)
     AND piece_display = true;
  GET DIAGNOSTICS v_hidden = ROW_COUNT;

  UPDATE public.pieces_price
     SET pricing_state          = 'FROZEN',
         pricing_state_reason   = c_reason,
         pricing_updated_by     = c_by,
         pricing_updated_source = c_source
   WHERE pri_piece_id_i = ANY (v_pending)
     AND pricing_state = 'ACTIVE';
  GET DIAGNOSTICS v_frozen = ROW_COUNT;

  -- §2 — POST-CONDITIONS
  IF v_hidden <> cardinality(v_pending) OR v_frozen <> cardinality(v_pending) THEN
    RAISE EXCEPTION 'ABORT: post-condition — % pièce(s) masquée(s), % ligne(s) gelée(s), % attendues',
      v_hidden, v_frozen, cardinality(v_pending);
  END IF;

  SELECT count(*) INTO v_n
    FROM public.pieces p
    JOIN public.pieces_price pp ON pp.pri_piece_id_i = p.piece_id
   WHERE p.piece_id = ANY (v_ids)
     AND NOT p.piece_display
     AND pp.pricing_state = 'FROZEN'
     AND pp.pricing_updated_source = c_source;
  IF v_n <> 6 THEN
    RAISE EXCEPTION 'ABORT: post-condition — % / 6 pièces retirées de la vente', v_n;
  END IF;

  RAISE NOTICE 'quarantaine rupture C00282 : % pièce(s) retirée(s) maintenant (0 = rejeu), 6/6 hors vente',
    cardinality(v_pending);
END
$quarantine$;
