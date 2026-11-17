-- =============================================================================
-- Migration : libellé du statut de commande 3 → « Payée, en préparation »
-- Date      : 2026-11-17 (mandat BN, département 13)
-- Scope     : public.___xtr_order_status, ligne ords_id = '3', colonne
--             ords_named seulement. Rien d'autre.
-- Forward-only. Ne réécrit AUCUNE migration historique.
-- =============================================================================
--
-- POURQUOI : décision de Marwane (mandat BN) — le libellé du statut 3 devient
-- « Payée, en préparation ». Le code (packages/domain-commerce
-- ORDER_STATUS_LABEL, frontend orders.utils / filtres / workflow) est aligné
-- dans la même PR.
--
-- NON MODIFIÉ (signalé dans la PR) : ords_action ('Rajout frais de port'),
-- ords_color, ords_dept_id de la ligne 3 ; la ligne 5 (« Payée — En
-- préparation ») ; les transitions 1→3→4 du code. Les libellés 3 et 5 sont
-- désormais proches : à trancher par l'owner.
--
-- ÉTAT MESURÉ (lecture seule, 2026-11-17) : ords_named = 'En attente de rajout
-- de frais de port'. Aucune logique du code ne compare ce texte.
--
-- APPLICATION : par le moteur du dépôt uniquement (Actions → « 🗄️ Apply
-- Supabase migrations (manual) », essai à blanc puis réel), après fusion sur
-- main, par l'owner.
--
-- ROLLBACK : 20261117_order_status_3_label.down.sql, à lancer à la main.
-- =============================================================================

-- Pas de BEGIN/COMMIT explicite : le moteur applique ce fichier dans une
-- transaction (.squawk.toml `assume_in_transaction = true`).
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- §0 — PRÉ-CONDITION FAIL-CLOSED : la ligne 3 existe et porte l'ancien
-- libellé (premier passage) ou le nouveau (rejeu).
DO $precheck$
DECLARE
  v_named text;
  v_n     int;
BEGIN
  SELECT count(*), max(ords_named) INTO v_n, v_named
    FROM public."___xtr_order_status" WHERE ords_id = '3';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'precheck: % ligne(s) ords_id=3 (attendu 1)', v_n;
  END IF;
  IF v_named NOT IN ('En attente de rajout de frais de port',
                     'Payée, en préparation') THEN
    RAISE EXCEPTION 'precheck: libellé inattendu pour ords_id=3 : %', v_named;
  END IF;
END
$precheck$;

-- §1 — Changement de libellé (1 ligne au plus).
UPDATE public."___xtr_order_status"
   SET ords_named = 'Payée, en préparation'
 WHERE ords_id = '3'
   AND ords_named = 'En attente de rajout de frais de port';

-- §2 — POST-CONDITION.
DO $postcheck$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public."___xtr_order_status"
     WHERE ords_id = '3' AND ords_named = 'Payée, en préparation'
  ) THEN
    RAISE EXCEPTION 'postcheck: libellé du statut 3 non appliqué';
  END IF;
END
$postcheck$;
