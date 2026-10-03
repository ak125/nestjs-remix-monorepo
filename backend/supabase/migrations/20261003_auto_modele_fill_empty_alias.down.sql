-- Rollback: 20261003_auto_modele_fill_empty_alias
-- Remet modele_alias = '' sur les 102 modèles renseignés par la migration, et
-- sur eux seuls : une ligne n'est remise à vide que si son alias est encore
-- exactement la valeur écrite (une valeur modifiée depuis par un autre canal
-- est conservée et signalée). Aucune autre colonne n'est touchée.
-- Après ce retour, les 488 lignes de __vehicle_page_cache se reconstruisent de
-- la même façon que pour l'aller (scripts/seo/backfill-vehicle-page-cache.ts).
-- L'engine est forward-only : ce fichier se lance à la main. La transaction
-- explicite borne les délais par SET LOCAL et rend retour et post-condition
-- indivisibles.
BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SET LOCAL search_path = public, pg_temp;

DO $unfill$
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
  v_reset bigint;
  v_kept  bigint;
BEGIN
  IF jsonb_array_length(c_rows) <> 102 THEN
    RAISE EXCEPTION 'ABORT: liste — 102 lignes attendues, % trouvées', jsonb_array_length(c_rows);
  END IF;

  UPDATE public.auto_modele m
     SET modele_alias = ''
    FROM jsonb_to_recordset(c_rows) AS e(id integer, marque integer, name text, alias text)
   WHERE m.modele_id = e.id
     AND m.modele_alias = e.alias;
  GET DIAGNOSTICS v_reset = ROW_COUNT;

  -- Lignes ni vides ni égales à la valeur écrite : modifiées par un autre canal.
  SELECT count(*) INTO v_kept
    FROM jsonb_to_recordset(c_rows) AS e(id integer, marque integer, name text, alias text)
    JOIN public.auto_modele m ON m.modele_id = e.id AND m.modele_alias <> '';
  RAISE NOTICE 'auto_modele: % lignes remises à vide ; % conservées (alias modifié depuis la migration)',
    v_reset, v_kept;
END
$unfill$;

COMMIT;
