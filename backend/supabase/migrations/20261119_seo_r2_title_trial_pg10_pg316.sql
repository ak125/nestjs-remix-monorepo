-- Mandat DW (2026-11-19) — essai de titre R2 sur deux gammes.
-- Gabarit `__seo_gamme_car.sgc_title` de courroie d'accessoire (pg 10, sgc_id
-- '4') et thermostat (pg 316, sgc_id '75') : « <Gamme> <MARQUE> <MODÈLE>
-- <type> [carburant] <puissance> ch », sans prix, sans accroche, sans années.
-- Le marqueur #VTypeCarburantPuissance# est résolu par
-- backend/src/modules/catalog/services/seo-template.service.ts
-- (buildR2TitleTypeLabel, packages/seo-types) : il doit être servi AVANT
-- l'application de ce fichier, sinon la garde des marqueurs le retire et le
-- titre perd type, carburant et puissance.
-- Les 116 autres gammes (groupe témoin), sgc_h1, sgc_descrip, sgc_content et
-- sgc_preview ne sont pas touchés.
-- Une ligne n'est modifiée que si elle porte encore exactement l'ancien
-- gabarit relevé le 2026-11-19 ; relancé, le fichier ne change rien. Toute
-- autre valeur trouvée arrête la transaction sans rien écrire.
-- Effet servi : après expiration du cache Redis `seo:processed:{pg}:{type}:*`
-- (24 h) ou sa purge.
-- Retour : 20261119_seo_r2_title_trial_pg10_pg316.down.sql (manuel).
-- Transaction : le runner (scripts/ci/apply-supabase-migration.py) encadre
-- le fichier de BEGIN/COMMIT ; pas de BEGIN/COMMIT ici.

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SET LOCAL search_path = public, pg_temp;

DO $essai$
DECLARE
  c_old CONSTANT text := '#Gamme# #VMarque# #VModele# #VType# #MinPrice# #PrixPasCher#.';
  c_new CONSTANT text := '#Gamme# #VMarque# #VModele# #VTypeCarburantPuissance#';
  v_updated bigint;
  v_ok      bigint;
BEGIN
  UPDATE public.__seo_gamme_car
     SET sgc_title = c_new
   WHERE (sgc_id, sgc_pg_id) IN (('4', '10'), ('75', '316'))
     AND sgc_title = c_old;
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  SELECT count(*) INTO v_ok
    FROM public.__seo_gamme_car
   WHERE (sgc_id, sgc_pg_id) IN (('4', '10'), ('75', '316'))
     AND sgc_title = c_new;

  IF v_ok <> 2 THEN
    RAISE EXCEPTION 'mandat DW : % ligne(s) sur 2 au nouveau gabarit après mise à jour (% modifiée(s)) ; valeur inattendue, rien n''est écrit', v_ok, v_updated;
  END IF;

  RAISE NOTICE 'mandat DW : % ligne(s) modifiée(s), 2 au nouveau gabarit', v_updated;
END
$essai$;
