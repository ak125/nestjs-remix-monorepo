-- Migration: Purchase Guide V2 - Contenu enrichi pour 230 gammes G1/G2
-- Structure orientée client avec les 6 principes:
-- 1. Clarté immédiate (à quoi ça sert, quand changer)
-- 2. Réduction de la peur (casse expliquée simplement)
-- 3. Preuve de sérieux (compatibilité, qualité équivalente origine)
-- 4. Argument prix rationnel (économie vs concession)
-- 5. CTA implicite sans pression
-- 6. Langage client, pas mécanique

-- ============================================
-- FONCTION: Génère le contenu V2 pour une gamme
-- ============================================

CREATE OR REPLACE FUNCTION generate_purchase_guide_v2(
  p_pg_id VARCHAR(20),
  p_pg_name VARCHAR(255),
  p_family_name VARCHAR(255)
) RETURNS VOID AS $$
DECLARE
  v_intro_title VARCHAR(255);
  v_intro_role TEXT;
  v_intro_sync_parts TEXT[];
  v_risk_title VARCHAR(255);
  v_risk_explanation TEXT;
  v_risk_consequences TEXT[];
  v_risk_cost_range VARCHAR(100);
  v_risk_conclusion TEXT;
  v_timing_title VARCHAR(255);
  v_timing_years VARCHAR(50);
  v_timing_km VARCHAR(50);
  v_timing_note TEXT;
BEGIN
  -- Titre intro par défaut
  v_intro_title := 'Le/La ' || p_pg_name;
  v_risk_title := 'Pourquoi ne jamais attendre pour le/la remplacer ?';
  v_timing_title := 'Quand faut-il le/la changer ?';

  -- Contenu selon la famille
  CASE
    -- ============================================
    -- SYSTÈME DE FREINAGE
    -- ============================================
    WHEN p_family_name ILIKE '%freinage%' THEN
      v_intro_role := 'Le ' || p_pg_name || ' est un élément essentiel de votre sécurité. Il permet de ralentir et d''arrêter votre véhicule en toute sécurité.';
      v_intro_sync_parts := ARRAY['les disques de frein', 'les étriers', 'le liquide de frein'];
      v_risk_explanation := 'Les pièces de frein s''usent progressivement avec le temps et les kilomètres. Une usure avancée peut réduire considérablement l''efficacité de freinage.';
      v_risk_consequences := ARRAY['distances de freinage allongées', 'usure prématurée des disques', 'risque d''accident en cas d''urgence'];
      v_risk_cost_range := '150 à 600 €';
      v_risk_conclusion := 'Remplacer vos pièces de frein à temps garantit votre sécurité et celle de vos passagers.';
      v_timing_years := '2 à 4 ans';
      v_timing_km := '30 000 à 60 000 km';
      v_timing_note := 'L''usure varie selon votre style de conduite (ville vs autoroute).';

    -- ============================================
    -- COURROIE, GALET, POULIE ET CHAÎNE (Distribution)
    -- ============================================
    WHEN p_family_name ILIKE '%courroie%' OR p_family_name ILIKE '%chaîne%' OR p_family_name ILIKE '%distribution%' THEN
      v_intro_role := 'Le ' || p_pg_name || ' assure la synchronisation parfaite du moteur. C''est une pièce critique pour le bon fonctionnement de votre véhicule.';
      v_intro_sync_parts := ARRAY['le vilebrequin', 'l''arbre à cames', 'parfois la pompe à eau'];
      v_risk_explanation := 'Avec le temps, cette pièce s''use sans prévenir. Et contrairement à d''autres pièces, elle ne donne pas de signes avant de casser.';
      v_risk_consequences := ARRAY['le moteur peut être gravement endommagé', 'les réparations peuvent dépasser plusieurs milliers d''euros', 'parfois, le moteur est irrécupérable'];
      v_risk_cost_range := '2 000 à 5 000 €';
      v_risk_conclusion := 'Changer cette pièce à temps coûte beaucoup moins cher qu''une panne moteur.';
      v_timing_years := '5 à 7 ans';
      v_timing_km := '60 000 à 160 000 km';
      v_timing_note := 'Les intervalles dépendent exactement du moteur → d''où l''importance de choisir la bonne pièce.';

    -- ============================================
    -- SYSTÈME DE FILTRATION
    -- ============================================
    WHEN p_family_name ILIKE '%filtration%' OR p_pg_name ILIKE '%filtre%' THEN
      v_intro_role := 'Le ' || p_pg_name || ' protège les organes vitaux de votre véhicule en filtrant les impuretés. Il assure une longévité optimale du moteur.';
      v_intro_sync_parts := ARRAY['le circuit d''huile', 'l''admission d''air', 'le système de climatisation'];
      v_risk_explanation := 'Un filtre encrassé laisse passer des impuretés qui abîment progressivement le moteur ou réduisent ses performances.';
      v_risk_consequences := ARRAY['surconsommation de carburant', 'perte de puissance', 'usure prématurée du moteur'];
      v_risk_cost_range := '500 à 2 000 €';
      v_risk_conclusion := 'Un filtre coûte quelques euros. Le remplacer régulièrement évite des réparations coûteuses.';
      v_timing_years := '1 an';
      v_timing_km := '15 000 à 30 000 km';
      v_timing_note := 'Consultez le carnet d''entretien de votre véhicule pour l''intervalle exact.';

    -- ============================================
    -- EMBRAYAGE
    -- ============================================
    WHEN p_family_name ILIKE '%embrayage%' THEN
      v_intro_role := 'Le ' || p_pg_name || ' transmet la puissance du moteur aux roues. Il permet de changer de vitesse en douceur.';
      v_intro_sync_parts := ARRAY['le volant moteur', 'la butée d''embrayage', 'la boîte de vitesses'];
      v_risk_explanation := 'L''embrayage s''use progressivement, surtout en conduite urbaine avec de nombreux arrêts et démarrages.';
      v_risk_consequences := ARRAY['patinage de l''embrayage', 'impossibilité de passer les vitesses', 'immobilisation du véhicule'];
      v_risk_cost_range := '800 à 2 000 €';
      v_risk_conclusion := 'Un embrayage usé peut vous laisser en panne. Mieux vaut anticiper le remplacement.';
      v_timing_years := '5 à 8 ans';
      v_timing_km := '100 000 à 150 000 km';
      v_timing_note := 'La durée de vie dépend fortement de votre style de conduite.';

    -- ============================================
    -- AMORTISSEUR ET SUSPENSION
    -- ============================================
    WHEN p_family_name ILIKE '%amortisseur%' OR p_family_name ILIKE '%suspension%' THEN
      v_intro_role := 'Le ' || p_pg_name || ' absorbe les irrégularités de la route et maintient le contact des roues avec le sol.';
      v_intro_sync_parts := ARRAY['les ressorts', 'les silent-blocs', 'les rotules'];
      v_risk_explanation := 'Des amortisseurs usés ne maintiennent plus correctement les roues au sol, ce qui affecte la tenue de route et le freinage.';
      v_risk_consequences := ARRAY['distances de freinage allongées', 'usure irrégulière des pneus', 'inconfort de conduite'];
      v_risk_cost_range := '300 à 800 €';
      v_risk_conclusion := 'Remplacer les amortisseurs améliore à la fois le confort et la sécurité.';
      v_timing_years := '4 à 6 ans';
      v_timing_km := '80 000 à 100 000 km';
      v_timing_note := 'Remplacez toujours les amortisseurs par paire (avant ou arrière).';

    -- ============================================
    -- REFROIDISSEMENT
    -- ============================================
    WHEN p_family_name ILIKE '%refroidissement%' THEN
      v_intro_role := 'Le ' || p_pg_name || ' régule la température du moteur pour éviter la surchauffe. Il est essentiel à la longévité du moteur.';
      v_intro_sync_parts := ARRAY['le radiateur', 'le thermostat', 'le liquide de refroidissement'];
      v_risk_explanation := 'Une défaillance du système de refroidissement provoque une surchauffe rapide qui peut détruire le moteur en quelques minutes.';
      v_risk_consequences := ARRAY['joint de culasse grillé', 'déformation de la culasse', 'moteur à remplacer'];
      v_risk_cost_range := '1 500 à 4 000 €';
      v_risk_conclusion := 'Le remplacement préventif évite une panne moteur catastrophique.';
      v_timing_years := '4 à 6 ans';
      v_timing_km := '60 000 à 100 000 km';
      v_timing_note := 'Surveillez régulièrement le niveau et la couleur du liquide de refroidissement.';

    -- ============================================
    -- SYSTÈME ÉLECTRIQUE
    -- ============================================
    WHEN p_family_name ILIKE '%électrique%' THEN
      v_intro_role := 'Le ' || p_pg_name || ' alimente les équipements électriques de votre véhicule et permet le démarrage du moteur.';
      v_intro_sync_parts := ARRAY['la batterie', 'les câbles électriques', 'le régulateur'];
      v_risk_explanation := 'Une pièce électrique défaillante peut vous laisser en panne, souvent au moment le plus inopportun.';
      v_risk_consequences := ARRAY['impossibilité de démarrer', 'batterie qui se décharge', 'équipements qui ne fonctionnent plus'];
      v_risk_cost_range := '200 à 800 €';
      v_risk_conclusion := 'Un composant électrique fiable vous évite les pannes surprise.';
      v_timing_years := '6 à 10 ans';
      v_timing_km := '150 000 à 200 000 km';
      v_timing_note := 'Les signes avant-coureurs : démarrage difficile, voyant batterie allumé.';

    -- ============================================
    -- DIRECTION ET LIAISON AU SOL
    -- ============================================
    WHEN p_family_name ILIKE '%direction%' OR p_family_name ILIKE '%liaison%' THEN
      v_intro_role := 'Le ' || p_pg_name || ' assure la précision de la direction et la stabilité de votre véhicule.';
      v_intro_sync_parts := ARRAY['la crémaillère', 'les rotules', 'les biellettes'];
      v_risk_explanation := 'L''usure des pièces de direction affecte la précision du volant et peut rendre la conduite dangereuse.';
      v_risk_consequences := ARRAY['jeu dans la direction', 'usure irrégulière des pneus', 'vibrations dans le volant'];
      v_risk_cost_range := '200 à 600 €';
      v_risk_conclusion := 'Une direction précise est essentielle pour votre sécurité.';
      v_timing_years := '4 à 6 ans';
      v_timing_km := '80 000 à 120 000 km';
      v_timing_note := 'Faites vérifier la géométrie après tout remplacement.';

    -- ============================================
    -- ALLUMAGE ET PRÉCHAUFFAGE
    -- ============================================
    WHEN p_family_name ILIKE '%allumage%' OR p_family_name ILIKE '%préchauffage%' THEN
      v_intro_role := 'Le ' || p_pg_name || ' assure le bon démarrage et le fonctionnement optimal du moteur.';
      v_intro_sync_parts := ARRAY['les bougies', 'la bobine d''allumage', 'les câbles haute tension'];
      v_risk_explanation := 'Des pièces d''allumage usées provoquent des ratés moteur, une surconsommation et des difficultés de démarrage.';
      v_risk_consequences := ARRAY['démarrage difficile', 'surconsommation de carburant', 'perte de puissance'];
      v_risk_cost_range := '100 à 400 €';
      v_risk_conclusion := 'Un système d''allumage en bon état garantit des performances optimales.';
      v_timing_years := '2 à 4 ans';
      v_timing_km := '30 000 à 60 000 km';
      v_timing_note := 'Les bougies essence et diesel ont des intervalles différents.';

    -- ============================================
    -- MOTEUR (Interne)
    -- ============================================
    WHEN p_family_name ILIKE '%moteur%' AND p_family_name NOT ILIKE '%support%' THEN
      v_intro_role := 'Le ' || p_pg_name || ' est une pièce interne du moteur, essentielle à son bon fonctionnement.';
      v_intro_sync_parts := ARRAY['le bloc moteur', 'les pistons', 'le vilebrequin'];
      v_risk_explanation := 'L''usure des pièces moteur peut entraîner des dommages irréversibles si elle n''est pas détectée à temps.';
      v_risk_consequences := ARRAY['perte de compression', 'consommation d''huile excessive', 'bruit anormal'];
      v_risk_cost_range := '1 000 à 5 000 €';
      v_risk_conclusion := 'Un entretien régulier préserve la longévité de votre moteur.';
      v_timing_years := '5 à 10 ans';
      v_timing_km := '100 000 à 200 000 km';
      v_timing_note := 'Respectez scrupuleusement les intervalles de vidange.';

    -- ============================================
    -- SUPPORT MOTEUR
    -- ============================================
    WHEN p_family_name ILIKE '%support%' THEN
      v_intro_role := 'Le ' || p_pg_name || ' maintient le moteur en place et absorbe ses vibrations pour un confort optimal.';
      v_intro_sync_parts := ARRAY['le berceau moteur', 'les silent-blocs', 'la transmission'];
      v_risk_explanation := 'Des supports usés transmettent les vibrations du moteur à l''habitacle et peuvent endommager d''autres composants.';
      v_risk_consequences := ARRAY['vibrations excessives', 'bruit dans l''habitacle', 'usure prématurée des composants'];
      v_risk_cost_range := '150 à 400 €';
      v_risk_conclusion := 'Des supports en bon état garantissent confort et longévité du véhicule.';
      v_timing_years := '5 à 8 ans';
      v_timing_km := '100 000 à 150 000 km';
      v_timing_note := 'Les vibrations au ralenti sont souvent le premier signe d''usure.';

    -- ============================================
    -- TRANSMISSION
    -- ============================================
    WHEN p_family_name ILIKE '%transmission%' THEN
      v_intro_role := 'Le ' || p_pg_name || ' transmet la puissance du moteur aux roues pour faire avancer le véhicule.';
      v_intro_sync_parts := ARRAY['le cardan', 'le différentiel', 'la boîte de vitesses'];
      v_risk_explanation := 'Une transmission défaillante peut vous immobiliser et endommager d''autres composants coûteux.';
      v_risk_consequences := ARRAY['claquements lors des manœuvres', 'vibrations à l''accélération', 'perte de puissance'];
      v_risk_cost_range := '400 à 1 200 €';
      v_risk_conclusion := 'Un entretien régulier de la transmission évite les pannes coûteuses.';
      v_timing_years := '5 à 8 ans';
      v_timing_km := '100 000 à 150 000 km';
      v_timing_note := 'Vérifiez régulièrement les soufflets de cardan.';

    -- ============================================
    -- CAPTEURS
    -- ============================================
    WHEN p_family_name ILIKE '%capteur%' THEN
      v_intro_role := 'Le ' || p_pg_name || ' mesure et transmet des informations essentielles au calculateur du véhicule.';
      v_intro_sync_parts := ARRAY['le calculateur moteur', 'le tableau de bord', 'les actionneurs'];
      v_risk_explanation := 'Un capteur défaillant envoie des informations erronées qui perturbent le fonctionnement du moteur.';
      v_risk_consequences := ARRAY['voyant moteur allumé', 'surconsommation', 'passage au contrôle technique difficile'];
      v_risk_cost_range := '80 à 300 €';
      v_risk_conclusion := 'Un capteur en bon état garantit des performances optimales et un passage serein au contrôle technique.';
      v_timing_years := '5 à 10 ans';
      v_timing_km := '100 000 à 200 000 km';
      v_timing_note := 'Un voyant moteur allumé nécessite un diagnostic rapide.';

    -- ============================================
    -- SYSTÈME D'ALIMENTATION
    -- ============================================
    WHEN p_family_name ILIKE '%alimentation%' THEN
      v_intro_role := 'Le ' || p_pg_name || ' achemine le carburant au moteur de manière optimale pour une combustion efficace.';
      v_intro_sync_parts := ARRAY['la pompe à carburant', 'les injecteurs', 'le filtre à carburant'];
      v_risk_explanation := 'Un système d''alimentation défaillant provoque des pertes de puissance et une surconsommation.';
      v_risk_consequences := ARRAY['difficultés de démarrage', 'à-coups à l''accélération', 'moteur qui cale'];
      v_risk_cost_range := '200 à 800 €';
      v_risk_conclusion := 'Un système d''alimentation en bon état garantit des performances et une consommation optimales.';
      v_timing_years := '4 à 8 ans';
      v_timing_km := '80 000 à 150 000 km';
      v_timing_note := 'Utilisez un carburant de qualité et évitez de rouler réservoir presque vide.';

    -- ============================================
    -- CLIMATISATION
    -- ============================================
    WHEN p_family_name ILIKE '%climatisation%' THEN
      v_intro_role := 'Le ' || p_pg_name || ' assure votre confort thermique en toute saison.';
      v_intro_sync_parts := ARRAY['le compresseur', 'le condenseur', 'le fluide frigorigène'];
      v_risk_explanation := 'Une climatisation défaillante affecte votre confort et peut provoquer de la buée sur le pare-brise.';
      v_risk_consequences := ARRAY['climatisation moins efficace', 'mauvaises odeurs', 'surconsommation du compresseur'];
      v_risk_cost_range := '200 à 800 €';
      v_risk_conclusion := 'Un entretien régulier de la climatisation préserve votre confort et votre santé.';
      v_timing_years := '2 à 3 ans';
      v_timing_km := '50 000 à 80 000 km';
      v_timing_note := 'Faites recharger le fluide et nettoyer le circuit régulièrement.';

    -- ============================================
    -- ECHAPPEMENT
    -- ============================================
    WHEN p_family_name ILIKE '%echappement%' OR p_family_name ILIKE '%échappement%' THEN
      v_intro_role := 'Le ' || p_pg_name || ' évacue les gaz de combustion et réduit les émissions polluantes.';
      v_intro_sync_parts := ARRAY['le catalyseur', 'le silencieux', 'la sonde lambda'];
      v_risk_explanation := 'Un système d''échappement défaillant augmente la pollution et peut vous faire échouer au contrôle technique.';
      v_risk_consequences := ARRAY['bruit excessif', 'échec au contrôle technique', 'surconsommation'];
      v_risk_cost_range := '150 à 600 €';
      v_risk_conclusion := 'Un échappement en bon état vous garantit de passer le contrôle technique sereinement.';
      v_timing_years := '5 à 8 ans';
      v_timing_km := '100 000 à 150 000 km';
      v_timing_note := 'La corrosion est l''ennemi principal de l''échappement.';

    -- ============================================
    -- ÉCLAIRAGE
    -- ============================================
    WHEN p_family_name ILIKE '%eclairage%' OR p_family_name ILIKE '%éclairage%' THEN
      v_intro_role := 'Le ' || p_pg_name || ' assure votre visibilité et signale votre présence aux autres usagers.';
      v_intro_sync_parts := ARRAY['les ampoules', 'les optiques', 'les feux'];
      v_risk_explanation := 'Un éclairage défaillant réduit votre visibilité et peut être sanctionné lors du contrôle technique.';
      v_risk_consequences := ARRAY['visibilité réduite', 'amende et points en moins', 'échec au contrôle technique'];
      v_risk_cost_range := '30 à 200 €';
      v_risk_conclusion := 'Un bon éclairage est essentiel pour votre sécurité, surtout de nuit.';
      v_timing_years := '2 à 5 ans';
      v_timing_km := 'Selon usure';
      v_timing_note := 'Vérifiez régulièrement le bon fonctionnement de tous vos feux.';

    -- ============================================
    -- TURBO
    -- ============================================
    WHEN p_family_name ILIKE '%turbo%' THEN
      v_intro_role := 'Le ' || p_pg_name || ' augmente la puissance du moteur en comprimant l''air d''admission.';
      v_intro_sync_parts := ARRAY['l''échangeur', 'les durites', 'le wastegate'];
      v_risk_explanation := 'Un turbo défaillant provoque une perte de puissance importante et peut endommager le moteur.';
      v_risk_consequences := ARRAY['perte de puissance significative', 'fumée à l''échappement', 'sifflement anormal'];
      v_risk_cost_range := '800 à 2 500 €';
      v_risk_conclusion := 'Respectez les temps de refroidissement du turbo pour prolonger sa durée de vie.';
      v_timing_years := '6 à 10 ans';
      v_timing_km := '150 000 à 250 000 km';
      v_timing_note := 'Laissez tourner le moteur 30 secondes avant de couper après un trajet autoroutier.';

    -- ============================================
    -- ACCESSOIRES
    -- ============================================
    WHEN p_family_name ILIKE '%accessoire%' THEN
      v_intro_role := 'Le ' || p_pg_name || ' contribue au bon fonctionnement et au confort de votre véhicule.';
      v_intro_sync_parts := ARRAY['les courroies accessoires', 'les galets', 'les tendeurs'];
      v_risk_explanation := 'Un accessoire usé peut affecter d''autres composants et réduire le confort d''utilisation.';
      v_risk_consequences := ARRAY['bruit de fonctionnement', 'usure des pièces liées', 'inconfort'];
      v_risk_cost_range := '50 à 300 €';
      v_risk_conclusion := 'Un accessoire en bon état garantit un fonctionnement optimal de votre véhicule.';
      v_timing_years := '3 à 5 ans';
      v_timing_km := '60 000 à 100 000 km';
      v_timing_note := 'Vérifiez l''état lors de chaque révision.';

    -- ============================================
    -- DÉFAUT: Contenu générique
    -- ============================================
    ELSE
      v_intro_role := 'Le/La ' || p_pg_name || ' est une pièce importante de votre véhicule qui contribue à son bon fonctionnement.';
      v_intro_sync_parts := ARRAY['les pièces associées', 'le système concerné'];
      v_risk_explanation := 'Avec le temps et les kilomètres, cette pièce s''use et peut affecter le bon fonctionnement de votre véhicule.';
      v_risk_consequences := ARRAY['dysfonctionnement du système', 'usure accélérée des pièces liées', 'inconfort de conduite'];
      v_risk_cost_range := '100 à 500 €';
      v_risk_conclusion := 'Un remplacement préventif évite des réparations plus coûteuses.';
      v_timing_years := '3 à 5 ans';
      v_timing_km := '60 000 à 100 000 km';
      v_timing_note := 'Consultez le carnet d''entretien de votre véhicule pour les intervalles précis.';
  END CASE;

  -- Insérer ou mettre à jour le guide
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
    sgpg_arg1_title,
    sgpg_arg1_content,
    sgpg_arg2_title,
    sgpg_arg2_content,
    sgpg_arg3_title,
    sgpg_arg3_content,
    sgpg_arg4_title,
    sgpg_arg4_content
  ) VALUES (
    p_pg_id,
    v_intro_title,
    v_intro_role,
    v_intro_sync_parts,
    v_risk_title,
    v_risk_explanation,
    v_risk_consequences,
    v_risk_cost_range,
    v_risk_conclusion,
    v_timing_title,
    v_timing_years,
    v_timing_km,
    v_timing_note,
    -- Arguments communs à toutes les gammes (les 4 principes de vente)
    'Compatibilité garantie',
    'Sur notre site, vous sélectionnez votre véhicule (marque, modèle, motorisation). La pièce est 100 % compatible, sans erreur possible.',
    'Qualité équivalente à l''origine',
    'Nous proposons des marques reconnues, des pièces conformes aux normes constructeur, la même qualité que chez un concessionnaire.',
    'Prix plus juste',
    'Jusqu''à 40 % moins cher qu''en garage ou concession, sans compromis sur la fiabilité.',
    'Kit complet recommandé',
    'Nous conseillons le kit complet quand c''est pertinent : toutes les pièces nécessaires en une fois. C''est plus sûr, plus durable, et évite une nouvelle main-d''œuvre plus tard.'
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
    sgpg_arg2_title = EXCLUDED.sgpg_arg2_title,
    sgpg_arg2_content = EXCLUDED.sgpg_arg2_content,
    sgpg_arg3_title = EXCLUDED.sgpg_arg3_title,
    sgpg_arg3_content = EXCLUDED.sgpg_arg3_content,
    sgpg_arg4_title = EXCLUDED.sgpg_arg4_title,
    sgpg_arg4_content = EXCLUDED.sgpg_arg4_content,
    sgpg_updated_at = NOW();

END;
$$ LANGUAGE plpgsql;

-- ============================================
-- EXÉCUTION: Générer le contenu pour toutes les gammes
-- ============================================

DO $$
DECLARE
  r RECORD;
  v_count INT := 0;
BEGIN
  RAISE NOTICE '🚀 Début de la génération des guides d''achat V2...';

  -- Parcourir toutes les gammes du catalogue
  FOR r IN (
    SELECT DISTINCT
      pg.pg_id::VARCHAR(20) as pg_id,
      pg.pg_name,
      COALESCE(cf.mf_name, 'Autre') as family_name
    FROM catalog_gamme cg
    JOIN pieces_gamme pg ON pg.pg_id = cg.mc_pg_id::int
    LEFT JOIN catalog_family cf ON cf.mf_id = cg.mc_mf_id
    ORDER BY 3, 2
  )
  LOOP
    -- Appeler la fonction de génération
    PERFORM generate_purchase_guide_v2(r.pg_id, r.pg_name, r.family_name);
    v_count := v_count + 1;

    -- Log tous les 50 éléments
    IF v_count % 50 = 0 THEN
      RAISE NOTICE '  ✅ % guides générés...', v_count;
    END IF;
  END LOOP;

  RAISE NOTICE '🎉 Génération terminée: % guides d''achat V2 créés!', v_count;
END $$;

-- ============================================
-- NETTOYAGE: Supprimer la fonction après usage
-- ============================================
DROP FUNCTION IF EXISTS generate_purchase_guide_v2(VARCHAR, VARCHAR, VARCHAR);

-- ============================================
-- VÉRIFICATION: Afficher un résumé
-- ============================================
DO $$
DECLARE
  v_total INT;
  v_families TEXT;
BEGIN
  SELECT COUNT(*) INTO v_total FROM __seo_gamme_purchase_guide;

  SELECT string_agg(DISTINCT
    CASE
      WHEN sgpg_intro_role ILIKE '%frein%' THEN 'Freinage'
      WHEN sgpg_intro_role ILIKE '%distribution%' OR sgpg_intro_role ILIKE '%synchronisation%' THEN 'Distribution'
      WHEN sgpg_intro_role ILIKE '%filtre%' THEN 'Filtration'
      WHEN sgpg_intro_role ILIKE '%embrayage%' THEN 'Embrayage'
      WHEN sgpg_intro_role ILIKE '%amortiss%' OR sgpg_intro_role ILIKE '%suspension%' THEN 'Suspension'
      WHEN sgpg_intro_role ILIKE '%température%' OR sgpg_intro_role ILIKE '%refroidissement%' THEN 'Refroidissement'
      WHEN sgpg_intro_role ILIKE '%électrique%' THEN 'Électrique'
      ELSE 'Autre'
    END, ', ') INTO v_families
  FROM __seo_gamme_purchase_guide;

  RAISE NOTICE '📊 Résumé:';
  RAISE NOTICE '   Total guides: %', v_total;
  RAISE NOTICE '   Catégories: %', v_families;
END $$;
