-- =============================================================================
-- Migration : aligner sur pri_dispo '0' les 9 lignes tarif gelées (FROZEN) de
--             pièces déjà masquées qui portent encore pri_dispo '1'
-- Date      : 2026-11-16 (mandat AS, décision 51 « définition unique de vendable »,
--             amendée par la décision 118 du 2026-11-17)
-- Scope     : public.pieces_price, 9 lignes (une par pièce) : pri_dispo,
--             pricing_state_reason, pricing_updated_by, pricing_updated_source.
--             Rien d'autre : ni piece_display, ni pricing_state, ni prix.
-- Forward-only. Ne réécrit AUCUNE migration historique.
-- =============================================================================
--
-- POURQUOI — décisions 51 et 118 : une ligne tarif est vendable si et seulement
-- si pri_dispo vaut '1', '2' ou '3', qu'elle n'est pas FROZEN et que la pièce
-- n'est pas masquée.
-- Ces 9 pièces sont hors vente (masquées + FROZEN) mais leur ligne garde
-- pri_dispo '1' : tout lecteur qui ne regarde que pri_dispo (recherche, RPC
-- catalogue, rapports de dispo, futur flux marchand) les compte encore comme
-- disponibles. On aligne la donnée sur la définition : pri_dispo '0'.
--
-- PÉRIMÈTRE (relevé en lecture seule le 2026-11-16, DEV = base partagée) :
-- toutes les lignes pricing_state = 'FROZEN' AND pri_dispo = '1', soit 9.
-- Revu le 2026-11-17 sous la décision 118 : aucune ligne FROZEN ne porte
-- pri_dispo '2' ou '3' (FROZEN = 9 lignes à '1', 2 lignes à '0') ; le
-- périmètre reste donc ces 9 lignes :
--   quarantaine du 2026-10-18 (20261018_pricing_quarantine_rupture_sphere_c00282) :
--     5660748 SNRA C00282  (SOREA)       9613328 SNRA XA230RZ (SOREA)
--     1008195 RCA  1202    (RCA France)  1011020 RCA  1204    (RCA France)
--     1303637 RCA  1603    (RCA France)  1306850 RCA  1609    (RCA France)
--   pilote du 2026-05-31 (audit/unavailable-quarantine-plan.md) :
--     3283439 LUK 513 0046 10 (ACR)  3283441 LUK 513 0049 10 (ACR)
--     8291920 SASIC SCL4123 (SASIC)
-- Chaque pièce : une seule ligne pieces_price, piece_display = false, aucune
-- ligne pieces_price_history.
--
-- EFFET SERVI : aucun. Les 9 pièces sont déjà retirées de la grille R2
-- (piece_display = false) et du panier (FROZEN). Aucune page ne change de
-- nombre de pièces ; pas de garde SEO à rejouer, la pré-condition
-- « piece_display = false » le garantit.
--
-- TRAÇABILITÉ : pricing_updated_source / pricing_updated_by passent à ce
-- fichier ; le motif d'origine est conservé en tête de pricing_state_reason.
-- Conséquence voulue : les .down.sql des quarantaines d'origine ne
-- reconnaissent plus ces lignes tant que le .down.sql de CE fichier n'a pas été
-- joué (retour arrière LIFO : ce fichier d'abord, la quarantaine ensuite).
--
-- HORS LOT, VOLONTAIREMENT : piece_display, pricing_state, prix,
-- pieces_price_history (même choix que 20261021 : pas de lot de pricing),
-- compatibilité, panier, commandes. pieces_price ne porte aucun trigger.
--
-- IDEMPOTENT ET REJOUABLE : chaque ligne est acceptée dans son état mesuré
-- (pri_dispo '1', FROZEN, source d'origine relevée) ou déjà alignée par ce
-- fichier (pri_dispo '0', FROZEN, source = ce fichier). Tout autre état
-- interrompt la migration.
--
-- APPLICATION : par le moteur du dépôt uniquement (Actions → « 🗄️ Apply Supabase
-- migrations (manual) », dry_run puis confirm = APPLY, only_ids = cet
-- identifiant), après fusion sur main. Zone STOP prix/stock : GO nominatif de
-- l'owner requis. Le bloc $precheck$ se joue seul en lecture seule avant.
--
-- ROLLBACK : 20261116_pricing_frozen_masked_dispo_zero.down.sql, à la main.
-- =============================================================================

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, pg_temp;

-- §0 — PRÉ-CONDITIONS, en lecture seule.
DO $precheck$
DECLARE
  c_source CONSTANT text := 'backend/supabase/migrations/20261116_pricing_frozen_masked_dispo_zero.sql';
  c_rows   CONSTANT jsonb := $json$
    [{"piece_id":5660748,"ref":"C00282","pm_id":4310,"frs":"SOREA","origin":"backend/supabase/migrations/20261018_pricing_quarantine_rupture_sphere_c00282.sql"}
    ,{"piece_id":9613328,"ref":"XA230RZ","pm_id":4310,"frs":"SOREA","origin":"backend/supabase/migrations/20261018_pricing_quarantine_rupture_sphere_c00282.sql"}
    ,{"piece_id":1008195,"ref":"1202","pm_id":3900,"frs":"RCA France","origin":"backend/supabase/migrations/20261018_pricing_quarantine_rupture_sphere_c00282.sql"}
    ,{"piece_id":1011020,"ref":"1204","pm_id":3900,"frs":"RCA France","origin":"backend/supabase/migrations/20261018_pricing_quarantine_rupture_sphere_c00282.sql"}
    ,{"piece_id":1303637,"ref":"1603","pm_id":3900,"frs":"RCA France","origin":"backend/supabase/migrations/20261018_pricing_quarantine_rupture_sphere_c00282.sql"}
    ,{"piece_id":1306850,"ref":"1609","pm_id":3900,"frs":"RCA France","origin":"backend/supabase/migrations/20261018_pricing_quarantine_rupture_sphere_c00282.sql"}
    ,{"piece_id":3283439,"ref":"513 0046 10","pm_id":2860,"frs":"ACR","origin":"audit/unavailable-quarantine-plan.md"}
    ,{"piece_id":3283441,"ref":"513 0049 10","pm_id":2860,"frs":"ACR","origin":"audit/unavailable-quarantine-plan.md"}
    ,{"piece_id":8291920,"ref":"SCL4123","pm_id":4120,"frs":"SASIC","origin":"audit/unavailable-quarantine-plan.md"}
    ]
  $json$::jsonb;
  r     record;
  v_n   bigint;
BEGIN
  IF jsonb_array_length(c_rows) <> 9
     OR (SELECT count(DISTINCT e.piece_id) FROM jsonb_to_recordset(c_rows) e(piece_id bigint)) <> 9 THEN
    RAISE EXCEPTION 'ABORT: liste — 9 pièces distinctes attendues';
  END IF;

  FOR r IN
    SELECT e.piece_id, e.ref, e.pm_id, e.frs, e.origin,
           p.piece_id AS found_id, p.piece_ref, p.piece_pm_id, p.piece_display
      FROM jsonb_to_recordset(c_rows) AS e(piece_id bigint, ref text, pm_id integer, frs text, origin text)
      LEFT JOIN public.pieces p ON p.piece_id = e.piece_id
  LOOP
    IF r.found_id IS NULL THEN
      RAISE EXCEPTION 'ABORT: pièce % introuvable', r.piece_id;
    END IF;
    IF r.piece_ref IS DISTINCT FROM r.ref OR r.piece_pm_id::integer IS DISTINCT FROM r.pm_id THEN
      RAISE EXCEPTION 'ABORT: pièce % — réf/marque « %/% » attendues, « %/% » trouvées',
        r.piece_id, r.ref, r.pm_id, r.piece_ref, r.piece_pm_id;
    END IF;
    IF r.piece_display IS NOT FALSE THEN
      RAISE EXCEPTION 'ABORT: pièce % affichée (piece_display=%) : ce lot ne vise que des pièces masquées',
        r.piece_id, r.piece_display;
    END IF;

    SELECT count(*) INTO v_n FROM public.pieces_price pp
     WHERE pp.pri_piece_id_i = r.piece_id OR pp.pri_piece_id = r.piece_id::text;
    IF v_n <> 1 THEN
      RAISE EXCEPTION 'ABORT: pièce % — % ligne(s) pieces_price, 1 attendue', r.piece_id, v_n;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.pieces_price pp
       WHERE pp.pri_piece_id_i = r.piece_id
         AND pp.pri_frs = r.frs
         AND pp.pricing_state = 'FROZEN'
         AND ((pp.pri_dispo = '1' AND pp.pricing_updated_source = r.origin)
           OR (pp.pri_dispo = '0' AND pp.pricing_updated_source = c_source))) THEN
      RAISE EXCEPTION 'ABORT: pièce % (% %) — ligne ni dans l''état relevé ni alignée par ce fichier : la base a changé',
        r.piece_id, r.ref, r.frs;
    END IF;
  END LOOP;

  RAISE NOTICE 'pré-condition alignement FROZEN masquées : OK (9 pièces)';
END
$precheck$;

-- §1 — ÉCRITURE ET POST-CONDITIONS.
DO $align$
DECLARE
  c_source CONSTANT text := 'backend/supabase/migrations/20261116_pricing_frozen_masked_dispo_zero.sql';
  c_by     CONSTANT text := 'decision-51-owner-go';
  c_ids    CONSTANT bigint[] := ARRAY[5660748, 9613328, 1008195, 1011020, 1303637, 1306850,
                                      3283439, 3283441, 8291920];
  c_origins CONSTANT text[] := ARRAY[
    'backend/supabase/migrations/20261018_pricing_quarantine_rupture_sphere_c00282.sql',
    'audit/unavailable-quarantine-plan.md'];
  v_set bigint;
  v_n   bigint;
BEGIN
  UPDATE public.pieces_price
     SET pri_dispo              = '0',
         pricing_state_reason   = pricing_state_reason
                                  || ' | 2026-11-16 : pri_dispo aligné sur 0 (décisions 51 et 118, vendable = dispo 1, 2 ou 3, '
                                  || 'ni FROZEN ni masquée). Réversible par 20261116_pricing_frozen_masked_dispo_zero.down.sql.',
         pricing_updated_by     = c_by,
         pricing_updated_source = c_source
   WHERE pri_piece_id_i = ANY (c_ids)
     AND pri_dispo = '1'
     AND pricing_state = 'FROZEN'
     AND pricing_updated_source = ANY (c_origins);
  GET DIAGNOSTICS v_set = ROW_COUNT;               -- 9 maintenant, 0 au rejeu

  SELECT count(*) INTO v_n
    FROM public.pieces_price pp
    JOIN public.pieces p ON p.piece_id = pp.pri_piece_id_i
   WHERE pp.pri_piece_id_i = ANY (c_ids)
     AND pp.pri_dispo = '0'
     AND pp.pricing_state = 'FROZEN'
     AND pp.pricing_updated_source = c_source
     AND p.piece_display = false;
  IF v_n <> 9 THEN
    RAISE EXCEPTION 'ABORT: post-condition — % / 9 lignes alignées', v_n;
  END IF;

  SELECT count(*) INTO v_n FROM public.pieces_price
   WHERE pricing_state = 'FROZEN' AND pri_dispo IN ('1', '2', '3')
     AND pri_piece_id_i = ANY (c_ids);
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'ABORT: post-condition — % ligne(s) FROZEN encore disponibles', v_n;
  END IF;

  RAISE NOTICE 'alignement FROZEN masquées : % ligne(s) posée(s) maintenant (0 = rejeu), 9/9 à pri_dispo 0', v_set;
END
$align$;
