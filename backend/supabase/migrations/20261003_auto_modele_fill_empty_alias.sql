-- =============================================================================
-- Migration : renseigner modele_alias des 102 modèles affichés dont l'alias est
--             vide
-- Date      : 2026-10-03
-- Scope     : public.auto_modele — 102 lignes, colonne modele_alias UNIQUEMENT,
--             '' → normalizeAlias(modele_name). Valeurs littérales, calculées
--             par la fonction canonique du dépôt (packages/seo-url-contract,
--             normalizeAlias) sur le modele_name mesuré le 2026-10-03.
--               CHEVROLET 25 · HYUNDAI 22 · KIA 17 · HONDA 12 · CITROËN 9 ·
--               FORD 6 · FIAT 4 · LADA 3 · LAND ROVER 2 · DAEWOO 1 · CHRYSLER 1
-- Forward-only. Ne réécrit AUCUNE migration historique.
-- =============================================================================
--
-- POURQUOI — rapport GSC « Introuvable (404) » du 21/09/2026 :
--   * 102 modèles ont modele_display = 1 et modele_alias = '' (aussi
--     modele_name_url = '', modele_sitemap = 0, modele_relfollow = 0). Ce sont
--     les SEULS modèles affichés sans alias. Ils portent 488 types affichés ;
--   * la page R2 (/pieces/…) construit son URL avec un repli
--     normalizeAlias(modele_name) : elle répond 200 et lie la page R8 sous le
--     slug `{normalizeAlias(modele_name)}-{modele_id}` ;
--   * la page R8 (/constructeurs/…) canonicalise avec `${modele_alias}-${modele_id}`
--     SANS repli : 301 vers `/-{modele_id}/`, segment que detectMalformedSegment
--     classe `missing_alias` → 404. Exemple mesuré en PROD le 2026-10-03 :
--     /constructeurs/fiat-58/ducato-v-platforme-chassis-250-58226/150-multijet-30-d-9130.html
--     → 301 /constructeurs/fiat-58/-58226/150-multijet-30-d-9130.html → 404 ;
--   * la même absence casse `vehicle_url` / `part_url` de
--     get_brand_page_data_optimized (liens `/-{id}/` sur les pages marque).
--
-- POURQUOI CES VALEURS (aucune URL inventée ni renommée) :
--   * la valeur écrite est exactement le slug que R2 émet DÉJÀ via son repli,
--     et que Google a découvert : l'URL R2 ne change pas (normalizeAlias est
--     idempotente), l'URL R8 liée devient celle qui répond ;
--   * sonde PROD 2026-10-03 (slug volontairement faux `zz-{id}`) : 78/102
--     modèles redirigent vers `{alias ci-dessous}-{id}`, 78/78 identiques. Les
--     24 autres ne sont pas observables par cette sonde (pages R2 sans
--     catalogue, 200 noindex sans redirection) ; même fonction, même entrée ;
--   * chaque valeur est un slug bien formé (^[a-z0-9]+(-[a-z0-9]+)*$, vérifié
--     ci-dessous), 34 caractères au plus (colonne varchar(40)).
--
-- ALIAS PARTAGÉS (26 paires, 23 alias) : un modèle plus ancien de la même marque
-- porte déjà l'alias (ex. sportage-v 42553, silverado 11366 et 44178). Aucun
-- index unique ne porte sur modele_alias (seule la clé primaire), les URL
-- contiennent modele_id et restent distinctes. getModelByBrandAndAlias
-- (order modele_id, limit 1) résout toujours le plus ancien : les 26 modèles
-- existants sont tous d'id inférieur, la résolution actuelle ne change pas.
--
-- HORS LOT, VOLONTAIREMENT :
--   * modele_name_url, modele_relfollow, modele_sitemap : non touchés. Les 488
--     pages R8 restent noindex (is_indexable exige modele_relfollow = 1) ;
--   * __vehicle_page_cache : projection, reconstruite par son constructeur
--     (scripts/seo/backfill-vehicle-page-cache.ts --type-ids=…), JAMAIS écrite
--     ici. Sans ce rebuild, R8 continue de servir modele_alias = '' : aucun
--     trigger sur auto_modele ne la rafraîchit (seul trg_auto_type_rebuild_cache
--     existe, sur auto_type). 488 rebuilds ≈ 10 min, hors budget de cette
--     transaction (60 s) ;
--   * __sitemap_p_link (0 ligne pour ces 102 modèles) : non touché.
--
-- EFFETS CONNUS :
--   * pages marque, cartes « véhicules compatibles » du blog, remap de type,
--     alternatives soft-404 : les liens `/-{id}/` deviennent `{alias}-{id}`, à
--     l'expiration de leurs caches Redis (600 s à 24 h selon la clé) ;
--   * pages R2 : URL inchangée (repli identique) ;
--   * pages R8 : inchangées tant que __vehicle_page_cache n'est pas reconstruit ;
--   * backfill_seo_keywords_type_ids / match_keyword_to_type /
--     match_keywords_batch (égalité ou LIKE sur l'alias) peuvent désormais
--     associer des mots-clés à ces modèles, s'ils sont lancés. Aucun job pg_cron
--     ne les appelle (vérifié le 2026-10-03) ;
--   * index Meilisearch : champ modelAlias renseigné au prochain réindexage.
--
-- IDEMPOTENT ET REJOUABLE : chaque ligne est acceptée avec modele_alias = ''
-- (état mesuré) ou déjà égal à la valeur attendue (rejeu) ; toute autre valeur
-- interrompt la migration. L'UPDATE ne touche que les lignes encore vides.
--
-- APPLICATION : par le moteur du dépôt uniquement (Actions → « 🗄️ Apply
-- Supabase migrations (manual) », only_ids = cet identifiant), après fusion sur
-- main — jamais par un canal qui contourne infra.schema_migrations. Puis rebuild
-- des 488 lignes de __vehicle_page_cache (décrit dans la PR).
--
-- ROLLBACK : 20261003_auto_modele_fill_empty_alias.down.sql (remet '' sur les
-- seules lignes encore égales à la valeur écrite), à lancer à la main : le
-- moteur est forward-only.
-- =============================================================================

-- Pas de BEGIN/COMMIT explicite : le moteur applique ce fichier dans une
-- transaction (.squawk.toml `assume_in_transaction = true`). L'UPDATE prend des
-- verrous de ligne sur 102 lignes, aucune réécriture de table.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SET LOCAL search_path = public, pg_temp;

-- Pré-conditions, écriture et post-conditions dans un seul bloc : la liste
-- n'existe qu'une fois, et tout écart l'interrompt avant ou après l'UPDATE.
DO $fill$
DECLARE
  c_rows CONSTANT jsonb := $json$
    [{"id":44491,"marque":44,"name":"ASTRO I Camionnette","alias":"astro-i-camionnette"}
    ,{"id":44501,"marque":44,"name":"BLAZER (1N)","alias":"blazer-1n"}
    ,{"id":44502,"marque":44,"name":"BOLT II","alias":"bolt-ii"}
    ,{"id":44504,"marque":44,"name":"CAPTIVA II","alias":"captiva-ii"}
    ,{"id":44505,"marque":44,"name":"CMV Camionnette","alias":"cmv-camionnette"}
    ,{"id":44506,"marque":44,"name":"CORVETTE V","alias":"corvette-v"}
    ,{"id":44507,"marque":44,"name":"CORVETTE V Décapotable","alias":"corvette-v-decapotable"}
    ,{"id":44509,"marque":44,"name":"D-MAX II","alias":"d-max-ii"}
    ,{"id":44510,"marque":44,"name":"ESTEEM Hatchback","alias":"esteem-hatchback"}
    ,{"id":44513,"marque":44,"name":"EXPRESS II Camionnette","alias":"express-ii-camionnette"}
    ,{"id":44514,"marque":44,"name":"EXPRESS II Platforme-Châssis","alias":"express-ii-platforme-chassis"}
    ,{"id":44515,"marque":44,"name":"GROOVE","alias":"groove"}
    ,{"id":44517,"marque":44,"name":"JOY Hatchback","alias":"joy-hatchback"}
    ,{"id":44518,"marque":44,"name":"JOY PLUS Sedan","alias":"joy-plus-sedan"}
    ,{"id":44520,"marque":44,"name":"N300 - N300 WORK Platforme-Châssis","alias":"n300-n300-work-platforme-chassis"}
    ,{"id":44521,"marque":44,"name":"ONIX II","alias":"onix-ii"}
    ,{"id":44522,"marque":44,"name":"ONIX PLUS","alias":"onix-plus"}
    ,{"id":44523,"marque":44,"name":"RODEO","alias":"rodeo"}
    ,{"id":44524,"marque":44,"name":"SILVERADO","alias":"silverado"}
    ,{"id":44525,"marque":44,"name":"SUBURBAN VII (GMT1YC)","alias":"suburban-vii-gmt1yc"}
    ,{"id":44526,"marque":44,"name":"TAHOE V","alias":"tahoe-v"}
    ,{"id":44527,"marque":44,"name":"TRACKER III","alias":"tracker-iii"}
    ,{"id":44528,"marque":44,"name":"TRAILBLAZER III","alias":"trailblazer-iii"}
    ,{"id":44529,"marque":44,"name":"TRANS SPORT (2U)","alias":"trans-sport-2u"}
    ,{"id":44531,"marque":44,"name":"ONIX III Berline","alias":"onix-iii-berline"}
    ,{"id":45181,"marque":45,"name":"AS 250 I Pick-up","alias":"as-250-i-pick-up"}
    ,{"id":46108,"marque":46,"name":"AMI (9A)","alias":"ami-9a"}
    ,{"id":46109,"marque":46,"name":"BERLINGO III (K9)","alias":"berlingo-iii-k9"}
    ,{"id":46113,"marque":46,"name":"C4 III","alias":"c4-iii"}
    ,{"id":46114,"marque":46,"name":"C5 X","alias":"c5-x"}
    ,{"id":46120,"marque":46,"name":"JUMPER III Platforme-Châssis","alias":"jumper-iii-platforme-chassis"}
    ,{"id":46123,"marque":46,"name":"JUMPY II Camionnette","alias":"jumpy-ii-camionnette"}
    ,{"id":46124,"marque":46,"name":"JUMPY II Platforme-Châssis","alias":"jumpy-ii-platforme-chassis"}
    ,{"id":46125,"marque":46,"name":"JUMPY III Camionnette (V)","alias":"jumpy-iii-camionnette-v"}
    ,{"id":46126,"marque":46,"name":"JUMPY III Platforme-Châssis (V)","alias":"jumpy-iii-platforme-chassis-v"}
    ,{"id":48065,"marque":48,"name":"DAMAS II Camionnette","alias":"damas-ii-camionnette"}
    ,{"id":58226,"marque":58,"name":"DUCATO V Platforme-Châssis (250)","alias":"ducato-v-platforme-chassis-250"}
    ,{"id":58229,"marque":58,"name":"FIORINO III Monospace (225)","alias":"fiorino-iii-monospace-225"}
    ,{"id":58232,"marque":58,"name":"SCUDO II Camionnette (270. 272)","alias":"scudo-ii-camionnette-270-272"}
    ,{"id":58233,"marque":58,"name":"SCUDO II Platforme-Châssis (270. 272)","alias":"scudo-ii-platforme-chassis-270-272"}
    ,{"id":60332,"marque":60,"name":"ENDEAVOUR - EVEREST","alias":"endeavour-everest"}
    ,{"id":60333,"marque":60,"name":"FREESTYLE","alias":"freestyle"}
    ,{"id":60335,"marque":60,"name":"KUGA III","alias":"kuga-iii"}
    ,{"id":60336,"marque":60,"name":"PUMA (J2K-CF7)","alias":"puma-j2k-cf7"}
    ,{"id":60346,"marque":60,"name":"TRANSIT VII Platforme-Châssis","alias":"transit-vii-platforme-chassis"}
    ,{"id":60348,"marque":60,"name":"TRANSIT IX V363 Platforme-Châssis","alias":"transit-ix-v363-platforme-chassis"}
    ,{"id":74199,"marque":74,"name":"ACTY II Camionnette (HH)","alias":"acty-ii-camionnette-hh"}
    ,{"id":74201,"marque":74,"name":"CITY VII Hatchback (GN3)","alias":"city-vii-hatchback-gn3"}
    ,{"id":74202,"marque":74,"name":"CITY VII (GN1. GN2)","alias":"city-vii-gn1-gn2"}
    ,{"id":74203,"marque":74,"name":"CIVIC XI","alias":"civic-xi"}
    ,{"id":74204,"marque":74,"name":"e (ZC7)","alias":"e-zc7"}
    ,{"id":74205,"marque":74,"name":"VEZEL SUV (RV)","alias":"vezel-suv-rv"}
    ,{"id":74206,"marque":74,"name":"INSIGHT III","alias":"insight-iii"}
    ,{"id":74208,"marque":74,"name":"JAZZ V","alias":"jazz-v"}
    ,{"id":74209,"marque":74,"name":"N-VAN","alias":"n-van"}
    ,{"id":74210,"marque":74,"name":"N-WGN II","alias":"n-wgn-ii"}
    ,{"id":74211,"marque":74,"name":"N-WGN CUSTOM","alias":"n-wgn-custom"}
    ,{"id":74212,"marque":74,"name":"PASSPORT III","alias":"passport-iii"}
    ,{"id":76140,"marque":76,"name":"ACCENT V","alias":"accent-v"}
    ,{"id":76141,"marque":76,"name":"ALCAZAR","alias":"alcazar"}
    ,{"id":76142,"marque":76,"name":"BAYON","alias":"bayon"}
    ,{"id":76144,"marque":76,"name":"CRETA II","alias":"creta-ii"}
    ,{"id":76148,"marque":76,"name":"H-100 Platforme-Châssis (HR)","alias":"h-100-platforme-chassis-hr"}
    ,{"id":76149,"marque":76,"name":"H350 - SOLATI","alias":"h350-solati"}
    ,{"id":76150,"marque":76,"name":"H350 - SOLATI Platforme-Châssis","alias":"h350-solati-platforme-chassis"}
    ,{"id":76151,"marque":76,"name":"HB20- HB20X (BR2)","alias":"hb20-hb20x-br2"}
    ,{"id":76152,"marque":76,"name":"HB20S Berline (BR2)","alias":"hb20s-berline-br2"}
    ,{"id":76153,"marque":76,"name":"i10 III","alias":"i10-iii"}
    ,{"id":76154,"marque":76,"name":"i10 III  Berline","alias":"i10-iii-berline"}
    ,{"id":76155,"marque":76,"name":"i20 III ","alias":"i20-iii"}
    ,{"id":76156,"marque":76,"name":"i30 IV","alias":"i30-iv"}
    ,{"id":76157,"marque":76,"name":"IONIQ 5","alias":"ioniq-5"}
    ,{"id":76159,"marque":76,"name":"PALISADE","alias":"palisade"}
    ,{"id":76161,"marque":76,"name":"PORTER II PickUp","alias":"porter-ii-pickup"}
    ,{"id":76162,"marque":76,"name":"REINA","alias":"reina"}
    ,{"id":76164,"marque":76,"name":"SONATA VIII","alias":"sonata-viii"}
    ,{"id":76165,"marque":76,"name":"STARIA (US4)","alias":"staria-us4"}
    ,{"id":76166,"marque":76,"name":"STARIA Camionnette (US4)","alias":"staria-camionnette-us4"}
    ,{"id":76168,"marque":76,"name":"TUCSON IV","alias":"tucson-iv"}
    ,{"id":76169,"marque":76,"name":"VENUE","alias":"venue"}
    ,{"id":88112,"marque":88,"name":"BONGO IV PickUp (PU)","alias":"bongo-iv-pickup-pu"}
    ,{"id":88113,"marque":88,"name":"CARNIVAL IV (KA4)","alias":"carnival-iv-ka4"}
    ,{"id":88114,"marque":88,"name":"XCEE'D (CD)","alias":"xceed-cd"}
    ,{"id":88115,"marque":88,"name":"CERATO V Hatchback","alias":"cerato-v-hatchback"}
    ,{"id":88116,"marque":88,"name":"K8 (GL3)","alias":"k8-gl3"}
    ,{"id":88117,"marque":88,"name":"OPTIMA III","alias":"optima-iii"}
    ,{"id":88118,"marque":88,"name":"PEGAS","alias":"pegas"}
    ,{"id":88119,"marque":88,"name":"PICANTO Runner (JA)","alias":"picanto-runner-ja"}
    ,{"id":88120,"marque":88,"name":"SPORTAGE V","alias":"sportage-v"}
    ,{"id":88124,"marque":88,"name":"PRO CEE'D (CD)","alias":"pro-ceed-cd"}
    ,{"id":88125,"marque":88,"name":"SELTOS","alias":"seltos"}
    ,{"id":88126,"marque":88,"name":"SONET (QY)","alias":"sonet-qy"}
    ,{"id":88127,"marque":88,"name":"SORENTO IV","alias":"sorento-iv"}
    ,{"id":88128,"marque":88,"name":"SOUL III","alias":"soul-iii"}
    ,{"id":88129,"marque":88,"name":"SOUL III Cargo","alias":"soul-iii-cargo"}
    ,{"id":88131,"marque":88,"name":"TELLURIDE (ON)","alias":"telluride-on"}
    ,{"id":88136,"marque":88,"name":"EV6 (CV)","alias":"ev6-cv"}
    ,{"id":90041,"marque":90,"name":"LARGUS","alias":"largus"}
    ,{"id":90042,"marque":90,"name":"NIVA TRAVEL","alias":"niva-travel"}
    ,{"id":90043,"marque":90,"name":"NIVA II","alias":"niva-ii"}
    ,{"id":93028,"marque":93,"name":"DEFENDER Platforme-Châssis (L316)","alias":"defender-platforme-chassis-l316"}
    ,{"id":93030,"marque":93,"name":"RANGE ROVER V","alias":"range-rover-v"}
    ]
  $json$::jsonb;
  r          record;
  v_n        bigint;
  v_distinct bigint;
  v_updated  bigint;
BEGIN
  -- §0 — PRÉ-CONDITIONS FAIL-CLOSED
  SELECT count(*), count(DISTINCT e.id) INTO v_n, v_distinct
    FROM jsonb_to_recordset(c_rows) AS e(id integer, marque integer, name text, alias text);
  IF v_n <> 102 OR v_distinct <> 102 THEN
    RAISE EXCEPTION 'ABORT: liste — 102 modele_id distincts attendus, % lignes / % distincts', v_n, v_distinct;
  END IF;

  FOR r IN
    SELECT e.id, e.marque, e.name, e.alias,
           m.modele_id, m.modele_marque_id, m.modele_display, m.modele_name, m.modele_alias
      FROM jsonb_to_recordset(c_rows) AS e(id integer, marque integer, name text, alias text)
      LEFT JOIN public.auto_modele m ON m.modele_id = e.id
  LOOP
    IF r.modele_id IS NULL THEN
      RAISE EXCEPTION 'ABORT: modele_id % introuvable', r.id;
    END IF;
    IF r.alias IS NULL OR r.alias !~ '^[a-z0-9]+(-[a-z0-9]+)*$' THEN
      RAISE EXCEPTION 'ABORT: modele_id % — alias attendu mal formé : %', r.id, r.alias;
    END IF;
    IF r.modele_marque_id <> r.marque THEN
      RAISE EXCEPTION 'ABORT: modele_id % — marque % attendue, % trouvée', r.id, r.marque, r.modele_marque_id;
    END IF;
    IF r.modele_display <> 1 THEN
      RAISE EXCEPTION 'ABORT: modele_id % — modele_display = % (1 attendu)', r.id, r.modele_display;
    END IF;
    -- L'alias est dérivé du nom : un nom modifié depuis la mesure invalide la valeur.
    IF r.modele_name IS DISTINCT FROM r.name THEN
      RAISE EXCEPTION 'ABORT: modele_id % — modele_name « % » attendu, « % » trouvé', r.id, r.name, r.modele_name;
    END IF;
    IF r.modele_alias NOT IN ('', r.alias) THEN
      RAISE EXCEPTION 'ABORT: modele_id % — modele_alias « % » ni vide ni égal à « % »', r.id, r.modele_alias, r.alias;
    END IF;
  END LOOP;

  -- §1 — ÉCRITURE (lignes encore vides uniquement)
  UPDATE public.auto_modele m
     SET modele_alias = e.alias
    FROM jsonb_to_recordset(c_rows) AS e(id integer, marque integer, name text, alias text)
   WHERE m.modele_id = e.id
     AND m.modele_alias = '';
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  -- §2 — POST-CONDITIONS
  SELECT count(*) INTO v_n
    FROM jsonb_to_recordset(c_rows) AS e(id integer, marque integer, name text, alias text)
    JOIN public.auto_modele m ON m.modele_id = e.id AND m.modele_alias = e.alias;
  IF v_n <> 102 THEN
    RAISE EXCEPTION 'ABORT: post-condition — % / 102 modèles portent l''alias attendu', v_n;
  END IF;

  SELECT count(*) INTO v_n
    FROM public.auto_modele
   WHERE modele_display = 1 AND modele_alias = '';
  RAISE NOTICE 'auto_modele: % lignes renseignées (0 = rejeu) ; modèles affichés encore sans alias : %',
    v_updated, v_n;
END
$fill$;
