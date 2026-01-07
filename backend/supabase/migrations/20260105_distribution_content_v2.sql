-- Migration: Contenu SEO V2 pour famille Distribution
-- Date: 2026-01-05
-- Description: Ajoute h1_override, how_to_choose, symptoms, faq pour 5 gammes Distribution

-- ============================================
-- 1. Courroie de distribution (pg_id = 8)
-- ============================================
-- Note: La courroie a déjà intro/risk/timing/arguments via migration précédente
-- On ajoute les nouvelles sections Phase 2

UPDATE __seo_gamme_purchase_guide SET
  sgpg_h1_override = 'Courroie de distribution – qualité OE, livraison rapide',
  sgpg_how_to_choose = 'Le choix de la courroie de distribution est critique pour la longévité de votre moteur :

• **Matériau** : HNBR (caoutchouc haute performance) résiste aux températures extrêmes et à l''huile
• **Qualité OE** : Privilégiez Gates, Contitech, Dayco – équipementiers d''origine des constructeurs
• **Kit complet** : Toujours remplacer avec les galets tendeurs et enrouleurs (usure simultanée)
• **Pompe à eau** : Si entraînée par la courroie, changez-la en même temps (économie main-d''œuvre)

Vérifiez toujours la compatibilité exacte avec votre motorisation – chaque moteur a sa référence spécifique.',
  sgpg_symptoms = ARRAY[
    'Bruit de claquement ou sifflement au démarrage',
    'Moteur qui cale sans raison apparente',
    'Difficultés de démarrage à froid',
    'Vibrations anormales du moteur',
    'Courroie visuellement craquelée ou effilochée'
  ],
  sgpg_faq = '[
    {"question": "Peut-on rouler avec une courroie de distribution usée ?", "answer": "Non, c''est extrêmement dangereux. Une courroie cassée peut détruire le moteur en quelques secondes. Si elle montre des signes d''usure, remplacez-la immédiatement."},
    {"question": "Pourquoi le kit complet est-il recommandé ?", "answer": "Les galets et la pompe à eau s''usent au même rythme que la courroie. Les changer ensemble évite une nouvelle intervention coûteuse (la main-d''œuvre représente 70% du prix total)."},
    {"question": "Quelle est la différence entre courroie et chaîne de distribution ?", "answer": "La chaîne est métallique et dure généralement toute la vie du moteur. La courroie en caoutchouc doit être remplacée selon les préconisations constructeur (60 000 à 160 000 km selon les moteurs)."},
    {"question": "Comment vérifier l''état de ma courroie ?", "answer": "Visuellement : recherchez des craquelures, effilochages ou dents usées. Attention, certaines courroies sont inaccessibles sans démontage – fiez-vous aux intervalles constructeur."}
  ]'::jsonb,
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '8';

-- ============================================
-- 2. Kit de distribution (pg_id = 3920)
-- ============================================

INSERT INTO __seo_gamme_purchase_guide (
  sgpg_pg_id,
  sgpg_intro_title,
  sgpg_intro_role,
  sgpg_intro_sync_parts,
  sgpg_risk_title,
  sgpg_risk_explanation,
  sgpg_risk_consequences,
  sgpg_risk_cost_range,
  sgpg_risk_conclusion,
  sgpg_timing_title,
  sgpg_timing_years,
  sgpg_timing_km,
  sgpg_timing_note,
  sgpg_arg1_title, sgpg_arg1_content, sgpg_arg1_icon,
  sgpg_arg2_title, sgpg_arg2_content, sgpg_arg2_icon,
  sgpg_arg3_title, sgpg_arg3_content, sgpg_arg3_icon,
  sgpg_arg4_title, sgpg_arg4_content, sgpg_arg4_icon,
  sgpg_h1_override,
  sgpg_how_to_choose,
  sgpg_symptoms,
  sgpg_faq
) VALUES (
  '3920',
  'Le kit de distribution',
  'Le kit de distribution regroupe toutes les pièces nécessaires au remplacement complet du système de distribution. Il assure une intervention complète et sécurisée en une seule opération.',
  ARRAY['la courroie de distribution', 'le galet tendeur', 'le(s) galet(s) enrouleur(s)', 'parfois la pompe à eau'],
  'Pourquoi choisir un kit complet ?',
  'Remplacer uniquement la courroie est une fausse économie. Les galets s''usent au même rythme et peuvent casser même avec une courroie neuve, causant les mêmes dégâts catastrophiques.',
  ARRAY['Économie de main-d''œuvre (70% du coût)', 'Toutes les pièces neuves garantissent la fiabilité', 'Évite une nouvelle intervention dans 1-2 ans', 'Garantie constructeur préservée'],
  '400 à 800 € (kit + pose)',
  'Le kit complet coûte à peine plus cher que la courroie seule une fois la main-d''œuvre comptée.',
  'Quand remplacer le kit ?',
  '5 à 7 ans',
  '60 000 à 160 000 km',
  'Consultez le carnet d''entretien de votre véhicule pour l''intervalle exact de votre motorisation.',
  'Kit complet certifié', 'Toutes les pièces sont compatibles entre elles et validées pour votre véhicule spécifique.', 'check-circle',
  'Marques équipementier', 'Gates, Contitech, SKF, INA – les mêmes fournisseurs que les constructeurs automobiles.', 'shield-check',
  'Économie garantie', 'Jusqu''à 30% moins cher qu''en concession, avec les mêmes pièces de qualité OE.', 'currency-euro',
  'Livraison express', 'Expédition sous 24-48h pour ne pas immobiliser votre véhicule plus longtemps que nécessaire.', 'truck',
  'Kit de distribution complet – toutes pièces incluses',
  'Le choix du bon kit de distribution dépend de votre motorisation exacte :

• **Kit simple** : Courroie + galet tendeur – pour moteurs simples
• **Kit complet** : Courroie + tous galets + pompe à eau – recommandé pour la plupart des véhicules
• **Kit renforcé** : Pièces premium pour véhicules à fort kilométrage ou conduite intensive

Vérifiez si votre pompe à eau est entraînée par la courroie de distribution :
- Si oui → prenez le kit avec pompe à eau (économie de main-d''œuvre)
- Si non → le kit standard suffit',
  ARRAY[
    'Bruit de claquement au ralenti',
    'Jeu excessif sur la courroie (visible à l''œil)',
    'Traces de fuite de liquide de refroidissement (pompe à eau)',
    'Courroie visuellement usée ou craquelée',
    'Kilométrage approchant l''intervalle de remplacement'
  ],
  '[
    {"question": "Puis-je installer le kit moi-même ?", "answer": "Le remplacement du kit de distribution est une opération complexe qui nécessite des outils spécifiques (pige de calage) et une expertise mécanique. Une erreur de calage peut détruire le moteur. Nous recommandons de confier cette intervention à un professionnel."},
    {"question": "Quelle est la différence entre les marques de kit ?", "answer": "Gates et Contitech sont les deux leaders mondiaux, fournisseurs des constructeurs. SKF et INA fabriquent les galets d''origine. Tous offrent une qualité équivalente à l''origine."},
    {"question": "Le kit inclut-il toujours la pompe à eau ?", "answer": "Non, il existe des kits avec ou sans pompe à eau. Vérifiez la composition avant achat. Si votre pompe à eau est entraînée par la courroie, le kit avec pompe est fortement recommandé."}
  ]'::jsonb
) ON CONFLICT (sgpg_pg_id) DO UPDATE SET
  sgpg_intro_title = EXCLUDED.sgpg_intro_title,
  sgpg_intro_role = EXCLUDED.sgpg_intro_role,
  sgpg_intro_sync_parts = EXCLUDED.sgpg_intro_sync_parts,
  sgpg_risk_title = EXCLUDED.sgpg_risk_title,
  sgpg_risk_explanation = EXCLUDED.sgpg_risk_explanation,
  sgpg_risk_consequences = EXCLUDED.sgpg_risk_consequences,
  sgpg_risk_cost_range = EXCLUDED.sgpg_risk_cost_range,
  sgpg_risk_conclusion = EXCLUDED.sgpg_risk_conclusion,
  sgpg_timing_title = EXCLUDED.sgpg_timing_title,
  sgpg_timing_years = EXCLUDED.sgpg_timing_years,
  sgpg_timing_km = EXCLUDED.sgpg_timing_km,
  sgpg_timing_note = EXCLUDED.sgpg_timing_note,
  sgpg_arg1_title = EXCLUDED.sgpg_arg1_title,
  sgpg_arg1_content = EXCLUDED.sgpg_arg1_content,
  sgpg_arg1_icon = EXCLUDED.sgpg_arg1_icon,
  sgpg_arg2_title = EXCLUDED.sgpg_arg2_title,
  sgpg_arg2_content = EXCLUDED.sgpg_arg2_content,
  sgpg_arg2_icon = EXCLUDED.sgpg_arg2_icon,
  sgpg_arg3_title = EXCLUDED.sgpg_arg3_title,
  sgpg_arg3_content = EXCLUDED.sgpg_arg3_content,
  sgpg_arg3_icon = EXCLUDED.sgpg_arg3_icon,
  sgpg_arg4_title = EXCLUDED.sgpg_arg4_title,
  sgpg_arg4_content = EXCLUDED.sgpg_arg4_content,
  sgpg_arg4_icon = EXCLUDED.sgpg_arg4_icon,
  sgpg_h1_override = EXCLUDED.sgpg_h1_override,
  sgpg_how_to_choose = EXCLUDED.sgpg_how_to_choose,
  sgpg_symptoms = EXCLUDED.sgpg_symptoms,
  sgpg_faq = EXCLUDED.sgpg_faq,
  sgpg_updated_at = NOW();

-- ============================================
-- 3. Galet tendeur (pg_id = 15)
-- ============================================

INSERT INTO __seo_gamme_purchase_guide (
  sgpg_pg_id,
  sgpg_intro_title,
  sgpg_intro_role,
  sgpg_intro_sync_parts,
  sgpg_risk_title,
  sgpg_risk_explanation,
  sgpg_risk_consequences,
  sgpg_risk_cost_range,
  sgpg_risk_conclusion,
  sgpg_timing_title,
  sgpg_timing_years,
  sgpg_timing_km,
  sgpg_timing_note,
  sgpg_arg1_title, sgpg_arg1_content, sgpg_arg1_icon,
  sgpg_arg2_title, sgpg_arg2_content, sgpg_arg2_icon,
  sgpg_arg3_title, sgpg_arg3_content, sgpg_arg3_icon,
  sgpg_arg4_title, sgpg_arg4_content, sgpg_arg4_icon,
  sgpg_h1_override,
  sgpg_how_to_choose,
  sgpg_symptoms,
  sgpg_faq
) VALUES (
  '15',
  'Le galet tendeur',
  'Le galet tendeur maintient la courroie de distribution sous tension constante. C''est lui qui assure le bon engrènement de la courroie sur les poulies et prévient tout saut de dent.',
  ARRAY['la courroie de distribution', 'le vilebrequin', 'l''arbre à cames'],
  'Pourquoi le galet tendeur est critique ?',
  'Un galet tendeur défaillant ne maintient plus la tension correcte. La courroie peut alors sauter une ou plusieurs dents, désynchronisant le moteur avec des conséquences catastrophiques.',
  ARRAY['Saut de courroie = moteur détruit', 'Bruit de roulement annonçant la casse imminente', 'Blocage du galet = courroie sectionnée'],
  '1 500 à 4 000 € (si moteur endommagé)',
  'Le galet tendeur se remplace systématiquement avec la courroie – ne faites jamais l''économie de cette pièce.',
  'Quand remplacer ?',
  'Avec la courroie',
  '60 000 à 160 000 km',
  'Le galet tendeur ne se remplace JAMAIS seul – toujours avec la courroie de distribution.',
  'Roulement haute qualité', 'Roulements SKF, INA, FAG – les mêmes que sur les véhicules neufs.', 'cog',
  'Tension calibrée', 'Ressort de tension conforme aux spécifications constructeur pour chaque moteur.', 'adjustments',
  'Durée de vie garantie', 'Conçu pour durer jusqu''au prochain remplacement de courroie.', 'clock',
  'Prix kit avantageux', 'Moins cher en kit complet qu''acheté séparément.', 'currency-euro',
  'Galet tendeur distribution – roulement OE',
  'Le galet tendeur doit être parfaitement adapté à votre moteur :

• **Type de tension** : Automatique (ressort) ou manuel selon le moteur
• **Diamètre et largeur** : Spécifiques à chaque référence moteur
• **Qualité roulement** : SKF, INA, FAG – équipementiers d''origine

Important : Le galet tendeur fait partie intégrante du kit de distribution. L''acheter seul n''a de sens que pour un remplacement d''urgence (galet défaillant sur courroie récente).',
  ARRAY[
    'Bruit de roulement (sifflement, grondement)',
    'Jeu latéral ou radial perceptible sur le galet',
    'Traces de fuite de graisse autour du roulement',
    'Courroie qui se désaxe légèrement',
    'Tension anormale de la courroie'
  ],
  '[
    {"question": "Peut-on changer le galet sans changer la courroie ?", "answer": "Techniquement oui, mais ce n''est pas recommandé. Si le galet est usé, la courroie l''est probablement aussi. Profitez du démontage pour tout remplacer – la main-d''œuvre représente 70% du coût total."},
    {"question": "Comment savoir si mon galet tendeur est défaillant ?", "answer": "Un bruit de roulement (sifflement ou grondement) provenant de la distribution est le signe principal. Vérifiez aussi s''il y a du jeu en faisant tourner le galet à la main."},
    {"question": "Galet tendeur ou galet enrouleur : quelle différence ?", "answer": "Le galet tendeur maintient la courroie sous tension (avec ressort). Le galet enrouleur guide simplement la courroie sans la tendre. Les deux doivent être remplacés ensemble."}
  ]'::jsonb
) ON CONFLICT (sgpg_pg_id) DO UPDATE SET
  sgpg_intro_title = EXCLUDED.sgpg_intro_title,
  sgpg_intro_role = EXCLUDED.sgpg_intro_role,
  sgpg_intro_sync_parts = EXCLUDED.sgpg_intro_sync_parts,
  sgpg_risk_title = EXCLUDED.sgpg_risk_title,
  sgpg_risk_explanation = EXCLUDED.sgpg_risk_explanation,
  sgpg_risk_consequences = EXCLUDED.sgpg_risk_consequences,
  sgpg_risk_cost_range = EXCLUDED.sgpg_risk_cost_range,
  sgpg_risk_conclusion = EXCLUDED.sgpg_risk_conclusion,
  sgpg_timing_title = EXCLUDED.sgpg_timing_title,
  sgpg_timing_years = EXCLUDED.sgpg_timing_years,
  sgpg_timing_km = EXCLUDED.sgpg_timing_km,
  sgpg_timing_note = EXCLUDED.sgpg_timing_note,
  sgpg_arg1_title = EXCLUDED.sgpg_arg1_title,
  sgpg_arg1_content = EXCLUDED.sgpg_arg1_content,
  sgpg_arg1_icon = EXCLUDED.sgpg_arg1_icon,
  sgpg_arg2_title = EXCLUDED.sgpg_arg2_title,
  sgpg_arg2_content = EXCLUDED.sgpg_arg2_content,
  sgpg_arg2_icon = EXCLUDED.sgpg_arg2_icon,
  sgpg_arg3_title = EXCLUDED.sgpg_arg3_title,
  sgpg_arg3_content = EXCLUDED.sgpg_arg3_content,
  sgpg_arg3_icon = EXCLUDED.sgpg_arg3_icon,
  sgpg_arg4_title = EXCLUDED.sgpg_arg4_title,
  sgpg_arg4_content = EXCLUDED.sgpg_arg4_content,
  sgpg_arg4_icon = EXCLUDED.sgpg_arg4_icon,
  sgpg_h1_override = EXCLUDED.sgpg_h1_override,
  sgpg_how_to_choose = EXCLUDED.sgpg_how_to_choose,
  sgpg_symptoms = EXCLUDED.sgpg_symptoms,
  sgpg_faq = EXCLUDED.sgpg_faq,
  sgpg_updated_at = NOW();

-- ============================================
-- 4. Galet enrouleur (pg_id = 16)
-- ============================================

INSERT INTO __seo_gamme_purchase_guide (
  sgpg_pg_id,
  sgpg_intro_title,
  sgpg_intro_role,
  sgpg_intro_sync_parts,
  sgpg_risk_title,
  sgpg_risk_explanation,
  sgpg_risk_consequences,
  sgpg_risk_cost_range,
  sgpg_risk_conclusion,
  sgpg_timing_title,
  sgpg_timing_years,
  sgpg_timing_km,
  sgpg_timing_note,
  sgpg_arg1_title, sgpg_arg1_content, sgpg_arg1_icon,
  sgpg_arg2_title, sgpg_arg2_content, sgpg_arg2_icon,
  sgpg_arg3_title, sgpg_arg3_content, sgpg_arg3_icon,
  sgpg_arg4_title, sgpg_arg4_content, sgpg_arg4_icon,
  sgpg_h1_override,
  sgpg_how_to_choose,
  sgpg_symptoms,
  sgpg_faq
) VALUES (
  '16',
  'Le galet enrouleur',
  'Le galet enrouleur guide la courroie de distribution dans son parcours. Il assure que la courroie reste bien alignée et ne frotte pas contre les autres composants du moteur.',
  ARRAY['la courroie de distribution', 'le galet tendeur', 'les poulies d''arbre à cames'],
  'Pourquoi le galet enrouleur est important ?',
  'Un galet enrouleur grippé ou avec du jeu peut faire dérailler la courroie ou créer une usure prématurée. Le roulement peut aussi se bloquer brutalement.',
  ARRAY['Usure prématurée de la courroie', 'Désalignement pouvant causer un saut de dent', 'Blocage brutal = casse courroie'],
  '1 500 à 4 000 € (si moteur endommagé)',
  'Le galet enrouleur coûte quelques dizaines d''euros – le remplacer avec la courroie est une évidence.',
  'Quand remplacer ?',
  'Avec la courroie',
  '60 000 à 160 000 km',
  'Certains moteurs ont plusieurs galets enrouleurs – vérifiez le contenu du kit.',
  'Guidage précis', 'Gorge et flancs usinés pour un guidage parfait de la courroie.', 'arrows-pointing-in',
  'Roulement étanche', 'Joint d''étanchéité protégeant le roulement des projections d''huile.', 'shield-check',
  'Rotation libre', 'Roulement à billes de qualité pour une rotation sans résistance.', 'arrow-path',
  'Compatible kit', 'Référence identique à celle incluse dans les kits de distribution.', 'puzzle-piece',
  'Galet enrouleur distribution – guidage courroie',
  'Le galet enrouleur est une pièce simple mais essentielle :

• **Fonction** : Guider la courroie, pas la tendre (contrairement au galet tendeur)
• **Type** : Lisse ou cranté selon le positionnement sur votre moteur
• **Nombre** : 1 à 3 selon la complexité du moteur

Conseil : Privilégiez l''achat du kit complet qui inclut tous les galets nécessaires pour votre moteur.',
  ARRAY[
    'Bruit de roulement continu',
    'Jeu perceptible sur le galet',
    'Traces d''usure sur les flancs de la courroie',
    'Courroie qui se décale latéralement',
    'Vibrations anormales côté distribution'
  ],
  '[
    {"question": "Mon moteur a-t-il un ou plusieurs galets enrouleurs ?", "answer": "Cela dépend de la configuration du moteur. Les moteurs simples (4 cylindres atmosphériques) ont souvent 1 seul galet enrouleur. Les moteurs plus complexes (turbo, V6) peuvent en avoir 2 ou 3."},
    {"question": "Galet lisse ou galet cranté ?", "answer": "Le galet lisse guide le dos de la courroie. Le galet cranté (si présent) guide la face dentée. Les deux types ont des roulements similaires mais ne sont pas interchangeables."},
    {"question": "Puis-je réutiliser mon ancien galet enrouleur ?", "answer": "Non. Même s''il semble en bon état, le roulement a subi le même nombre de cycles que la courroie. Le coût du galet est négligeable par rapport au risque de casse."}
  ]'::jsonb
) ON CONFLICT (sgpg_pg_id) DO UPDATE SET
  sgpg_intro_title = EXCLUDED.sgpg_intro_title,
  sgpg_intro_role = EXCLUDED.sgpg_intro_role,
  sgpg_intro_sync_parts = EXCLUDED.sgpg_intro_sync_parts,
  sgpg_risk_title = EXCLUDED.sgpg_risk_title,
  sgpg_risk_explanation = EXCLUDED.sgpg_risk_explanation,
  sgpg_risk_consequences = EXCLUDED.sgpg_risk_consequences,
  sgpg_risk_cost_range = EXCLUDED.sgpg_risk_cost_range,
  sgpg_risk_conclusion = EXCLUDED.sgpg_risk_conclusion,
  sgpg_timing_title = EXCLUDED.sgpg_timing_title,
  sgpg_timing_years = EXCLUDED.sgpg_timing_years,
  sgpg_timing_km = EXCLUDED.sgpg_timing_km,
  sgpg_timing_note = EXCLUDED.sgpg_timing_note,
  sgpg_arg1_title = EXCLUDED.sgpg_arg1_title,
  sgpg_arg1_content = EXCLUDED.sgpg_arg1_content,
  sgpg_arg1_icon = EXCLUDED.sgpg_arg1_icon,
  sgpg_arg2_title = EXCLUDED.sgpg_arg2_title,
  sgpg_arg2_content = EXCLUDED.sgpg_arg2_content,
  sgpg_arg2_icon = EXCLUDED.sgpg_arg2_icon,
  sgpg_arg3_title = EXCLUDED.sgpg_arg3_title,
  sgpg_arg3_content = EXCLUDED.sgpg_arg3_content,
  sgpg_arg3_icon = EXCLUDED.sgpg_arg3_icon,
  sgpg_arg4_title = EXCLUDED.sgpg_arg4_title,
  sgpg_arg4_content = EXCLUDED.sgpg_arg4_content,
  sgpg_arg4_icon = EXCLUDED.sgpg_arg4_icon,
  sgpg_h1_override = EXCLUDED.sgpg_h1_override,
  sgpg_how_to_choose = EXCLUDED.sgpg_how_to_choose,
  sgpg_symptoms = EXCLUDED.sgpg_symptoms,
  sgpg_faq = EXCLUDED.sgpg_faq,
  sgpg_updated_at = NOW();

-- ============================================
-- 5. Pompe à eau (pg_id = 14)
-- ============================================

INSERT INTO __seo_gamme_purchase_guide (
  sgpg_pg_id,
  sgpg_intro_title,
  sgpg_intro_role,
  sgpg_intro_sync_parts,
  sgpg_risk_title,
  sgpg_risk_explanation,
  sgpg_risk_consequences,
  sgpg_risk_cost_range,
  sgpg_risk_conclusion,
  sgpg_timing_title,
  sgpg_timing_years,
  sgpg_timing_km,
  sgpg_timing_note,
  sgpg_arg1_title, sgpg_arg1_content, sgpg_arg1_icon,
  sgpg_arg2_title, sgpg_arg2_content, sgpg_arg2_icon,
  sgpg_arg3_title, sgpg_arg3_content, sgpg_arg3_icon,
  sgpg_arg4_title, sgpg_arg4_content, sgpg_arg4_icon,
  sgpg_h1_override,
  sgpg_how_to_choose,
  sgpg_symptoms,
  sgpg_faq
) VALUES (
  '14',
  'La pompe à eau',
  'La pompe à eau fait circuler le liquide de refroidissement dans tout le moteur. Elle maintient la température de fonctionnement optimale et évite la surchauffe qui détruit le moteur.',
  ARRAY['le circuit de refroidissement', 'le radiateur', 'le thermostat', 'la courroie de distribution (si entraînée)'],
  'Pourquoi la pompe à eau est vitale ?',
  'Une pompe à eau défaillante ne refroidit plus le moteur. La température monte rapidement et peut causer des dégâts irréversibles : joint de culasse, déformation de culasse, serrage moteur.',
  ARRAY['Surchauffe moteur = arrêt immédiat obligatoire', 'Joint de culasse claqué (800-1500€)', 'Culasse voilée ou fissurée (1500-3000€)', 'Moteur serré = véhicule HS'],
  '800 à 3 000 € (selon dégâts)',
  'La pompe à eau coûte entre 30 et 150€ – ne prenez jamais le risque de la surchauffe.',
  'Quand remplacer ?',
  '5 à 10 ans',
  '80 000 à 180 000 km',
  'Si entraînée par la courroie de distribution, remplacez-la avec le kit distribution.',
  'Turbine haute performance', 'Turbine en métal ou composite haute résistance pour un débit optimal.', 'arrows-pointing-out',
  'Joint d''étanchéité', 'Joint torique et bague d''étanchéité de qualité OE inclus.', 'shield-check',
  'Roulement renforcé', 'Roulement à billes ou à rouleaux dimensionné pour la durée de vie.', 'cog',
  'Compatibilité garantie', 'Référence exacte pour votre moteur, connexions et fixations identiques.', 'check-badge',
  'Pompe à eau – pièces d''origine au meilleur prix',
  'Le choix de la pompe à eau dépend de votre motorisation :

• **Entraînement** : Courroie distribution ou courroie accessoires – détermine quand la changer
• **Matériau turbine** : Métal (plus durable) ou plastique renforcé (moins cher)
• **Type de joint** : O-ring ou joint papier selon le moteur
• **Marque** : Dolz, Graf, SKF, Hepu – équipementiers reconnus

Important : Si votre pompe à eau est entraînée par la courroie de distribution, le kit distribution avec pompe est fortement recommandé.',
  ARRAY[
    'Fuite de liquide de refroidissement sous le moteur',
    'Bruit de roulement côté pompe à eau',
    'Température moteur qui monte anormalement',
    'Niveau de liquide de refroidissement qui baisse',
    'Jeu sur l''axe de la pompe'
  ],
  '[
    {"question": "Comment savoir si ma pompe à eau est entraînée par la distribution ?", "answer": "Consultez la documentation technique de votre véhicule ou demandez à un garagiste. En général, si la pompe à eau est visible sans démonter le carter de distribution, elle est sur la courroie accessoires. Si elle est cachée, elle est probablement sur la distribution."},
    {"question": "Puis-je rouler avec une pompe à eau qui fuit légèrement ?", "answer": "Non. Une fuite, même légère, va s''aggraver. De plus, si la pompe fuit, son roulement est probablement en fin de vie et peut se bloquer brutalement, cassant la courroie si elle est sur la distribution."},
    {"question": "Faut-il vidanger le circuit après remplacement ?", "answer": "Oui, c''est obligatoire. Vidangez le liquide, remplissez avec du liquide neuf conforme aux préconisations constructeur, et purgez l''air du circuit. Une purge incorrecte peut créer des poches d''air et une surchauffe."},
    {"question": "Pompe à eau métal ou plastique ?", "answer": "Les pompes à turbine métallique sont plus durables mais plus chères. Les pompes à turbine plastique sont fiables pour un usage normal. Pour les véhicules à fort kilométrage ou les climats chauds, privilégiez le métal."}
  ]'::jsonb
) ON CONFLICT (sgpg_pg_id) DO UPDATE SET
  sgpg_intro_title = EXCLUDED.sgpg_intro_title,
  sgpg_intro_role = EXCLUDED.sgpg_intro_role,
  sgpg_intro_sync_parts = EXCLUDED.sgpg_intro_sync_parts,
  sgpg_risk_title = EXCLUDED.sgpg_risk_title,
  sgpg_risk_explanation = EXCLUDED.sgpg_risk_explanation,
  sgpg_risk_consequences = EXCLUDED.sgpg_risk_consequences,
  sgpg_risk_cost_range = EXCLUDED.sgpg_risk_cost_range,
  sgpg_risk_conclusion = EXCLUDED.sgpg_risk_conclusion,
  sgpg_timing_title = EXCLUDED.sgpg_timing_title,
  sgpg_timing_years = EXCLUDED.sgpg_timing_years,
  sgpg_timing_km = EXCLUDED.sgpg_timing_km,
  sgpg_timing_note = EXCLUDED.sgpg_timing_note,
  sgpg_arg1_title = EXCLUDED.sgpg_arg1_title,
  sgpg_arg1_content = EXCLUDED.sgpg_arg1_content,
  sgpg_arg1_icon = EXCLUDED.sgpg_arg1_icon,
  sgpg_arg2_title = EXCLUDED.sgpg_arg2_title,
  sgpg_arg2_content = EXCLUDED.sgpg_arg2_content,
  sgpg_arg2_icon = EXCLUDED.sgpg_arg2_icon,
  sgpg_arg3_title = EXCLUDED.sgpg_arg3_title,
  sgpg_arg3_content = EXCLUDED.sgpg_arg3_content,
  sgpg_arg3_icon = EXCLUDED.sgpg_arg3_icon,
  sgpg_arg4_title = EXCLUDED.sgpg_arg4_title,
  sgpg_arg4_content = EXCLUDED.sgpg_arg4_content,
  sgpg_arg4_icon = EXCLUDED.sgpg_arg4_icon,
  sgpg_h1_override = EXCLUDED.sgpg_h1_override,
  sgpg_how_to_choose = EXCLUDED.sgpg_how_to_choose,
  sgpg_symptoms = EXCLUDED.sgpg_symptoms,
  sgpg_faq = EXCLUDED.sgpg_faq,
  sgpg_updated_at = NOW();

-- ============================================
-- Vérification finale
-- ============================================
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM __seo_gamme_purchase_guide
  WHERE sgpg_pg_id IN ('8', '3920', '15', '16', '14')
    AND sgpg_h1_override IS NOT NULL;

  RAISE NOTICE 'Distribution: % gammes avec contenu V2 complet', v_count;
END $$;
