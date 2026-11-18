-- =============================================================================
-- Migration : quatre liens fournisseur ↔ marque — DistriCash (71) et CAL (19)
--             vendent SEIM (4200) et LUK (2860)
-- Date      : 2026-11-18 (mandat BK, complément n° 5 ; « oui » de Marwane du
--             18/11 à 17:55, heure de Paris)
-- Scope     : public.___xtr_supplier_link_pm, 4 lignes ajoutées au plus. Rien
--             d'autre : aucune ligne existante modifiée ou supprimée.
-- Forward-only. Ne réécrit AUCUNE migration historique.
-- =============================================================================
--
-- POURQUOI — le relevé daté des offres (complément BK n° 4, #2166) n'interroge
-- un fournisseur connectable que pour les marques que cette table lui associe
-- (getSupplierLinkedBrands). Relevé du 2026-11-18 : ni SEIM ni LUK n'y ont de
-- lien, si bien que les lignes payées de ces deux marques restent « relevé
-- absent », donc BLOQUE en PROD. Preuves de vente :
--   * DCA ↔ SEIM : relevé DCA du 18/11 (SEIM 554855, référence exacte) et
--     import tarif de juin ;
--   * DCA ↔ LUK  : LUK 500 0728 10 disponible sur le portail DCA le 18/11 ;
--   * CAL ↔ SEIM et CAL ↔ LUK : confirmés par Marwane le 18/11.
--
-- STRUCTURE SUIVIE (relevé en lecture seule du 2026-11-18) — 4 colonnes text,
-- aucune valeur par défaut, aucun trigger, seule contrainte la clé primaire
-- slpm_id :
--   slpm_id      : entier en texte, 108 lignes numérotées 1 à 108 ;
--   slpm_pm_id   : pieces_marque.pm_id en texte ;
--   slpm_spl_id  : ___xtr_supplier.spl_id en texte ;
--   slpm_display : '1' sur les 108 lignes.
-- Les nouvelles lignes prennent le plus grand slpm_id numérique + 1, + 2… dans
-- l'ordre fixe ci-dessous ; slpm_display = '1'.
--
-- EFFET : au prochain passage du relevé sur DEV (drapeau
-- SUPPLIER_OFFER_RELEVE_ENABLED, posé par Marwane), DCA et CAL sont interrogés
-- pour les lignes payées SEIM et LUK. La synchro catalogue
-- (supplier-sync.runner) lit la même table : elle inclura aussi ces marques
-- quand elle tourne. Aucun effet sur le site public, les prix ou les pages.
--
-- GARDES — la migration s'interrompt, sans rien écrire, si :
--   * la marque 4200 n'est pas SEIM, la marque 2860 n'est pas LUK, le
--     fournisseur 19 n'est pas CAL ou le fournisseur 71 n'est pas DCA ;
--   * un slpm_id n'est pas un entier (la numérotation ne serait plus sûre) ;
--   * l'un des quatre liens existe déjà en double ;
--   * l'écriture ajoute plus de 4 lignes, ou une ligne hors des quatre liens ;
--   * après l'écriture, l'un des quatre liens n'existe pas exactement une fois,
--     ou le nombre de lignes n'a pas augmenté du nombre d'ajouts.
--
-- IDEMPOTENT ET REJOUABLE : un lien n'est ajouté que s'il n'existe pas. Rejouée,
-- la migration ajoute 0 ligne et passe.
--
-- APPLICATION : par le moteur du dépôt uniquement (Actions → « 🗄️ Apply Supabase
-- migrations (manual) », dry_run puis confirm = APPLY, only_ids = cet
-- identifiant), après fusion sur main et sur le « oui » de Marwane — jamais par
-- un canal qui contourne infra.schema_migrations. Le bloc $precheck$ se joue
-- seul en lecture seule avant.
--
-- ROLLBACK : 20261118_supplier_link_pm_dca_cal_seim_luk.down.sql, à la main.
-- =============================================================================

-- Pas de BEGIN/COMMIT explicite : le moteur applique ce fichier dans une
-- transaction (.squawk.toml `assume_in_transaction = true`). INSERT de 4 lignes
-- au plus ; une course sur slpm_id échoue sur la clé primaire et annule tout.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, pg_temp;

-- §0 — PRÉ-CONDITIONS, en lecture seule (rejouables avant la fusion).
DO $precheck$
DECLARE
  v_bad      text;
  v_non_num  bigint;
  v_doublons bigint;
  v_presents bigint;
BEGIN
  SELECT string_agg(e.what, ', ') INTO v_bad
    FROM (VALUES ('marque 4200 = SEIM', (SELECT pm_name FROM public.pieces_marque WHERE pm_id::text = '4200'), 'SEIM'),
                 ('marque 2860 = LUK',  (SELECT pm_name FROM public.pieces_marque WHERE pm_id::text = '2860'), 'LUK'),
                 ('fournisseur 19 = CAL', (SELECT spl_name FROM public.___xtr_supplier WHERE spl_id::text = '19'), 'CAL'),
                 ('fournisseur 71 = DCA', (SELECT spl_name FROM public.___xtr_supplier WHERE spl_id::text = '71'), 'DCA'))
         AS e(what, lu, attendu)
   WHERE upper(trim(coalesce(e.lu, ''))) <> e.attendu;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'ABORT: pré-condition non remplie — % : la base a changé depuis le relevé', v_bad;
  END IF;

  SELECT count(*) INTO v_non_num
    FROM public.___xtr_supplier_link_pm
   WHERE slpm_id !~ '^[0-9]+$';
  IF v_non_num > 0 THEN
    RAISE EXCEPTION 'ABORT: % slpm_id non entier(s) — numérotation des nouveaux liens impossible sans deviner', v_non_num;
  END IF;

  SELECT count(*) INTO v_doublons
    FROM (SELECT l.slpm_spl_id, l.slpm_pm_id
            FROM public.___xtr_supplier_link_pm l
            JOIN (VALUES ('71', '4200'), ('71', '2860'), ('19', '4200'), ('19', '2860'))
                 AS w(spl, pm) ON l.slpm_spl_id = w.spl AND l.slpm_pm_id = w.pm
           GROUP BY 1, 2
          HAVING count(*) > 1) d;
  IF v_doublons > 0 THEN
    RAISE EXCEPTION 'ABORT: % des quatre liens existe(nt) déjà en double', v_doublons;
  END IF;

  SELECT count(*) INTO v_presents
    FROM public.___xtr_supplier_link_pm l
    JOIN (VALUES ('71', '4200'), ('71', '2860'), ('19', '4200'), ('19', '2860'))
         AS w(spl, pm) ON l.slpm_spl_id = w.spl AND l.slpm_pm_id = w.pm;
  RAISE NOTICE 'pré-condition liens SEIM/LUK : OK (% lien(s) déjà présent(s) sur 4 ; 4 = rejeu)', v_presents;
END
$precheck$;

-- §1 — ÉCRITURE ET POST-CONDITIONS, dans la même transaction : tout écart annule
-- l'écriture.
DO $link$
DECLARE
  v_avant   bigint;
  v_apres   bigint;
  v_ajouts  text[];
  v_hors    bigint;
  v_mauvais bigint;
BEGIN
  SELECT count(*) INTO v_avant FROM public.___xtr_supplier_link_pm;

  WITH voulu (rang, spl, pm) AS (
    VALUES (1, '71', '4200'), (2, '71', '2860'), (3, '19', '4200'), (4, '19', '2860')
  ), manquant AS (
    SELECT v.rang, v.spl, v.pm
      FROM voulu v
     WHERE NOT EXISTS (SELECT 1
                         FROM public.___xtr_supplier_link_pm l
                        WHERE l.slpm_spl_id = v.spl
                          AND l.slpm_pm_id = v.pm)
  ), base AS (
    SELECT coalesce(max(slpm_id::bigint), 0) AS n FROM public.___xtr_supplier_link_pm
  ), ins AS (
    INSERT INTO public.___xtr_supplier_link_pm (slpm_id, slpm_pm_id, slpm_spl_id, slpm_display)
    SELECT (b.n + row_number() OVER (ORDER BY m.rang))::text, m.pm, m.spl, '1'
      FROM manquant m CROSS JOIN base b
    RETURNING slpm_spl_id, slpm_pm_id
  )
  SELECT coalesce(array_agg(i.slpm_spl_id || '↔' || i.slpm_pm_id ORDER BY i.slpm_spl_id, i.slpm_pm_id), ARRAY[]::text[])
    INTO v_ajouts
    FROM ins i;                                    -- 4 lignes maintenant, 0 au rejeu

  IF cardinality(v_ajouts) > 4 THEN
    RAISE EXCEPTION 'ABORT: garde — % lignes ajoutées, 4 au plus attendues', cardinality(v_ajouts);
  END IF;
  SELECT count(*) INTO v_hors
    FROM unnest(v_ajouts) AS a(lien)
   WHERE a.lien NOT IN ('71↔4200', '71↔2860', '19↔4200', '19↔2860');
  IF v_hors > 0 THEN
    RAISE EXCEPTION 'ABORT: garde — ligne(s) ajoutée(s) hors des quatre liens : %', v_ajouts;
  END IF;

  SELECT count(*) INTO v_mauvais
    FROM (VALUES ('71', '4200'), ('71', '2860'), ('19', '4200'), ('19', '2860')) AS w(spl, pm)
   WHERE (SELECT count(*)
            FROM public.___xtr_supplier_link_pm l
           WHERE l.slpm_spl_id = w.spl
             AND l.slpm_pm_id = w.pm
             AND l.slpm_display = '1') <> 1;
  IF v_mauvais > 0 THEN
    RAISE EXCEPTION 'ABORT: post-condition — % lien(s) sur 4 absent(s), en double ou masqué(s)', v_mauvais;
  END IF;

  SELECT count(*) INTO v_apres FROM public.___xtr_supplier_link_pm;
  IF v_apres <> v_avant + cardinality(v_ajouts) THEN
    RAISE EXCEPTION 'ABORT: post-condition — % lignes avant, % ajout(s), % après', v_avant, cardinality(v_ajouts), v_apres;
  END IF;

  RAISE NOTICE 'liens SEIM/LUK : % lien(s) ajouté(s) maintenant (0 = rejeu) %, 4 / 4 présents, % ligne(s) au total',
    cardinality(v_ajouts), v_ajouts, v_apres;
END
$link$;
