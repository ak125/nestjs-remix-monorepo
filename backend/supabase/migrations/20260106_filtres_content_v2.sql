-- Migration: Contenu SEO spécifique pour famille Filtres (5 gammes)
-- Date: 2026-01-06
-- Gammes: 7 (Huile), 8 (Air), 9 (Carburant), 416 (Boîte auto), 424 (Habitacle)

-- =============================================================================
-- FILTRE À HUILE (ID: 7)
-- =============================================================================
UPDATE __seo_gamme_purchase_guide SET
  sgpg_intro_title = 'Le filtre à huile',
  sgpg_intro_role = 'Le filtre à huile retient les impuretés métalliques, les résidus de combustion et les particules abrasives présentes dans l''huile moteur. Il protège les pièces internes du moteur (pistons, bielles, vilebrequin) contre l''usure prématurée.',
  sgpg_risk_title = 'Pourquoi ne jamais attendre ?',
  sgpg_risk_explanation = 'Un filtre à huile colmaté ne filtre plus correctement. L''huile contaminée circule alors dans le moteur, provoquant une usure accélérée des pièces mobiles. Dans les cas extrêmes, la valve de dérivation s''ouvre et laisse passer l''huile non filtrée.',
  sgpg_risk_consequences = ARRAY[
    'Usure prématurée des coussinets de bielles',
    'Rayures sur les cylindres et pistons',
    'Grippage du turbo (huile non filtrée)',
    'Surconsommation d''huile',
    'Perte de pression d''huile'
  ],
  sgpg_risk_cost_range = '8 à 25 € (filtre seul) / 80 à 150 € avec vidange complète',
  sgpg_risk_conclusion = 'Le filtre à huile se change à chaque vidange. C''est une économie mal placée de le garder : le coût est dérisoire comparé aux dégâts potentiels.',
  sgpg_timing_title = 'Quand faut-il le changer ?',
  sgpg_timing_years = '1 an maximum',
  sgpg_timing_km = '10 000 à 30 000 km selon motorisation',
  sgpg_timing_note = 'Le filtre à huile se change systématiquement à chaque vidange. Les moteurs diesel et turbo nécessitent un remplacement plus fréquent (10 000 à 15 000 km). Les essence atmosphériques peuvent aller jusqu''à 30 000 km.',
  sgpg_arg4_title = 'Qualité OE garantie',
  sgpg_arg4_content = 'Nos filtres à huile sont de qualité équivalente constructeur. Média filtrant haute performance, valve anti-retour intégrée, joint d''étanchéité de qualité. Marques : Mann, Mahle, Bosch, Purflux.',
  sgpg_symptoms = ARRAY[
    'Voyant huile qui s''allume ou clignote',
    'Bruit de claquement ou de cliquetis au ralenti',
    'Huile très noire avant l''échéance de vidange',
    'Baisse du niveau d''huile plus rapide que d''habitude',
    'Odeur d''huile brûlée dans l''habitacle'
  ],
  sgpg_faq = '[
    {"question": "Peut-on changer le filtre sans faire la vidange ?", "answer": "Techniquement oui, mais c''est déconseillé. L''huile neuve avec un vieux filtre se salit rapidement. Inversement, un filtre neuf avec de l''huile usée ne sert à rien. Changez les deux ensemble."},
    {"question": "Filtre à huile OE ou adaptable ?", "answer": "Les filtres adaptables de marques reconnues (Mann, Mahle, Bosch) offrent une qualité équivalente à l''origine pour 30 à 50% moins cher. Évitez les no-name à 3€ qui peuvent avoir un média filtrant de mauvaise qualité."},
    {"question": "Comment savoir si mon filtre à huile est HS ?", "answer": "Un filtre colmaté provoque une chute de pression d''huile (voyant), des bruits moteur inhabituels, ou une huile qui noircit très vite. En cas de doute, changez-le : c''est peu cher et rapide."},
    {"question": "Faut-il pré-remplir le filtre à huile neuf ?", "answer": "Pour les filtres à visser verticaux, oui : remplissez-le d''huile avant montage pour éviter un démarrage à sec. Pour les filtres horizontaux ou les cartouches, ce n''est pas nécessaire."},
    {"question": "Diagnostic express : mon voyant huile s''allume", "answer": "1) Vérifiez le niveau d''huile immédiatement. 2) Si le niveau est bon, le problème peut venir du capteur, de la pompe à huile, ou d''un filtre très colmaté. 3) Ne roulez pas avec le voyant allumé : risque de casse moteur."}
  ]'::jsonb,
  sgpg_how_to_choose = 'Choisissez un filtre à huile adapté à votre motorisation. Les moteurs diesel et turbo nécessitent des filtres avec un débit et une capacité de filtration supérieurs. Vérifiez toujours la compatibilité avec votre véhicule.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '7';

-- =============================================================================
-- FILTRE À AIR (ID: 8)
-- =============================================================================
UPDATE __seo_gamme_purchase_guide SET
  sgpg_intro_title = 'Le filtre à air',
  sgpg_intro_role = 'Le filtre à air purifie l''air aspiré par le moteur avant qu''il n''entre dans la chambre de combustion. Il retient poussières, pollens, insectes et particules fines qui pourraient abraser les cylindres et fausser le dosage air/carburant.',
  sgpg_risk_title = 'Pourquoi ne jamais attendre ?',
  sgpg_risk_explanation = 'Un filtre à air encrassé réduit le débit d''air entrant. Le moteur compense en enrichissant le mélange, ce qui augmente la consommation et les émissions polluantes. À terme, les performances chutent et le moteur s''encrasse.',
  sgpg_risk_consequences = ARRAY[
    'Surconsommation de carburant (jusqu''à 10%)',
    'Perte de puissance à l''accélération',
    'Encrassement du moteur et des injecteurs',
    'Usure prématurée des segments et cylindres',
    'Échec au contrôle technique (émissions)'
  ],
  sgpg_risk_cost_range = '10 à 40 € (filtre) / 15 à 60 € avec main d''œuvre',
  sgpg_risk_conclusion = 'Le filtre à air est l''une des pièces les plus simples et économiques à remplacer. Son impact sur la consommation et la longévité moteur justifie un remplacement régulier.',
  sgpg_timing_title = 'Quand faut-il le changer ?',
  sgpg_timing_years = '2 ans maximum',
  sgpg_timing_km = '20 000 à 40 000 km selon conditions',
  sgpg_timing_note = 'En ville ou en environnement poussiéreux (chantiers, routes non goudronnées), divisez l''intervalle par deux. Les filtres à air sport lavables ont une durée de vie plus longue mais nécessitent un entretien régulier.',
  sgpg_arg4_title = 'Filtration haute performance',
  sgpg_arg4_content = 'Nos filtres à air utilisent un média filtrant multicouche qui retient 99% des particules supérieures à 10 microns. Marques premium : Mann, Mahle, Bosch, K&N pour les versions sport lavables.',
  sgpg_symptoms = ARRAY[
    'Perte de puissance à l''accélération',
    'Consommation de carburant en hausse',
    'Fumée noire à l''échappement (diesel)',
    'Ralenti instable ou irrégulier',
    'Filtre visiblement gris ou noir à l''inspection'
  ],
  sgpg_faq = '[
    {"question": "Filtre à air papier ou lavable ?", "answer": "Le filtre papier est économique et efficace, à changer tous les 20 000-40 000 km. Le filtre lavable (K&N, BMC) coûte plus cher mais dure la vie du véhicule. Il offre un léger gain de performance mais nécessite un nettoyage régulier."},
    {"question": "Peut-on souffler un filtre à air pour le nettoyer ?", "answer": "Oui, temporairement en dépannage. Soufflez de l''intérieur vers l''extérieur pour déloger les grosses poussières. Mais un filtre soufflé n''est pas comme neuf : les micro-pores restent colmatés. Remplacez-le dès que possible."},
    {"question": "Un filtre sport augmente-t-il vraiment la puissance ?", "answer": "Le gain est marginal sur un moteur d''origine (1-3 ch). L''intérêt est surtout économique (filtre lavable réutilisable) et acoustique (son plus sportif). Pour un vrai gain, il faut une reprogrammation moteur."},
    {"question": "Comment vérifier l''état de mon filtre à air ?", "answer": "Ouvrez la boîte à air (généralement sans outil) et sortez le filtre. S''il est gris clair, c''est bon. S''il est gris foncé ou noir, changez-le. En cas de doute, placez une lampe derrière : la lumière doit passer."},
    {"question": "Diagnostic express : ma voiture consomme plus", "answer": "1) Vérifiez le filtre à air : un filtre encrassé peut augmenter la conso de 10%. 2) Contrôlez la pression des pneus. 3) Vérifiez l''état des bougies (essence) ou des injecteurs (diesel). Le filtre à air est le premier suspect."}
  ]'::jsonb,
  sgpg_how_to_choose = 'Choisissez un filtre adapté à votre boîtier à air. Les dimensions doivent être exactes pour garantir l''étanchéité. En environnement poussiéreux, optez pour un filtre avec une plus grande surface de filtration.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '8';

-- =============================================================================
-- FILTRE À CARBURANT (ID: 9)
-- =============================================================================
UPDATE __seo_gamme_purchase_guide SET
  sgpg_intro_title = 'Le filtre à carburant',
  sgpg_intro_role = 'Le filtre à carburant retient les impuretés présentes dans l''essence ou le gazole avant qu''elles n''atteignent les injecteurs. Il protège le circuit d''injection haute pression des particules, de l''eau et des résidus de corrosion du réservoir.',
  sgpg_risk_title = 'Pourquoi ne jamais attendre ?',
  sgpg_risk_explanation = 'Un filtre à carburant colmaté affame le moteur en carburant. Les injecteurs haute pression (Common Rail) sont particulièrement sensibles aux impuretés : une seule particule peut gripper un injecteur à 300€ pièce.',
  sgpg_risk_consequences = ARRAY[
    'Injecteurs bouchés ou grippés (300-600€/pièce)',
    'Pompe haute pression endommagée (800-1500€)',
    'Perte de puissance et à-coups',
    'Démarrage difficile à froid',
    'Calage du moteur à bas régime'
  ],
  sgpg_risk_cost_range = '15 à 60 € (filtre) / 40 à 120 € avec main d''œuvre',
  sgpg_risk_conclusion = 'Le filtre à carburant protège des composants très coûteux. Son remplacement régulier est un investissement minime face au prix d''une pompe ou d''injecteurs neufs.',
  sgpg_timing_title = 'Quand faut-il le changer ?',
  sgpg_timing_years = '2 à 4 ans',
  sgpg_timing_km = '20 000 à 60 000 km selon carburant',
  sgpg_timing_note = 'Les diesels modernes (HDI, TDI, CDI) avec injection Common Rail nécessitent un filtre neuf tous les 20 000 à 30 000 km. Les essences sont moins exigeantes : 40 000 à 60 000 km. Sur les vieux véhicules, changez-le plus souvent (réservoir rouillé).',
  sgpg_arg4_title = 'Protection injection garantie',
  sgpg_arg4_content = 'Nos filtres à carburant intègrent un séparateur d''eau (diesel) et une finesse de filtration adaptée à l''injection moderne (2-5 microns). Marques : Bosch, Mann, Purflux, Delphi pour les systèmes Common Rail.',
  sgpg_symptoms = ARRAY[
    'Perte de puissance en côte ou à l''accélération',
    'À-coups ou hésitations à bas régime',
    'Démarrage difficile surtout à froid',
    'Calages répétés au ralenti',
    'Voyant moteur allumé (défaut injection)'
  ],
  sgpg_faq = '[
    {"question": "Essence vs diesel : même fréquence de remplacement ?", "answer": "Non. Les diesels HDI/TDI modernes sont plus exigeants : remplacement tous les 20 000-30 000 km. Le gazole contient plus d''impuretés et d''eau que l''essence. Les essences peuvent aller jusqu''à 60 000 km."},
    {"question": "Comment savoir si mon filtre à carburant est HS ?", "answer": "Symptômes typiques : perte de puissance en montée, à-coups à l''accélération, démarrage laborieux. Sur diesel, le voyant de présence d''eau peut s''allumer si le filtre ne sépare plus l''eau correctement."},
    {"question": "Faut-il purger le filtre diesel neuf ?", "answer": "Oui, après remplacement il faut amorcer le circuit. La plupart des véhicules ont une pompe d''amorçage manuelle sur le filtre. Pompez jusqu''à sentir une résistance, puis démarrez. Quelques ratés au démarrage sont normaux."},
    {"question": "Filtre à carburant ou injecteurs : comment distinguer ?", "answer": "Le filtre provoque une perte progressive de puissance et des à-coups à tous les régimes. Un injecteur défaillant provoque un cylindre qui ne fonctionne plus (vibrations, fumée noire, bruit anormal). Le diagnostic valise tranche."},
    {"question": "Diagnostic express : ma voiture a des à-coups", "answer": "1) À-coups à l''accélération = filtre carburant suspect. 2) À-coups au ralenti uniquement = injecteur ou bobine. 3) À-coups à chaud = sonde lambda ou débitmètre. Commencez par le filtre, c''est le moins cher."}
  ]'::jsonb,
  sgpg_how_to_choose = 'Pour les diesels Common Rail, exigez un filtre avec séparateur d''eau intégré et une finesse de filtration de 2 à 5 microns. Vérifiez la compatibilité exacte avec votre véhicule : les raccords varient.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '9';

-- =============================================================================
-- FILTRE DE BOÎTE AUTOMATIQUE (ID: 416)
-- =============================================================================
UPDATE __seo_gamme_purchase_guide SET
  sgpg_intro_title = 'Le filtre de boîte automatique',
  sgpg_intro_role = 'Le filtre de boîte automatique purifie l''huile de transmission (ATF) en retenant les particules d''usure des embrayages, freins et engrenages internes. Il préserve la mécanique de précision du convertisseur et des trains planétaires.',
  sgpg_risk_title = 'Pourquoi ne jamais attendre ?',
  sgpg_risk_explanation = 'L''huile de boîte auto contient des particules métalliques issues de l''usure normale. Un filtre colmaté ne les retient plus : elles circulent et accélèrent l''usure des composants. Le convertisseur de couple et les embrayages internes sont les premiers touchés.',
  sgpg_risk_consequences = ARRAY[
    'Passages de vitesses durs ou retardés',
    'Patinage des embrayages internes',
    'Surchauffe de la boîte (huile mal refroidie)',
    'Usure prématurée du convertisseur de couple',
    'Réparation ou remplacement de boîte (2000-6000€)'
  ],
  sgpg_risk_cost_range = '20 à 80 € (filtre) / 150 à 400 € avec vidange ATF',
  sgpg_risk_conclusion = 'La boîte automatique est un organe coûteux à réparer. Le remplacement régulier du filtre et de l''huile ATF est une assurance longévité peu onéreuse.',
  sgpg_timing_title = 'Quand faut-il le changer ?',
  sgpg_timing_years = '4 à 6 ans',
  sgpg_timing_km = '60 000 à 100 000 km selon constructeur',
  sgpg_timing_note = 'Les boîtes automatiques modernes (ZF, Aisin) ont des intervalles longs (100 000 km) mais un remplacement préventif à 60 000 km est recommandé en usage urbain. Les boîtes DSG/S-Tronic nécessitent une vidange tous les 60 000 km.',
  sgpg_arg4_title = 'Huile ATF adaptée incluse',
  sgpg_arg4_content = 'Le filtre de boîte auto se change avec l''huile ATF. Utilisez impérativement l''huile spécifiée par le constructeur (Dexron, ATF+4, etc.). Une huile inadaptée provoque des dysfonctionnements immédiats.',
  sgpg_symptoms = ARRAY[
    'Passages de vitesses brutaux ou tardifs',
    'Vibrations ou à-coups lors des changements de rapport',
    'Boîte qui patine en montée ou sous charge',
    'Huile ATF brune ou avec odeur de brûlé',
    'Voyant de température boîte ou message d''alerte'
  ],
  sgpg_faq = '[
    {"question": "Vidange boîte auto : partielle ou complète ?", "answer": "La vidange simple (par gravité) ne remplace que 40-50% de l''huile. La vidange par échange (machine) remplace 90%+. Pour un entretien régulier, la vidange simple suffit. Pour une boîte négligée, l''échange complet est préférable."},
    {"question": "Ma boîte est dite ''à vie'' : faut-il quand même vidanger ?", "answer": "''À vie'' signifie ''vie de la garantie''. Après 100 000 km sans entretien, les problèmes apparaissent. Les spécialistes boîte auto recommandent une vidange tous les 60 000-80 000 km, même sur les boîtes scellées."},
    {"question": "Boîte DSG/S-Tronic : même entretien ?", "answer": "Les boîtes DSG ont deux circuits séparés : huile mécanique + huile Mechatronic. La vidange standard concerne l''huile mécanique. L''unité Mechatronic a son propre filtre interne, rarement accessible."},
    {"question": "Comment savoir si ma boîte auto souffre ?", "answer": "Symptômes d''alerte : passages durs, patinage, à-coups, bruit de sifflement. Vérifiez la couleur de l''huile : rouge = OK, brune = usée, noire avec odeur = problème. Un diagnostic valise peut lire les adaptations de la boîte."},
    {"question": "Diagnostic express : ma boîte auto patine", "answer": "1) Vérifiez le niveau d''huile ATF (si jauge accessible). 2) Contrôlez la couleur et l''odeur de l''huile. 3) Si l''huile est brune/noire, une vidange peut améliorer les choses. 4) Si ça persiste, diagnostic spécialisé boîte auto."}
  ]'::jsonb,
  sgpg_how_to_choose = 'Le filtre de boîte auto doit correspondre exactement à votre boîte (ZF, Aisin, Mercedes 7G, etc.). Commandez le kit complet filtre + joint de carter + huile ATF spécifique.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '416';

-- =============================================================================
-- FILTRE D'HABITACLE (ID: 424)
-- =============================================================================
UPDATE __seo_gamme_purchase_guide SET
  sgpg_intro_title = 'Le filtre d''habitacle',
  sgpg_intro_role = 'Le filtre d''habitacle purifie l''air entrant dans le véhicule par la ventilation et la climatisation. Il retient pollens, poussières fines (PM2.5), gaz d''échappement et allergènes pour protéger la santé des occupants.',
  sgpg_risk_title = 'Pourquoi ne jamais attendre ?',
  sgpg_risk_explanation = 'Un filtre d''habitacle saturé devient un nid à bactéries et moisissures. L''air vicié qui en sort provoque allergies, irritations et mauvaises odeurs. La climatisation perd en efficacité car le débit d''air chute.',
  sgpg_risk_consequences = ARRAY[
    'Allergies et irritations respiratoires',
    'Mauvaises odeurs persistantes dans l''habitacle',
    'Buée difficile à évacuer sur le pare-brise',
    'Climatisation moins efficace (débit réduit)',
    'Surconsommation du ventilateur (forçage)'
  ],
  sgpg_risk_cost_range = '10 à 35 € (filtre) / 20 à 60 € avec main d''œuvre',
  sgpg_risk_conclusion = 'Le filtre d''habitacle impacte directement votre confort et votre santé. C''est l''une des pièces les moins chères à remplacer et souvent accessible sans outil.',
  sgpg_timing_title = 'Quand faut-il le changer ?',
  sgpg_timing_years = '1 an',
  sgpg_timing_km = '15 000 à 30 000 km',
  sgpg_timing_note = 'Remplacez-le au moins une fois par an, idéalement au printemps (avant la saison des pollens) ou à l''automne (avant l''hiver). En ville ou en zone polluée, divisez l''intervalle par deux.',
  sgpg_arg4_title = 'Version charbon actif disponible',
  sgpg_arg4_content = 'Le filtre à charbon actif absorbe les gaz nocifs (NOx, ozone) en plus des particules. Recommandé en ville et sur autoroute (tunnels). Le surcoût de quelques euros améliore significativement la qualité de l''air.',
  sgpg_symptoms = ARRAY[
    'Mauvaise odeur persistante à la ventilation',
    'Allergies ou irritations en voiture',
    'Débit d''air faible même en vitesse maximale',
    'Buée sur le pare-brise difficile à évacuer',
    'Bruit de ventilateur qui force'
  ],
  sgpg_faq = '[
    {"question": "Filtre habitacle simple ou charbon actif ?", "answer": "Le filtre simple (blanc) retient particules et pollens. Le filtre à charbon actif (gris/noir) ajoute l''absorption des gaz nocifs et des odeurs. En ville ou sur autoroute, le charbon actif vaut les 5-10€ de différence."},
    {"question": "Où se trouve le filtre d''habitacle ?", "answer": "Généralement derrière la boîte à gants (la plupart des véhicules) ou sous le capot côté passager (anciennes générations). Consultez le manuel ou une vidéo YouTube pour votre modèle. Souvent accessible sans outil."},
    {"question": "Peut-on rouler sans filtre d''habitacle ?", "answer": "Techniquement oui, mais l''évaporateur de climatisation se salit rapidement. Le nettoyer coûte 100-200€. De plus, vous respirez directement les gaz d''échappement des autres véhicules. Gardez toujours un filtre."},
    {"question": "Mon filtre habitacle sent mauvais : que faire ?", "answer": "Un filtre qui sent mauvais est colonisé par des bactéries. Changez-le et traitez le circuit de ventilation avec un nettoyant antibactérien en bombe. L''odeur peut aussi venir de l''évaporateur (nettoyage professionnel)."},
    {"question": "Diagnostic express : j''ai de la buée difficile à évacuer", "answer": "1) Vérifiez le filtre d''habitacle (premier suspect si encrassé). 2) Activez la climatisation (déshumidifie l''air). 3) Vérifiez les aérateurs (bien ouverts). 4) Si ça persiste, le drain d''évaporateur peut être bouché."}
  ]'::jsonb,
  sgpg_how_to_choose = 'Choisissez un filtre aux dimensions exactes de votre véhicule. Optez pour la version charbon actif si vous roulez en ville. Les personnes allergiques apprécieront les filtres HEPA haute filtration.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '424';

-- =============================================================================
-- Vérification post-migration
-- =============================================================================
-- SELECT sgpg_pg_id, sgpg_intro_title,
--        array_length(sgpg_symptoms, 1) as symptoms_count,
--        jsonb_array_length(sgpg_faq) as faq_count
-- FROM __seo_gamme_purchase_guide
-- WHERE sgpg_pg_id IN ('7', '8', '9', '416', '424');
