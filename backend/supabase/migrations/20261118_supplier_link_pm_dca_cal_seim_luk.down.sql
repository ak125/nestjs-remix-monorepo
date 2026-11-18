-- Rollback: 20261118_supplier_link_pm_dca_cal_seim_luk
-- Retire les quatre liens fournisseur ↔ marque ajoutés par la migration :
-- DCA (71) ↔ SEIM (4200), DCA (71) ↔ LUK (2860), CAL (19) ↔ SEIM (4200),
-- CAL (19) ↔ LUK (2860). Aucune autre ligne : chaque suppression est désignée
-- par son couple exact (slpm_spl_id, slpm_pm_id), et aucun de ces couples
-- n'existait au relevé du 2026-11-18 (0 ligne).
-- Effet : le relevé et la synchro n'interrogent plus DCA ni CAL pour SEIM et LUK ;
-- les lignes payées de ces marques redeviennent « relevé absent » (BLOQUE).
-- À ne lancer que sur décision de l'owner. L'engine est forward-only : ce
-- fichier se lance à la main. La transaction explicite borne les délais par
-- SET LOCAL et rend retour et constat indivisibles.
BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, pg_temp;

DO $unlink$
DECLARE
  v_n bigint;
BEGIN
  DELETE FROM public.___xtr_supplier_link_pm
   WHERE (slpm_spl_id, slpm_pm_id) IN (('71', '4200'), ('71', '2860'),
                                       ('19', '4200'), ('19', '2860'));
  GET DIAGNOSTICS v_n = ROW_COUNT;

  IF v_n > 4 THEN
    RAISE EXCEPTION 'ABORT: % lignes supprimées, 4 au plus attendues', v_n;
  END IF;
  RAISE NOTICE 'rollback liens SEIM/LUK : % lien(s) retiré(s) (0 = déjà absents)', v_n;
END
$unlink$;

-- Constat : aucun des quatre liens ne doit rester.
SELECT slpm_id, slpm_spl_id, slpm_pm_id, slpm_display
  FROM public.___xtr_supplier_link_pm
 WHERE (slpm_spl_id, slpm_pm_id) IN (('71', '4200'), ('71', '2860'),
                                     ('19', '4200'), ('19', '2860'))
 ORDER BY slpm_spl_id, slpm_pm_id;

COMMIT;
