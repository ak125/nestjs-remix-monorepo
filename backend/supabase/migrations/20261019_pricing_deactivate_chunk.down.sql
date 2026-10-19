-- Rollback: 20261019_pricing_deactivate_chunk
-- Retire public.pricing_deactivate_chunk et public.pricing_deactivate_rollback.
-- Aucune table n'est touchée : un retrait déjà fait RESTE en place (pri_dispo '0').
-- Pour le défaire, lancer pricing_deactivate_rollback(batch, fournisseur) sur
-- chaque lot DISPO_DEACTIVATION concerné AVANT ce fichier : après lui, seule une
-- écriture manuelle relue le peut encore (pricing_rollback_batch est refusé par
-- le service pour ces lots, et réécrirait les prix affichés).
-- Retirer d'abord le code appelant (routes deactivate/*) : sinon chaque appel échoue.
-- L'engine est forward-only : ce fichier se lance à la main, sur GO owner.
-- Auto-transactionnel : BEGIN / COMMIT portés par le fichier, SET LOCAL bornés à lui.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- Pré-condition : aucun retrait en cours d'écriture.
DO $precheck$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.price_import_batches
     WHERE operation = 'DISPO_DEACTIVATION' AND status = 'COMMITTING'
  ) THEN
    RAISE EXCEPTION 'ABORT: un lot DISPO_DEACTIVATION est en COMMITTING';
  END IF;
END
$precheck$;

DROP FUNCTION IF EXISTS public.pricing_deactivate_rollback(uuid, text);
DROP FUNCTION IF EXISTS public.pricing_deactivate_chunk(uuid, uuid, text, text, jsonb);
COMMIT;
