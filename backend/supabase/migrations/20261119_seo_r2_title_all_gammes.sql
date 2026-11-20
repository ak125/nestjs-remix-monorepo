-- Mandat DW, complément 1 (2026-11-19) — nouveau titre R2 sur toutes les gammes.
-- Complément 2 : marque et modèle en casse normale, noms d'affichage.
-- Gabarit `__seo_gamme_car.sgc_title` : « <Gamme> <Marque> <Modèle> <type>
-- [carburant] <puissance> ch », sans prix, sans accroche, sans années ;
-- code moteur ajouté par le code aux seules pages en collision.
-- Les marqueurs #VMarqueAffichage#, #VModeleAffichage# et
-- #VTypeCarburantPuissance# sont résolus par
-- backend/src/modules/catalog/services/seo-template.service.ts
-- (normalizeVehicleNameCase, buildR2TitleTypeLabel, packages/seo-types, et
-- R2TitleCollisionService) : ils doivent être servis en PROD AVANT
-- l'application de ce fichier, sinon la garde des marqueurs les retire et le
-- titre se réduit à la gamme.
-- Noms d'affichage (modele_name_meta, type_name_meta) : servis seulement
-- après 20261119_seo_r2_title_display_names_rpc.sql ET le patch rm-builder
-- (geste réservé) ; sinon noms bruts, en casse normale pour marque et modèle.
-- sgc_h1, sgc_descrip, sgc_content et sgc_preview ne sont pas touchés.
-- Garde : une ligne n'est modifiée que si elle porte encore exactement
-- l'ancien gabarit relevé le 2026-11-19 (118 lignes sur 118). Relancé, le
-- fichier ne change rien. Si une ligne porte une autre valeur que l'ancien
-- ou le nouveau gabarit, la transaction s'arrête sans rien écrire.
-- Effet servi : après expiration du cache Redis `seo:processed:{pg}:{type}:*`
-- (24 h) ou sa purge.
-- Retour : 20261119_seo_r2_title_all_gammes.down.sql (manuel).
-- Transaction : le runner (scripts/ci/apply-supabase-migration.py) encadre
-- le fichier de BEGIN/COMMIT ; pas de BEGIN/COMMIT ici.

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SET LOCAL search_path = public, pg_temp;

DO $titre_r2$
DECLARE
  c_old CONSTANT text := '#Gamme# #VMarque# #VModele# #VType# #MinPrice# #PrixPasCher#.';
  c_new CONSTANT text := '#Gamme# #VMarqueAffichage# #VModeleAffichage# #VTypeCarburantPuissance#';
  v_unexpected text;
  v_updated    bigint;
  v_new        bigint;
BEGIN
  -- Arrêt avant écriture sur toute valeur inattendue (NULL compris).
  SELECT string_agg(format('sgc_id=%s pg=%s', sgc_id, sgc_pg_id), ', '
                    ORDER BY sgc_pg_id, sgc_id)
    INTO v_unexpected
    FROM public.__seo_gamme_car
   WHERE sgc_title IS DISTINCT FROM c_old
     AND sgc_title IS DISTINCT FROM c_new;

  IF v_unexpected IS NOT NULL THEN
    RAISE EXCEPTION 'mandat DW : sgc_title inattendu (ni ancien ni nouveau gabarit) pour % ; rien n''est écrit', v_unexpected;
  END IF;

  UPDATE public.__seo_gamme_car
     SET sgc_title = c_new
   WHERE sgc_title = c_old;
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  SELECT count(*) INTO v_new
    FROM public.__seo_gamme_car
   WHERE sgc_title = c_new;

  RAISE NOTICE 'mandat DW : % ligne(s) modifiée(s), % ligne(s) au nouveau gabarit', v_updated, v_new;
END
$titre_r2$;
