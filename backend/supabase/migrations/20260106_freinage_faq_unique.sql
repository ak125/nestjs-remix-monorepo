-- =============================================================================
-- CORRECTION CANNIBALISATION FAQ FREINAGE (14 gammes)
-- Personnaliser les questions avec le nom de chaque pièce
-- Enrichir symptoms avec 5+ catégories
-- =============================================================================

-- Plaquettes de frein (ID 402)
UPDATE __seo_gamme_purchase_guide SET
  sgpg_faq = '[
    {"question": "Plaquettes OE ou adaptables : que choisir ?", "answer": "Les plaquettes OE garantissent la compatibilité constructeur. Les adaptables (Brembo, Ferodo, TRW) offrent souvent un meilleur rapport qualité/prix avec des performances équivalentes voire supérieures."},
    {"question": "Comment savoir si mes plaquettes sont usées ?", "answer": "Témoin sonore métallique au freinage, voyant frein au tableau de bord, épaisseur inférieure à 3mm visible à travers la jante, distances de freinage allongées."},
    {"question": "Tous les combien changer les plaquettes ?", "answer": "Entre 20 000 et 50 000 km selon la conduite. Plus tôt en ville (freinages fréquents), plus tard sur autoroute. Vérifiez à chaque révision."},
    {"question": "Peut-on changer ses plaquettes soi-même ?", "answer": "Oui, opération accessible avec cric, clé et repousse-piston. Comptez 30 min par essieu. Attention à ne pas ouvrir le circuit hydraulique."},
    {"question": "Quelle erreur éviter avec les plaquettes ?", "answer": "Ne jamais graisser la surface de friction. Nettoyer les coulisseaux d étrier. Respecter le rodage : éviter les freinages violents les 200 premiers km."}
  ]'::jsonb,
  sgpg_symptoms = ARRAY[
    'Sifflement métallique au freinage (témoin d usure)',
    'Voyant frein allumé au tableau de bord',
    'Épaisseur visible inférieure à 3mm à travers la jante',
    'Distances de freinage allongées',
    'Pédale de frein qui s enfonce plus que d habitude',
    'Plus de 30 000 km depuis le dernier changement'
  ],
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '402';

-- Disques de frein (ID 82)
UPDATE __seo_gamme_purchase_guide SET
  sgpg_faq = '[
    {"question": "Disque ventilé ou plein : lequel choisir ?", "answer": "Ventilé à l avant (dissipe mieux la chaleur lors de freinages répétés), plein à l arrière (suffisant pour la charge). Respectez toujours le montage d origine."},
    {"question": "Comment savoir si mes disques sont voilés ?", "answer": "Vibrations dans le volant au freinage, usure asymétrique des plaquettes, sillon circulaire visible ou bord en relief (lèvre d usure)."},
    {"question": "Tous les combien changer les disques ?", "answer": "Entre 60 000 et 80 000 km en moyenne. Vérifiez l épaisseur minimale gravée sur le disque. Changez-les avec les plaquettes si usés."},
    {"question": "Peut-on rectifier un disque voilé ?", "answer": "Techniquement oui, mais rarement rentable. Le disque rectifié sera plus fin et chauffera plus vite. Préférez le remplacement."},
    {"question": "Quelle erreur éviter avec les disques ?", "answer": "Ne montez jamais de disques de qualité inférieure à l origine. Changez toujours plaquettes et disques ensemble si les disques sont usés."}
  ]'::jsonb,
  sgpg_symptoms = ARRAY[
    'Vibrations dans le volant au freinage',
    'Sillon circulaire visible sur la surface du disque',
    'Bord du disque en relief (lèvre d usure)',
    'Crissement métallique au freinage',
    'Odeur de brûlé après freinages répétés',
    'Épaisseur sous le minimum indiqué sur le disque'
  ],
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '82';

-- Étriers de frein (ID 78)
UPDATE __seo_gamme_purchase_guide SET
  sgpg_faq = '[
    {"question": "Étrier neuf ou échange standard ?", "answer": "L échange standard est 30-50% moins cher et de qualité équivalente. Vérifiez la consigne et l état du noyau à retourner."},
    {"question": "Comment savoir si mon étrier est grippé ?", "answer": "Usure asymétrique des plaquettes (une seule usée), véhicule qui tire d un côté au freinage, roue anormalement chaude après roulage."},
    {"question": "Faut-il purger après changement d étrier ?", "answer": "Oui obligatoirement. Le circuit a été ouvert, de l air est entré. Purgez par gravité ou avec un purgeur automatique."},
    {"question": "Peut-on réparer un étrier grippé ?", "answer": "Parfois, en changeant le kit de réparation (piston + joints). Mais souvent plus rentable de remplacer l étrier complet."},
    {"question": "Quelle erreur éviter avec les étriers ?", "answer": "Ne jamais appuyer sur la pédale de frein étrier déposé (piston éjecté). Ne pas tordre le flexible. Graisser les coulisseaux."}
  ]'::jsonb,
  sgpg_symptoms = ARRAY[
    'Usure asymétrique des plaquettes (une plus usée que l autre)',
    'Véhicule qui tire d un côté au freinage',
    'Roue anormalement chaude après roulage',
    'Fuite de liquide de frein au niveau de l étrier',
    'Pédale de frein dure ou spongieuse',
    'Bruit de frottement permanent (piston grippé)'
  ],
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '78';

-- Câbles de frein à main (ID 124)
UPDATE __seo_gamme_purchase_guide SET
  sgpg_faq = '[
    {"question": "Câble OE ou adaptable : que choisir ?", "answer": "Les câbles adaptables de qualité (Cofle, TRW) sont fiables et moins chers. Vérifiez la longueur exacte et les embouts de fixation."},
    {"question": "Comment savoir si mon câble de frein à main est usé ?", "answer": "Frein à main qui ne tient plus en côte, course du levier excessive (plus de 7 clics), véhicule qui roule frein à main serré."},
    {"question": "Tous les combien changer le câble de frein à main ?", "answer": "Pas de périodicité fixe. À remplacer dès que le frein à main ne tient plus correctement malgré le réglage."},
    {"question": "Peut-on changer le câble de frein à main soi-même ?", "answer": "Oui, mais accès parfois difficile sous le véhicule. Comptez 1h à 2h. Pensez à régler la tension après montage."},
    {"question": "Quelle erreur éviter avec le câble de frein à main ?", "answer": "Ne pas trop tendre le câble neuf (usure prématurée). Graisser la gaine si elle coulisse mal. Vérifier aussi l état des mâchoires."}
  ]'::jsonb,
  sgpg_symptoms = ARRAY[
    'Frein à main qui ne tient plus en côte',
    'Course du levier excessive (plus de 7 clics)',
    'Véhicule qui roule alors que le frein à main est serré',
    'Câble visible effiloché ou rouillé',
    'Bruit de frottement à l arrière en roulant',
    'Levier de frein à main mou ou sans résistance'
  ],
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '124';

-- Mâchoires de frein (ID 70)
UPDATE __seo_gamme_purchase_guide SET
  sgpg_faq = '[
    {"question": "Mâchoires OE ou adaptables : que choisir ?", "answer": "Les mâchoires adaptables (TRW, Bosch, Valeo) offrent d excellentes performances. Vérifiez le diamètre du tambour et la largeur des garnitures."},
    {"question": "Comment savoir si mes mâchoires sont usées ?", "answer": "Frein à main inefficace, bruit de frottement métallique à l arrière, tambour rayé à l intérieur, épaisseur de garniture inférieure à 2mm."},
    {"question": "Tous les combien changer les mâchoires ?", "answer": "Entre 80 000 et 120 000 km en moyenne. Elles durent plus longtemps que les plaquettes car sollicitées uniquement à l arrière."},
    {"question": "Peut-on changer ses mâchoires soi-même ?", "answer": "Oui mais plus technique que les plaquettes. Il faut déposer le tambour et les ressorts. Comptez 1h par côté. Attention au remontage."},
    {"question": "Quelle erreur éviter avec les mâchoires ?", "answer": "Ne pas toucher les garnitures avec des mains grasses. Vérifier l état des cylindres de roue. Toujours changer par paire (essieu)."}
  ]'::jsonb,
  sgpg_symptoms = ARRAY[
    'Frein à main qui ne tient plus ou mal',
    'Bruit de frottement métallique à l arrière',
    'Tambour rayé ou strié à l intérieur',
    'Épaisseur de garniture inférieure à 2mm',
    'Freinage arrière déséquilibré (tire d un côté)',
    'Poussière de frein noire excessive sur les jantes arrière'
  ],
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '70';

-- Flexibles de frein (ID 83)
UPDATE __seo_gamme_purchase_guide SET
  sgpg_faq = '[
    {"question": "Flexible OE ou renforcé : que choisir ?", "answer": "Les flexibles OE suffisent pour un usage normal. Les flexibles renforcés (aviation/tressés) offrent une meilleure sensation de pédale pour une conduite sportive."},
    {"question": "Comment savoir si mon flexible de frein est HS ?", "answer": "Craquelures visibles sur le caoutchouc, gonflement du flexible au freinage, fuite de liquide, pédale de frein spongieuse."},
    {"question": "Tous les combien changer les flexibles de frein ?", "answer": "Tous les 10 ans ou 150 000 km recommandé. Le caoutchouc vieillit même sans rouler. Contrôle visuel à chaque révision."},
    {"question": "Peut-on changer un flexible de frein soi-même ?", "answer": "Oui, mais nécessite de purger le circuit après. Attention à ne pas vriller le flexible au montage. Utilisez une clé à tuyauter."},
    {"question": "Quelle erreur éviter avec les flexibles ?", "answer": "Ne jamais plier ou tordre un flexible. Ne pas utiliser de pince étau pour le pincer. Vérifier que le flexible ne frotte pas sur la roue en braquant."}
  ]'::jsonb,
  sgpg_symptoms = ARRAY[
    'Craquelures ou fissures visibles sur le flexible',
    'Gonflement du flexible lors d un appui sur la pédale',
    'Fuite de liquide de frein au niveau du flexible',
    'Pédale de frein spongieuse ou molle',
    'Freinage qui tire d un côté (flexible bouché)',
    'Flexible qui frotte contre la roue en braquant'
  ],
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '83';

-- Tambours de frein (ID 123)
UPDATE __seo_gamme_purchase_guide SET
  sgpg_faq = '[
    {"question": "Tambour OE ou adaptable : que choisir ?", "answer": "Les tambours adaptables de qualité (TRW, Brembo) sont fiables et économiques. Vérifiez le diamètre intérieur exact et le nombre de trous."},
    {"question": "Comment savoir si mon tambour est usé ?", "answer": "Rainures profondes à l intérieur du tambour, diamètre intérieur au-delà du maximum (gravé sur le tambour), freinage arrière bruyant."},
    {"question": "Tous les combien changer les tambours ?", "answer": "Entre 100 000 et 150 000 km. Ils s usent moins vite que les disques car moins sollicités. Vérifiez le diamètre à chaque changement de mâchoires."},
    {"question": "Peut-on rectifier un tambour ?", "answer": "Oui si le diamètre reste sous le maximum autorisé. Mais la rectification coûte souvent presque autant qu un tambour neuf."},
    {"question": "Quelle erreur éviter avec les tambours ?", "answer": "Ne pas forcer pour déposer un tambour grippé (utiliser un extracteur). Nettoyer la poussière de frein (nocive). Changer par paire."}
  ]'::jsonb,
  sgpg_symptoms = ARRAY[
    'Rainures profondes visibles à l intérieur du tambour',
    'Diamètre intérieur au-delà du maximum gravé',
    'Bruit de frottement ou crissement à l arrière',
    'Tambour ovalisé (vibrations au freinage arrière)',
    'Traces de surchauffe (bleuissement du métal)',
    'Frein à main inefficace malgré mâchoires neuves'
  ],
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '123';

-- Maîtres-cylindres de frein (ID 258)
UPDATE __seo_gamme_purchase_guide SET
  sgpg_faq = '[
    {"question": "Maître-cylindre neuf ou échange standard ?", "answer": "L échange standard est 30-40% moins cher. Qualité équivalente au neuf si le reconditionnement est fait par un spécialiste."},
    {"question": "Comment savoir si mon maître-cylindre est HS ?", "answer": "Pédale de frein qui s enfonce lentement au feu rouge, niveau de liquide qui baisse sans fuite visible, pédale molle après purge."},
    {"question": "Tous les combien changer le maître-cylindre ?", "answer": "Pas de périodicité fixe. C est une pièce durable (souvent plus de 200 000 km). À remplacer en cas de fuite interne ou défaillance."},
    {"question": "Peut-on changer le maître-cylindre soi-même ?", "answer": "Oui mais technique. Il faut purger tout le circuit après. Réglage de la garde de pédale parfois nécessaire. Comptez 2h."},
    {"question": "Quelle erreur éviter avec le maître-cylindre ?", "answer": "Ne jamais rouler avec une pédale qui s enfonce (danger). Purger dans le bon ordre (roue la plus éloignée en premier). Utiliser du liquide de frein neuf."}
  ]'::jsonb,
  sgpg_symptoms = ARRAY[
    'Pédale de frein qui s enfonce lentement à l arrêt',
    'Niveau de liquide qui baisse sans fuite visible extérieure',
    'Pédale de frein molle malgré une purge récente',
    'Liquide de frein qui fuit dans l habitacle (servo)',
    'Perte de freinage progressive sur un circuit',
    'Voyant niveau liquide de frein allumé'
  ],
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '258';

-- Agrégats ABS (ID 415)
UPDATE __seo_gamme_purchase_guide SET
  sgpg_faq = '[
    {"question": "Bloc ABS neuf ou reconditionné ?", "answer": "Le reconditionné est 50-70% moins cher. Choisissez un spécialiste reconnu avec garantie. Le neuf est parfois indisponible sur véhicules anciens."},
    {"question": "Comment savoir si mon bloc ABS est défaillant ?", "answer": "Voyant ABS allumé en permanence, ABS qui ne se déclenche plus au freinage d urgence, codes défaut P ou C stockés, bruit de pompe anormal."},
    {"question": "Tous les combien changer le bloc ABS ?", "answer": "Pas de périodicité. C est une pièce électronique durable. Les pannes sont souvent liées à des soudures ou composants électroniques fatigués."},
    {"question": "Peut-on rouler avec le voyant ABS allumé ?", "answer": "Oui, le freinage classique fonctionne. Mais l ABS est désactivé : risque de blocage des roues sur sol glissant. À réparer rapidement."},
    {"question": "Quelle erreur éviter avec le bloc ABS ?", "answer": "Ne pas débrancher le bloc moteur tournant. Éviter les courts-circuits lors du diagnostic. Faire une purge ABS après remplacement (outil requis)."}
  ]'::jsonb,
  sgpg_symptoms = ARRAY[
    'Voyant ABS allumé en permanence au tableau de bord',
    'ABS qui ne se déclenche plus au freinage d urgence',
    'Bruit de pompe ABS anormal ou continu',
    'Codes défaut ABS stockés (P ou C)',
    'Pédale de frein qui pulse sans raison',
    'ESP ou contrôle de stabilité désactivé'
  ],
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '415';

-- Témoins d usure de frein (ID 407)
UPDATE __seo_gamme_purchase_guide SET
  sgpg_faq = '[
    {"question": "Témoin d usure électrique ou acoustique ?", "answer": "Électrique : voyant au tableau de bord. Acoustique : languette métallique qui siffle. Les deux indiquent qu il faut changer les plaquettes."},
    {"question": "Comment savoir si mon témoin d usure est HS ?", "answer": "Voyant frein allumé en permanence même avec plaquettes neuves, ou au contraire pas de voyant alors que les plaquettes sont usées."},
    {"question": "Faut-il changer le témoin à chaque changement de plaquettes ?", "answer": "Oui pour les témoins électriques (usage unique). Le témoin acoustique est intégré à la plaquette et change avec elle."},
    {"question": "Peut-on rouler avec le voyant d usure allumé ?", "answer": "Sur quelques centaines de km maximum. Le voyant s allume quand il reste environ 2-3mm de garniture. Ne pas tarder à changer."},
    {"question": "Quelle erreur éviter avec les témoins d usure ?", "answer": "Ne pas oublier de brancher le connecteur après changement de plaquettes. Vérifier que le câble ne frotte pas sur le disque."}
  ]'::jsonb,
  sgpg_symptoms = ARRAY[
    'Voyant usure frein allumé au tableau de bord',
    'Sifflement métallique au freinage (témoin acoustique)',
    'Voyant allumé en permanence même plaquettes neuves',
    'Connecteur du témoin débranché ou coupé',
    'Fil du témoin fondu (frottement sur disque)',
    'Pas de voyant alors que plaquettes visiblement usées'
  ],
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '407';

-- Kits de freins arrière complets (ID 3859)
UPDATE __seo_gamme_purchase_guide SET
  sgpg_faq = '[
    {"question": "Kit complet ou pièces séparées : que choisir ?", "answer": "Le kit complet est souvent 15-20% moins cher que les pièces séparées. Il garantit la compatibilité entre mâchoires, cylindres et ressorts."},
    {"question": "Comment savoir si je dois changer tout le kit arrière ?", "answer": "Frein à main inefficace, freinage arrière bruyant, fuite de cylindre de roue, ressorts cassés ou détendus visibles."},
    {"question": "Tous les combien changer le kit de frein arrière ?", "answer": "Entre 80 000 et 120 000 km. Profitez du changement de mâchoires pour inspecter cylindres et ressorts. Changez le kit si douteux."},
    {"question": "Peut-on changer le kit de frein arrière soi-même ?", "answer": "Oui mais technique. Dépose du tambour, des ressorts, des mâchoires et cylindres. Comptez 2h par côté. Photos avant démontage conseillées."},
    {"question": "Quelle erreur éviter avec le kit de frein arrière ?", "answer": "Ne pas mélanger pièces de différents kits. Respecter le sens de montage des mâchoires (primaire/secondaire). Purger après si cylindres changés."}
  ]'::jsonb,
  sgpg_symptoms = ARRAY[
    'Frein à main qui ne tient plus correctement',
    'Freinage arrière bruyant ou qui grince',
    'Fuite de liquide au niveau des roues arrière',
    'Ressorts de rappel cassés ou détendus',
    'Freinage arrière déséquilibré',
    'Mâchoires usées jusqu au métal'
  ],
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '3859';

-- Cylindres de roue (ID 277)
UPDATE __seo_gamme_purchase_guide SET
  sgpg_faq = '[
    {"question": "Cylindre de roue neuf ou kit réparation ?", "answer": "Le cylindre neuf est plus fiable. Le kit réparation (pistons + joints) convient si le corps du cylindre n est pas rayé ou corrodé."},
    {"question": "Comment savoir si mon cylindre de roue fuit ?", "answer": "Traces de liquide sur le dos des mâchoires, intérieur du tambour mouillé, niveau de liquide qui baisse, mâchoire d un côté plus usée."},
    {"question": "Tous les combien changer les cylindres de roue ?", "answer": "Pas de périodicité fixe. À remplacer dès qu une fuite apparaît. Contrôle visuel à chaque changement de mâchoires."},
    {"question": "Peut-on changer un cylindre de roue soi-même ?", "answer": "Oui. Dépose du tambour et des mâchoires nécessaire. Purge obligatoire après. Comptez 1h par côté."},
    {"question": "Quelle erreur éviter avec les cylindres de roue ?", "answer": "Ne pas rouler avec un cylindre qui fuit (liquide sur garnitures = perte de freinage). Changer par paire recommandé. Purger correctement."}
  ]'::jsonb,
  sgpg_symptoms = ARRAY[
    'Traces de liquide sur le dos des mâchoires',
    'Intérieur du tambour mouillé ou gras',
    'Niveau de liquide de frein qui baisse',
    'Freinage arrière déséquilibré',
    'Mâchoires usées de façon asymétrique',
    'Fuite visible au niveau du cylindre'
  ],
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '277';

-- Capteurs ABS (ID 412)
UPDATE __seo_gamme_purchase_guide SET
  sgpg_faq = '[
    {"question": "Capteur ABS OE ou adaptable ?", "answer": "Les capteurs adaptables de qualité fonctionnent très bien. Vérifiez la longueur du câble et le type de connecteur (2 ou 3 broches)."},
    {"question": "Comment savoir si mon capteur ABS est HS ?", "answer": "Voyant ABS allumé, code défaut capteur spécifique à une roue, capteur visible endommagé ou câble coupé."},
    {"question": "Tous les combien changer les capteurs ABS ?", "answer": "Pas de périodicité. C est une pièce durable. Remplacez uniquement en cas de défaillance confirmée par diagnostic."},
    {"question": "Peut-on changer un capteur ABS soi-même ?", "answer": "Oui, opération simple. Débrancher le connecteur, dévisser le capteur, nettoyer le logement, monter le neuf. Effacer le défaut après."},
    {"question": "Quelle erreur éviter avec les capteurs ABS ?", "answer": "Ne pas forcer si le capteur est grippé (risque de casse). Nettoyer la cible (roue dentée). Respecter l entrefer si réglable."}
  ]'::jsonb,
  sgpg_symptoms = ARRAY[
    'Voyant ABS allumé au tableau de bord',
    'Code défaut spécifique à une roue (ex: capteur AV gauche)',
    'Capteur visible endommagé ou couvert de crasse',
    'Câble du capteur coupé ou dénudé',
    'ABS qui se déclenche à basse vitesse sans raison',
    'Cible ABS (roue dentée) endommagée ou encrassée'
  ],
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '412';

-- Interrupteurs de feux stop (ID 806)
UPDATE __seo_gamme_purchase_guide SET
  sgpg_faq = '[
    {"question": "Interrupteur feux stop OE ou adaptable ?", "answer": "Les interrupteurs adaptables fonctionnent bien pour un usage standard. L OE est recommandé sur véhicules récents avec fonctions multiples (ESP, régulateur)."},
    {"question": "Comment savoir si mon interrupteur de feux stop est HS ?", "answer": "Feux stop qui restent allumés en permanence, ou qui ne s allument plus du tout. Le régulateur de vitesse peut aussi ne plus fonctionner."},
    {"question": "Peut-on tester l interrupteur de feux stop ?", "answer": "Oui avec un multimètre. Vérifiez la continuité quand la pédale est enfoncée. Ou observez les feux stop pendant qu un assistant appuie sur la pédale."},
    {"question": "Peut-on changer l interrupteur de feux stop soi-même ?", "answer": "Oui, très simple. Accès sous le tableau de bord, derrière la pédale de frein. Quart de tour pour déverrouiller. 10 minutes suffisent."},
    {"question": "Quelle erreur éviter avec l interrupteur de feux stop ?", "answer": "Vérifier le réglage après montage (feux doivent s allumer dès le début de course pédale). Attention au sens de montage sur certains modèles."}
  ]'::jsonb,
  sgpg_symptoms = ARRAY[
    'Feux stop qui restent allumés moteur éteint',
    'Feux stop qui ne s allument plus du tout',
    'Régulateur de vitesse qui ne fonctionne plus',
    'Message d erreur système ESP au tableau de bord',
    'Batterie qui se décharge (feux stop restés allumés)',
    'Boîte automatique bloquée en position P'
  ],
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '806';

-- =============================================================================
-- DIFFÉRENCIATION ARG4 (éviter les doublons "Changez par essieu/paire")
-- =============================================================================

-- Plaquettes (402) - Déjà OK, garde "Changez par essieu"
-- Disques (82) - Différencier
UPDATE __seo_gamme_purchase_guide SET
  sgpg_arg4_title = 'Qualité certifiée',
  sgpg_arg4_content = 'Disques de marques premium (Brembo, TRW, Bosch) avec certification ECE R90 pour une sécurité maximale.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '82' AND sgpg_arg4_title LIKE '%paire%';

-- Mâchoires (70) - Différencier
UPDATE __seo_gamme_purchase_guide SET
  sgpg_arg4_title = 'Longue durée de vie',
  sgpg_arg4_content = 'Les mâchoires arrière durent 2 fois plus longtemps que les plaquettes avant. Un investissement durable.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '70' AND sgpg_arg4_title LIKE '%essieu%';

-- Tambours (123) - Différencier
UPDATE __seo_gamme_purchase_guide SET
  sgpg_arg4_title = 'Robustesse éprouvée',
  sgpg_arg4_content = 'Tambours en fonte de qualité, résistants à la chaleur et à l usure pour plus de 100 000 km.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '123' AND sgpg_arg4_title LIKE '%paire%';

-- Cylindres de roue (277) - Différencier
UPDATE __seo_gamme_purchase_guide SET
  sgpg_arg4_title = 'Étanchéité garantie',
  sgpg_arg4_content = 'Cylindres avec joints de qualité pour une étanchéité parfaite et un freinage arrière fiable.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '277' AND sgpg_arg4_title LIKE '%paire%';

-- =============================================================================
-- VÉRIFICATION POST-MIGRATION
-- =============================================================================
-- Après exécution, lancer:
-- python3 scripts/seo_audit.py audit --famille "Freinage"
-- Attendu: 0 FAQ dupliquées, 14/14 gammes OK
