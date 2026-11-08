-- Rollback: 20261031_accents_protected_segments
-- Rend à restore_french_accents son corps relevé le 2026-10-31 (md5 du corps
-- 25eac4c38827cce38b9b4e2d6362fad0). Ce retour rétablit les deux défauts : à
-- chaque écriture, les quatre triggers d'accents réécrivent de nouveau les
-- balises et les URL (href="/reference-auto/…" → "/référence-auto/…") et
-- monte, situe, pose, repose. Un lot de contenu écrit après la migration ne
-- se retire alors plus à l'identique : retirer d'abord ce lot par son propre
-- .down.sql, puis lancer ce fichier.
-- L'engine est forward-only : ce fichier se lance à la main, sur GO owner.
-- Auto-transactionnel : BEGIN / COMMIT portés par le fichier, SET LOCAL bornés à lui.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, pg_temp;

DO $precheck$
DECLARE
  c_old CONSTANT text := '25eac4c38827cce38b9b4e2d6362fad0';
  c_new CONSTANT text := '300d4e4c2f502c0eb9e52b92fde60769';
  v_md5 text;
BEGIN
  SELECT md5(p.prosrc) INTO v_md5
    FROM pg_proc p
   WHERE p.oid = 'public.restore_french_accents(text)'::regprocedure;
  IF v_md5 IS NULL OR v_md5 NOT IN (c_old, c_new) THEN
    RAISE EXCEPTION 'ABORT: corps de restore_french_accents inconnu (md5 %)', v_md5;
  END IF;
END
$precheck$;

CREATE OR REPLACE FUNCTION public.restore_french_accents(input_text text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  result text := input_text;
  -- Dictionnaire : (pattern_sans_accent, forme_accentuee)
  -- Ordre important : patterns longs d'abord pour éviter les collisions
  patterns text[][] := ARRAY[
    -- Locutions à + nom (fréquent dans "filtre à X")
    ['\ya air\y', 'à air'],
    ['\ya huile\y', 'à huile'],
    ['\ya carburant\y', 'à carburant'],
    ['\ya pollen\y', 'à pollen'],
    ['\ya gasoil\y', 'à gasoil'],
    ['\ya remplacer\y', 'à remplacer'],
    ['\ya controler\y', 'à contrôler'],
    ['\ya verifier\y', 'à vérifier'],
    ['\ya deposer\y', 'à déposer'],
    ['\ya eviter\y', 'à éviter'],
    ['\ya travers\y', 'à travers'],
    ['\ya jour\y', 'à jour'],
    ['\ya temps\y', 'à temps'],
    ['\yl acceleration\y', 'l''accélération'],
    ['\yl admission\y', 'l''admission'],
    ['\yl echappement\y', 'l''échappement'],
    -- Verbes au participe passé (fréquents)
    ['\yaspire\y', 'aspiré'],
    ['\yaspirer\y', 'aspirer'],
    ['\ysitue\y', 'situé'],
    ['\ysituee\y', 'située'],
    ['\yprotege\y', 'protège'],
    ['\yprotegee\y', 'protégée'],
    ['\yproteger\y', 'protéger'],
    ['\yverifie\y', 'vérifié'],
    ['\yverifier\y', 'vérifier'],
    ['\ycontrole\y', 'contrôle'],
    ['\ycontroler\y', 'contrôler'],
    ['\ydemonte\y', 'démonté'],
    ['\ydemontage\y', 'démontage'],
    ['\ydemonter\y', 'démonter'],
    ['\ymonte\y', 'monté'],
    ['\ymontee\y', 'montée'],
    ['\yinstalle\y', 'installé'],
    ['\yinstaller\y', 'installer'],
    ['\yrecommande\y', 'recommandé'],
    ['\yrecommandee\y', 'recommandée'],
    ['\ypose\y', 'posé'],
    ['\yrepose\y', 'reposé'],
    ['\ydepose\y', 'déposé'],
    ['\ydepend\y', 'dépend'],
    ['\yetat\y', 'état'],
    ['\yaccede\y', 'accède'],
    ['\yacces\y', 'accès'],
    ['\yprocede\y', 'procédé'],
    ['\yprecede\y', 'précédé'],
    ['\ypreconise\y', 'préconisé'],
    ['\ypreconisation\y', 'préconisation'],
    ['\ypreconisations\y', 'préconisations'],
    ['\yprecis\y', 'précis'],
    ['\yprecision\y', 'précision'],
    ['\yendommage\y', 'endommagé'],
    ['\yendommager\y', 'endommager'],
    ['\yrepandu\y', 'répandu'],
    ['\yrepandue\y', 'répandue'],
    ['\ydifference\y', 'différence'],
    ['\ydifferent\y', 'différent'],
    ['\ydifferente\y', 'différente'],
    ['\yameliore\y', 'amélioré'],
    ['\yameliorer\y', 'améliorer'],
    ['\yamelioration\y', 'amélioration'],
    ['\ydegrade\y', 'dégradé'],
    ['\ydegrader\y', 'dégrader'],
    ['\ydeteriore\y', 'détérioré'],
    ['\ydeteriorer\y', 'détériorer'],
    ['\yexperience\y', 'expérience'],
    ['\yreparation\y', 'réparation'],
    ['\yreparer\y', 'réparer'],
    ['\ypanne\y', 'panne'],
    ['\yconsommation\y', 'consommation'],
    ['\yacceleration\y', 'accélération'],
    ['\yechappement\y', 'échappement'],
    ['\yadmission\y', 'admission'],
    ['\yprobleme\y', 'problème'],
    ['\yproblemes\y', 'problèmes'],
    ['\ysysteme\y', 'système'],
    ['\ysystemes\y', 'systèmes'],
    ['\yprocedure\y', 'procédure'],
    ['\ymodele\y', 'modèle'],
    ['\ymodeles\y', 'modèles'],
    ['\yreference\y', 'référence'],
    ['\yreferences\y', 'références'],
    ['\yveuillez\y', 'veuillez'],
    ['\ynecessaire\y', 'nécessaire'],
    ['\ynecessite\y', 'nécessite'],
    ['\ynecessiter\y', 'nécessiter'],
    ['\yplusieurs\y', 'plusieurs'],
    ['\ypoussiere\y', 'poussière'],
    ['\ypoussieres\y', 'poussières'],
    ['\ymatiere\y', 'matière'],
    ['\ymatieres\y', 'matières'],
    ['\ymaniere\y', 'manière'],
    ['\ymanieres\y', 'manières'],
    ['\ypremiere\y', 'première'],
    ['\ypremier\y', 'premier'],
    ['\yderniere\y', 'dernière'],
    ['\ydernier\y', 'dernier'],
    ['\ycarriere\y', 'carrière'],
    ['\yarriere\y', 'arrière'],
    ['\yavant\y', 'avant'],
    ['\ymoteur\y', 'moteur'],
    ['\yfrein\y', 'frein'],
    ['\ycylindre\y', 'cylindre'],
    ['\ycylindres\y', 'cylindres'],
    ['\ysoupape\y', 'soupape'],
    ['\ysoupapes\y', 'soupapes'],
    ['\ysegment\y', 'segment'],
    ['\ysegments\y', 'segments'],
    ['\ycollecteur\y', 'collecteur'],
    ['\yallege\y', 'allégé'],
    ['\yserie\y', 'série'],
    ['\yseries\y', 'séries'],
    ['\yusure\y', 'usure'],
    ['\yconstructeur\y', 'constructeur'],
    ['\yconstructeurs\y', 'constructeurs'],
    ['\yqualite\y', 'qualité'],
    ['\yqualites\y', 'qualités'],
    ['\ydurabilite\y', 'durabilité'],
    ['\ycomplete\y', 'complète'],
    ['\ycomplet\y', 'complet'],
    ['\ybeaucoup\y', 'beaucoup'],
    -- Préfixes avec é
    ['\yetanche\y', 'étanche'],
    ['\yetancheite\y', 'étanchéité'],
    ['\yequipe\y', 'équipé'],
    ['\yequipement\y', 'équipement'],
    ['\yequipements\y', 'équipements'],
    ['\ymetal\y', 'métal'],
    ['\ymetallique\y', 'métallique'],
    ['\yenerge\y', 'énergé'],
    ['\yenergie\y', 'énergie'],
    ['\yeffectue\y', 'effectué'],
    ['\yeffectuer\y', 'effectuer'],
    -- à (préposition isolée) — très conservateur
    ['\ya ete\y', 'a été'],
    ['\ya eu\y', 'a eu'],
    -- Mots très fréquents
    ['\yelement\y', 'élément'],
    ['\yelements\y', 'éléments'],
    ['\yelementaire\y', 'élémentaire'],
    ['\ydetecte\y', 'détecté'],
    ['\ydetecter\y', 'détecter'],
    ['\ydetection\y', 'détection']
  ];
  i integer;
BEGIN
  FOR i IN 1..array_length(patterns, 1) LOOP
    result := regexp_replace(result, patterns[i][1], patterns[i][2], 'g');
  END LOOP;
  RETURN result;
END;
$function$;

DO $postcheck$
DECLARE
  c_old CONSTANT text := '25eac4c38827cce38b9b4e2d6362fad0';
  v_md5 text;
  v_cfg text[];
BEGIN
  SELECT md5(p.prosrc), p.proconfig INTO v_md5, v_cfg
    FROM pg_proc p
   WHERE p.oid = 'public.restore_french_accents(text)'::regprocedure;
  IF v_md5 IS DISTINCT FROM c_old OR v_cfg IS DISTINCT FROM ARRAY['search_path=public'] THEN
    RAISE EXCEPTION 'ABORT: post-condition — md5 %, config %', v_md5, v_cfg;
  END IF;
  RAISE NOTICE 'restore_french_accents : corps du relevé du 2026-10-31 rétabli';
END
$postcheck$;

COMMIT;
