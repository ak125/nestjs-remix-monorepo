-- ══════════════════════════════════════════════════════════════
-- Migration: Extend diagnostic engine from 3 to 13 systems
-- Systems added: distribution, embrayage, suspension, direction,
--   echappement, filtration, injection, climatisation, transmission, eclairage
-- All INSERTs use ON CONFLICT (id) DO NOTHING for idempotency
-- ══════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════
-- WAVE A: distribution, embrayage, suspension, direction
-- ══════════════════════════════════════════════════════════════

INSERT INTO __diag_system (id, slug, label, description, display_order, active) VALUES
  (6, 'distribution', 'Système de distribution', 'Courroie/chaîne de distribution, galets tendeurs, pompe à eau entraînée', 4, true),
  (7, 'embrayage', 'Système d''embrayage', 'Disque, mécanisme, butée, volant moteur, commande hydraulique', 5, true),
  (8, 'suspension', 'Suspension et amortisseurs', 'Amortisseurs, ressorts, rotules, silentblocs, coupelles', 6, true),
  (9, 'direction', 'Direction', 'Crémaillère, pompe DA, rotules et biellettes de direction', 7, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO __diag_symptom (id, slug, system_id, label, description, signal_mode, urgency, active) VALUES
  (31, 'bruit_claquement_moteur', 6, 'Bruit de claquement moteur', 'Claquement rythmique lié au régime, au ralenti ou à l''accélération', 'customer_reported', 'haute', true),
  (32, 'sifflement_demarrage', 6, 'Sifflement au démarrage', 'Son aigu type courroie patinante, à froid, disparaît à chaud', 'customer_reported', 'moyenne', true),
  (33, 'perte_puissance_distribution', 6, 'Perte de puissance', 'Moteur qui tire moins en accélération', 'customer_reported', 'moyenne', true),
  (34, 'temoin_moteur_distribution', 6, 'Témoin moteur allumé', 'Voyant moteur orange fixe, aléatoire', 'customer_reported', 'moyenne', true),
  (35, 'pedale_embrayage_dure', 7, 'Pédale d''embrayage dure', 'Résistance excessive à chaque actionnement, fatigue musculaire', 'customer_reported', 'moyenne', true),
  (36, 'pedale_molle_spongieuse', 7, 'Pédale molle ou spongieuse', 'Course excessive, point de patinage haut', 'customer_reported', 'moyenne', true),
  (37, 'patinage_embrayage', 7, 'Patinage embrayage', 'Régime monte sans accélération proportionnelle, en côte ou forte accélération', 'customer_reported', 'haute', true),
  (38, 'bruit_debrayage', 7, 'Bruit au débrayage', 'Grincement, sifflement ou claquement à l''appui pédale', 'customer_reported', 'moyenne', true),
  (39, 'difficulte_passage_vitesses', 7, 'Difficulté passage vitesses', 'Craquements ou résistance au passage, à froid ou constant', 'customer_reported', 'moyenne', true),
  (40, 'rebonds_excessifs', 8, 'Rebonds excessifs', 'Véhicule continue de rebondir après dos d''âne, plus de 2 rebonds', 'customer_reported', 'haute', true),
  (41, 'tenue_route_degradee', 8, 'Tenue de route dégradée', 'Véhicule flottant, instable en virage ou freinage', 'customer_reported', 'haute', true),
  (42, 'usure_pneus_anormale', 8, 'Usure pneus anormale', 'Usure en vagues ou facettes, visible au contrôle', 'mechanic_observed', 'moyenne', true),
  (43, 'bruits_suspension', 8, 'Bruits de suspension', 'Claquements, cognements sur routes dégradées', 'customer_reported', 'moyenne', true),
  (44, 'vehicule_affaisse', 8, 'Véhicule affaissé', 'Un côté plus bas que l''autre à l''arrêt', 'customer_reported', 'haute', true),
  (45, 'claquements_sourds', 8, 'Claquements sourds', 'Bruit sourd côté roue au départ, freinage ou dos d''âne', 'customer_reported', 'moyenne', true),
  (46, 'direction_lourde', 9, 'Direction lourde', 'Volant dur, résistance excessive, surtout à basse vitesse', 'customer_reported', 'haute', true),
  (47, 'jeu_volant', 9, 'Jeu dans le volant', 'Volant tourne sans que les roues bougent, direction floue', 'customer_reported', 'haute', true),
  (48, 'bruit_direction', 9, 'Bruits en braquant', 'Craquement, grincement ou sifflement en tournant le volant', 'customer_reported', 'moyenne', true),
  (49, 'fuite_liquide_da', 9, 'Fuite de liquide DA', 'Fuite visible sur crémaillère, raccords ou bocal DA', 'mechanic_observed', 'haute', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO __diag_cause (id, slug, system_id, label, cause_type, description, verification_method, urgency, active, plausible_km_min, plausible_km_max, plausible_age_min, plausible_age_max, workshop_priority) VALUES
  (25, 'courroie_distribution_usee', 6, 'Courroie de distribution usée', 'wear', 'Fissures, effilochage, âge/kilométrage dépassé', 'Inspection visuelle, contrôle âge/km vs préco constructeur', 'critique', true, 80000, 200000, 4, 10, 'P1'),
  (26, 'galet_tendeur_defaillant', 6, 'Galet tendeur défaillant', 'mechanical', 'Jeu excessif, bruit de roulement', 'Contrôle jeu galet, écoute bruit roulement', 'haute', true, 80000, 200000, 4, 10, 'P1'),
  (27, 'pompe_eau_distribution', 6, 'Pompe à eau HS (distribution)', 'mechanical', 'Fuite liquide de refroidissement, jeu axial', 'Contrôle fuite, jeu axial pompe', 'haute', true, 80000, 180000, 5, 12, 'P1'),
  (28, 'courroie_accessoires_usee', 6, 'Courroie accessoires usée', 'wear', 'Fissures, patinage, sifflement', 'Inspection visuelle, test tension', 'moyenne', true, 60000, 120000, 4, 8, 'P2'),
  (29, 'disque_embrayage_use', 7, 'Disque d''embrayage usé', 'wear', 'Garnitures de friction usées, patinage', 'Test patinage en côte, contrôle km', 'haute', true, 80000, 200000, 5, 15, 'P1'),
  (30, 'butee_embrayage_hs', 7, 'Butée d''embrayage HS', 'mechanical', 'Bruit à l''appui pédale, fuite liquide possible', 'Écoute bruit débrayage, contrôle fuite', 'moyenne', true, 80000, 180000, 5, 15, 'P2'),
  (31, 'volant_moteur_bimasse_hs', 7, 'Volant moteur bimasse HS', 'mechanical', 'Vibrations excessives, claquements au ralenti', 'Contrôle vibrations ralenti, jeu angulaire', 'moyenne', true, 100000, 250000, 6, 15, 'P2'),
  (32, 'emetteur_recepteur_defaillant', 7, 'Émetteur/récepteur embrayage défaillant', 'hydraulic', 'Pédale molle, fuite liquide commande', 'Contrôle niveau liquide, recherche fuite', 'moyenne', true, 80000, 200000, 5, 15, 'P2'),
  (33, 'amortisseur_use', 8, 'Amortisseur usé (fuite huile)', 'wear', 'Traces huile sur corps amortisseur, rebonds excessifs', 'Test rebond (appui aile), inspection visuelle fuite', 'haute', true, 60000, 120000, 4, 8, 'P1'),
  (34, 'ressort_casse', 8, 'Ressort cassé', 'mechanical', 'Véhicule affaissé d''un côté, bruit métallique', 'Inspection visuelle hauteur caisse, contrôle ressort', 'haute', true, 100000, 200000, 6, 15, 'P1'),
  (35, 'rotule_suspension_hs', 8, 'Rotule de suspension usée', 'wear', 'Jeu visible, claquement, direction floue', 'Contrôle jeu roue levée, test latéral', 'haute', true, 80000, 180000, 5, 12, 'P1'),
  (36, 'silentbloc_use', 8, 'Silentbloc usé', 'wear', 'Caoutchouc craquelé, claquements sourds', 'Inspection visuelle, test jeu triangle', 'moyenne', true, 80000, 160000, 5, 12, 'P2'),
  (37, 'coupelle_amortisseur_hs', 8, 'Coupelle/butée amortisseur HS', 'wear', 'Bruit rotation volant à l''arrêt, grincement', 'Écoute bruit braquage, contrôle visuel', 'moyenne', true, 60000, 120000, 4, 8, 'P2'),
  (38, 'cremaillere_usee', 9, 'Crémaillère usée', 'wear', 'Usure pignons, bagues de guidage, jeu interne', 'Contrôle jeu roue levée, inspection soufflets', 'haute', true, 120000, 250000, 8, 20, 'P1'),
  (39, 'pompe_direction_hs', 9, 'Pompe DA défaillante', 'mechanical', 'Sifflement, pression insuffisante, fuite', 'Contrôle niveau liquide DA, écoute sifflement', 'haute', true, 100000, 200000, 6, 15, 'P1'),
  (40, 'rotule_direction_usee', 9, 'Rotule de direction usée', 'wear', 'Jeu roue levée, claquement manœuvres', 'Test jeu rotule roue levée, secouer 9h-15h', 'haute', true, 80000, 180000, 5, 12, 'P1'),
  (41, 'biellette_direction_usee', 9, 'Biellette de direction usée', 'wear', 'Claquement dans virages, jeu latéral', 'Contrôle visuel, test jeu biellette', 'moyenne', true, 60000, 140000, 4, 10, 'P2')
ON CONFLICT (id) DO NOTHING;

INSERT INTO __diag_symptom_cause_link (id, symptom_id, cause_id, relative_score, evidence_for, evidence_against, requires_verification, active) VALUES
  (56, 31, 25, 65, ARRAY['Claquement rythmique lié au régime', 'Kilométrage élevé'], ARRAY[]::text[], true, true),
  (57, 31, 26, 45, ARRAY['Bruit de roulement galet'], ARRAY[]::text[], true, true),
  (58, 31, 27, 30, ARRAY['Jeu axial pompe'], ARRAY[]::text[], true, true),
  (59, 32, 28, 70, ARRAY['Sifflement à froid disparaît à chaud', 'Courroie patinante'], ARRAY[]::text[], true, true),
  (60, 32, 26, 25, ARRAY['Galet tendeur fatigué'], ARRAY[]::text[], true, true),
  (61, 33, 25, 60, ARRAY['Calage distribution décalé'], ARRAY[]::text[], true, true),
  (62, 33, 27, 35, ARRAY['Pompe à eau fuyante, surchauffe possible'], ARRAY[]::text[], true, true),
  (63, 33, 28, 20, ARRAY['Accessoires mal entraînés'], ARRAY[]::text[], true, true),
  (64, 34, 25, 55, ARRAY['Calage distribution perturbé'], ARRAY[]::text[], true, true),
  (65, 34, 26, 30, ARRAY['Vibration galet détectée par capteur'], ARRAY[]::text[], true, true),
  (66, 35, 32, 60, ARRAY['Émetteur/récepteur grippé'], ARRAY[]::text[], true, true),
  (67, 35, 30, 30, ARRAY['Butée mécanique grippée'], ARRAY[]::text[], true, true),
  (68, 36, 32, 65, ARRAY['Fuite liquide commande', 'Air dans circuit hydraulique'], ARRAY[]::text[], true, true),
  (69, 36, 30, 25, ARRAY['Butée hydraulique fuyante'], ARRAY[]::text[], true, true),
  (70, 37, 29, 75, ARRAY['Garnitures friction usées', 'Kilométrage élevé'], ARRAY[]::text[], true, true),
  (71, 37, 31, 20, ARRAY['Volant bimasse HS provoque patinage irrégulier'], ARRAY[]::text[], true, true),
  (72, 38, 30, 65, ARRAY['Bruit à l''appui pédale', 'Sifflement butée'], ARRAY[]::text[], true, true),
  (73, 38, 31, 30, ARRAY['Claquements au ralenti', 'Vibrations volant bimasse'], ARRAY[]::text[], true, true),
  (74, 39, 29, 45, ARRAY['Disque usé ne désolidarise pas complètement'], ARRAY[]::text[], true, true),
  (75, 39, 32, 40, ARRAY['Course insuffisante, débrayage incomplet'], ARRAY[]::text[], true, true),
  (76, 39, 31, 20, ARRAY['Volant bimasse provoque à-coups'], ARRAY[]::text[], true, true),
  (77, 40, 33, 80, ARRAY['Plus de 2 rebonds au test aile', 'Fuite huile amortisseur'], ARRAY[]::text[], true, true),
  (78, 40, 37, 15, ARRAY['Coupelle ne retient plus le rebond'], ARRAY[]::text[], true, true),
  (79, 41, 33, 70, ARRAY['Véhicule flottant', 'Instabilité virage'], ARRAY[]::text[], true, true),
  (80, 41, 35, 25, ARRAY['Jeu rotule affecte géométrie'], ARRAY[]::text[], true, true),
  (81, 41, 36, 20, ARRAY['Silentbloc usé affecte tenue'], ARRAY[]::text[], true, true),
  (82, 42, 33, 55, ARRAY['Usure en vagues typique amortisseur HS'], ARRAY[]::text[], true, true),
  (83, 42, 35, 30, ARRAY['Géométrie faussée par rotule'], ARRAY[]::text[], true, true),
  (84, 42, 36, 20, ARRAY['Silentbloc modifie angle roue'], ARRAY[]::text[], true, true),
  (85, 43, 33, 35, ARRAY['Cognement amortisseur en fin de course'], ARRAY[]::text[], true, true),
  (86, 43, 37, 35, ARRAY['Grincement coupelle supérieure'], ARRAY[]::text[], true, true),
  (87, 43, 36, 25, ARRAY['Claquement silentbloc craquelé'], ARRAY[]::text[], true, true),
  (88, 44, 34, 75, ARRAY['Ressort cassé ou fatigué', 'Hauteur caisse asymétrique'], ARRAY[]::text[], true, true),
  (89, 44, 33, 20, ARRAY['Amortisseur HS comprime ressort'], ARRAY[]::text[], true, true),
  (90, 45, 36, 55, ARRAY['Caoutchouc craquelé', 'Bruit sourd au départ/freinage'], ARRAY[]::text[], true, true),
  (91, 45, 35, 30, ARRAY['Jeu rotule génère claquement'], ARRAY[]::text[], true, true),
  (92, 45, 37, 15, ARRAY['Coupelle lâche claque'], ARRAY[]::text[], true, true),
  (93, 46, 39, 60, ARRAY['Sifflement pompe', 'Niveau liquide DA bas'], ARRAY[]::text[], true, true),
  (94, 46, 38, 35, ARRAY['Crémaillère grippée, corrosion interne'], ARRAY[]::text[], true, true),
  (95, 47, 40, 55, ARRAY['Jeu roue levée 9h-15h', 'Rotule usée'], ARRAY[]::text[], true, true),
  (96, 47, 41, 35, ARRAY['Biellette desserrée', 'Jeu latéral'], ARRAY[]::text[], true, true),
  (97, 47, 38, 20, ARRAY['Usure pignons crémaillère'], ARRAY[]::text[], true, true),
  (98, 48, 39, 50, ARRAY['Sifflement continu pompe DA'], ARRAY[]::text[], true, true),
  (99, 48, 38, 30, ARRAY['Craquement en braquant'], ARRAY[]::text[], true, true),
  (100, 48, 40, 20, ARRAY['Claquement rotule en manœuvre'], ARRAY[]::text[], true, true),
  (101, 49, 39, 50, ARRAY['Fuite raccords ou bocal'], ARRAY[]::text[], true, true),
  (102, 49, 38, 45, ARRAY['Joints spy crémaillère usés, fuite aux soufflets'], ARRAY[]::text[], true, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO __diag_safety_rule (id, system_id, rule_slug, condition_description, risk_flag, urgency, blocks_catalog, active) VALUES
  (18, 6, 'timing_belt_snap_risk', 'Courroie de distribution au-delà de la préconisation constructeur : risque de casse moteur irréversible', 'CRITIQUE: risque casse moteur si courroie lâche', 'haute', true, true),
  (19, 7, 'clutch_slip_hill_risk', 'Patinage embrayage en côte ou sous charge : risque d''immobilisation en situation dangereuse', 'ATTENTION: patinage peut empêcher le démarrage en côte', 'moyenne', false, true),
  (20, 8, 'suspension_stability_risk', 'Amortisseurs HS : allongement distances de freinage et perte de contrôle en virage', 'SECURITE: tenue de route dégradée, distances de freinage allongées', 'haute', true, true),
  (21, 8, 'spring_break_risk', 'Ressort de suspension cassé : risque de contact pneu/carrosserie et instabilité', 'ATTENTION: véhicule affaissé, risque contact pneu', 'haute', false, true),
  (22, 9, 'steering_loss_risk', 'Perte de direction assistée ou jeu excessif : risque d''accident par perte de contrôle directionnel', 'CRITIQUE: perte de contrôle directionnel possible', 'haute', true, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO __diag_maintenance_operation (id, slug, system_id, label, description, interval_km_min, interval_km_max, interval_months_min, interval_months_max, severity_if_overdue, normal_wear_km_min, normal_wear_km_max, related_gamme_slug, related_pg_id, active) VALUES
  (24, 'kit_distribution_replacement', 6, 'Remplacement kit de distribution', 'Courroie + galets + pompe à eau, selon préco constructeur', 80000, 160000, 48, 72, 'critical', 80000, 200000, 'kit-de-distribution', 307, true),
  (25, 'courroie_accessoires_replacement', 6, 'Remplacement courroie accessoires', 'Courroie poly-V et galet tendeur accessoires', 60000, 120000, 48, 72, 'moderate', 60000, 120000, 'courroie-trapezoidale-a-nervures', 305, true),
  (26, 'kit_embrayage_replacement', 7, 'Remplacement kit embrayage', 'Disque + mécanisme + butée, contrôle volant moteur', 80000, 200000, 60, 180, 'high', 80000, 200000, 'embrayage', 3825, true),
  (27, 'volant_moteur_replacement', 7, 'Remplacement volant moteur', 'Volant moteur bimasse, lors du changement embrayage', 100000, 250000, 72, 180, 'high', 100000, 250000, 'volant-moteur', 577, true),
  (28, 'amortisseur_replacement', 8, 'Remplacement amortisseurs', 'Par paire (essieu), avec kit butée et soufflet', 60000, 100000, 48, 96, 'high', 60000, 120000, 'amortisseur', 854, true),
  (29, 'silentbloc_replacement', 8, 'Remplacement silentblocs', 'Silentblocs triangle de suspension, géométrie après', 80000, 150000, 60, 144, 'moderate', 80000, 160000, 'silentbloc-de-bras-de-suspension', 251, true),
  (30, 'pompe_direction_replacement', 9, 'Remplacement pompe DA', 'Pompe de direction assistée, purge circuit', 100000, 200000, 72, 180, 'high', 100000, 200000, 'pompe-de-direction-assistee', 12, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO __diag_maintenance_symptom_link (id, symptom_id, operation_id, relevance, active) VALUES
  (24, 31, 24, 'primary', true), (25, 32, 25, 'primary', true), (26, 33, 24, 'related', true),
  (27, 34, 24, 'related', true), (28, 37, 26, 'primary', true), (29, 38, 26, 'related', true),
  (30, 38, 27, 'related', true), (31, 39, 26, 'related', true), (32, 40, 28, 'primary', true),
  (33, 41, 28, 'primary', true), (34, 43, 29, 'related', true), (35, 45, 29, 'primary', true),
  (36, 46, 30, 'primary', true), (37, 48, 30, 'related', true)
ON CONFLICT (id) DO NOTHING;

-- ══════════════════════════════════════════════════════════════
-- WAVE B: echappement, filtration, injection, climatisation
-- ══════════════════════════════════════════════════════════════

INSERT INTO __diag_system (id, slug, label, description, display_order, active) VALUES
  (10, 'echappement', 'Échappement et catalyseur', 'Catalyseur, FAP, sonde lambda, silencieux, collecteur, flexible', 8, true),
  (11, 'filtration', 'Filtration', 'Filtres à huile, air, carburant, habitacle', 9, true),
  (12, 'injection', 'Injection et alimentation', 'Injecteurs, pompe HP, rampe commune, régulateur pression', 10, true),
  (13, 'climatisation', 'Climatisation', 'Compresseur, condenseur, évaporateur, déshydrateur, gaz réfrigérant', 11, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO __diag_symptom (id, slug, system_id, label, description, signal_mode, urgency, active) VALUES
  (50, 'bruit_echappement_fort', 10, 'Bruit d''échappement fort', 'Bruit métallique, souffle ou grondement sous la voiture', 'customer_reported', 'moyenne', true),
  (51, 'fumee_anormale', 10, 'Fumée anormale échappement', 'Fumée noire, blanche épaisse ou bleue persistante', 'customer_reported', 'haute', true),
  (52, 'perte_puissance_echappement', 10, 'Perte de puissance + voyant', 'Moteur qui étouffe à l''accélération, voyant moteur allumé', 'customer_reported', 'haute', true),
  (53, 'odeur_gaz_habitacle', 10, 'Odeur de gaz dans l''habitacle', 'Odeur d''échappement perceptible dans l''habitacle', 'customer_reported', 'haute', true),
  (54, 'voyant_huile', 11, 'Voyant huile allumé', 'Voyant pression huile rouge au ralenti ou en virage', 'customer_reported', 'critique', true),
  (55, 'perte_puissance_filtration', 11, 'Perte de puissance moteur', 'Moteur manque de souffle, accélération molle', 'customer_reported', 'moyenne', true),
  (56, 'surconsommation_carburant', 11, 'Surconsommation carburant', 'Consommation anormalement élevée sans changement d''usage', 'customer_reported', 'basse', true),
  (57, 'odeur_habitacle', 11, 'Odeur désagréable habitacle', 'Odeur de moisi ou d''huile brûlée à la ventilation', 'customer_reported', 'basse', true),
  (58, 'moteur_broute', 12, 'Moteur qui broute', 'À-coups et ratés en accélération ou montée en régime', 'customer_reported', 'moyenne', true),
  (59, 'ralenti_instable', 12, 'Ralenti instable', 'Variations RPM au ralenti, vibrations', 'customer_reported', 'moyenne', true),
  (60, 'demarrage_difficile_injection', 12, 'Démarrage difficile', 'Plusieurs tentatives nécessaires, surtout à froid', 'customer_reported', 'haute', true),
  (61, 'fumee_noire_injection', 12, 'Fumée noire diesel', 'Fumée noire épaisse à l''accélération franche', 'customer_reported', 'moyenne', true),
  (62, 'perte_puissance_injection', 12, 'Perte de puissance brutale', 'Mode dégradé, voyant moteur, puissance limitée', 'customer_reported', 'haute', true),
  (63, 'clim_pas_de_froid', 13, 'Climatisation sans effet', 'Pas de froid, compresseur ne s''enclenche pas ou tourne sans refroidir', 'customer_reported', 'moyenne', true),
  (64, 'bruit_compresseur_clim', 13, 'Bruit compresseur climatisation', 'Bruit métallique ou claquement au niveau du compresseur', 'customer_reported', 'haute', true),
  (65, 'odeur_clim', 13, 'Odeur de moisi ventilation', 'Odeur désagréable à la mise en route ventilation/clim', 'customer_reported', 'basse', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO __diag_cause (id, slug, system_id, label, cause_type, description, verification_method, urgency, active, plausible_km_min, plausible_km_max, plausible_age_min, plausible_age_max, workshop_priority) VALUES
  (42, 'catalyseur_colmate', 10, 'Catalyseur colmaté', 'wear', 'Substrat céramique saturé, codes P0420/P0430', 'Lecture codes défaut, test contre-pression échappement', 'haute', true, 80000, 200000, 6, 15, 'P1'),
  (43, 'sonde_lambda_hs', 10, 'Sonde lambda défaillante', 'electrical', 'Mélange mal régulé, surconsommation', 'Lecture codes défaut, mesure tension sonde', 'moyenne', true, 80000, 160000, 5, 12, 'P2'),
  (44, 'silencieux_perce', 10, 'Silencieux percé', 'corrosion', 'Corrosion perforant le pot, bruit de souffle', 'Inspection visuelle, test fumigène', 'moyenne', true, 60000, 150000, 5, 12, 'P2'),
  (45, 'joint_collecteur_hs', 10, 'Joint collecteur/flexible HS', 'wear', 'Joint brûlé ou flexible fissuré, fuite gaz', 'Inspection visuelle, écoute sifflement à froid', 'haute', true, 80000, 180000, 5, 15, 'P1'),
  (46, 'filtre_huile_colmate', 11, 'Filtre à huile colmaté', 'wear', 'Accumulation impuretés, dépassement intervalle vidange', 'Contrôle visuel, pression huile manomètre', 'critique', true, 10000, 30000, 6, 24, 'P1'),
  (47, 'filtre_air_colmate', 11, 'Filtre à air colmaté', 'wear', 'Poussière et débris bloquant admission air', 'Inspection visuelle, test aspiration', 'moyenne', true, 15000, 40000, 12, 24, 'P2'),
  (48, 'filtre_carburant_colmate', 11, 'Filtre à carburant colmaté', 'wear', 'Impuretés carburant, eau dans filtre diesel', 'Test débit, lecture codes défaut pression', 'moyenne', true, 30000, 60000, 24, 48, 'P2'),
  (49, 'filtre_habitacle_sature', 11, 'Filtre habitacle saturé', 'wear', 'Pollen, poussière, bactéries accumulées', 'Inspection visuelle, test débit ventilation', 'basse', true, 15000, 30000, 12, 18, 'P3'),
  (50, 'injecteur_encrasse', 12, 'Injecteur encrassé/usé', 'wear', 'Pulvérisation dégradée, fuite possible', 'Lecture codes défaut, test débit/retour injecteurs', 'haute', true, 80000, 250000, 5, 15, 'P1'),
  (51, 'pompe_injection_hs', 12, 'Pompe HP défaillante', 'mechanical', 'Pression rampe commune insuffisante', 'Mesure pression rampe vs spécification', 'haute', true, 120000, 300000, 6, 15, 'P1'),
  (52, 'bobine_allumage_hs', 12, 'Bobine d''allumage HS', 'electrical', 'Raté allumage sur un cylindre', 'Code défaut P030x, test résistance bobine', 'moyenne', true, 60000, 150000, 4, 12, 'P2'),
  (53, 'filtre_carburant_injection', 12, 'Filtre à carburant colmaté (injection)', 'wear', 'Débit insuffisant, eau dans filtre diesel', 'Contrôle historique, test débit', 'moyenne', true, 30000, 60000, 24, 48, 'P2'),
  (54, 'compresseur_clim_hs', 13, 'Compresseur climatisation HS', 'mechanical', 'Embrayage HS, blocage interne, fuite', 'Contrôle embrayage compresseur, pression circuit', 'haute', true, 100000, 250000, 6, 15, 'P1'),
  (55, 'condenseur_clim_bouche', 13, 'Condenseur climatisation obstrué', 'blockage', 'Débris/feuilles devant condenseur, échange thermique dégradé', 'Inspection visuelle, nettoyage test', 'moyenne', true, 40000, 120000, 3, 10, 'P2'),
  (56, 'deshydrateur_sature', 13, 'Déshydrateur/bouteille saturé', 'wear', 'Humidité dans circuit, performance dégradée', 'Contrôle pression circuit, bulles au voyant', 'moyenne', true, 60000, 150000, 4, 10, 'P2'),
  (57, 'fuite_gaz_refrigerant', 13, 'Fuite gaz réfrigérant', 'leak', 'Traces huile sur raccords, niveau gaz insuffisant', 'Test UV fluorescent, détecteur de fuite', 'haute', true, 40000, 200000, 3, 15, 'P1')
ON CONFLICT (id) DO NOTHING;

INSERT INTO __diag_symptom_cause_link (id, symptom_id, cause_id, relative_score, evidence_for, evidence_against, requires_verification, active) VALUES
  (103, 50, 44, 55, ARRAY['Bruit souffle/grondement', 'Corrosion visible'], ARRAY[]::text[], true, true),
  (104, 50, 45, 40, ARRAY['Sifflement à froid', 'Fuite au collecteur'], ARRAY[]::text[], true, true),
  (105, 50, 42, 20, ARRAY['Bruit ferraille catalyseur fragmenté'], ARRAY[]::text[], true, true),
  (106, 51, 42, 45, ARRAY['Voyant moteur codes P0420/P0430'], ARRAY[]::text[], true, true),
  (107, 51, 43, 40, ARRAY['Mélange mal régulé', 'Surconsommation'], ARRAY[]::text[], true, true),
  (108, 52, 42, 65, ARRAY['Moteur étouffe', 'Contre-pression élevée'], ARRAY[]::text[], true, true),
  (109, 52, 43, 30, ARRAY['Sonde HS provoque mauvais mélange'], ARRAY[]::text[], true, true),
  (110, 53, 44, 50, ARRAY['Silencieux percé laisse passer gaz'], ARRAY[]::text[], true, true),
  (111, 53, 45, 45, ARRAY['Fuite collecteur/flexible vers habitacle'], ARRAY[]::text[], true, true),
  (112, 54, 46, 75, ARRAY['Voyant pression huile', 'Filtre colmaté bloque débit'], ARRAY[]::text[], true, true),
  (113, 55, 47, 60, ARRAY['Admission air restreinte', 'Accélération molle'], ARRAY[]::text[], true, true),
  (114, 55, 48, 35, ARRAY['Débit carburant insuffisant'], ARRAY[]::text[], true, true),
  (115, 56, 47, 40, ARRAY['Mélange trop riche par manque air'], ARRAY[]::text[], true, true),
  (116, 56, 48, 45, ARRAY['Filtre diesel colmaté, surconsommation'], ARRAY[]::text[], true, true),
  (117, 57, 49, 75, ARRAY['Odeur moisi ventilation', 'Filtre saturé'], ARRAY[]::text[], true, true),
  (118, 58, 50, 65, ARRAY['À-coups accélération', 'Ratés allumage'], ARRAY[]::text[], true, true),
  (119, 58, 52, 30, ARRAY['Raté un cylindre, code P030x'], ARRAY[]::text[], true, true),
  (120, 59, 50, 55, ARRAY['Variations RPM', 'Pulvérisation dégradée'], ARRAY[]::text[], true, true),
  (121, 59, 52, 35, ARRAY['Bobine HS provoque instabilité'], ARRAY[]::text[], true, true),
  (122, 60, 50, 45, ARRAY['Fuite retour injecteur diesel'], ARRAY[]::text[], true, true),
  (123, 60, 51, 40, ARRAY['Pression rampe insuffisante'], ARRAY[]::text[], true, true),
  (124, 60, 53, 20, ARRAY['Débit carburant restreint'], ARRAY[]::text[], true, true),
  (125, 61, 50, 65, ARRAY['Mauvaise pulvérisation diesel'], ARRAY[]::text[], true, true),
  (126, 61, 53, 25, ARRAY['Filtre diesel limite débit'], ARRAY[]::text[], true, true),
  (127, 62, 51, 60, ARRAY['Mode dégradé, pression rail basse'], ARRAY[]::text[], true, true),
  (128, 62, 50, 30, ARRAY['Injecteur grippé provoque perte puissance'], ARRAY[]::text[], true, true),
  (129, 63, 57, 50, ARRAY['Manque gaz, compresseur ne s''enclenche pas'], ARRAY[]::text[], true, true),
  (130, 63, 54, 30, ARRAY['Compresseur bloqué, embrayage HS'], ARRAY[]::text[], true, true),
  (131, 63, 55, 15, ARRAY['Condenseur obstrué, échange thermique dégradé'], ARRAY[]::text[], true, true),
  (132, 63, 56, 10, ARRAY['Humidité dans circuit'], ARRAY[]::text[], true, true),
  (133, 64, 54, 75, ARRAY['Bruit métallique compresseur', 'Embrayage HS'], ARRAY[]::text[], true, true),
  (134, 65, 49, 70, ARRAY['Odeur moisi filtre habitacle saturé'], ARRAY[]::text[], true, true),
  (135, 65, 56, 15, ARRAY['Humidité favorise moisissures'], ARRAY[]::text[], true, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO __diag_safety_rule (id, system_id, rule_slug, condition_description, risk_flag, urgency, blocks_catalog, active) VALUES
  (23, 10, 'exhaust_fumes_cabin_risk', 'Odeur de gaz d''échappement dans l''habitacle : risque d''intoxication au monoxyde de carbone', 'CRITIQUE: risque intoxication CO dans habitacle', 'haute', true, true),
  (24, 12, 'fuel_leak_fire_risk', 'Fuite d''injecteur ou de carburant : risque d''incendie moteur', 'CRITIQUE: risque incendie si fuite carburant', 'haute', true, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO __diag_maintenance_operation (id, slug, system_id, label, description, interval_km_min, interval_km_max, interval_months_min, interval_months_max, severity_if_overdue, normal_wear_km_min, normal_wear_km_max, related_gamme_slug, related_pg_id, active) VALUES
  (31, 'controle_echappement', 10, 'Contrôle ligne d''échappement', 'Inspection visuelle silencieux, catalyseur, collecteur', 40000, 80000, 24, 48, 'moderate', 60000, 150000, 'catalyseur', 429, true),
  (32, 'filtre_huile_replacement', 11, 'Remplacement filtre à huile', 'À chaque vidange moteur', 10000, 30000, 12, 24, 'critical', 10000, 30000, 'filtre-a-huile', 7, true),
  (33, 'filtre_air_replacement', 11, 'Remplacement filtre à air', 'Inspection et remplacement régulier', 15000, 40000, 12, 24, 'moderate', 15000, 40000, 'filtre-a-air', 8, true),
  (34, 'filtre_carburant_replacement', 11, 'Remplacement filtre à carburant', 'Surtout diesel, inclure purge eau', 30000, 60000, 24, 48, 'high', 30000, 60000, 'filtre-a-carburant', 9, true),
  (35, 'filtre_habitacle_replacement', 11, 'Remplacement filtre habitacle', 'Pollen et particules, 1-2x/an', 15000, 30000, 12, 18, 'low', 15000, 30000, 'filtre-d-habitacle', 424, true),
  (36, 'bougie_allumage_replacement', 12, 'Remplacement bougies d''allumage', 'Essence uniquement, selon type (standard/iridium)', 30000, 60000, 36, 72, 'moderate', 30000, 90000, 'bougie-d-allumage', 686, true),
  (37, 'injecteur_nettoyage', 12, 'Nettoyage/remplacement injecteurs', 'Nettoyage ultrasons ou échange standard diesel', 80000, 200000, 60, 180, 'high', 80000, 250000, 'injecteur', 3902, true),
  (38, 'recharge_clim', 13, 'Recharge climatisation', 'Recharge gaz R134a/R1234yf + recherche fuite', 40000, 80000, 24, 36, 'low', 40000, 200000, 'compresseur-de-climatisation', 447, true),
  (39, 'filtre_habitacle_clim', 13, 'Remplacement filtre habitacle (clim)', 'Essentiel pour qualité air et performance clim', 15000, 20000, 12, 12, 'low', 15000, 30000, 'filtre-d-habitacle', 424, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO __diag_maintenance_symptom_link (id, symptom_id, operation_id, relevance, active) VALUES
  (38, 50, 31, 'primary', true), (39, 52, 31, 'related', true), (40, 54, 32, 'primary', true),
  (41, 55, 33, 'primary', true), (42, 55, 34, 'related', true), (43, 56, 33, 'related', true),
  (44, 56, 34, 'primary', true), (45, 57, 35, 'primary', true), (46, 58, 37, 'primary', true),
  (47, 59, 37, 'related', true), (48, 59, 36, 'related', true), (49, 60, 37, 'primary', true),
  (50, 63, 38, 'primary', true), (51, 65, 39, 'primary', true)
ON CONFLICT (id) DO NOTHING;

-- ══════════════════════════════════════════════════════════════
-- WAVE C: transmission, eclairage
-- ══════════════════════════════════════════════════════════════

INSERT INTO __diag_system (id, slug, label, description, display_order, active) VALUES
  (14, 'transmission', 'Transmission et boîte de vitesses', 'Boîte manuelle/auto, cardans, soufflets, différentiel', 12, true),
  (15, 'eclairage', 'Éclairage et signalisation', 'Phares, feux, ampoules, optiques, signalisation', 13, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO __diag_symptom (id, slug, system_id, label, description, signal_mode, urgency, active) VALUES
  (66, 'craquement_passage_vitesse', 14, 'Craquement au passage de vitesse', 'Craquement sur un rapport, pire à froid, synchroniseurs suspects', 'customer_reported', 'moyenne', true),
  (67, 'claquement_virage_transmission', 14, 'Claquement en virage', 'Claquement sec en accélération/décélération dans les virages, soufflet cardan suspect', 'customer_reported', 'haute', true),
  (68, 'vibration_acceleration', 14, 'Vibration à l''accélération', 'Vibration proportionnelle à la vitesse, dans l''habitacle', 'customer_reported', 'moyenne', true),
  (69, 'phare_faible', 15, 'Phares faibles', 'Luminosité réduite, ampoules vieillissantes ou optiques ternies', 'customer_reported', 'moyenne', true),
  (70, 'feu_hs', 15, 'Feu ne fonctionne pas', 'Un ou plusieurs feux inactifs, fusible ou ampoule', 'customer_reported', 'haute', true),
  (71, 'ampoule_grille_frequemment', 15, 'Ampoules grillent fréquemment', 'Remplacement fréquent, surtension ou mauvais support', 'customer_reported', 'moyenne', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO __diag_cause (id, slug, system_id, label, cause_type, description, verification_method, urgency, active, plausible_km_min, plausible_km_max, plausible_age_min, plausible_age_max, workshop_priority) VALUES
  (58, 'cardan_use', 14, 'Cardan usé', 'wear', 'Croisillon usé, claquement en virage, vibration', 'Inspection soufflets, test jeu croisillon', 'haute', true, 100000, 250000, 6, 15, 'P1'),
  (59, 'soufflet_cardan_dechire', 14, 'Soufflet de cardan déchiré', 'wear', 'Graisse projetée visible, cardan tourne sans lubrification', 'Inspection visuelle, graisse sur roue intérieure', 'haute', true, 60000, 150000, 4, 12, 'P1'),
  (60, 'boite_vitesses_usee', 14, 'Boîte de vitesses usée', 'mechanical', 'Synchroniseurs usés, craquement passage rapports', 'Test passage vitesses, vidange et contrôle huile', 'moyenne', true, 150000, 350000, 8, 20, 'P2'),
  (61, 'ampoule_grillee', 15, 'Ampoule grillée', 'wear', 'Filament cassé, perte luminosité progressive', 'Inspection visuelle, test alimentation', 'moyenne', true, 30000, 100000, 2, 5, 'P2'),
  (62, 'feu_avant_defaillant', 15, 'Bloc optique avant défaillant', 'mechanical', 'Optique ternie, connecteur oxydé, étanchéité perdue', 'Inspection visuelle, test électrique', 'haute', true, 80000, 200000, 5, 12, 'P2'),
  (63, 'feu_arriere_defaillant', 15, 'Bloc optique arrière défaillant', 'mechanical', 'Connecteur oxydé, masse corrodée, humidité', 'Inspection visuelle, test continuité masse', 'haute', true, 80000, 200000, 5, 12, 'P2')
ON CONFLICT (id) DO NOTHING;

INSERT INTO __diag_symptom_cause_link (id, symptom_id, cause_id, relative_score, evidence_for, evidence_against, requires_verification, active) VALUES
  (136, 66, 60, 70, ARRAY['Craquement sur rapport précis', 'Pire à froid'], ARRAY[]::text[], true, true),
  (137, 66, 58, 20, ARRAY['Vibration associée au passage'], ARRAY[]::text[], true, true),
  (138, 67, 59, 60, ARRAY['Graisse projetée visible', 'Soufflet déchiré'], ARRAY[]::text[], true, true),
  (139, 67, 58, 40, ARRAY['Croisillon usé, claquement sec'], ARRAY[]::text[], true, true),
  (140, 68, 58, 60, ARRAY['Vibration proportionnelle vitesse'], ARRAY[]::text[], true, true),
  (141, 68, 59, 30, ARRAY['Cardan sans graisse vibre'], ARRAY[]::text[], true, true),
  (142, 69, 61, 60, ARRAY['Ampoule vieillissante, -20-30% luminosité'], ARRAY[]::text[], true, true),
  (143, 69, 62, 35, ARRAY['Optique ternie, polycarbonate opaque'], ARRAY[]::text[], true, true),
  (144, 70, 61, 50, ARRAY['Fusible OK, ampoule grillée'], ARRAY[]::text[], true, true),
  (145, 70, 62, 30, ARRAY['Connecteur oxydé phare avant'], ARRAY[]::text[], true, true),
  (146, 70, 63, 25, ARRAY['Masse corrodée feu arrière'], ARRAY[]::text[], true, true),
  (147, 71, 61, 40, ARRAY['Qualité ampoule ou vibrations'], ARRAY[]::text[], true, true),
  (148, 71, 62, 25, ARRAY['Surtension alternateur >14.8V'], ARRAY[]::text[], true, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO __diag_safety_rule (id, system_id, rule_slug, condition_description, risk_flag, urgency, blocks_catalog, active) VALUES
  (25, 14, 'cardan_snap_risk', 'Soufflet déchiré + cardan grippé : risque de casse cardan et immobilisation', 'ATTENTION: cardan sans graisse risque de casser', 'moyenne', false, true),
  (26, 15, 'no_headlight_night_risk', 'Phare(s) HS : conduite de nuit dangereuse, non-conformité CT', 'SECURITE: éclairage insuffisant, danger de nuit', 'haute', false, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO __diag_maintenance_operation (id, slug, system_id, label, description, interval_km_min, interval_km_max, interval_months_min, interval_months_max, severity_if_overdue, normal_wear_km_min, normal_wear_km_max, related_gamme_slug, related_pg_id, active) VALUES
  (40, 'soufflet_cardan_replacement', 14, 'Remplacement soufflet cardan', 'Soufflet + regraissage, ou cardan complet si usé', 60000, 150000, 48, 144, 'high', 60000, 150000, 'soufflet-de-cardan', 193, true),
  (41, 'controle_eclairage', 15, 'Contrôle éclairage complet', 'Test tous feux, réglage phares, remplacement ampoules', 20000, 40000, 12, 24, 'moderate', 30000, 100000, 'ampoule', 1457, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO __diag_maintenance_symptom_link (id, symptom_id, operation_id, relevance, active) VALUES
  (52, 67, 40, 'primary', true), (53, 68, 40, 'related', true),
  (54, 69, 41, 'primary', true), (55, 70, 41, 'primary', true), (56, 71, 41, 'related', true)
ON CONFLICT (id) DO NOTHING;

-- ══════════════════════════════════════════════════════════════
-- FIXES: cross-system link, missing maintenance links, clim cause
-- ══════════════════════════════════════════════════════════════

-- Fix 1: Create filtre_habitacle_clim cause in climatisation (avoids cross-system link)
INSERT INTO __diag_cause (id, slug, system_id, label, cause_type, description, verification_method, urgency, active, plausible_km_min, plausible_km_max, plausible_age_min, plausible_age_max, workshop_priority)
VALUES (64, 'filtre_habitacle_clim', 13, 'Filtre habitacle saturé (clim)', 'wear', 'Pollen, poussière, bactéries accumulées sur le filtre habitacle', 'Inspection visuelle, test débit ventilation', 'basse', true, 15000, 30000, 12, 18, 'P3')
ON CONFLICT (id) DO NOTHING;

-- Fix 2: Repoint link 134 to same-system cause 64 (was cross-system: cause 49 in filtration)
UPDATE __diag_symptom_cause_link SET cause_id = 64 WHERE id = 134 AND cause_id = 49;

-- Fix 3: Add missing maintenance-symptom links (14 previously orphan symptoms)
INSERT INTO __diag_maintenance_symptom_link (id, symptom_id, operation_id, relevance, active) VALUES
  (57, 2, 1, 'primary', true),   -- brake_noise_grinding → plaquettes
  (58, 2, 2, 'related', true),   -- brake_noise_grinding → disques
  (59, 8, 8, 'primary', true),   -- start_cranks_no_fire → bougies préchauffage
  (60, 8, 5, 'related', true),   -- start_cranks_no_fire → batterie
  (61, 35, 26, 'related', true), -- pedale_embrayage_dure → kit embrayage
  (62, 36, 26, 'related', true), -- pedale_molle_spongieuse → kit embrayage
  (63, 42, 28, 'related', true), -- usure_pneus_anormale → amortisseurs
  (64, 44, 28, 'primary', true), -- vehicule_affaisse → amortisseurs
  (65, 47, 30, 'related', true), -- jeu_volant → pompe DA
  (66, 49, 30, 'primary', true), -- fuite_liquide_da → pompe DA
  (67, 51, 31, 'primary', true), -- fumee_anormale → controle echappement
  (68, 53, 31, 'primary', true), -- odeur_gaz_habitacle → controle echappement
  (69, 61, 37, 'primary', true), -- fumee_noire_injection → injecteurs
  (70, 62, 37, 'primary', true), -- perte_puissance_injection → injecteurs
  (71, 64, 38, 'related', true), -- bruit_compresseur_clim → recharge clim
  (72, 66, 40, 'related', true)  -- craquement_passage_vitesse → soufflet cardan
ON CONFLICT (id) DO NOTHING;
