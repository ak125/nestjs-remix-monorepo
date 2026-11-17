-- =============================================================================
-- ROLLBACK de 20261117_order_status_3_label.sql (mandat BN, 2026-11-17)
-- À lancer À LA MAIN par l'owner (le moteur de migrations est forward-only).
-- Retire les statuts 7 et 8 tant qu'aucune commande ni aucun historique ne les
-- porte, puis remet le libellé historique de la ligne ords_id = '3'.
-- Si une commande porte déjà 7 ou 8 (boutons de la session BM en service),
-- le rollback échoue sans rien changer : revenir d'abord sur le branchement.
-- =============================================================================
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $precheck$
DECLARE
  v_n int;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public."___xtr_order_status"
     WHERE ords_id = '3'
       AND ords_named IN ('Payée, à traiter',
                          'Payée, en préparation',
                          'En attente de rajout de frais de port')
  ) THEN
    RAISE EXCEPTION 'precheck: libellé inattendu pour ords_id=3';
  END IF;

  SELECT count(*) INTO v_n
    FROM public."___xtr_order" WHERE ord_ords_id IN ('7', '8');
  IF v_n > 0 THEN
    RAISE EXCEPTION 'precheck: % commande(s) portent 7 ou 8, rollback refusé', v_n;
  END IF;

  SELECT count(*) INTO v_n
    FROM public."___xtr_order_history"
   WHERE from_status IN ('7', '8') OR to_status IN ('7', '8');
  IF v_n > 0 THEN
    RAISE EXCEPTION 'precheck: % événement(s) d''historique portent 7 ou 8, rollback refusé', v_n;
  END IF;
END
$precheck$;

DELETE FROM public."___xtr_order_status"
 WHERE (ords_id = '7' AND ords_named = 'Expédiée')
    OR (ords_id = '8' AND ords_named = 'Livrée');

UPDATE public."___xtr_order_status"
   SET ords_named = 'En attente de rajout de frais de port'
 WHERE ords_id = '3'
   AND ords_named IN ('Payée, à traiter', 'Payée, en préparation');

DO $postcheck$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public."___xtr_order_status"
     WHERE ords_id = '3'
       AND ords_named = 'En attente de rajout de frais de port'
  ) THEN
    RAISE EXCEPTION 'postcheck: rollback du libellé non appliqué';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public."___xtr_order_status" WHERE ords_id IN ('7', '8')
  ) THEN
    RAISE EXCEPTION 'postcheck: statuts 7 ou 8 encore présents';
  END IF;
END
$postcheck$;
COMMIT;
