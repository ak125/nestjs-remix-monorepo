-- =============================================================================
-- ROLLBACK de 20261117_order_status_3_label.sql (mandat BN, 2026-11-17)
-- À lancer À LA MAIN par l'owner (le moteur de migrations est forward-only).
-- Remet le libellé historique de la ligne ords_id = '3'.
-- =============================================================================
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $precheck$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public."___xtr_order_status"
     WHERE ords_id = '3'
       AND ords_named IN ('Payée, en préparation',
                          'En attente de rajout de frais de port')
  ) THEN
    RAISE EXCEPTION 'precheck: libellé inattendu pour ords_id=3';
  END IF;
END
$precheck$;

UPDATE public."___xtr_order_status"
   SET ords_named = 'En attente de rajout de frais de port'
 WHERE ords_id = '3'
   AND ords_named = 'Payée, en préparation';

DO $postcheck$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public."___xtr_order_status"
     WHERE ords_id = '3'
       AND ords_named = 'En attente de rajout de frais de port'
  ) THEN
    RAISE EXCEPTION 'postcheck: rollback du libellé non appliqué';
  END IF;
END
$postcheck$;
COMMIT;
