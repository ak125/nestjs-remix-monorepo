-- =============================================================================
-- restore_french_accents : ne plus réécrire les balises ni les URL
-- =============================================================================
--
-- La fonction est appelée à chaque écriture par quatre triggers :
-- fn_auto_restore_accents_r1_meta (__seo_gamme), fn_auto_restore_accents_r1_slots
-- (__seo_r1_gamme_slots), fn_auto_restore_accents_r3 (__seo_gamme_conseil) et
-- fn_auto_restore_accents_r6 (__seo_gamme_purchase_guide). Elle n'était versionnée
-- nulle part : seul 20260616_vague5_pin_function_search_path.sql fixe son
-- search_path. Ce fichier en porte désormais le corps complet.
--
-- DÉFAUT 1 — ses 139 motifs s'appliquaient à tout le texte, balises comprises :
-- `\yreference\y` réécrivait href="/reference-auto/…" en href="/référence-auto/…"
-- (lien cassé). Relevé en lecture seule du 2026-10-31 : 409 lignes portent un
-- segment que la prochaine écriture changerait (__seo_gamme 106,
-- __seo_gamme_conseil 303), et 23 href accentués sont déjà stockés dans
-- sgc_content (19 gammes).
-- CORRECTION : les balises HTML et les URL ou chemins sont exclus de la
-- réécriture, avec la définition de PROTECTED_SEGMENT de
-- backend/src/config/fr-accent-map.ts, appliquée côté code depuis #1936.
--
-- DÉFAUT 2 — quatre entrées réécrivaient des mots corrects : monte → monté,
-- situe → situé, pose → posé, repose → reposé. Dans les textes relevés, ce sont
-- des noms (« première monte », « la pose », « la repose ») ou des verbes
-- conjugués (« se situe », « le moteur monte ») : 359 lignes les contiennent
-- encore, aucune comme participe. 82 lignes portent déjà la forme fautive
-- (« première monté », « se situé », « la reposé »).
-- CORRECTION : ces quatre entrées sont retirées. Les 135 autres et leur ordre
-- sont inchangés.
--
-- PREUVE (banc PostgreSQL 17 isolé, sans réseau, sur les 10 856 valeurs
-- relevées des colonnes réécrites par les quatre triggers) : la nouvelle
-- fonction ne change aucun segment protégé, elle est idempotente, toute valeur
-- inchangée par l'ancienne l'est encore, et hors segments elle ne s'en écarte
-- que sur les 359 lignes des quatre mots retirés. Temps : 32,7 s contre 31,2 s
-- pour l'ancienne sur ces 10 856 valeurs.
--
-- INCHANGÉS : signature, IMMUTABLE, search_path, propriétaire et droits
-- (CREATE OR REPLACE les conserve), les quatre triggers. Aucune ligne n'est
-- réécrite ici : une valeur ne change qu'à sa prochaine écriture. Les 23 href et
-- les 82 textes déjà altérés restent à corriger par un lot de contenu distinct.
--
-- APPLICATION : par le moteur du dépôt uniquement (Actions → « 🗄️ Apply Supabase
-- migrations (manual) », dry_run puis confirm = APPLY, only_ids = cet
-- identifiant), après fusion sur main. Le bloc $precheck$ se joue seul en
-- lecture seule avant la fusion. À appliquer avant toute écriture de contenu qui
-- compte sur un retour arrière exact (lot éditorial du filtre à huile).
--
-- ROLLBACK : 20261031_accents_protected_segments.down.sql, à lancer à la main
-- (le moteur est forward-only). Il rétablit les deux défauts.
-- =============================================================================

-- Pas de BEGIN/COMMIT explicite : le moteur applique ce fichier dans une
-- transaction (.squawk.toml `assume_in_transaction = true`).
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, pg_temp;

-- §0 — PRÉ-CONDITIONS, en lecture seule (rejouables avant la fusion) : la
-- fonction doit être celle du relevé du 2026-10-31, ou déjà celle de ce fichier.
DO $precheck$
DECLARE
  c_old CONSTANT text := '25eac4c38827cce38b9b4e2d6362fad0';
  c_new CONSTANT text := '300d4e4c2f502c0eb9e52b92fde60769';
  v_n   bigint;
  v_md5 text;
  r     record;
BEGIN
  SELECT count(*) INTO v_n
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'restore_french_accents';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'ABORT: % fonction(s) public.restore_french_accents, 1 attendue', v_n;
  END IF;
  SELECT md5(p.prosrc), p.provolatile, p.proconfig, l.lanname INTO r
    FROM pg_proc p JOIN pg_language l ON l.oid = p.prolang
   WHERE p.oid = 'public.restore_french_accents(text)'::regprocedure;
  v_md5 := r.md5;
  IF v_md5 NOT IN (c_old, c_new) THEN
    RAISE EXCEPTION 'ABORT: corps de restore_french_accents inconnu (md5 %) : ni celui du relevé, ni celui de ce fichier', v_md5;
  END IF;
  IF r.provolatile <> 'i' OR r.lanname <> 'plpgsql' OR r.proconfig IS DISTINCT FROM ARRAY['search_path=public'] THEN
    RAISE EXCEPTION 'ABORT: attributs inattendus (volatilité %, langage %, config %)', r.provolatile, r.lanname, r.proconfig;
  END IF;

  RAISE NOTICE 'pré-condition restore_french_accents : OK (%)',
    CASE WHEN v_md5 = c_old THEN 'version du relevé' ELSE 'déjà corrigée, rejeu sans effet' END;
END
$precheck$;

-- §1 — NOUVEAU CORPS.
CREATE OR REPLACE FUNCTION public.restore_french_accents(input_text text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  -- Segments jamais réécrits : balises HTML (attributs href, src, alt, class…)
  -- et URL ou chemins présents dans le texte (« /pieces/… », « https://… »).
  -- Même définition que PROTECTED_SEGMENT de backend/src/config/fr-accent-map.ts
  -- (FH-2) : sans elle, \yreference\y réécrivait href="/reference-auto/…"
  -- en href="/référence-auto/…" (lien cassé).
  protected_segment constant text :=
    '(<\/?[a-zA-Z!][^>]*>|(?:https?:\/\/|www\.)[^\s<>"'']+|(?<![\w-])\/[\w\-./%#?=&]+)';
  -- Séparateur des morceaux de texte : caractère de contrôle, hors mot, qu'aucun
  -- motif ne reconnaît ; une entrée qui le contient déjà est traitée morceau par
  -- morceau.
  sep constant text := chr(1);
  parts text[];
  segments text[];
  joined text;
  result text := '';
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
    -- Ni monte, ni situe, ni pose, ni repose : dans les textes servis, ce sont
    -- des noms (« première monte », « la pose », « la repose ») ou des verbes
    -- conjugués (« se situe », « le moteur monte »), jamais des participes.
    ['\yaspire\y', 'aspiré'],
    ['\yaspirer\y', 'aspirer'],
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
    ['\ymontee\y', 'montée'],
    ['\yinstalle\y', 'installé'],
    ['\yinstaller\y', 'installer'],
    ['\yrecommande\y', 'recommandé'],
    ['\yrecommandee\y', 'recommandée'],
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
  j integer;
BEGIN
  IF input_text IS NULL OR input_text = '' THEN
    RETURN input_text;
  END IF;
  parts := regexp_split_to_array(input_text, protected_segment);
  segments := ARRAY(
    SELECT m[1] FROM regexp_matches(input_text, protected_segment, 'g') AS m
  );
  IF array_length(parts, 1) <> coalesce(array_length(segments, 1), 0) + 1 THEN
    RAISE EXCEPTION 'restore_french_accents : découpage incohérent (% morceaux, % segments)',
      array_length(parts, 1), coalesce(array_length(segments, 1), 0);
  END IF;
  IF strpos(input_text, sep) = 0 THEN
    joined := array_to_string(parts, sep);
    FOR i IN 1..array_length(patterns, 1) LOOP
      joined := regexp_replace(joined, patterns[i][1], patterns[i][2], 'g');
    END LOOP;
    parts := string_to_array(joined, sep);
    IF array_length(parts, 1) <> coalesce(array_length(segments, 1), 0) + 1 THEN
      RAISE EXCEPTION 'restore_french_accents : séparateur altéré par un motif';
    END IF;
  ELSE
    FOR j IN 1..array_length(parts, 1) LOOP
      FOR i IN 1..array_length(patterns, 1) LOOP
        parts[j] := regexp_replace(parts[j], patterns[i][1], patterns[i][2], 'g');
      END LOOP;
    END LOOP;
  END IF;
  FOR j IN 1..array_length(parts, 1) LOOP
    result := result || parts[j] || coalesce(segments[j], '');
  END LOOP;
  RETURN result;
END;
$function$;

-- §2 — POST-CONDITIONS : corps attendu, attributs gardés, comportement vérifié.
DO $postcheck$
DECLARE
  c_new CONSTANT text := '300d4e4c2f502c0eb9e52b92fde60769';
  v_md5 text;
  v_cfg text[];
  t     record;
BEGIN
  SELECT md5(p.prosrc), p.proconfig INTO v_md5, v_cfg
    FROM pg_proc p
   WHERE p.oid = 'public.restore_french_accents(text)'::regprocedure;
  IF v_md5 IS DISTINCT FROM c_new OR v_cfg IS DISTINCT FROM ARRAY['search_path=public'] THEN
    RAISE EXCEPTION 'ABORT: post-condition — md5 %, config %', v_md5, v_cfg;
  END IF;

  FOR t IN
    SELECT * FROM (VALUES
      ('<a href="/reference-auto/filtre-a-huile">la reference du modele</a>',
       '<a href="/reference-auto/filtre-a-huile">la référence du modèle</a>'),
      ('voir /pieces/filtre-a-huile-7.html ou https://exemple.test/reference/modele, puis le modele',
       'voir /pieces/filtre-a-huile-7.html ou https://exemple.test/reference/modele, puis le modèle'),
      ('<img src="/img/piece.webp" alt="piece"> le filtre a huile',
       '<img src="/img/piece.webp" alt="piece"> le filtre à huile'),
      ('équipementiers de première monte ; le prix se situe entre ; la pose et la repose',
       'équipementiers de première monte ; le prix se situe entre ; la pose et la repose'),
      ('', '')
    ) AS v(entree, attendu)
  LOOP
    IF public.restore_french_accents(t.entree) IS DISTINCT FROM t.attendu THEN
      RAISE EXCEPTION 'ABORT: post-condition — « % » donne « % », « % » attendu',
        t.entree, public.restore_french_accents(t.entree), t.attendu;
    END IF;
    IF public.restore_french_accents(t.attendu) IS DISTINCT FROM t.attendu THEN
      RAISE EXCEPTION 'ABORT: post-condition — « % » n''est pas un point fixe', t.attendu;
    END IF;
  END LOOP;
  IF public.restore_french_accents(NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'ABORT: post-condition — NULL doit rester NULL';
  END IF;

  RAISE NOTICE 'restore_french_accents : balises et URL protégées, monte/situe/pose/repose retirés';
END
$postcheck$;
