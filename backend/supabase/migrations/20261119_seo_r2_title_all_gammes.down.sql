-- Rollback: 20261119_seo_r2_title_all_gammes
-- Remet `__seo_gamme_car.sgc_title` de toutes les gammes à l'ancien gabarit
-- relevé le 2026-11-19 : '#Gamme# #VMarque# #VModele# #VType# #MinPrice# #PrixPasCher#.'
-- Une ligne n'est touchée que si elle porte encore exactement le gabarit posé
-- par la migration ; une ligne modifiée depuis est conservée et signalée.
-- Le code du marqueur #VTypeCarburantPuissance# peut rester servi : sans
-- gabarit qui l'écrit, il n'a aucun effet (ni lecture de collision).
-- Effet servi : après expiration du cache Redis `seo:processed:{pg}:{type}:*`
-- (24 h) ou sa purge.
-- L'engine est forward-only : ce fichier se lance à la main.
BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SET LOCAL search_path = public, pg_temp;

DO $retour$
DECLARE
  c_old CONSTANT text := '#Gamme# #VMarque# #VModele# #VType# #MinPrice# #PrixPasCher#.';
  c_new CONSTANT text := '#Gamme# #VMarque# #VModele# #VTypeCarburantPuissance#';
  v_back  bigint;
  v_reste text;
BEGIN
  UPDATE public.__seo_gamme_car
     SET sgc_title = c_old
   WHERE sgc_title = c_new;
  GET DIAGNOSTICS v_back = ROW_COUNT;

  SELECT string_agg(format('sgc_id=%s pg=%s', sgc_id, sgc_pg_id), ', '
                    ORDER BY sgc_pg_id, sgc_id)
    INTO v_reste
    FROM public.__seo_gamme_car
   WHERE sgc_title IS DISTINCT FROM c_old;

  RAISE NOTICE 'retour mandat DW : % ligne(s) remise(s) à l''ancien gabarit ; conservée(s) car différente(s) : %', v_back, coalesce(v_reste, 'aucune');
END
$retour$;

COMMIT;
